"""
NAQAL GO — backend re-test for:
 (A) GET /api/admin/stats analytics endpoint
 (B) Admin SPA mounted at /api/web-admin/
 (C) Driver E2E with Socket.IO real-time events
 (D) Auth-guard regression

Public ingress base URL pulled from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL).
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
import time
import uuid
from typing import Any, Optional

import httpx
import socketio

ROOT = "https://naqal-go.preview.emergentagent.com"
API = f"{ROOT}/api"
SOCKET_PATH = "/api/socket.io"

CUSTOMER_PHONE = "+9647700009999"
DRIVER_PHONE = "+9647701234567"
ADMIN_USER = "admin"
ADMIN_PASS = "naqal2026"
MOCK_OTP = "123456"

# Mosul approx — these two points are ~5 km apart (after the 1.2 road-factor)
MOSUL_A = {"latitude": 36.3450, "longitude": 43.1450, "address": "حي النور، الموصل"}
MOSUL_B = {"latitude": 36.3650, "longitude": 43.1750, "address": "حي الزهور، الموصل"}

results: list[tuple[str, bool, str]] = []


def rec(name: str, ok: bool, msg: str = "") -> None:
    results.append((name, ok, msg))
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {name}  {msg}")


# --------------------------- helpers ---------------------------
async def login_customer(client: httpx.AsyncClient, phone: str, name: str) -> str:
    r = await client.post(f"{API}/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    r = await client.post(
        f"{API}/auth/verify-otp", json={"phone": phone, "code": MOCK_OTP}
    )
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    # set / update profile name
    await client.put(
        f"{API}/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    return token


async def login_driver(client: httpx.AsyncClient) -> str:
    r = await client.post(f"{API}/auth/send-otp", json={"phone": DRIVER_PHONE})
    assert r.status_code == 200, r.text
    r = await client.post(
        f"{API}/auth/verify-otp", json={"phone": DRIVER_PHONE, "code": MOCK_OTP}
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


async def login_admin(client: httpx.AsyncClient) -> str:
    r = await client.post(
        f"{API}/auth/admin/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --------------------------- PART A: stats ---------------------------
async def part_a(client: httpx.AsyncClient, admin_token: str,
                customer_token: str, driver_token: str) -> None:
    # admin /admin/stats
    r = await client.get(
        f"{API}/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    if r.status_code != 200:
        rec("A2 admin stats 200", False, f"status={r.status_code} body={r.text[:200]}")
        return
    data = r.json()
    issues: list[str] = []

    totals = data.get("totals", {})
    for k in ("orders", "drivers", "online_drivers", "completed", "revenue", "open_tickets"):
        if k not in totals:
            issues.append(f"totals.{k} missing")

    pipeline = data.get("pipeline", {})
    for k in ("pending_review", "pending", "active"):
        if k not in pipeline:
            issues.append(f"pipeline.{k} missing")

    today = data.get("today", {})
    for k in ("orders_completed", "revenue"):
        if k not in today:
            issues.append(f"today.{k} missing")

    week = data.get("week", {})
    for k in ("orders_completed", "revenue"):
        if k not in week:
            issues.append(f"week.{k} missing")

    s7 = data.get("series_7d")
    if not isinstance(s7, list) or len(s7) != 7:
        issues.append(f"series_7d not 7 items (len={len(s7) if isinstance(s7, list) else 'N/A'})")
    else:
        # check shape
        date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
        for i, item in enumerate(s7):
            for k in ("day", "orders", "revenue"):
                if k not in item:
                    issues.append(f"series_7d[{i}].{k} missing")
            if "day" in item and not date_re.match(str(item["day"])):
                issues.append(f"series_7d[{i}].day not YYYY-MM-DD: {item['day']}")
        # ascending
        days = [item.get("day") for item in s7]
        if days != sorted(days):
            issues.append(f"series_7d not ascending: {days}")

    rec(
        "A2 GET /api/admin/stats shape",
        not issues,
        f"totals.orders={totals.get('orders')} drivers={totals.get('drivers')} "
        f"online={totals.get('online_drivers')} revenue={totals.get('revenue')} "
        f"series7d.first={s7[0] if s7 else None} | issues={issues}",
    )

    # A3 — no token
    r = await client.get(f"{API}/admin/stats")
    rec("A3 stats without token → 401", r.status_code == 401, f"status={r.status_code}")

    # A4 — customer token
    r = await client.get(
        f"{API}/admin/stats", headers={"Authorization": f"Bearer {customer_token}"}
    )
    rec("A4 stats with CUSTOMER token → 403", r.status_code == 403, f"status={r.status_code}")

    # A5 — driver token
    r = await client.get(
        f"{API}/admin/stats", headers={"Authorization": f"Bearer {driver_token}"}
    )
    rec("A5 stats with DRIVER token → 403", r.status_code == 403, f"status={r.status_code}")


# --------------------------- PART B: SPA ---------------------------
async def part_b(client: httpx.AsyncClient) -> None:
    # B6 /api/web-admin/
    r = await client.get(f"{API}/web-admin/")
    has_root = '<div id="root">' in r.text
    ok = (
        r.status_code == 200
        and "text/html" in r.headers.get("content-type", "")
        and has_root
    )
    rec(
        "B6 /api/web-admin/ root html",
        ok,
        f"status={r.status_code} ct={r.headers.get('content-type')} hasRoot={has_root}",
    )

    # B7 fallback
    r = await client.get(f"{API}/web-admin/anything-random-{uuid.uuid4().hex[:6]}")
    ok = r.status_code == 200 and "text/html" in r.headers.get("content-type", "")
    rec(
        "B7 /api/web-admin/random SPA fallback",
        ok,
        f"status={r.status_code} ct={r.headers.get('content-type')}",
    )

    # B8 asset — discover from index.html
    r = await client.get(f"{API}/web-admin/")
    matches = re.findall(r"/api/web-admin/assets/([A-Za-z0-9_.\-]+\.(?:css|js))", r.text)
    if not matches:
        rec("B8 first asset reachable", False, "no asset reference found in index.html")
        return
    asset = matches[0]
    r = await client.get(f"{API}/web-admin/assets/{asset}")
    ct = r.headers.get("content-type", "")
    is_css_or_js = ("css" in ct) or ("javascript" in ct) or ("application/js" in ct)
    rec(
        f"B8 asset {asset}",
        r.status_code == 200 and is_css_or_js,
        f"status={r.status_code} ct={ct}",
    )


# --------------------------- PART C: socket E2E ---------------------------
class EventCollector:
    def __init__(self) -> None:
        self.connected = False
        self.sid: Optional[str] = None
        self.order_updates: list[dict] = []
        self.driver_locations: list[dict] = []
        self.lock = asyncio.Lock()


async def part_c(client: httpx.AsyncClient, customer_token: str,
                 driver_token: str) -> Optional[str]:
    # C10 driver online
    r = await client.put(
        f"{API}/driver/status",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"is_online": True},
    )
    rec("C10 driver online toggle", r.status_code == 200, f"status={r.status_code}")

    # C11 connect customer socket
    sio_client = socketio.AsyncClient(reconnection=False, logger=False, engineio_logger=False)
    ec = EventCollector()

    @sio_client.event
    async def connect():
        ec.connected = True
        ec.sid = sio_client.get_sid()

    @sio_client.on("order_update")
    async def _ou(data):
        async with ec.lock:
            ec.order_updates.append(data)

    @sio_client.on("driver_location")
    async def _dl(data):
        async with ec.lock:
            ec.driver_locations.append(data)

    try:
        await sio_client.connect(
            ROOT,
            socketio_path=SOCKET_PATH,
            auth={"token": customer_token},
            transports=["websocket", "polling"],
            wait=True,
            wait_timeout=10,
        )
    except Exception as exc:
        rec("C11 customer socket connect", False, f"exc={exc!r}")
        return None

    rec(
        "C11 customer socket connected",
        ec.connected and bool(ec.sid),
        f"sid={ec.sid}",
    )

    # C12 customer creates short order
    order_payload = {
        "service_type": "goods",
        "pickup": MOSUL_A,
        "dropoff": MOSUL_B,
        "vehicle_type": "kia_pickup",
        "cargo_description": "صناديق صغيرة",
        "cargo_notes": "حذر",
    }
    r = await client.post(
        f"{API}/orders",
        headers={"Authorization": f"Bearer {customer_token}"},
        json=order_payload,
    )
    if r.status_code != 200:
        rec("C12 create order", False, f"status={r.status_code} body={r.text[:200]}")
        await sio_client.disconnect()
        return None
    order = r.json()["order"]
    order_id = order["id"]
    rec(
        "C12 create order",
        True,
        f"id={order_id[:8]} distance={order.get('distance_km')} price={order.get('final_price')} status={order.get('status')}",
    )
    if order.get("status") != "pending":
        rec("C12 order status==pending", False, f"got {order.get('status')}")
        await sio_client.disconnect()
        return None

    # C13 subscribe_order
    try:
        ack = await sio_client.call(
            "subscribe_order", {"order_id": order_id}, timeout=5
        )
        rec(
            "C13 subscribe_order ack",
            isinstance(ack, dict) and ack.get("ok") is True,
            f"ack={ack}",
        )
    except Exception as exc:
        rec("C13 subscribe_order ack", False, f"exc={exc!r}")
        await sio_client.disconnect()
        return None

    # baseline event counts before driver actions
    baseline_ou = len(ec.order_updates)
    baseline_dl = len(ec.driver_locations)

    # C14 driver accepts
    r = await client.post(
        f"{API}/driver/orders/{order_id}/accept",
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    if r.status_code != 200:
        rec("C14 driver accept", False, f"status={r.status_code} body={r.text[:200]}")
        await sio_client.disconnect()
        return None

    # wait for the "accepted" order_update event
    deadline = time.time() + 4
    saw_accepted = False
    while time.time() < deadline:
        if len(ec.order_updates) > baseline_ou:
            last = ec.order_updates[-1]
            st = (last.get("order") or {}).get("status")
            if st == "accepted":
                saw_accepted = True
                break
        await asyncio.sleep(0.1)
    rec(
        "C14 socket order_update accepted within 3s",
        saw_accepted,
        f"updates_received={len(ec.order_updates) - baseline_ou}",
    )

    # C15 driver location push
    baseline_dl = len(ec.driver_locations)
    test_lat = 36.3500
    test_lng = 43.1500
    r = await client.put(
        f"{API}/driver/location",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"latitude": test_lat, "longitude": test_lng},
    )
    if r.status_code != 200:
        rec("C15 driver location POST", False, f"status={r.status_code} body={r.text[:200]}")
    else:
        deadline = time.time() + 4
        got_loc = None
        while time.time() < deadline:
            if len(ec.driver_locations) > baseline_dl:
                got_loc = ec.driver_locations[-1]
                break
            await asyncio.sleep(0.1)
        ok = False
        msg = ""
        if got_loc:
            loc = got_loc.get("location") or {}
            lat = loc.get("latitude")
            lng = loc.get("longitude")
            ok = abs(lat - test_lat) < 1e-6 and abs(lng - test_lng) < 1e-6
            msg = f"got lat={lat} lng={lng}"
        rec("C15 driver_location event within 3s", ok, msg or "no event received")

    # C16 progress through statuses
    statuses = ["arriving", "picked_up", "in_transit", "completed"]
    for st in statuses:
        baseline_ou = len(ec.order_updates)
        r = await client.post(
            f"{API}/driver/orders/{order_id}/status",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"status": st},
        )
        if r.status_code != 200:
            rec(f"C16 PUT status→{st}", False, f"status={r.status_code} body={r.text[:200]}")
            break
        # wait for event
        deadline = time.time() + 4
        saw = False
        while time.time() < deadline:
            if len(ec.order_updates) > baseline_ou:
                last = ec.order_updates[-1]
                if (last.get("order") or {}).get("status") == st:
                    saw = True
                    break
            await asyncio.sleep(0.1)
        rec(f"C16 socket order_update→{st}", saw, f"updates_since={len(ec.order_updates) - baseline_ou}")

    # C17 final GET
    r = await client.get(
        f"{API}/orders/{order_id}",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    if r.status_code != 200:
        rec("C17 GET final order", False, f"status={r.status_code} body={r.text[:200]}")
    else:
        # Endpoint may return {"order": ...} or order directly
        body = r.json()
        ord_obj = body.get("order") if isinstance(body, dict) and "order" in body else body
        ok = (
            ord_obj.get("status") == "completed"
            and ord_obj.get("driver_location") is not None
        )
        rec(
            "C17 final order completed + driver_location set",
            ok,
            f"status={ord_obj.get('status')} driver_location={ord_obj.get('driver_location')}",
        )

    await sio_client.disconnect()
    return order_id


# --------------------------- PART D: regression ---------------------------
async def part_d(client: httpx.AsyncClient, customer_token: str, driver_token: str) -> None:
    # D18 customer → /admin/orders → 403
    r = await client.get(
        f"{API}/admin/orders",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    rec("D18 customer→/admin/orders 403", r.status_code == 403, f"status={r.status_code}")

    # D19 driver → POST /admin/drivers → 403
    r = await client.post(
        f"{API}/admin/drivers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "phone": "+9647709990000",
            "name": "x",
            "license_number": "X",
            "vehicle_type": "kia_pickup",
            "vehicle_plate": "X",
        },
    )
    rec("D19 driver→POST /admin/drivers 403", r.status_code == 403, f"status={r.status_code}")

    # D20 admin login with wrong password → 401
    r = await client.post(
        f"{API}/auth/admin/login",
        json={"username": ADMIN_USER, "password": "wrong-pass"},
    )
    rec("D20 admin wrong password → 401", r.status_code == 401, f"status={r.status_code}")


async def main() -> int:
    async with httpx.AsyncClient(timeout=30.0) as client:
        print(f"== Logging in admin/customer/driver against {API}")
        admin_token = await login_admin(client)
        rec("login admin", bool(admin_token), "")

        customer_token = await login_customer(client, CUSTOMER_PHONE, "Socket Test")
        rec("login customer +9647700009999", bool(customer_token), "")

        driver_token = await login_driver(client)
        rec("login driver +9647701234567", bool(driver_token), "")

        print("\n== Part A: /api/admin/stats ==")
        await part_a(client, admin_token, customer_token, driver_token)

        print("\n== Part B: Admin SPA ==")
        await part_b(client)

        print("\n== Part C: Driver socket E2E ==")
        await part_c(client, customer_token, driver_token)

        print("\n== Part D: Auth-guard regression ==")
        await part_d(client, customer_token, driver_token)

    print("\n================ SUMMARY ================")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} passed")
    failed = [r for r in results if not r[1]]
    if failed:
        print("\nFAILURES:")
        for n, _ok, msg in failed:
            print(f"  - {n}: {msg}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
