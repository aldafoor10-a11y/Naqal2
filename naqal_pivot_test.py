"""
NAQAL GO – Backend regression test for the major architectural pivot.
Tests:
  A. Hidden owner admin (phone+password) login + OTP block.
  B. Hidden admin invisibility in user listings.
  C. Centralized order workflow (no driver broadcast).
  D. Admin assigns driver.
  E. Price override.
  F. Pricing settings.
  G. Hidden admin cannot be created as a driver.
  H. Regression of unrelated flows.
"""

import os
import sys
import json
import time
import random
import requests

BASE = "https://naqal-go.preview.emergentagent.com/api"

PASS, FAIL = 0, 0
FAILS = []


def show(label, resp):
    try:
        body = resp.json()
    except Exception:
        body = resp.text[:300]
    print(f"  → {label}: HTTP {resp.status_code} {json.dumps(body, ensure_ascii=False)[:500]}")
    return body


def check(label, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ PASS: {label}")
    else:
        FAIL += 1
        FAILS.append(f"{label} — {detail}")
        print(f"  ❌ FAIL: {label} — {detail}")


def section(t):
    print(f"\n{'='*70}\n{t}\n{'='*70}")


# ----------------------------------------------------------------------
# A. Hidden owner admin login
# ----------------------------------------------------------------------
section("A. Hidden owner admin phone+password login")

owner_token = None

# 1
print("[1] POST /auth/admin/phone-login phone=07517300194 pwd=yassir00")
r = requests.post(
    f"{BASE}/auth/admin/phone-login",
    json={"phone": "07517300194", "password": "yassir00"},
)
b = show("phone-login", r)
ok = r.status_code == 200 and b.get("token") and (
    b.get("admin", {}).get("user_type") == "admin"
)
check("phone-login (0-prefix) → 200 + admin token", ok, f"status={r.status_code}")
if ok:
    owner_token = b["token"]

# 2
print("[2] phone-login wrong password")
r = requests.post(
    f"{BASE}/auth/admin/phone-login",
    json={"phone": "07517300194", "password": "wrong"},
)
show("phone-login wrong pwd", r)
check("wrong password → 401", r.status_code == 401, f"status={r.status_code}")

# 3
print("[3] phone-login +964 variant")
r = requests.post(
    f"{BASE}/auth/admin/phone-login",
    json={"phone": "+9647517300194", "password": "yassir00"},
)
b = show("phone-login +964", r)
check(
    "+964 variant phone-login → 200",
    r.status_code == 200 and b.get("token") and b.get("admin", {}).get("user_type") == "admin",
    f"status={r.status_code}",
)

# 4
print("[4] send-otp 07517300194")
r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "07517300194"})
show("send-otp blocked", r)
check("OTP blocked for hidden phone (0-form) → 403", r.status_code == 403, f"status={r.status_code}")

# 5
print("[5] send-otp +9647517300194")
r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "+9647517300194"})
show("send-otp +964 blocked", r)
check("OTP blocked for hidden phone (+964 form) → 403", r.status_code == 403, f"status={r.status_code}")

# 6
print("[6] GET /admin/stats with owner_token")
assert owner_token, "owner_token missing — cannot continue admin tests"
hdr_owner = {"Authorization": f"Bearer {owner_token}"}
r = requests.get(f"{BASE}/admin/stats", headers=hdr_owner)
show("/admin/stats", r)
check("/admin/stats with owner_token → 200", r.status_code == 200, f"status={r.status_code}")

# ----------------------------------------------------------------------
# B. Hidden admin invisibility
# ----------------------------------------------------------------------
section("B. Hidden admin invisibility")

# 7
print("[7] GET /admin/drivers — owner phone must NOT appear")
r = requests.get(f"{BASE}/admin/drivers", headers=hdr_owner)
b = show("admin/drivers", r)
drivers = b.get("drivers", []) if isinstance(b, dict) else []
hidden_in_drivers = any(
    d.get("phone") in ("07517300194", "+9647517300194") for d in drivers
)
check("/admin/drivers → 200", r.status_code == 200, f"status={r.status_code}")
check(
    "Hidden owner phone NOT present in drivers list",
    not hidden_in_drivers,
    f"found {sum(1 for d in drivers if d.get('phone') in ('07517300194','+9647517300194'))} match",
)

# 8
print("[8] GET /admin/orders with owner_token")
r = requests.get(f"{BASE}/admin/orders", headers=hdr_owner)
show("admin/orders", r)
check("/admin/orders → 200", r.status_code == 200, f"status={r.status_code}")

# 9 customer login
print("[9] Customer OTP login +9647700001111")
r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "+9647700001111"})
show("send-otp customer", r)
assert r.status_code == 200, "Customer OTP send failed"
r = requests.post(
    f"{BASE}/auth/verify-otp", json={"phone": "+9647700001111", "code": "123456"}
)
b = show("verify-otp customer", r)
customer_token = b.get("token")
needs_name = b.get("needs_name", False)
hdr_cust = {"Authorization": f"Bearer {customer_token}"}
if needs_name:
    r = requests.put(f"{BASE}/auth/profile", headers=hdr_cust, json={"name": "Layla Ahmed"})
    show("profile name", r)
r = requests.get(f"{BASE}/auth/me", headers=hdr_cust)
b = show("/auth/me", r)
user = b.get("user", {})
check(
    "Customer /auth/me → user_type=customer & phone NOT hidden",
    r.status_code == 200
    and user.get("user_type") == "customer"
    and user.get("phone") not in ("07517300194", "+9647517300194"),
    f"user={user}",
)

# ----------------------------------------------------------------------
# C. Centralized order workflow
# ----------------------------------------------------------------------
section("C. Centralized order workflow (no driver broadcast)")

# 10 create order
print("[10] customer creates scheduled order")
order_payload = {
    "service_type": "goods",
    "pickup": {"address": "P", "latitude": 36.34, "longitude": 43.13},
    "dropoff": {"address": "D", "latitude": 36.37, "longitude": 43.17},
    "vehicle_type": "kia_pickup",
    "cargo_description": "box",
    "booking_type": "scheduled",
    "scheduled_date": "2026-06-25",
    "scheduled_time": "14:30",
    "customer_live_location": {"address": "home", "latitude": 36.34, "longitude": 43.13},
}
r = requests.post(f"{BASE}/orders", headers=hdr_cust, json=order_payload)
b = show("create order", r)
order = b.get("order", {}) if isinstance(b, dict) else {}
order_id = order.get("id")
check(
    "Order created with scheduling + live_location",
    r.status_code == 200
    and order.get("status") == "pending"
    and order.get("booking_type") == "scheduled"
    and order.get("scheduled_date") == "2026-06-25"
    and order.get("scheduled_time") == "14:30"
    and isinstance(order.get("customer_live_location"), dict)
    and order_id,
    f"status={r.status_code} order_status={order.get('status')}",
)

# 11 driver login
print("[11] Driver login +9647701234567")
r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "+9647701234567"})
show("send-otp driver", r)
r = requests.post(
    f"{BASE}/auth/verify-otp", json={"phone": "+9647701234567", "code": "123456"}
)
b = show("verify-otp driver", r)
# If driver is unapproved, re-approve via admin and retry
if r.status_code == 403:
    # find driver id then toggle-approval
    drv = next(
        (d for d in drivers if d.get("phone") == "+9647701234567"),
        None,
    )
    if drv:
        print("  Driver was unapproved; toggling approval ON")
        rr = requests.put(
            f"{BASE}/admin/drivers/{drv['id']}/toggle-approval", headers=hdr_owner
        )
        show("toggle-approval", rr)
        r = requests.post(
            f"{BASE}/auth/verify-otp",
            json={"phone": "+9647701234567", "code": "123456"},
        )
        b = show("retry verify-otp", r)
driver_token = b.get("token")
driver_id = b.get("user", {}).get("id")
check(
    "Driver verify-otp → 200 with token",
    r.status_code == 200 and driver_token and driver_id,
    f"status={r.status_code}",
)
hdr_drv = {"Authorization": f"Bearer {driver_token}"}

# 12 driver online
print("[12] driver status online=true")
r = requests.put(f"{BASE}/driver/status", headers=hdr_drv, json={"is_online": True})
b = show("driver/status", r)
check("driver online=true", r.status_code == 200, f"status={r.status_code}")

# 13 driver available orders BEFORE assignment
print("[13] GET /driver/orders/available (should be 0 for our pending order)")
r = requests.get(f"{BASE}/driver/orders/available", headers=hdr_drv)
b = show("available", r)
avail = b.get("orders", []) if isinstance(b, dict) else []
has_ours = any(o.get("id") == order_id for o in avail)
check(
    "Pending order NOT visible to driver before admin assigns",
    r.status_code == 200 and not has_ours,
    f"avail_count={len(avail)}, has_ours={has_ours}",
)

# 14 driver tries to accept un-assigned order
print("[14] driver accept un-assigned order")
r = requests.post(f"{BASE}/driver/orders/{order_id}/accept", headers=hdr_drv)
show("accept-unassigned", r)
check(
    "Accept un-assigned order → 4xx",
    400 <= r.status_code < 500,
    f"status={r.status_code}",
)

# ----------------------------------------------------------------------
# D. Admin assigns driver
# ----------------------------------------------------------------------
section("D. Admin assigns driver")

# 15
print("[15] POST /admin/orders/{id}/assign-driver")
r = requests.post(
    f"{BASE}/admin/orders/{order_id}/assign-driver",
    headers=hdr_owner,
    json={"driver_id": driver_id},
)
b = show("assign-driver", r)
assigned_order = b.get("order", {}) if isinstance(b, dict) else {}
check(
    "Assign-driver → 200 with status=assigned + assigned_driver_id matches",
    r.status_code == 200
    and assigned_order.get("status") == "assigned"
    and assigned_order.get("assigned_driver_id") == driver_id,
    f"status={r.status_code} order_status={assigned_order.get('status')}",
)

# 16
print("[16] GET /driver/orders/available — should now contain order")
r = requests.get(f"{BASE}/driver/orders/available", headers=hdr_drv)
b = show("available after assign", r)
avail = b.get("orders", []) if isinstance(b, dict) else []
has_ours = any(o.get("id") == order_id for o in avail)
check(
    "Assigned order appears in driver's available list",
    r.status_code == 200 and has_ours,
    f"available_count={len(avail)} has_ours={has_ours}",
)

# 17 driver accept
print("[17] driver accepts assigned order")
r = requests.post(f"{BASE}/driver/orders/{order_id}/accept", headers=hdr_drv)
b = show("accept", r)
accepted = b.get("order", {}) if isinstance(b, dict) else {}
check(
    "Driver accept → 200 + status=accepted",
    r.status_code == 200 and accepted.get("status") == "accepted",
    f"status={r.status_code}",
)

# 18 re-assign accepted order
print("[18] re-assign accepted order")
r = requests.post(
    f"{BASE}/admin/orders/{order_id}/assign-driver",
    headers=hdr_owner,
    json={"driver_id": driver_id},
)
show("re-assign", r)
check(
    "Re-assigning accepted order → 400",
    r.status_code == 400,
    f"status={r.status_code}",
)

# 19 assign to unapproved driver
print("[19] try to assign to an UN-approved fresh driver")
# Create a fresh driver via admin
fresh_phone = f"+96477{random.randint(10000000, 99999999)}"
r = requests.post(
    f"{BASE}/admin/drivers",
    headers=hdr_owner,
    json={
        "name": "Mu7ammed Khaled",
        "phone": fresh_phone,
        "vehicle_type": "kia_pickup",
        "vehicle_plate": "موصل 99001",
    },
)
b = show("create fresh driver", r)
fresh_id = b.get("driver", {}).get("id") if isinstance(b, dict) else None
if fresh_id:
    # Toggle approval OFF
    rr = requests.put(
        f"{BASE}/admin/drivers/{fresh_id}/toggle-approval", headers=hdr_owner
    )
    show("toggle approval off", rr)
    # Need a fresh PENDING order
    fresh_order_payload = dict(order_payload, cargo_description="for unapproved test")
    rr = requests.post(f"{BASE}/orders", headers=hdr_cust, json=fresh_order_payload)
    fresh_order_id = rr.json().get("order", {}).get("id")
    rr = requests.post(
        f"{BASE}/admin/orders/{fresh_order_id}/assign-driver",
        headers=hdr_owner,
        json={"driver_id": fresh_id},
    )
    bb = show("assign to unapproved", rr)
    detail = bb.get("detail", "") if isinstance(bb, dict) else ""
    check(
        "Assign to unapproved driver → 400 'Driver is not approved'",
        rr.status_code == 400 and "not approved" in detail.lower(),
        f"status={rr.status_code} detail={detail}",
    )
else:
    FAILS.append("Could not create fresh driver for test 19")
    FAIL += 1
    print("  ❌ Could not create fresh driver")

# ----------------------------------------------------------------------
# E. Price override
# ----------------------------------------------------------------------
section("E. Price override")

# 20
print("[20] override price 99999")
r = requests.post(
    f"{BASE}/admin/orders/{order_id}/override-price",
    headers=hdr_owner,
    json={"price": 99999},
)
b = show("override 99999", r)
o = b.get("order", {}) if isinstance(b, dict) else {}
check(
    "Override price=99999 → 200, final_price==99999",
    r.status_code == 200 and (o.get("final_price") == 99999 or o.get("final_price") == 99999.0),
    f"status={r.status_code} final={o.get('final_price')}",
)

# 21
print("[21] override price 500 (too low)")
r = requests.post(
    f"{BASE}/admin/orders/{order_id}/override-price",
    headers=hdr_owner,
    json={"price": 500},
)
show("override 500", r)
check("Override price=500 → 400", r.status_code == 400, f"status={r.status_code}")

# 22
print("[22] override with customer token")
r = requests.post(
    f"{BASE}/admin/orders/{order_id}/override-price",
    headers=hdr_cust,
    json={"price": 50000},
)
show("override customer", r)
check("Customer cannot override price → 403", r.status_code == 403, f"status={r.status_code}")

# ----------------------------------------------------------------------
# F. Pricing settings
# ----------------------------------------------------------------------
section("F. Pricing settings")

# 23
print("[23] GET /admin/pricing-settings")
r = requests.get(f"{BASE}/admin/pricing-settings", headers=hdr_owner)
b = show("pricing-settings get", r)
s = b.get("settings", {}) if isinstance(b, dict) else {}
check(
    "/admin/pricing-settings → 200 with min_price + max_auto_price",
    r.status_code == 200 and "min_price" in s and "max_auto_price" in s,
    f"keys={list(s.keys())}",
)

# 24
print("[24] PUT /admin/pricing-settings min_price=12500 max_auto_price=80000")
r = requests.put(
    f"{BASE}/admin/pricing-settings",
    headers=hdr_owner,
    json={"min_price": 12500, "max_auto_price": 80000},
)
show("pricing-settings put", r)
check("PUT pricing-settings → 200", r.status_code == 200, f"status={r.status_code}")

r = requests.get(f"{BASE}/admin/pricing-settings", headers=hdr_owner)
b = show("pricing-settings re-get", r)
s2 = b.get("settings", {}) if isinstance(b, dict) else {}
check(
    "GET reflects updated min_price=12500 & max_auto_price=80000",
    s2.get("min_price") == 12500 and s2.get("max_auto_price") == 80000,
    f"got min={s2.get('min_price')} max={s2.get('max_auto_price')}",
)

# 25
print("[25] PUT pricing-settings with customer token")
r = requests.put(
    f"{BASE}/admin/pricing-settings",
    headers=hdr_cust,
    json={"min_price": 1},
)
show("pricing-settings customer", r)
check(
    "Customer PUT pricing-settings → 403",
    r.status_code == 403,
    f"status={r.status_code}",
)

# ----------------------------------------------------------------------
# G. Hidden admin cannot be created as driver
# ----------------------------------------------------------------------
section("G. Hidden admin cannot be created as customer/driver")

# 26 — try to create driver with hidden phone
print("[26] try creating driver with hidden phone")
for ph in ("07517300194", "+9647517300194"):
    r = requests.post(
        f"{BASE}/admin/drivers",
        headers=hdr_owner,
        json={
            "name": "Should Fail",
            "phone": ph,
            "vehicle_type": "kia_pickup",
            "vehicle_plate": "موصل 00000",
        },
    )
    b = show(f"create driver phone={ph}", r)
    rejected = r.status_code == 400
    check(
        f"Create driver with hidden phone={ph} → 400 (block bug if 200)",
        rejected,
        f"status={r.status_code} body={b}",
    )
    # If it created a driver, delete it to keep DB clean
    if not rejected and isinstance(b, dict) and b.get("driver", {}).get("id"):
        bad_id = b["driver"]["id"]
        requests.delete(f"{BASE}/admin/drivers/{bad_id}", headers=hdr_owner)
        print(f"  (cleaned up created driver {bad_id})")

# ----------------------------------------------------------------------
# H. Regression of unrelated flows
# ----------------------------------------------------------------------
section("H. Regression of unrelated flows")

# 27
print("[27] POST /auth/admin/login admin/naqal2026")
r = requests.post(
    f"{BASE}/auth/admin/login", json={"username": "admin", "password": "naqal2026"}
)
b = show("admin/login", r)
check(
    "Username admin login → 200",
    r.status_code == 200 and b.get("token"),
    f"status={r.status_code}",
)

# 28
print("[28] GET /admin/orders/pending-review")
r = requests.get(f"{BASE}/admin/orders/pending-review", headers=hdr_owner)
show("pending-review", r)
check("/admin/orders/pending-review → 200", r.status_code == 200, f"status={r.status_code}")

# 29
print("[29] GET /web-admin/")
r = requests.get(f"{BASE}/web-admin/")
print(f"  → web-admin status={r.status_code} ct={r.headers.get('content-type')} bytes={len(r.content)}")
check(
    "/api/web-admin/ → 200 HTML",
    r.status_code == 200 and "text/html" in (r.headers.get("content-type") or ""),
    f"status={r.status_code} ct={r.headers.get('content-type')}",
)

# ----------------------------------------------------------------------
print(f"\n{'='*70}\nRESULTS: {PASS} passed, {FAIL} failed\n{'='*70}")
if FAILS:
    print("Failures:")
    for f in FAILS:
        print(f"  - {f}")
sys.exit(0 if FAIL == 0 else 1)
