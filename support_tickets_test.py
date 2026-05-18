"""
NAQAL GO – Support tickets endpoint tests
Target: public ingress at EXPO_PUBLIC_BACKEND_URL (+ /api)
Covers all flows in the review request.
"""
import os
import sys
import time
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
ENV_PATH = Path("/app/frontend/.env")
BASE = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE, "EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env"
API = f"{BASE}/api"
print(f"Using API base: {API}")

# Test phone numbers (real-looking Iraqi numbers)
CUSTOMER1_PHONE = "+9647700001111"
CUSTOMER2_PHONE = "+9647700002222"   # second customer for cross-tenant test
DRIVER_PHONE = "+9647701234567"      # seeded approved driver

results = []   # (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}{(' — ' + detail) if detail else ''}")


def post(path, json=None, token=None, expect=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.post(f"{API}{path}", json=json, headers=headers, timeout=30)
    return r


def get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(f"{API}{path}", headers=headers, timeout=30)


def put(path, json=None, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.put(f"{API}{path}", json=json, headers=headers, timeout=30)


def otp_login(phone, name=None):
    """Send + verify OTP. Returns token + user dict."""
    r = requests.post(f"{API}/auth/send-otp", json={"phone": phone}, timeout=30)
    assert r.status_code == 200, f"send-otp failed for {phone}: {r.status_code} {r.text}"
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "123456"}, timeout=30)
    assert r.status_code == 200, f"verify-otp failed for {phone}: {r.status_code} {r.text}"
    data = r.json()
    token = data["token"]
    user = data.get("user", {})
    # If new customer and name needed, update via register endpoint
    if name and not user.get("name"):
        r2 = requests.post(
            f"{API}/auth/register",
            json={"name": name},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if r2.status_code == 200:
            user = r2.json().get("user", user)
    return token, user


def admin_login():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"username": "admin", "password": "naqal2026"},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


# ---------- Authentication setup ----------
print("\n=== Setting up auth tokens ===")
cust1_token, cust1_user = otp_login(CUSTOMER1_PHONE, name="علي حسن")
print(f"Customer1 id={cust1_user.get('id')} name={cust1_user.get('name')}")

cust2_token, cust2_user = otp_login(CUSTOMER2_PHONE, name="سارة محمود")
print(f"Customer2 id={cust2_user.get('id')} name={cust2_user.get('name')}")

driver_token, driver_user = otp_login(DRIVER_PHONE)
print(f"Driver id={driver_user.get('id')} type={driver_user.get('user_type')}")

admin_token = admin_login()
print("Admin token acquired")

# ---------- 1. Customer creates ticket ----------
print("\n=== 1. Customer creates ticket ===")
r = post(
    "/support/tickets",
    json={"subject": "Payment issue", "message": "My payment failed but money was deducted"},
    token=cust1_token,
)
ticket_id = None
ok = r.status_code == 200
detail = f"status={r.status_code}"
if ok:
    body = r.json()
    t = body.get("ticket", {})
    ticket_id = t.get("id")
    checks = {
        "has_id": bool(ticket_id),
        "status_open": t.get("status") == "open",
        "messages_len_1": len(t.get("messages", [])) == 1,
        "author_role_customer": (
            t.get("messages", [{}])[0].get("author", {}).get("role") == "customer"
        ),
        "unread_for_admin_1": t.get("unread_for_admin") == 1,
    }
    ok = all(checks.values())
    detail = f"status=200 checks={checks} ticket_id={ticket_id}"
record("1. Customer creates ticket", ok, detail)
assert ticket_id, "Cannot continue without ticket_id"

# ---------- 2. List my tickets ----------
print("\n=== 2. List my tickets ===")
r = get("/support/tickets", token=cust1_token)
ok = r.status_code == 200 and r.json().get("count", 0) >= 1
record("2. List my tickets (customer)", ok, f"status={r.status_code} count={r.json().get('count') if r.status_code==200 else 'n/a'}")

# ---------- 3. Auth/role guards ----------
print("\n=== 3. Auth/role guards ===")
# 3a. Driver creating ticket -> 403
r = post(
    "/support/tickets",
    json={"subject": "Test", "message": "should fail"},
    token=driver_token,
)
record("3a. Driver POST /support/tickets → 403", r.status_code == 403, f"got {r.status_code}")

# 3b. No-token list -> 401
r = requests.get(f"{API}/support/tickets", timeout=30)
record("3b. No-token GET /support/tickets → 401", r.status_code == 401, f"got {r.status_code}")

# 3c. Different customer fetching someone else's ticket -> 403
r = get(f"/support/tickets/{ticket_id}", token=cust2_token)
record("3c. Other customer GET /support/tickets/{id} → 403", r.status_code == 403, f"got {r.status_code}")

# ---------- 4. Admin reply flow ----------
print("\n=== 4. Admin reply flow ===")
# 4a. Admin lists tickets and sees this one
r = get("/admin/support/tickets", token=admin_token)
ok = r.status_code == 200
appears = False
if ok:
    appears = any(t.get("id") == ticket_id for t in r.json().get("tickets", []))
record("4a. Admin sees ticket in /admin/support/tickets", ok and appears, f"status={r.status_code} appears={appears}")

# 4b. Admin replies
r = post(
    f"/support/tickets/{ticket_id}/messages",
    json={"message": "We're investigating"},
    token=admin_token,
)
ok = r.status_code == 200
detail = f"status={r.status_code}"
if ok:
    t = r.json().get("ticket", {})
    checks = {
        "status_pending": t.get("status") == "pending",
        "unread_for_customer_1": t.get("unread_for_customer") == 1,
        "messages_len_2": len(t.get("messages", [])) == 2,
    }
    ok = all(checks.values())
    detail = f"status=200 checks={checks}"
record("4b. Admin reply flips open→pending + unread_for_customer=1 + 2 messages", ok, detail)

# ---------- 5. Customer view clears unread ----------
print("\n=== 5. Customer view clears unread ===")
r = get(f"/support/tickets/{ticket_id}", token=cust1_token)
ok = r.status_code == 200
detail = f"status={r.status_code}"
if ok:
    t = r.json().get("ticket", {})
    ok = t.get("unread_for_customer") == 0
    detail = f"unread_for_customer={t.get('unread_for_customer')}"
record("5. Customer GET clears unread_for_customer", ok, detail)

# ---------- 6. Customer reply re-engages ----------
print("\n=== 6. Customer reply re-engages ===")
r = post(
    f"/support/tickets/{ticket_id}/messages",
    json={"message": "Thanks"},
    token=cust1_token,
)
ok = r.status_code == 200
detail = f"status={r.status_code}"
if ok:
    t = r.json().get("ticket", {})
    ok = len(t.get("messages", [])) == 3
    detail = f"messages_len={len(t.get('messages', []))}"
record("6. Customer reply yields 3 messages", ok, detail)

# ---------- 7. Admin status updates ----------
print("\n=== 7. Admin status updates ===")
# 7a. Set to resolved
r = put(f"/admin/support/tickets/{ticket_id}/status", json={"status": "resolved"}, token=admin_token)
record("7a. PUT status=resolved → 200", r.status_code == 200, f"got {r.status_code}")

# 7b. Customer replies on resolved ticket → status reverts to open
r = post(
    f"/support/tickets/{ticket_id}/messages",
    json={"message": "Still broken!"},
    token=cust1_token,
)
ok = r.status_code == 200
detail = f"status={r.status_code}"
if ok:
    t = r.json().get("ticket", {})
    ok = t.get("status") == "open"
    detail = f"status_after_customer_reply={t.get('status')}"
record("7b. Customer reply on resolved → status=open", ok, detail)

# 7c. Invalid status → 422
r = put(f"/admin/support/tickets/{ticket_id}/status", json={"status": "foo"}, token=admin_token)
record("7c. PUT status=foo → 422", r.status_code == 422, f"got {r.status_code}")

# 7d. Customer (non-admin) PUT status → 403
r = put(f"/admin/support/tickets/{ticket_id}/status", json={"status": "closed"}, token=cust1_token)
record("7d. Customer PUT admin status → 403", r.status_code == 403, f"got {r.status_code}")

# ---------- 8. Edge cases ----------
print("\n=== 8. Edge cases ===")
# 8a. Empty subject → 400
r = post("/support/tickets", json={"subject": "   ", "message": "hello"}, token=cust1_token)
record("8a. Empty subject → 400", r.status_code == 400, f"got {r.status_code}")

# 8b. Empty message on existing ticket → 400
r = post(f"/support/tickets/{ticket_id}/messages", json={"message": "   "}, token=cust1_token)
record("8b. Empty message → 400", r.status_code == 400, f"got {r.status_code}")

# 8c. GET nonexistent ticket → 404
r = get("/support/tickets/nonexistent-ticket-id-xyz", token=cust1_token)
record("8c. GET nonexistent ticket → 404", r.status_code == 404, f"got {r.status_code}")

# ---------- Summary ----------
print("\n=== SUMMARY ===")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"{passed}/{total} passed")
for name, ok, detail in results:
    print(f"  {'✅' if ok else '❌'} {name}{(' — ' + detail) if not ok else ''}")

sys.exit(0 if passed == total else 1)
