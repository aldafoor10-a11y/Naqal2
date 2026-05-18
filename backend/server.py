"""
NAQAL GO - Backend Server
A premium transportation marketplace for Mosul, Iraq.
"""

import os
import uuid
import logging
import math
import random
import string
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# -------------------------------------------------------------------
# Setup
# -------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "naqalgo")
JWT_SECRET = os.environ.get("JWT_SECRET", "naqal-go-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="NAQAL GO API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("naqalgo")


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def make_id() -> str:
    return str(uuid.uuid4())


def make_order_number() -> str:
    ts = now_utc().strftime("%y%m%d")
    rand = "".join(random.choices(string.digits, k=4))
    return f"NG{ts}{rand}"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def create_jwt(user_id: str, user_type: str) -> str:
    payload = {
        "sub": user_id,
        "user_type": user_type,
        "exp": now_utc() + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    token = authorization[7:]
    payload = decode_jwt(token)
    user_id = payload.get("sub")
    user_type = payload.get("user_type")
    if user_type == "admin":
        admin = await db.admins.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        admin["user_type"] = "admin"
        return admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def normalize_phone(phone: str) -> str:
    """Normalize Iraqi phone numbers to +964 format."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("00964"):
        phone = "+964" + phone[5:]
    elif phone.startswith("964"):
        phone = "+" + phone
    elif phone.startswith("0"):
        phone = "+964" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+964" + phone
    return phone


# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------
class Location(BaseModel):
    address: str
    latitude: float
    longitude: float


class SendOtpRequest(BaseModel):
    phone: str


class VerifyOtpRequest(BaseModel):
    phone: str
    code: str


class RegisterRequest(BaseModel):
    name: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class PriceEstimateRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    vehicle_type: Literal["kia_pickup", "pickup_truck", "medium_truck", "large_truck"] = "kia_pickup"
    service_type: Optional[str] = None


class CreateOrderRequest(BaseModel):
    service_type: Literal["furniture", "goods", "appliances", "special"]
    pickup: Location
    dropoff: Location
    vehicle_type: Literal["kia_pickup", "pickup_truck", "medium_truck", "large_truck"]
    cargo_description: str
    cargo_notes: Optional[str] = ""
    cargo_images: Optional[List[str]] = []  # base64
    scheduled_at: Optional[str] = None


# -------------------------------------------------------------------
# Pricing Engine
# -------------------------------------------------------------------
PRICING = {
    "min_price": 5000,
    "tiers": [
        # (max_km, fixed_or_rate, type)
        (3, 7000, "fixed"),
        (10, 1800, "per_km"),
        (25, 1400, "per_km"),
        (10_000, 1000, "per_km"),
    ],
    "vehicle_multiplier": {
        "kia_pickup": 1.00,
        "pickup_truck": 1.10,
        "medium_truck": 1.20,
        "large_truck": 1.35,
    },
    "peak_hours": [(7, 9), (17, 20)],  # local time in 24h
    "peak_multiplier": 1.15,
    # Long-distance policy
    "max_auto_price": 75000,          # cap for automatic pricing (IQD)
    "auto_cap_distance_km": 75,       # at and above this distance, final price is capped
    "manual_review_distance_km": 130, # above this, manager must set the price manually
}

VEHICLE_RECOMMENDATION = {
    "furniture": "pickup_truck",
    "goods": "kia_pickup",
    "appliances": "kia_pickup",
    "special": "medium_truck",
}


def estimate_distance_minutes(distance_km: float) -> int:
    """Rough ETA based on urban avg speed of 30 km/h plus 5 min pickup."""
    return max(5, int((distance_km / 30) * 60) + 5)


def calculate_price(distance_km: float, vehicle_type: str) -> dict:
    # Determine base by tier
    remaining = distance_km
    total = 0.0
    breakdown = []

    if remaining <= 3:
        total = PRICING["tiers"][0][1]
        breakdown.append({"label": "first_3km_fixed", "amount": total})
    else:
        # First 3km: fixed
        total = PRICING["tiers"][0][1]
        breakdown.append({"label": "first_3km_fixed", "amount": PRICING["tiers"][0][1]})
        remaining -= 3
        # 3-10km
        if remaining > 0:
            seg = min(remaining, 7)  # 10 - 3 = 7
            cost = seg * PRICING["tiers"][1][1]
            total += cost
            breakdown.append({"label": "3-10km", "km": seg, "rate": PRICING["tiers"][1][1], "amount": cost})
            remaining -= seg
        # 10-25km
        if remaining > 0:
            seg = min(remaining, 15)  # 25 - 10 = 15
            cost = seg * PRICING["tiers"][2][1]
            total += cost
            breakdown.append({"label": "10-25km", "km": seg, "rate": PRICING["tiers"][2][1], "amount": cost})
            remaining -= seg
        # 25+
        if remaining > 0:
            cost = remaining * PRICING["tiers"][3][1]
            total += cost
            breakdown.append({"label": "25+km", "km": remaining, "rate": PRICING["tiers"][3][1], "amount": cost})

    base = max(PRICING["min_price"], total)

    # Vehicle multiplier
    vmult = PRICING["vehicle_multiplier"].get(vehicle_type, 1.0)
    after_vehicle = base * vmult

    # Peak multiplier
    hour = now_utc().hour + 3  # Iraq UTC+3
    if hour >= 24:
        hour -= 24
    is_peak = any(start <= hour < end for start, end in PRICING["peak_hours"])
    final = after_vehicle * (PRICING["peak_multiplier"] if is_peak else 1.0)

    # Round to nearest 500
    final = int(round(final / 500.0) * 500)

    # Long-distance cap: at and above 75km, total price stops increasing.
    capped = False
    if distance_km >= PRICING["auto_cap_distance_km"] and final > PRICING["max_auto_price"]:
        final = PRICING["max_auto_price"]
        capped = True

    return {
        "base_price": int(base),
        "vehicle_multiplier": vmult,
        "is_peak": is_peak,
        "peak_multiplier": PRICING["peak_multiplier"] if is_peak else 1.0,
        "final_price": final,
        "is_capped": capped,
        "currency": "IQD",
        "breakdown": breakdown,
    }


# -------------------------------------------------------------------
# OTP Storage (in-memory, mock - accepts "123456" universally)
# -------------------------------------------------------------------
MOCK_OTP = "123456"


# -------------------------------------------------------------------
# Auth Routes
# -------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "NAQAL GO", "status": "ok", "version": "1.0.0"}


@api.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@api.post("/auth/send-otp")
async def send_otp(req: SendOtpRequest):
    phone = normalize_phone(req.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # Generate code: random when Twilio is active, fixed mock otherwise.
    code = _generate_otp_code() if TWILIO_ENABLED else MOCK_OTP

    await db.otp_sessions.update_one(
        {"phone": phone},
        {
            "$set": {
                "phone": phone,
                "code": code,
                "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
                "attempts": 0,
                "sent_at": now_utc().isoformat(),
            }
        },
        upsert=True,
    )

    sms_sent = await _send_otp_sms(phone, code)
    if TWILIO_ENABLED and not sms_sent:
        # Real SMS failed — surface error to caller.
        raise HTTPException(status_code=502, detail="Could not send verification SMS")

    if not TWILIO_ENABLED:
        logger.info(f"[MOCK OTP] Sent to {phone} (code: {code})")

    response = {"success": True, "message": "OTP sent", "phone": phone}
    # Only expose code in mock mode for developer convenience
    if not TWILIO_ENABLED:
        response["mock_code"] = code
    return response


@api.post("/auth/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    phone = normalize_phone(req.phone)
    session = await db.otp_sessions.find_one({"phone": phone}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=400, detail="No OTP session found. Request a new code.")

    # Accept either the session's actual code OR the literal mock code when Twilio is off.
    valid_code = req.code == session.get("code") or (
        not TWILIO_ENABLED and req.code == MOCK_OTP
    )
    if not valid_code:
        await db.otp_sessions.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Look up user. Drivers are pre-created by admin — they may or may not be approved.
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    is_new = False
    if not user:
        # No pre-existing user — auto-create as CUSTOMER only.
        # Drivers cannot register themselves.
        is_new = True
        user = {
            "id": make_id(),
            "phone": phone,
            "name": "",
            "user_type": "customer",
            "profile_image": None,
            "rating": 5.0,
            "total_orders": 0,
            "is_verified": True,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user.copy())
        user.pop("_id", None)
    else:
        # Existing driver: ensure they are approved & active.
        if user.get("user_type") == "driver" and not user.get("is_approved", False):
            raise HTTPException(
                status_code=403,
                detail="حساب السائق لم تتم الموافقة عليه من قبل الإدارة بعد",
            )

    # Cleanup OTP session
    await db.otp_sessions.delete_one({"phone": phone})

    token = create_jwt(user["id"], user.get("user_type", "customer"))
    return {
        "success": True,
        "is_new_user": is_new,
        "needs_name": is_new or not user.get("name"),
        "user_type": user.get("user_type", "customer"),
        "token": token,
        "user": user,
    }


@api.put("/auth/profile")
async def update_profile(req: RegisterRequest, current_user: dict = Depends(get_current_user)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"name": req.name.strip(), "updated_at": now_utc().isoformat()}},
    )
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {"success": True, "user": user}


@api.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@api.post("/auth/admin/login")
async def admin_login(req: AdminLoginRequest):
    admin = await db.admins.find_one({"username": req.username.lower()})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(req.password.encode("utf-8"), admin["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(admin["id"], "admin")
    return {
        "success": True,
        "token": token,
        "admin": {"id": admin["id"], "username": admin["username"], "user_type": "admin"},
    }


# -------------------------------------------------------------------
# Pricing Routes
# -------------------------------------------------------------------
@api.post("/pricing/estimate")
async def pricing_estimate(req: PriceEstimateRequest):
    distance = haversine_km(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    # Add 20% for road network factor
    road_distance = distance * 1.2
    eta_min = estimate_distance_minutes(road_distance)
    recommended = VEHICLE_RECOMMENDATION.get(req.service_type or "", "kia_pickup")

    # Long-distance: requires manual manager approval. Don't compute an automatic price.
    if road_distance > PRICING["manual_review_distance_km"]:
        return {
            "distance_km": round(road_distance, 2),
            "straight_km": round(distance, 2),
            "eta_minutes": eta_min,
            "vehicle_type": req.vehicle_type,
            "recommended_vehicle": recommended,
            "requires_manual_pricing": True,
            "manual_review_threshold_km": PRICING["manual_review_distance_km"],
            "final_price": None,
            "is_capped": False,
            "currency": "IQD",
            "message": "Long-distance orders above 130 KM require manual pricing approval from management.",
        }

    price = calculate_price(road_distance, req.vehicle_type)
    return {
        "distance_km": round(road_distance, 2),
        "straight_km": round(distance, 2),
        "eta_minutes": eta_min,
        "vehicle_type": req.vehicle_type,
        "recommended_vehicle": recommended,
        "requires_manual_pricing": False,
        **price,
    }


@api.get("/pricing/config")
async def pricing_config():
    return {
        "min_price": PRICING["min_price"],
        "tiers": [
            {"range": "0-3 km", "type": "fixed", "amount": 7000},
            {"range": "3-10 km", "type": "per_km", "amount": 1800},
            {"range": "10-25 km", "type": "per_km", "amount": 1400},
            {"range": "25+ km", "type": "per_km", "amount": 1000},
        ],
        "vehicle_multipliers": PRICING["vehicle_multiplier"],
        "peak_multiplier": PRICING["peak_multiplier"],
        "max_auto_price": PRICING["max_auto_price"],
        "auto_cap_distance_km": PRICING["auto_cap_distance_km"],
        "manual_review_distance_km": PRICING["manual_review_distance_km"],
        "currency": "IQD",
    }


# -------------------------------------------------------------------
# Order Routes
# -------------------------------------------------------------------
@api.post("/orders")
async def create_order(req: CreateOrderRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="Only customers can create orders")

    distance = haversine_km(
        req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude
    ) * 1.2
    eta_min = estimate_distance_minutes(distance)

    # Long-distance: requires manual manager pricing approval.
    requires_manual = distance > PRICING["manual_review_distance_km"]

    if requires_manual:
        final_price = 0
        base_price = 0
        vmult = PRICING["vehicle_multiplier"].get(req.vehicle_type, 1.0)
        peak_mult = 1.0
        is_peak = False
        is_capped = False
        status = "pending_review"
    else:
        price = calculate_price(distance, req.vehicle_type)
        final_price = price["final_price"]
        base_price = price["base_price"]
        vmult = price["vehicle_multiplier"]
        peak_mult = price["peak_multiplier"]
        is_peak = price["is_peak"]
        is_capped = price["is_capped"]
        status = "pending"

    order = {
        "id": make_id(),
        "order_number": make_order_number(),
        "customer_id": current_user["id"],
        "customer_name": current_user.get("name", ""),
        "customer_phone": current_user.get("phone", ""),
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "service_type": req.service_type,
        "vehicle_type": req.vehicle_type,
        "pickup": req.pickup.dict(),
        "dropoff": req.dropoff.dict(),
        "distance_km": round(distance, 2),
        "eta_minutes": eta_min,
        "base_price": base_price,
        "vehicle_multiplier": vmult,
        "peak_multiplier": peak_mult,
        "is_peak": is_peak,
        "is_capped": is_capped,
        "final_price": final_price,
        "requires_manual_pricing": requires_manual,
        "manual_price_set_by": None,
        "manual_price_set_at": None,
        "currency": "IQD",
        "cargo_description": req.cargo_description,
        "cargo_notes": req.cargo_notes or "",
        "cargo_images": req.cargo_images or [],
        "status": status,
        "status_history": [{"status": status, "at": now_utc().isoformat()}],
        "payment_method": "cash",
        "rating": None,
        "rating_comment": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
    }
    await db.orders.insert_one(order.copy())
    order.pop("_id", None)

    # Increment user total orders
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"total_orders": 1}})

    if requires_manual:
        logger.info(
            f"[MANUAL REVIEW] Order {order['order_number']} ({round(distance,1)}km) sent to admin for pricing approval"
        )
    return {"success": True, "order": order}


@api.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    query: dict = {}
    if current_user.get("user_type") == "customer":
        query["customer_id"] = current_user["id"]
    elif current_user.get("user_type") == "driver":
        query["driver_id"] = current_user["id"]
    if status:
        query["status"] = status
    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    orders = await cursor.to_list(length=limit)
    return {"orders": orders, "count": len(orders)}


@api.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.get("user_type") == "customer" and order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return {"order": order}


@api.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order["status"] not in ["pending", "accepted"]:
        raise HTTPException(status_code=400, detail="Cannot cancel order in current status")
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
            },
            "$push": {"status_history": {"status": "cancelled", "at": now_utc().isoformat()}},
        },
    )
    return {"success": True}


@api.post("/orders/{order_id}/rate")
async def rate_order(
    order_id: str,
    rating: int,
    comment: Optional[str] = "",
    current_user: dict = Depends(get_current_user),
):
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    order = await db.orders.find_one({"id": order_id})
    if not order or order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed orders")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"rating": rating, "rating_comment": comment, "updated_at": now_utc().isoformat()}},
    )
    return {"success": True}


# -------------------------------------------------------------------
# Driver endpoints
# -------------------------------------------------------------------
class DriverStatusRequest(BaseModel):
    is_online: bool


class DriverLocationRequest(BaseModel):
    latitude: float
    longitude: float


class DriverOrderStatusRequest(BaseModel):
    status: Literal["arriving", "picked_up", "in_transit", "completed"]


def _require_driver(user: dict) -> None:
    if user.get("user_type") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")


@api.get("/driver/profile")
async def driver_profile(current_user: dict = Depends(get_current_user)):
    _require_driver(current_user)
    return {"driver": current_user}


@api.put("/driver/status")
async def driver_set_status(
    req: DriverStatusRequest, current_user: dict = Depends(get_current_user)
):
    _require_driver(current_user)
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "is_online": req.is_online,
                "last_status_change": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
            }
        },
    )
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {"success": True, "driver": user}


@api.put("/driver/location")
async def driver_update_location(
    req: DriverLocationRequest, current_user: dict = Depends(get_current_user)
):
    _require_driver(current_user)
    loc = {"latitude": req.latitude, "longitude": req.longitude}
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "current_location": loc,
                "location_updated_at": now_utc().isoformat(),
            }
        },
    )
    # Also propagate to any active orders this driver has
    await db.orders.update_many(
        {
            "driver_id": current_user["id"],
            "status": {"$in": ["accepted", "arriving", "picked_up", "in_transit"]},
        },
        {"$set": {"driver_location": loc, "updated_at": now_utc().isoformat()}},
    )
    return {"success": True}


@api.get("/driver/orders/available")
async def driver_available_orders(current_user: dict = Depends(get_current_user)):
    _require_driver(current_user)
    if not current_user.get("is_online"):
        return {"orders": [], "count": 0}
    cursor = (
        db.orders.find({"status": "pending", "driver_id": None}, {"_id": 0})
        .sort("created_at", -1)
        .limit(30)
    )
    orders = await cursor.to_list(length=30)
    return {"orders": orders, "count": len(orders)}


@api.get("/driver/orders/active")
async def driver_active_orders(current_user: dict = Depends(get_current_user)):
    _require_driver(current_user)
    cursor = db.orders.find(
        {
            "driver_id": current_user["id"],
            "status": {"$in": ["accepted", "arriving", "picked_up", "in_transit"]},
        },
        {"_id": 0},
    ).sort("accepted_at", -1)
    orders = await cursor.to_list(length=10)
    return {"orders": orders, "count": len(orders)}


@api.get("/driver/orders/history")
async def driver_history(current_user: dict = Depends(get_current_user)):
    _require_driver(current_user)
    cursor = (
        db.orders.find(
            {"driver_id": current_user["id"], "status": {"$in": ["completed", "cancelled"]}},
            {"_id": 0},
        )
        .sort("created_at", -1)
        .limit(100)
    )
    orders = await cursor.to_list(length=100)
    return {"orders": orders, "count": len(orders)}


@api.post("/driver/orders/{order_id}/accept")
async def driver_accept_order(
    order_id: str, current_user: dict = Depends(get_current_user)
):
    _require_driver(current_user)
    if not current_user.get("is_online"):
        raise HTTPException(status_code=400, detail="يجب أن تكون متصلاً لقبول الطلبات")
    if not current_user.get("is_approved", False):
        raise HTTPException(status_code=403, detail="حساب السائق غير معتمد")

    # Atomic claim: only succeed if order still pending and unassigned
    result = await db.orders.find_one_and_update(
        {"id": order_id, "status": "pending", "driver_id": None},
        {
            "$set": {
                "driver_id": current_user["id"],
                "driver_name": current_user.get("name", ""),
                "driver_phone": current_user.get("phone", ""),
                "driver_rating": current_user.get("rating", 5.0),
                "driver_vehicle_plate": current_user.get("vehicle_plate", ""),
                "driver_vehicle_type": current_user.get("vehicle_type", ""),
                "driver_location": current_user.get("current_location"),
                "status": "accepted",
                "accepted_at": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
            },
            "$push": {"status_history": {"status": "accepted", "at": now_utc().isoformat()}},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=409, detail="الطلب لم يعد متاحاً")
    return {"success": True, "order": result}


@api.post("/driver/orders/{order_id}/reject")
async def driver_reject_order(
    order_id: str, current_user: dict = Depends(get_current_user)
):
    _require_driver(current_user)
    # Track rejection but do not change order — it stays pending for another driver
    await db.orders.update_one(
        {"id": order_id},
        {"$addToSet": {"rejected_by": current_user["id"]}},
    )
    return {"success": True}


@api.post("/driver/orders/{order_id}/status")
async def driver_update_status(
    order_id: str,
    req: DriverOrderStatusRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_driver(current_user)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")

    # Validate state transitions
    valid_next = {
        "accepted": "arriving",
        "arriving": "picked_up",
        "picked_up": "in_transit",
        "in_transit": "completed",
    }
    expected = valid_next.get(order["status"])
    if expected != req.status:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from {order['status']} to {req.status}",
        )

    update = {
        "$set": {"status": req.status, "updated_at": now_utc().isoformat()},
        "$push": {"status_history": {"status": req.status, "at": now_utc().isoformat()}},
    }
    if req.status == "picked_up":
        update["$set"]["started_at"] = now_utc().isoformat()
    if req.status == "completed":
        update["$set"]["completed_at"] = now_utc().isoformat()
        # Credit earnings to driver
        await db.users.update_one(
            {"id": current_user["id"]},
            {
                "$inc": {
                    "total_earnings": int(order.get("final_price", 0) or 0),
                    "completed_orders": 1,
                }
            },
        )

    await db.orders.update_one({"id": order_id}, update)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "order": order}


@api.get("/driver/earnings")
async def driver_earnings(current_user: dict = Depends(get_current_user)):
    _require_driver(current_user)
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    # Today's & this-week's completed trips
    today_iso = now_utc().date().isoformat()
    week_start = (now_utc() - timedelta(days=7)).isoformat()
    today_cursor = db.orders.find(
        {
            "driver_id": current_user["id"],
            "status": "completed",
            "completed_at": {"$gte": today_iso},
        },
        {"_id": 0},
    )
    today_orders = await today_cursor.to_list(length=100)
    week_cursor = db.orders.find(
        {
            "driver_id": current_user["id"],
            "status": "completed",
            "completed_at": {"$gte": week_start},
        },
        {"_id": 0},
    )
    week_orders = await week_cursor.to_list(length=200)

    today_total = sum(int(o.get("final_price", 0) or 0) for o in today_orders)
    week_total = sum(int(o.get("final_price", 0) or 0) for o in week_orders)
    return {
        "today_earnings": today_total,
        "today_trips": len(today_orders),
        "week_earnings": week_total,
        "week_trips": len(week_orders),
        "total_earnings": int(user.get("total_earnings", 0) or 0),
        "total_trips": int(user.get("completed_orders", 0) or 0),
        "rating": user.get("rating", 5.0),
    }


# -------------------------------------------------------------------
# Admin: Driver management
# -------------------------------------------------------------------
class AdminCreateDriverRequest(BaseModel):
    name: str
    phone: str
    vehicle_type: Literal["kia_pickup", "pickup_truck", "medium_truck", "large_truck"]
    vehicle_plate: str
    license_number: Optional[str] = ""


@api.post("/admin/drivers")
async def admin_create_driver(
    req: AdminCreateDriverRequest, current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    phone = normalize_phone(req.phone)
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(
            status_code=400, detail="A user with this phone number already exists"
        )
    driver = {
        "id": make_id(),
        "phone": phone,
        "name": req.name.strip(),
        "user_type": "driver",
        "vehicle_type": req.vehicle_type,
        "vehicle_plate": req.vehicle_plate.strip(),
        "license_number": req.license_number or "",
        "rating": 5.0,
        "completed_orders": 0,
        "total_earnings": 0,
        "is_verified": True,
        "is_approved": True,  # admin-created → auto-approved
        "is_active": True,
        "is_online": False,
        "current_location": None,
        "created_at": now_utc().isoformat(),
        "created_by_admin": current_user.get("username", "admin"),
    }
    await db.users.insert_one(driver.copy())
    driver.pop("_id", None)
    return {"success": True, "driver": driver}


@api.get("/admin/drivers")
async def admin_list_drivers(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    cursor = db.users.find({"user_type": "driver"}, {"_id": 0}).sort("created_at", -1)
    drivers = await cursor.to_list(length=500)
    return {"drivers": drivers, "count": len(drivers)}


@api.put("/admin/drivers/{driver_id}/toggle-approval")
async def admin_toggle_driver_approval(
    driver_id: str, current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    driver = await db.users.find_one({"id": driver_id, "user_type": "driver"})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    new_state = not driver.get("is_approved", False)
    await db.users.update_one(
        {"id": driver_id},
        {"$set": {"is_approved": new_state, "updated_at": now_utc().isoformat()}},
    )
    return {"success": True, "is_approved": new_state}


@api.delete("/admin/drivers/{driver_id}")
async def admin_delete_driver(
    driver_id: str, current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    res = await db.users.delete_one({"id": driver_id, "user_type": "driver"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"success": True}


# -------------------------------------------------------------------
# Admin endpoints (manual pricing review)
# -------------------------------------------------------------------
class SetManualPriceRequest(BaseModel):
    price: int
    note: Optional[str] = ""


def _require_admin(user: dict) -> None:
    if user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@api.get("/admin/orders/pending-review")
async def admin_list_pending_review(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    cursor = (
        db.orders.find({"status": "pending_review"}, {"_id": 0})
        .sort("created_at", -1)
        .limit(200)
    )
    orders = await cursor.to_list(length=200)
    return {"orders": orders, "count": len(orders)}


@api.get("/admin/orders")
async def admin_list_orders(
    status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    query: dict = {}
    if status:
        query["status"] = status
    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    orders = await cursor.to_list(length=limit)
    return {"orders": orders, "count": len(orders)}


@api.post("/admin/orders/{order_id}/set-price")
async def admin_set_manual_price(
    order_id: str,
    req: SetManualPriceRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    if req.price < PRICING["min_price"]:
        raise HTTPException(
            status_code=400, detail=f"Price must be at least {PRICING['min_price']} IQD"
        )
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in ("pending_review",):
        raise HTTPException(
            status_code=400, detail="Only pending_review orders can be priced manually"
        )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "final_price": req.price,
                "manual_price_set_by": current_user.get("username", "admin"),
                "manual_price_set_at": now_utc().isoformat(),
                "manual_price_note": req.note or "",
                "status": "pending",
                "updated_at": now_utc().isoformat(),
            },
            "$push": {"status_history": {"status": "pending", "at": now_utc().isoformat()}},
        },
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "order": order}


@api.post("/admin/orders/{order_id}/reject")
async def admin_reject_order(order_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
                "cancellation_reason": "Rejected by admin",
            },
            "$push": {"status_history": {"status": "cancelled", "at": now_utc().isoformat()}},
        },
    )
    return {"success": True}


# -------------------------------------------------------------------
@api.post("/orders/{order_id}/simulate-accept")
async def simulate_accept(order_id: str, current_user: dict = Depends(get_current_user)):
    """Demo endpoint to simulate a driver accepting the order."""
    order = await db.orders.find_one({"id": order_id})
    if not order or order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "pending":
        return {"success": True, "order": {k: v for k, v in order.items() if k != "_id"}}

    # Pick a random demo driver
    driver = await db.users.find_one({"user_type": "driver"}, {"_id": 0})
    if not driver:
        driver = {
            "id": "demo-driver-1",
            "name": "أحمد محمد",
            "phone": "+9647701234567",
            "rating": 4.8,
            "vehicle_plate": "موصل 12345",
        }

    pickup = order["pickup"]
    # Driver "starts" 2km away
    driver_loc = {"latitude": pickup["latitude"] + 0.02, "longitude": pickup["longitude"] + 0.02}

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "driver_id": driver["id"],
                "driver_name": driver.get("name", "Driver"),
                "driver_phone": driver.get("phone", ""),
                "driver_rating": driver.get("rating", 5.0),
                "driver_vehicle_plate": driver.get("vehicle_plate", ""),
                "driver_location": driver_loc,
                "status": "accepted",
                "accepted_at": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
            },
            "$push": {"status_history": {"status": "accepted", "at": now_utc().isoformat()}},
        },
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "order": order}


@api.post("/orders/{order_id}/simulate-progress")
async def simulate_progress(order_id: str, current_user: dict = Depends(get_current_user)):
    """Cycle order through next status for demo purposes."""
    order = await db.orders.find_one({"id": order_id})
    if not order or order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")

    next_status = {
        "accepted": "arriving",
        "arriving": "picked_up",
        "picked_up": "in_transit",
        "in_transit": "completed",
    }.get(order["status"])
    if not next_status:
        return {"success": True, "order": {k: v for k, v in order.items() if k != "_id"}}

    update = {
        "$set": {"status": next_status, "updated_at": now_utc().isoformat()},
        "$push": {"status_history": {"status": next_status, "at": now_utc().isoformat()}},
    }
    if next_status == "picked_up":
        update["$set"]["started_at"] = now_utc().isoformat()
    if next_status == "completed":
        update["$set"]["completed_at"] = now_utc().isoformat()

    await db.orders.update_one({"id": order_id}, update)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "order": order}


# -------------------------------------------------------------------
# Seeding
# -------------------------------------------------------------------
@app.on_event("startup")
async def seed_admin():
    """Seed default admin if not exists."""
    existing = await db.admins.find_one({"username": "admin"})
    if not existing:
        pw_hash = bcrypt.hashpw("naqal2026".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        await db.admins.insert_one(
            {
                "id": make_id(),
                "username": "admin",
                "password_hash": pw_hash,
                "created_at": now_utc().isoformat(),
            }
        )
        logger.info("Default admin seeded (admin / naqal2026)")

    # Seed a demo driver
    driver = await db.users.find_one({"user_type": "driver"})
    if not driver:
        await db.users.insert_one(
            {
                "id": make_id(),
                "phone": "+9647701234567",
                "name": "أحمد محمد",
                "user_type": "driver",
                "vehicle_type": "pickup_truck",
                "vehicle_plate": "موصل 12345",
                "rating": 4.8,
                "total_orders": 124,
                "is_verified": True,
                "is_approved": True,
                "is_active": True,
                "created_at": now_utc().isoformat(),
            }
        )
        logger.info("Demo driver seeded")


@app.on_event("shutdown")
async def shutdown_db():
    client.close()


# -------------------------------------------------------------------
# Register
# -------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
