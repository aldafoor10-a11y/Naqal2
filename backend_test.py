"""
NAQAL GO - End-to-End Backend Test Suite

Tests all critical scenarios via public ingress (EXPO_PUBLIC_BACKEND_URL).
Routes are all prefixed with /api.
"""

import os
import sys
import time
import uuid
import json
from typing import Any, Optional

import requests

BASE_URL = "https://naqal-go.preview.emergentagent.com"
API = f"{BASE_URL}/api"

DRIVER_PHONE = "+9647701234567"          # seeded driver
CUSTOMER_PHONE = "+9647700001234"        # test customer
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "naqal2026"
MOCK_OTP = "123456"

# Mosul approximate coords (used for short, medium, long-distance orders)
MOSUL_LAT, MOSUL_LNG = 36.3489, 43.1577

# Failure collector
FAILURES: list[dict] = []
RESULTS: list[dict] = []


def record(name: str, ok: bool, detail: str = ""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {('- ' + detail) if detail else ''}")
    if not ok:
        FAILURES.append({"name": name, "detail": detail})


def fail(name: str, endpoint: str, payload: Any, response: requests.Response, expected: str):
    body = None
    try:
        body = response.json()
    except Exception:
        body = response.text
    detail = (
        f"endpoint={endpoint} payload={json.dumps(payload, default=str)} "
        f"expected={expected} status={response.status_code} body={json.dumps(body, default=str)[:500]}"
    )
    record(name, False, detail)


def api_post(path: str, json_body: Any = None, token: Optional[str] = None, timeout: int = 30):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json_body, headers=headers, timeout=timeout)


def api_get(path: str, token: Optional[str] = None, params: Optional[dict] = None, timeout: int = 30):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=headers, params=params, timeout=timeout)


def api_put(path: str, json_body: Any = None, token: Optional[str] = None, timeout: int = 30):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.put(f"{API}{path}", json=json_body, headers=headers, timeout=timeout)


# Storage for cross-test state
state: dict = {}


def t_health():
    r = api_get("/")
    if r.status_code == 200:
        record("health/root", True, str(r.json()))
    else:
        fail("health/root", "/", None, r, "200")


# ---------------------------------------------------------------
# 1) Driver login (mock OTP)
# ---------------------------------------------------------------
def t_driver_send_otp():
    payload = {"phone": DRIVER_PHONE}
    r = api_post("/auth/send-otp", payload)
    if r.status_code != 200:
        fail("driver send-otp", "/auth/send-otp", payload, r, "200")
        return
    data = r.json()
    if data.get("mock_code") != MOCK_OTP:
        fail("driver send-otp mock_code", "/auth/send-otp", payload, r, f"mock_code={MOCK_OTP}")
        return
    record("driver send-otp", True, f"mock_code={data.get('mock_code')}")


def t_driver_verify_otp():
    payload = {"phone": DRIVER_PHONE, "code": MOCK_OTP}
    r = api_post("/auth/verify-otp", payload)
    if r.status_code != 200:
        fail("driver verify-otp", "/auth/verify-otp", payload, r, "200")
        return
    data = r.json()
    if data.get("user_type") != "driver":
        fail("driver verify-otp user_type", "/auth/verify-otp", payload, r, "user_type=driver")
        return
    token = data.get("token")
    if not token:
        fail("driver verify-otp token", "/auth/verify-otp", payload, r, "non-empty token")
        return
    user = data.get("user", {})
    if not user.get("is_approved", False):
        fail(
            "driver verify-otp is_approved",
            "/auth/verify-otp",
            payload,
            r,
            "user.is_approved=true",
        )
        return
    state["driver_token"] = token
    state["driver_id"] = user["id"]
    record("driver verify-otp", True, f"driver_id={user['id']}")


def t_driver_profile():
    token = state.get("driver_token")
    if not token:
        record("driver profile", False, "no driver token from verify-otp")
        return
    r = api_get("/driver/profile", token=token)
    if r.status_code != 200:
        fail("driver profile", "/driver/profile", None, r, "200")
        return
    data = r.json().get("driver", {})
    if data.get("user_type") != "driver":
        fail("driver profile user_type", "/driver/profile", None, r, "user_type=driver")
        return
    record("driver profile", True, f"name={data.get('name')}")


# ---------------------------------------------------------------
# 2) Customer access control
# ---------------------------------------------------------------
def t_customer_create():
    # send-otp + verify-otp for new customer
    r = api_post("/auth/send-otp", {"phone": CUSTOMER_PHONE})
    if r.status_code != 200:
        fail("customer send-otp", "/auth/send-otp", {"phone": CUSTOMER_PHONE}, r, "200")
        return
    r = api_post("/auth/verify-otp", {"phone": CUSTOMER_PHONE, "code": MOCK_OTP})
    if r.status_code != 200:
        fail("customer verify-otp", "/auth/verify-otp", None, r, "200")
        return
    data = r.json()
    if data.get("user_type") != "customer":
        fail("customer verify-otp type", "/auth/verify-otp", None, r, "user_type=customer")
        return
    state["customer_token"] = data["token"]
    state["customer_id"] = data["user"]["id"]
    # Set the name on the customer profile
    r2 = api_put("/auth/profile", {"name": "علي حسن"}, token=state["customer_token"])
    if r2.status_code != 200:
        fail("customer set name", "/auth/profile", {"name": "علي حسن"}, r2, "200")
        return
    record("customer signup+name", True, f"customer_id={state['customer_id']}")


def t_customer_blocked_driver_endpoints():
    token = state.get("customer_token")
    if not token:
        record("customer blocked from driver endpoints", False, "no customer token")
        return

    r1 = api_get("/driver/profile", token=token)
    if r1.status_code != 403:
        fail(
            "customer access /driver/profile",
            "/driver/profile",
            None,
            r1,
            "403",
        )
    else:
        record("customer→/driver/profile blocked (403)", True)

    payload = {
        "name": "Test",
        "phone": "+9647709990000",
        "vehicle_type": "kia_pickup",
        "vehicle_plate": "X-1",
    }
    r2 = api_post("/admin/drivers", payload, token=token)
    if r2.status_code != 403:
        fail("customer access /admin/drivers", "/admin/drivers", payload, r2, "403")
    else:
        record("customer→/admin/drivers blocked (403)", True)


# ---------------------------------------------------------------
# 3) Driver lifecycle E2E
# ---------------------------------------------------------------
def t_driver_online():
    token = state.get("driver_token")
    r = api_put("/driver/status", {"is_online": True}, token=token)
    if r.status_code != 200:
        fail("driver set online", "/driver/status", {"is_online": True}, r, "200")
        return
    if not r.json().get("driver", {}).get("is_online"):
        fail(
            "driver set online flag",
            "/driver/status",
            {"is_online": True},
            r,
            "driver.is_online=true",
        )
        return
    record("driver set online", True)


def t_customer_short_order():
    """Customer creates a short ~5km order (Mosul → Mosul)."""
    token = state.get("customer_token")
    if not token:
        record("customer create order", False, "no customer token")
        return

    # ~5km offset: 0.045 degrees latitude ≈ 5km
    pickup_lat, pickup_lng = MOSUL_LAT, MOSUL_LNG
    dropoff_lat, dropoff_lng = MOSUL_LAT + 0.045, MOSUL_LNG + 0.005

    # First get a price estimate to confirm distance is returned
    est_payload = {
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "dropoff_lat": dropoff_lat,
        "dropoff_lng": dropoff_lng,
        "vehicle_type": "kia_pickup",
        "service_type": "goods",
    }
    r_est = api_post("/pricing/estimate", est_payload, token=token)
    if r_est.status_code != 200:
        fail("short order pricing estimate", "/pricing/estimate", est_payload, r_est, "200")
        return
    est = r_est.json()
    if not est.get("distance_km") or est.get("distance_km") <= 0:
        fail(
            "short order distance present",
            "/pricing/estimate",
            est_payload,
            r_est,
            "distance_km>0",
        )
        return
    state["short_estimate"] = est

    order_payload = {
        "service_type": "goods",
        "pickup": {
            "address": "حي الزهور، الموصل",
            "latitude": pickup_lat,
            "longitude": pickup_lng,
        },
        "dropoff": {
            "address": "حي الرسالة، الموصل",
            "latitude": dropoff_lat,
            "longitude": dropoff_lng,
        },
        "vehicle_type": "kia_pickup",
        "cargo_description": "أثاث منزلي خفيف",
        "cargo_notes": "",
    }
    r = api_post("/orders", order_payload, token=token)
    if r.status_code != 200:
        fail("customer create short order", "/orders", order_payload, r, "200")
        return
    order = r.json().get("order", {})
    if order.get("status") != "pending":
        fail(
            "short order status",
            "/orders",
            order_payload,
            r,
            f"status=pending got={order.get('status')}",
        )
        return
    state["short_order_id"] = order["id"]
    state["short_order"] = order
    record(
        "customer create short order",
        True,
        f"order_id={order['id']} distance_km={order.get('distance_km')} final_price={order.get('final_price')}",
    )


def t_driver_sees_available_order():
    token = state.get("driver_token")
    short_id = state.get("short_order_id")
    if not token or not short_id:
        record("driver sees order in available", False, "no token/order")
        return
    r = api_get("/driver/orders/available", token=token)
    if r.status_code != 200:
        fail("driver available orders", "/driver/orders/available", None, r, "200")
        return
    orders = r.json().get("orders", [])
    if not any(o["id"] == short_id for o in orders):
        fail(
            "driver available orders contains new order",
            "/driver/orders/available",
            None,
            r,
            f"orders contain id={short_id} (got {len(orders)} orders)",
        )
        return
    record("driver available orders contains short order", True)


def t_driver_accept_order():
    token = state.get("driver_token")
    order_id = state.get("short_order_id")
    r = api_post(f"/driver/orders/{order_id}/accept", token=token)
    if r.status_code != 200:
        fail(
            "driver accept order",
            f"/driver/orders/{order_id}/accept",
            None,
            r,
            "200",
        )
        return
    order = r.json().get("order", {})
    if order.get("status") != "accepted":
        fail(
            "driver accept order status",
            f"/driver/orders/{order_id}/accept",
            None,
            r,
            "status=accepted",
        )
        return
    record("driver accept order", True)


def t_invalid_state_jump():
    """After 'accepted', trying picked_up directly should 400."""
    token = state.get("driver_token")
    order_id = state.get("short_order_id")
    r = api_post(
        f"/driver/orders/{order_id}/status", {"status": "picked_up"}, token=token
    )
    if r.status_code != 400:
        fail(
            "state machine rejects bad jump",
            f"/driver/orders/{order_id}/status",
            {"status": "picked_up"},
            r,
            "400",
        )
        return
    record("state machine rejects accepted→picked_up", True)


def t_driver_progress():
    token = state.get("driver_token")
    order_id = state.get("short_order_id")
    sequence = ["arriving", "picked_up", "in_transit", "completed"]
    for s in sequence:
        r = api_post(
            f"/driver/orders/{order_id}/status", {"status": s}, token=token
        )
        if r.status_code != 200:
            fail(
                f"driver progress→{s}",
                f"/driver/orders/{order_id}/status",
                {"status": s},
                r,
                "200",
            )
            return
        order = r.json().get("order", {})
        if order.get("status") != s:
            fail(
                f"driver progress status={s}",
                f"/driver/orders/{order_id}/status",
                {"status": s},
                r,
                f"status={s}",
            )
            return
    record("driver progress arriving→completed", True)


def t_driver_earnings():
    token = state.get("driver_token")
    r = api_get("/driver/earnings", token=token)
    if r.status_code != 200:
        fail("driver earnings", "/driver/earnings", None, r, "200")
        return
    data = r.json()
    if (data.get("today_trips") or 0) < 1:
        fail(
            "driver earnings today_trips",
            "/driver/earnings",
            None,
            r,
            "today_trips>=1",
        )
        return
    if (data.get("total_earnings") or 0) <= 0:
        fail(
            "driver earnings total_earnings",
            "/driver/earnings",
            None,
            r,
            "total_earnings>0",
        )
        return
    record(
        "driver earnings reflect completed trip",
        True,
        f"today_trips={data['today_trips']} total_earnings={data['total_earnings']}",
    )


def t_driver_history():
    token = state.get("driver_token")
    order_id = state.get("short_order_id")
    r = api_get("/driver/orders/history", token=token)
    if r.status_code != 200:
        fail("driver history", "/driver/orders/history", None, r, "200")
        return
    orders = r.json().get("orders", [])
    if not any(o["id"] == order_id for o in orders):
        fail(
            "driver history contains completed",
            "/driver/orders/history",
            None,
            r,
            f"id={order_id} present",
        )
        return
    record("driver history contains completed order", True)


# ---------------------------------------------------------------
# 4) Admin flow
# ---------------------------------------------------------------
def t_admin_login():
    payload = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    r = api_post("/auth/admin/login", payload)
    if r.status_code != 200:
        fail("admin login", "/auth/admin/login", payload, r, "200")
        return
    token = r.json().get("token")
    if not token:
        fail("admin login token", "/auth/admin/login", payload, r, "token in response")
        return
    state["admin_token"] = token
    record("admin login", True)


def t_admin_list_drivers():
    token = state.get("admin_token")
    r = api_get("/admin/drivers", token=token)
    if r.status_code != 200:
        fail("admin list drivers", "/admin/drivers", None, r, "200")
        return
    count = r.json().get("count", 0)
    if count < 1:
        fail("admin list drivers count", "/admin/drivers", None, r, "count>=1")
        return
    record("admin list drivers", True, f"count={count}")


def t_admin_create_driver():
    token = state.get("admin_token")
    # Use unique phone (suffix random) to avoid collision with previous test runs
    # but spec says +9647709876543, we'll use that + a small variation if it already exists
    base_phone = "+9647709876543"
    payload = {
        "name": "محمد علي",
        "phone": base_phone,
        "vehicle_type": "kia_pickup",
        "vehicle_plate": "TEST-001",
    }
    r = api_post("/admin/drivers", payload, token=token)
    if r.status_code == 400:
        # Likely already exists from previous run — make unique
        unique_phone = f"+96477{uuid.uuid4().int % 100000000:08d}"
        payload["phone"] = unique_phone
        r = api_post("/admin/drivers", payload, token=token)

    if r.status_code not in (200, 201):
        fail("admin create driver", "/admin/drivers", payload, r, "200 or 201")
        return
    state["new_driver_phone"] = payload["phone"]
    state["new_driver_id"] = r.json()["driver"]["id"]
    record("admin create driver", True, f"phone={payload['phone']}")


def t_admin_duplicate_phone():
    token = state.get("admin_token")
    new_phone = state.get("new_driver_phone")
    if not new_phone:
        record("admin duplicate phone", False, "no new_driver_phone from prior step")
        return
    payload = {
        "name": "Duplicate",
        "phone": new_phone,
        "vehicle_type": "kia_pickup",
        "vehicle_plate": "TEST-002",
    }
    r = api_post("/admin/drivers", payload, token=token)
    if r.status_code != 400:
        fail("admin duplicate phone", "/admin/drivers", payload, r, "400")
        return
    record("admin duplicate phone rejected (400)", True)


def t_admin_list_orders():
    token = state.get("admin_token")
    r = api_get("/admin/orders", token=token)
    if r.status_code != 200:
        fail("admin list orders", "/admin/orders", None, r, "200")
        return
    record("admin list orders", True, f"count={r.json().get('count')}")


def t_long_distance_manual_review():
    token = state.get("customer_token")
    if not token:
        record("long-distance manual review", False, "no customer token")
        return
    pickup = {"address": "Mosul", "latitude": MOSUL_LAT, "longitude": MOSUL_LNG}
    dropoff = {"address": "Far", "latitude": 37.6, "longitude": MOSUL_LNG}
    payload = {
        "service_type": "goods",
        "pickup": pickup,
        "dropoff": dropoff,
        "vehicle_type": "kia_pickup",
        "cargo_description": "long-distance",
    }
    r = api_post("/orders", payload, token=token)
    if r.status_code != 200:
        fail("long distance order create", "/orders", payload, r, "200")
        return
    order = r.json().get("order", {})
    if order.get("status") != "pending_review":
        fail(
            "long distance status",
            "/orders",
            payload,
            r,
            f"status=pending_review got={order.get('status')}",
        )
        return
    if order.get("final_price") != 0:
        fail(
            "long distance final_price",
            "/orders",
            payload,
            r,
            f"final_price=0 got={order.get('final_price')}",
        )
        return
    state["long_order_id"] = order["id"]
    record(
        "long-distance order pending_review",
        True,
        f"order_id={order['id']} distance={order.get('distance_km')}",
    )


def t_admin_pending_review_list():
    token = state.get("admin_token")
    long_id = state.get("long_order_id")
    r = api_get("/admin/orders/pending-review", token=token)
    if r.status_code != 200:
        fail("admin pending-review", "/admin/orders/pending-review", None, r, "200")
        return
    orders = r.json().get("orders", [])
    if not any(o["id"] == long_id for o in orders):
        fail(
            "admin pending-review contains long order",
            "/admin/orders/pending-review",
            None,
            r,
            f"id={long_id} present",
        )
        return
    record("admin pending-review contains long order", True)


def t_admin_set_price():
    token = state.get("admin_token")
    long_id = state.get("long_order_id")
    payload = {"price": 90000}
    r = api_post(f"/admin/orders/{long_id}/set-price", payload, token=token)
    if r.status_code != 200:
        fail("admin set price", f"/admin/orders/{long_id}/set-price", payload, r, "200")
        return
    order = r.json().get("order", {})
    if order.get("status") != "pending":
        fail(
            "admin set price status",
            f"/admin/orders/{long_id}/set-price",
            payload,
            r,
            "status=pending",
        )
        return
    if order.get("final_price") != 90000:
        fail(
            "admin set price final_price",
            f"/admin/orders/{long_id}/set-price",
            payload,
            r,
            "final_price=90000",
        )
        return
    record("admin set manual price", True)


# ---------------------------------------------------------------
# 5) Pricing constraints
# ---------------------------------------------------------------
def t_pricing_estimate_distances():
    """Test ~50km (normal), ~100km (capped), ~150km (manual)."""
    # The server multiplies straight-line distance by 1.2 to estimate road distance.
    # Therefore to hit a target ROAD distance X, set straight distance = X/1.2.
    # 1 degree of latitude ≈ 111.32 km
    targets = [
        ("~50km", 50, "normal"),
        ("~100km", 100, "capped"),
        ("~150km", 150, "manual"),
    ]
    for label, target_km, expected in targets:
        straight_km = target_km / 1.2
        delta_lat = straight_km / 111.32
        payload = {
            "pickup_lat": MOSUL_LAT,
            "pickup_lng": MOSUL_LNG,
            "dropoff_lat": MOSUL_LAT + delta_lat,
            "dropoff_lng": MOSUL_LNG,
            "vehicle_type": "kia_pickup",
            "service_type": "goods",
        }
        r = api_post("/pricing/estimate", payload)
        if r.status_code != 200:
            fail(
                f"pricing estimate {label}",
                "/pricing/estimate",
                payload,
                r,
                "200",
            )
            continue
        data = r.json()
        if expected == "normal":
            if data.get("requires_manual_pricing"):
                fail(
                    f"pricing estimate {label} not manual",
                    "/pricing/estimate",
                    payload,
                    r,
                    "requires_manual_pricing=false",
                )
                continue
            if not isinstance(data.get("final_price"), int) or data["final_price"] <= 0:
                fail(
                    f"pricing estimate {label} final_price",
                    "/pricing/estimate",
                    payload,
                    r,
                    "final_price>0",
                )
                continue
            record(
                f"pricing estimate {label} normal",
                True,
                f"distance_km={data.get('distance_km')} final={data['final_price']}",
            )
        elif expected == "capped":
            if not data.get("is_capped"):
                fail(
                    f"pricing estimate {label} capped",
                    "/pricing/estimate",
                    payload,
                    r,
                    "is_capped=true",
                )
                continue
            if data.get("final_price") != 75000:
                fail(
                    f"pricing estimate {label} cap value",
                    "/pricing/estimate",
                    payload,
                    r,
                    "final_price=75000",
                )
                continue
            record(
                f"pricing estimate {label} capped",
                True,
                f"distance_km={data.get('distance_km')} final={data['final_price']}",
            )
        else:  # manual
            if not data.get("requires_manual_pricing"):
                fail(
                    f"pricing estimate {label} manual",
                    "/pricing/estimate",
                    payload,
                    r,
                    "requires_manual_pricing=true",
                )
                continue
            if data.get("final_price") is not None:
                fail(
                    f"pricing estimate {label} final_price null",
                    "/pricing/estimate",
                    payload,
                    r,
                    "final_price=null",
                )
                continue
            record(
                f"pricing estimate {label} manual",
                True,
                f"distance_km={data.get('distance_km')}",
            )


# ---------------------------------------------------------------
# 6) Auth guards
# ---------------------------------------------------------------
def t_unauth_driver_profile():
    r = api_get("/driver/profile")  # no token
    if r.status_code != 401:
        fail("no-token /driver/profile", "/driver/profile", None, r, "401")
        return
    record("no-token /driver/profile → 401", True)


def t_unapproved_driver_blocked():
    """Create a new driver via admin, toggle approval off, then verify-otp should 403."""
    token = state.get("admin_token")
    if not token:
        record("unapproved driver flow", False, "no admin token")
        return
    phone = f"+96477{uuid.uuid4().int % 100000000:08d}"
    create_payload = {
        "name": "غير معتمد",
        "phone": phone,
        "vehicle_type": "kia_pickup",
        "vehicle_plate": "UNAPP-1",
    }
    r = api_post("/admin/drivers", create_payload, token=token)
    if r.status_code not in (200, 201):
        fail("create unapproved driver", "/admin/drivers", create_payload, r, "200")
        return
    driver_id = r.json()["driver"]["id"]
    # Toggle approval (currently approved → flip to unapproved)
    r2 = api_put(
        f"/admin/drivers/{driver_id}/toggle-approval", token=token
    )
    if r2.status_code != 200 or r2.json().get("is_approved") is not False:
        fail(
            "toggle approval to false",
            f"/admin/drivers/{driver_id}/toggle-approval",
            None,
            r2,
            "is_approved=false",
        )
        return
    # send + verify OTP — should 403
    r3 = api_post("/auth/send-otp", {"phone": phone})
    if r3.status_code != 200:
        fail("unapproved send-otp", "/auth/send-otp", {"phone": phone}, r3, "200")
        return
    r4 = api_post("/auth/verify-otp", {"phone": phone, "code": MOCK_OTP})
    if r4.status_code != 403:
        fail(
            "unapproved verify-otp blocked",
            "/auth/verify-otp",
            {"phone": phone, "code": MOCK_OTP},
            r4,
            "403",
        )
        return
    record("unapproved driver verify-otp → 403", True)


# ---------------------------------------------------------------
# Driver of new phone — quick test that admin-created drivers can log in
# ---------------------------------------------------------------


def run_all():
    # Sequence matters; some tests depend on earlier state
    tests = [
        t_health,
        # 1
        t_driver_send_otp,
        t_driver_verify_otp,
        t_driver_profile,
        # 2
        t_customer_create,
        t_customer_blocked_driver_endpoints,
        # 3
        t_driver_online,
        t_customer_short_order,
        t_driver_sees_available_order,
        t_driver_accept_order,
        t_invalid_state_jump,
        t_driver_progress,
        t_driver_earnings,
        t_driver_history,
        # 4
        t_admin_login,
        t_admin_list_drivers,
        t_admin_create_driver,
        t_admin_duplicate_phone,
        t_admin_list_orders,
        t_long_distance_manual_review,
        t_admin_pending_review_list,
        t_admin_set_price,
        # 5
        t_pricing_estimate_distances,
        # 6
        t_unauth_driver_profile,
        t_unapproved_driver_blocked,
    ]
    for fn in tests:
        try:
            fn()
        except Exception as exc:
            import traceback
            record(fn.__name__, False, f"Exception: {exc}\n{traceback.format_exc()[:500]}")

    print("\n" + "=" * 60)
    print(f"RESULTS: {sum(1 for r in RESULTS if r['ok'])}/{len(RESULTS)} passed")
    print("=" * 60)
    if FAILURES:
        print("\nFAILED TESTS:")
        for f_ in FAILURES:
            print(f"\n  - {f_['name']}")
            print(f"    {f_['detail']}")
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(run_all())
