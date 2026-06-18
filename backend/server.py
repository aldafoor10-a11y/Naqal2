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
import socketio
import httpx
import asyncio
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
    booking_type: Optional[Literal["now", "scheduled", "date", "time"]] = "now"
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    customer_live_location: Optional[Location] = None


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
# OTP / Twilio integration
# -------------------------------------------------------------------
MOCK_OTP = "123456"

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "").strip()
TWILIO_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER)

_twilio_client = None
if TWILIO_ENABLED:
    try:
        from twilio.rest import Client as _TwilioClient  # type: ignore
        _twilio_client = _TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio SMS enabled")
    except Exception as exc:  # pragma: no cover
        logger.error(f"Twilio init failed, falling back to mock OTP: {exc}")
        TWILIO_ENABLED = False
        _twilio_client = None


def _generate_otp_code() -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))


async def _send_otp_sms(phone: str, code: str) -> bool:
    """Send an OTP via Twilio. Returns True on success, False on failure.

    In mock mode (Twilio not configured), this is a no-op and returns True
    so the caller can proceed; the code is logged to the server console.
    """
    if not TWILIO_ENABLED or _twilio_client is None:
        return True
    try:
        body = f"NAQAL GO - رمز التحقق: {code}\nصالح لمدة 10 دقائق."
        # Twilio is synchronous; offload to threadpool to avoid blocking loop.
        import asyncio
        await asyncio.to_thread(
            _twilio_client.messages.create,
            body=body,
            from_=TWILIO_PHONE_NUMBER,
            to=phone,
        )
        return True
    except Exception as exc:
        logger.error(f"Twilio send failed for {phone}: {exc}")
        return False


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

    # Block the hidden owner phone from OTP flow — it must only be used via the
    # dedicated admin phone+password login.
    hidden_admin = await db.admins.find_one({"hidden": True})
    if hidden_admin:
        candidates = {hidden_admin.get("phone")}
        hp = hidden_admin.get("phone", "")
        if hp.startswith("0"):
            candidates.add("+964" + hp[1:])
        if hp.startswith("+964"):
            candidates.add("0" + hp[4:])
        if phone in candidates or req.phone in candidates:
            raise HTTPException(status_code=403, detail="هذا الرقم محجوز")

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


class AdminPhoneLoginRequest(BaseModel):
    phone: str
    password: str


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


@api.post("/auth/admin/phone-login")
async def admin_phone_login(req: AdminPhoneLoginRequest):
    """Hidden owner admin login via phone + password from the mobile app."""
    phone = req.phone.strip()
    # accept both with and without country code variations
    candidates = [phone]
    if phone.startswith("0"):
        candidates.append("+964" + phone[1:])
    if phone.startswith("+964"):
        candidates.append("0" + phone[4:])
    admin = await db.admins.find_one({"phone": {"$in": candidates}})
    if not admin:
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    if not bcrypt.checkpw(req.password.encode("utf-8"), admin["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    token = create_jwt(admin["id"], "admin")
    return {
        "success": True,
        "token": token,
        "user_type": "admin",
        "admin": {
            "id": admin["id"],
            "username": admin.get("username", "owner"),
            "phone": admin.get("phone"),
            "user_type": "admin",
        },
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
        # Scheduling
        "booking_type": req.booking_type or "now",
        "scheduled_date": req.scheduled_date or None,
        "scheduled_time": req.scheduled_time or None,
        "scheduled_at": req.scheduled_at or None,
        # Customer live location (for admin to see context)
        "customer_live_location": (
            req.customer_live_location.dict() if req.customer_live_location else None
        ),
        # Admin assignment
        "assigned_driver_id": None,
        "assigned_driver_name": None,
        "assigned_at": None,
        "assigned_by": None,
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

    # Push to ADMIN only - drivers no longer auto-receive. Admin must assign.
    if not requires_manual:
        try:
            await sio.emit("new_order", {"order": order}, room="admins")
        except Exception:
            pass
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
    # Propagate to any active orders this driver has + push via socket
    active_orders = await db.orders.find(
        {
            "driver_id": current_user["id"],
            "status": {"$in": ["accepted", "arriving", "picked_up", "in_transit"]},
        },
        {"_id": 0, "id": 1},
    ).to_list(length=20)
    await db.orders.update_many(
        {
            "driver_id": current_user["id"],
            "status": {"$in": ["accepted", "arriving", "picked_up", "in_transit"]},
        },
        {"$set": {"driver_location": loc, "updated_at": now_utc().isoformat()}},
    )
    payload = {
        "driver_id": current_user["id"],
        "location": loc,
        "at": now_utc().isoformat(),
    }
    for o in active_orders:
        await _emit_to_order(o["id"], "driver_location", {**payload, "order_id": o["id"]})
    return {"success": True}


@api.get("/driver/orders/available")
async def driver_available_orders(current_user: dict = Depends(get_current_user)):
    """Orders the admin has *assigned* to this driver and that he hasn't yet accepted."""
    _require_driver(current_user)
    if not current_user.get("is_online"):
        return {"orders": [], "count": 0}
    cursor = (
        db.orders.find(
            {
                "status": "assigned",
                "assigned_driver_id": current_user["id"],
                "driver_id": None,
            },
            {"_id": 0},
        )
        .sort("assigned_at", -1)
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

    # Atomic claim: only succeed if order assigned to this driver and not yet accepted
    result = await db.orders.find_one_and_update(
        {
            "id": order_id,
            "status": "assigned",
            "assigned_driver_id": current_user["id"],
            "driver_id": None,
        },
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
    await _emit_to_order(order_id, "order_update", {"order_id": order_id, "order": result})
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
    await _emit_to_order(order_id, "order_update", {"order_id": order_id, "order": order})
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

    # Block reserved owner phone in any variant
    hidden = await db.admins.find_one({"hidden": True})
    if hidden:
        reserved = {hidden.get("phone")}
        hp = hidden.get("phone", "")
        if hp.startswith("0"):
            reserved.add("+964" + hp[1:])
        if hp.startswith("+964"):
            reserved.add("0" + hp[4:])
        if phone in reserved or req.phone in reserved:
            raise HTTPException(status_code=400, detail="This phone number is reserved")

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

    # Seed hidden owner admin (mobile phone+password login).
    # IMPORTANT: this user is stored in db.admins (not db.users) so it never
    # appears in any customer/driver listing. It's looked up only via the
    # phone+password admin login endpoint.
    HIDDEN_PHONE = "07517300194"
    HIDDEN_PASSWORD = "yassir00"
    existing_hidden = await db.admins.find_one({"phone": HIDDEN_PHONE})
    if not existing_hidden:
        pw_hash = bcrypt.hashpw(HIDDEN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        await db.admins.insert_one(
            {
                "id": make_id(),
                "username": "owner",
                "phone": HIDDEN_PHONE,
                "password_hash": pw_hash,
                "hidden": True,
                "created_at": now_utc().isoformat(),
            }
        )
        logger.info("Hidden owner admin seeded (phone-based)")

    # Sanitize: remove any normal user/driver that may have leaked the reserved phone
    reserved_variants = [HIDDEN_PHONE, "+964" + HIDDEN_PHONE[1:]]
    purged = await db.users.delete_many({"phone": {"$in": reserved_variants}})
    if purged.deleted_count:
        logger.warning(f"Purged {purged.deleted_count} stale user(s) using reserved owner phone")

    # Default pricing settings (mirror of PRICING dict in /api/app_settings)
    settings = await db.app_settings.find_one({"_id": "pricing"})
    if not settings:
        await db.app_settings.insert_one(
            {
                "_id": "pricing",
                "min_price": PRICING["min_price"],
                "max_auto_price": PRICING["max_auto_price"],
                "auto_cap_distance_km": PRICING["auto_cap_distance_km"],
                "manual_review_distance_km": PRICING["manual_review_distance_km"],
                "peak_multiplier": PRICING["peak_multiplier"],
                "tiers": PRICING["tiers"],
                "vehicle_multiplier": PRICING["vehicle_multiplier"],
                "updated_at": now_utc().isoformat(),
            }
        )

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


# -------------------------------------------------------------------
# Support tickets (customer <-> admin)
# -------------------------------------------------------------------
class CreateTicketRequest(BaseModel):
    subject: str
    message: str


class AddTicketMessageRequest(BaseModel):
    message: str


class UpdateTicketStatusRequest(BaseModel):
    status: Literal["open", "pending", "resolved", "closed"]


def _ticket_actor(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "name": user.get("name") or user.get("username") or "—",
        "role": user.get("user_type", "customer"),
    }


@api.post("/support/tickets")
async def create_ticket(
    req: CreateTicketRequest, current_user: dict = Depends(get_current_user)
):
    if current_user.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="Only customers can open support tickets")
    if not req.subject.strip() or not req.message.strip():
        raise HTTPException(status_code=400, detail="Subject and message are required")
    now = now_utc().isoformat()
    ticket = {
        "id": make_id(),
        "customer_id": current_user["id"],
        "customer_name": current_user.get("name", ""),
        "customer_phone": current_user.get("phone", ""),
        "subject": req.subject.strip()[:140],
        "status": "open",
        "unread_for_customer": 0,
        "unread_for_admin": 1,
        "last_message_preview": req.message.strip()[:120],
        "last_message_at": now,
        "messages": [
            {
                "id": make_id(),
                "author": _ticket_actor(current_user),
                "text": req.message.strip(),
                "at": now,
            }
        ],
        "created_at": now,
        "updated_at": now,
    }
    await db.support_tickets.insert_one(ticket.copy())
    ticket.pop("_id", None)
    return {"success": True, "ticket": ticket}


@api.get("/support/tickets")
async def list_my_tickets(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    cursor = (
        db.support_tickets.find({"customer_id": current_user["id"]}, {"_id": 0, "messages": 0})
        .sort("last_message_at", -1)
        .limit(100)
    )
    items = await cursor.to_list(length=100)
    return {"tickets": items, "count": len(items)}


@api.get("/support/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    role = current_user.get("user_type")
    if role == "customer" and ticket["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if role not in ("customer", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    # Clear unread counter for the viewing party
    if role == "customer":
        await db.support_tickets.update_one(
            {"id": ticket_id}, {"$set": {"unread_for_customer": 0}}
        )
        ticket["unread_for_customer"] = 0
    elif role == "admin":
        await db.support_tickets.update_one(
            {"id": ticket_id}, {"$set": {"unread_for_admin": 0}}
        )
        ticket["unread_for_admin"] = 0
    return {"ticket": ticket}


@api.post("/support/tickets/{ticket_id}/messages")
async def add_ticket_message(
    ticket_id: str,
    req: AddTicketMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    text = req.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    role = current_user.get("user_type")
    if role == "customer" and ticket["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if role not in ("customer", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = now_utc().isoformat()
    msg = {
        "id": make_id(),
        "author": _ticket_actor(current_user),
        "text": text,
        "at": now,
    }
    set_fields = {
        "last_message_preview": text[:120],
        "last_message_at": now,
        "updated_at": now,
    }
    inc_fields = {}
    if role == "customer":
        inc_fields["unread_for_admin"] = 1
        # reopen if customer replies on a resolved/closed ticket
        if ticket.get("status") in ("resolved", "closed"):
            set_fields["status"] = "open"
    else:  # admin
        inc_fields["unread_for_customer"] = 1
        if ticket.get("status") == "open":
            set_fields["status"] = "pending"

    update = {"$push": {"messages": msg}, "$set": set_fields}
    if inc_fields:
        update["$inc"] = inc_fields

    await db.support_tickets.update_one({"id": ticket_id}, update)
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    return {"success": True, "ticket": ticket, "message": msg}


@api.get("/admin/stats")
async def admin_stats(current_user: dict = Depends(get_current_user)):
    """Aggregate dashboard analytics for admin."""
    _require_admin(current_user)
    now = now_utc()
    today_iso = now.date().isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Totals
    total_orders = await db.orders.count_documents({})
    total_drivers = await db.users.count_documents({"user_type": "driver"})
    online_drivers = await db.users.count_documents({"user_type": "driver", "is_online": True})
    pending_review = await db.orders.count_documents({"status": "pending_review"})
    pending = await db.orders.count_documents({"status": "pending"})
    active = await db.orders.count_documents(
        {"status": {"$in": ["accepted", "arriving", "picked_up", "in_transit"]}}
    )
    completed_total = await db.orders.count_documents({"status": "completed"})
    open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "pending"]}})

    # Revenue (sum of final_price for completed orders)
    rev_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}},
    ]
    revenue_total = 0
    async for row in db.orders.aggregate(rev_pipeline):
        revenue_total = row.get("total", 0)

    today_done = await db.orders.count_documents(
        {"status": "completed", "completed_at": {"$gte": today_iso}}
    )
    week_done = await db.orders.count_documents(
        {"status": "completed", "completed_at": {"$gte": week_ago}}
    )

    rev_today_p = [
        {"$match": {"status": "completed", "completed_at": {"$gte": today_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}},
    ]
    rev_today = 0
    async for row in db.orders.aggregate(rev_today_p):
        rev_today = row.get("total", 0)

    rev_week_p = [
        {"$match": {"status": "completed", "completed_at": {"$gte": week_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}},
    ]
    rev_week = 0
    async for row in db.orders.aggregate(rev_week_p):
        rev_week = row.get("total", 0)

    # Orders per day (last 7 days) - approximate by created_at string prefix
    series: list[dict] = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        next_day = (now - timedelta(days=i - 1)).date().isoformat() if i > 0 else (now + timedelta(days=1)).date().isoformat()
        cnt = await db.orders.count_documents({"created_at": {"$gte": day, "$lt": next_day}})
        rev_p = [
            {"$match": {"status": "completed", "completed_at": {"$gte": day, "$lt": next_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$final_price"}}},
        ]
        rev = 0
        async for row in db.orders.aggregate(rev_p):
            rev = row.get("total", 0)
        series.append({"day": day, "orders": cnt, "revenue": rev})

    return {
        "totals": {
            "orders": total_orders,
            "drivers": total_drivers,
            "online_drivers": online_drivers,
            "completed": completed_total,
            "revenue": revenue_total,
            "open_tickets": open_tickets,
        },
        "pipeline": {
            "pending_review": pending_review,
            "pending": pending,
            "active": active,
        },
        "today": {"orders_completed": today_done, "revenue": rev_today},
        "week": {"orders_completed": week_done, "revenue": rev_week},
        "series_7d": series,
    }


class AssignDriverRequest(BaseModel):
    driver_id: str


class PriceOverrideRequest(BaseModel):
    price: float


@api.post("/admin/orders/{order_id}/assign-driver")
async def admin_assign_driver(
    order_id: str,
    req: AssignDriverRequest,
    current_user: dict = Depends(get_current_user),
):
    """Admin manually assigns an order to a specific driver."""
    _require_admin(current_user)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") not in ("pending", "assigned"):
        raise HTTPException(status_code=400, detail=f"Cannot assign order with status {order['status']}")
    driver = await db.users.find_one({"id": req.driver_id, "user_type": "driver"})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if not driver.get("is_approved"):
        raise HTTPException(status_code=400, detail="Driver is not approved")
    now = now_utc().isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": "assigned",
                "assigned_driver_id": driver["id"],
                "assigned_driver_name": driver.get("name", ""),
                "assigned_at": now,
                "assigned_by": current_user.get("id"),
                "updated_at": now,
            },
            "$push": {"status_history": {"status": "assigned", "at": now}},
        },
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    # Push real-time to that driver + emit
    try:
        await _emit_to_user(driver["id"], "new_order", {"order": updated})
        await _emit_to_order(order_id, "order_update", {"order_id": order_id, "order": updated})
    except Exception:
        pass
    asyncio.create_task(
        _send_push(
            [driver["id"]],
            "🚚 طلب جديد مُعيّن لك",
            f"{updated.get('cargo_description') or 'طلب نقل'} • {int(updated.get('final_price') or 0):,} د.ع",
            {"type": "assigned", "order_id": order_id},
        )
    )
    return {"success": True, "order": updated}


@api.post("/admin/orders/{order_id}/override-price")
async def admin_override_price(
    order_id: str,
    req: PriceOverrideRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    if req.price < 1000:
        raise HTTPException(status_code=400, detail="Price too low")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now = now_utc().isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "final_price": req.price,
                "price_overridden_at": now,
                "price_overridden_by": current_user.get("id"),
                "updated_at": now,
            }
        },
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    try:
        await _emit_to_order(order_id, "order_update", {"order_id": order_id, "order": updated})
    except Exception:
        pass
    return {"success": True, "order": updated}


@api.get("/admin/pricing-settings")
async def get_pricing_settings(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    settings = await db.app_settings.find_one({"_id": "pricing"})
    if settings:
        settings.pop("_id", None)
    return {"settings": settings or {}}


class PricingSettingsRequest(BaseModel):
    min_price: Optional[int] = None
    max_auto_price: Optional[int] = None
    auto_cap_distance_km: Optional[int] = None
    manual_review_distance_km: Optional[int] = None
    peak_multiplier: Optional[float] = None
    vehicle_multiplier: Optional[dict] = None


@api.put("/admin/pricing-settings")
async def update_pricing_settings(
    req: PricingSettingsRequest, current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    set_fields: dict = {"updated_at": now_utc().isoformat()}
    for k, v in req.dict(exclude_none=True).items():
        set_fields[k] = v
    if len(set_fields) == 1:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.app_settings.update_one({"_id": "pricing"}, {"$set": set_fields}, upsert=True)
    # Apply to in-memory PRICING so new estimates use them immediately
    if "min_price" in set_fields:
        PRICING["min_price"] = int(set_fields["min_price"])
    if "max_auto_price" in set_fields:
        PRICING["max_auto_price"] = int(set_fields["max_auto_price"])
    if "auto_cap_distance_km" in set_fields:
        PRICING["auto_cap_distance_km"] = int(set_fields["auto_cap_distance_km"])
    if "manual_review_distance_km" in set_fields:
        PRICING["manual_review_distance_km"] = int(set_fields["manual_review_distance_km"])
    if "peak_multiplier" in set_fields:
        PRICING["peak_multiplier"] = float(set_fields["peak_multiplier"])
    if "vehicle_multiplier" in set_fields and isinstance(set_fields["vehicle_multiplier"], dict):
        PRICING["vehicle_multiplier"].update(set_fields["vehicle_multiplier"])
    settings = await db.app_settings.find_one({"_id": "pricing"}, {"_id": 0})
    return {"success": True, "settings": settings}


@api.get("/admin/support/tickets")
async def admin_list_tickets(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    query: dict = {}
    if status:
        query["status"] = status
    cursor = (
        db.support_tickets.find(query, {"_id": 0, "messages": 0})
        .sort("last_message_at", -1)
        .limit(200)
    )
    items = await cursor.to_list(length=200)
    return {"tickets": items, "count": len(items)}


@api.put("/admin/support/tickets/{ticket_id}/status")
async def admin_update_ticket_status(
    ticket_id: str,
    req: UpdateTicketStatusRequest,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    res = await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": req.status, "updated_at": now_utc().isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"success": True, "status": req.status}


# -------------------------------------------------------------------
# Expo Push Notifications
# -------------------------------------------------------------------
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushTokenRequest(BaseModel):
    token: str
    platform: Optional[str] = None  # "ios" | "android"


async def _send_push(
    user_ids: list[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Fire-and-forget push to a list of users."""
    if not user_ids:
        return
    users = await db.users.find(
        {"id": {"$in": user_ids}, "expo_push_token": {"$exists": True, "$ne": ""}},
        {"_id": 0, "expo_push_token": 1, "id": 1},
    ).to_list(length=100)
    messages = [
        {
            "to": u["expo_push_token"],
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "default",
        }
        for u in users
        if u.get("expo_push_token", "").startswith("ExponentPushToken[")
    ]
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client_http:
            r = await client_http.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400:
                logger.warning(f"Expo push failed: {r.status_code} {r.text}")
    except Exception as exc:
        logger.warning(f"Expo push error: {exc}")


async def _broadcast_push_to_online_drivers(title: str, body: str, data: dict) -> None:
    drivers = await db.users.find(
        {
            "user_type": "driver",
            "is_online": True,
            "is_approved": True,
            "expo_push_token": {"$exists": True, "$ne": ""},
        },
        {"_id": 0, "id": 1},
    ).to_list(length=200)
    if drivers:
        await _send_push([d["id"] for d in drivers], title, body, data)


@api.put("/auth/push-token")
async def register_push_token(
    req: PushTokenRequest, current_user: dict = Depends(get_current_user)
):
    """Persist a user's Expo push token."""
    token = req.token.strip()
    if not token.startswith("ExponentPushToken[") and not token.startswith("ExpoPushToken["):
        # Allow empty to clear, but reject obvious junk
        if token != "":
            raise HTTPException(status_code=400, detail="Invalid Expo push token format")
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "expo_push_token": token,
                "push_platform": req.platform or "",
                "push_updated_at": now_utc().isoformat(),
            }
        },
    )
    return {"success": True}


# -------------------------------------------------------------------
# Customer ratings
# -------------------------------------------------------------------
class RateOrderRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None


@api.post("/orders/{order_id}/rate")
async def customer_rate_order(
    order_id: str,
    req: RateOrderRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="Only customers can rate")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("status") != "completed":
        raise HTTPException(status_code=400, detail="You can only rate completed orders")
    if order.get("customer_rating"):
        raise HTTPException(status_code=400, detail="Order is already rated")
    if not order.get("driver_id"):
        raise HTTPException(status_code=400, detail="No driver assigned to this order")

    review_text = (req.review or "").strip()[:500]
    now = now_utc().isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "customer_rating": req.rating,
                "customer_review": review_text,
                "rated_at": now,
                "updated_at": now,
            }
        },
    )

    # Update driver's running average
    pipeline = [
        {"$match": {"driver_id": order["driver_id"], "customer_rating": {"$gte": 1}}},
        {
            "$group": {
                "_id": None,
                "avg": {"$avg": "$customer_rating"},
                "cnt": {"$sum": 1},
            }
        },
    ]
    avg_doc = None
    async for row in db.orders.aggregate(pipeline):
        avg_doc = row
    if avg_doc:
        await db.users.update_one(
            {"id": order["driver_id"]},
            {
                "$set": {
                    "rating": round(float(avg_doc["avg"]), 2),
                    "rating_count": int(avg_doc["cnt"]),
                }
            },
        )

    # Notify driver
    asyncio.create_task(
        _send_push(
            [order["driver_id"]],
            f"⭐ {req.rating}/5 من زبونك",
            review_text or "تم تقييم رحلتك",
            {"type": "rating", "order_id": order_id},
        )
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "order": updated}


# -------------------------------------------------------------------
# Driver earnings analytics
# -------------------------------------------------------------------
@api.get("/driver/earnings/analytics")
async def driver_earnings_analytics(
    range_: str = Query("week", alias="range"),
    current_user: dict = Depends(get_current_user),
):
    """Earnings analytics for the logged-in driver.

    range_: "week" (last 7 days), "month" (last 30 days)
    Returns series + breakdown by status/day.
    """
    _require_driver(current_user)
    now = now_utc()
    days = 30 if range_ == "month" else 7

    series: list[dict] = []
    total_revenue = 0
    total_trips = 0
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        next_day = (now - timedelta(days=i - 1)).date().isoformat() if i > 0 else (
            now + timedelta(days=1)
        ).date().isoformat()
        pipeline = [
            {
                "$match": {
                    "driver_id": current_user["id"],
                    "status": "completed",
                    "completed_at": {"$gte": day, "$lt": next_day},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "earnings": {"$sum": "$final_price"},
                    "trips": {"$sum": 1},
                }
            },
        ]
        earnings = 0
        trips = 0
        async for row in db.orders.aggregate(pipeline):
            earnings = row.get("earnings", 0) or 0
            trips = row.get("trips", 0) or 0
        series.append({"day": day, "earnings": earnings, "trips": trips})
        total_revenue += earnings
        total_trips += trips

    # Breakdown by status (all-time for this driver)
    by_status_pipeline = [
        {"$match": {"driver_id": current_user["id"]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    by_status: dict[str, int] = {}
    async for row in db.orders.aggregate(by_status_pipeline):
        by_status[row["_id"]] = row["count"]

    avg_trip = round(total_revenue / total_trips) if total_trips > 0 else 0

    return {
        "range": range,
        "series": series,
        "totals": {
            "earnings": total_revenue,
            "trips": total_trips,
            "avg_trip_price": avg_trip,
        },
        "by_status": by_status,
        "vehicle_type": current_user.get("vehicle_type"),
    }


# -------------------------------------------------------------------
# Socket.IO real-time layer
# -------------------------------------------------------------------
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


async def _emit_to_order(order_id: str, event: str, data: dict) -> None:
    """Emit an event to all clients listening to a specific order room."""
    try:
        await sio.emit(event, data, room=f"order:{order_id}")
    except Exception as exc:  # pragma: no cover
        logger.warning(f"socket emit {event} failed: {exc}")


async def _emit_to_user(user_id: str, event: str, data: dict) -> None:
    try:
        await sio.emit(event, data, room=f"user:{user_id}")
    except Exception as exc:  # pragma: no cover
        logger.warning(f"socket emit {event} to user failed: {exc}")


@sio.event
async def connect(sid, environ, auth):
    """Authenticate the socket connection via Bearer token in auth payload."""
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    if not token:
        return False  # reject
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return False
    user_id = payload.get("sub")
    user_type = payload.get("user_type", "customer")
    if not user_id:
        return False
    await sio.save_session(sid, {"user_id": user_id, "user_type": user_type})
    # Personal room for direct messages (e.g. new-order push for a specific driver)
    await sio.enter_room(sid, f"user:{user_id}")
    if user_type == "driver":
        await sio.enter_room(sid, "drivers")
    logger.info(f"[socket] connected sid={sid} user={user_id} type={user_type}")
    return True


@sio.event
async def disconnect(sid):
    logger.info(f"[socket] disconnected sid={sid}")


@sio.on("subscribe_order")
async def subscribe_order(sid, data):
    """Customer or driver subscribes to live updates for a specific order."""
    if not isinstance(data, dict):
        return {"ok": False, "error": "bad payload"}
    order_id = data.get("order_id")
    if not order_id:
        return {"ok": False, "error": "order_id required"}
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    order = await db.orders.find_one(
        {"id": order_id}, {"_id": 0, "customer_id": 1, "driver_id": 1}
    )
    if not order:
        return {"ok": False, "error": "order not found"}
    if user_id not in (order.get("customer_id"), order.get("driver_id")):
        return {"ok": False, "error": "forbidden"}
    await sio.enter_room(sid, f"order:{order_id}")
    return {"ok": True, "room": f"order:{order_id}"}


@sio.on("unsubscribe_order")
async def unsubscribe_order(sid, data):
    if not isinstance(data, dict):
        return {"ok": False}
    order_id = data.get("order_id")
    if order_id:
        await sio.leave_room(sid, f"order:{order_id}")
    return {"ok": True}


# -------------------------------------------------------------------
@app.on_event("shutdown")
async def shutdown_db():
    client.close()


# -------------------------------------------------------------------
# Register
# -------------------------------------------------------------------
app.include_router(api)

# Web Admin Panel — serve built Vite SPA from /api/web-admin/*
ADMIN_DIST = Path("/app/admin/dist")
if ADMIN_DIST.exists() and (ADMIN_DIST / "index.html").exists():
    # /api/web-admin/assets/* and other built files
    app.mount(
        "/api/web-admin/assets",
        StaticFiles(directory=str(ADMIN_DIST / "assets")),
        name="admin-assets",
    )

    @app.get("/api/web-admin")
    @app.get("/api/web-admin/")
    async def admin_root():
        return FileResponse(str(ADMIN_DIST / "index.html"))

    @app.get("/api/web-admin/{full_path:path}")
    async def admin_spa(full_path: str):
        # First try a real file on disk (favicon, etc.)
        candidate = ADMIN_DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        # Fall back to SPA index for client-side routing
        return FileResponse(str(ADMIN_DIST / "index.html"))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO. We re-assign `app` so uvicorn serves the ASGI app that
# multiplexes HTTP + WebSocket. The /api ingress only proxies HTTP routes,
# so we also expose Socket.IO under /api/socket.io (handled internally by
# the python-socketio ASGIApp by listening on socketio_path).
app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/api/socket.io")
