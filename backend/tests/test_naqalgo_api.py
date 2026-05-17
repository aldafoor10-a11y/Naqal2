"""NAQAL GO Backend API Tests - Phase 1 MVP."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://naqal-go.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["app"] == "NAQAL GO"
        assert data["status"] == "ok"

    def test_health_db(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- Auth: OTP / Profile ----------
class TestAuth:
    customer_token = None
    customer_id = None
    test_phone_raw = "7700009911"  # uses test-prefix-like data
    normalized_phone = "+9647700009911"

    def test_send_otp_normalizes(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": self.test_phone_raw})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["phone"] == self.normalized_phone

    def test_send_otp_already_prefixed(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": "+9647700009911"})
        assert r.status_code == 200
        assert r.json()["phone"] == "+9647700009911"

    def test_send_otp_invalid_short(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": "12"})
        # normalized -> "+96412" -> len 6 < 10
        assert r.status_code == 400

    def test_verify_otp_new_user(self):
        # Send first
        requests.post(f"{API}/auth/send-otp", json={"phone": self.test_phone_raw})
        r = requests.post(
            f"{API}/auth/verify-otp",
            json={"phone": self.test_phone_raw, "code": "123456"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "token" in data and len(data["token"]) > 20
        assert "user" in data
        assert data["user"]["phone"] == self.normalized_phone
        assert data["user"]["user_type"] == "customer"
        # New users should need name
        assert data["needs_name"] is True
        # Persist for later tests
        TestAuth.customer_token = data["token"]
        TestAuth.customer_id = data["user"]["id"]

    def test_verify_otp_invalid_code(self):
        requests.post(f"{API}/auth/send-otp", json={"phone": "7700009912"})
        r = requests.post(
            f"{API}/auth/verify-otp",
            json={"phone": "7700009912", "code": "000000"},
        )
        assert r.status_code == 400

    def test_update_profile(self):
        assert TestAuth.customer_token, "Need token from prior test"
        headers = {"Authorization": f"Bearer {TestAuth.customer_token}"}
        r = requests.put(f"{API}/auth/profile", json={"name": "TEST_Customer"}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["name"] == "TEST_Customer"

    def test_get_me(self):
        assert TestAuth.customer_token
        headers = {"Authorization": f"Bearer {TestAuth.customer_token}"}
        r = requests.get(f"{API}/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["user"]["id"] == TestAuth.customer_id
        assert r.json()["user"]["name"] == "TEST_Customer"

    def test_get_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Admin ----------
class TestAdmin:
    def test_admin_login_success(self):
        r = requests.post(f"{API}/auth/admin/login", json={"username": "admin", "password": "naqal2026"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "token" in data
        assert data["admin"]["username"] == "admin"
        assert data["admin"]["user_type"] == "admin"

    def test_admin_login_wrong_password(self):
        r = requests.post(f"{API}/auth/admin/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401


# ---------- Pricing ----------
class TestPricing:
    def test_pricing_config(self):
        r = requests.get(f"{API}/pricing/config")
        assert r.status_code == 200
        data = r.json()
        assert "tiers" in data and len(data["tiers"]) == 4
        assert data["vehicle_multipliers"]["kia_pickup"] == 1.0
        assert data["vehicle_multipliers"]["large_truck"] == 1.35
        assert data["currency"] == "IQD"

    def test_estimate_short_distance_under_3km(self):
        # Two points very close (~0.5km apart in Mosul)
        r = requests.post(
            f"{API}/pricing/estimate",
            json={
                "pickup_lat": 36.3450, "pickup_lng": 43.1450,
                "dropoff_lat": 36.3470, "dropoff_lng": 43.1470,
                "vehicle_type": "kia_pickup",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "distance_km" in data
        assert data["distance_km"] < 3
        # Under 3km should give the 7000 fixed (before peak)
        assert data["base_price"] == 7000
        assert data["vehicle_multiplier"] == 1.0
        assert "final_price" in data and data["final_price"] > 0
        assert "breakdown" in data and isinstance(data["breakdown"], list)
        assert "eta_minutes" in data

    def test_estimate_vehicle_multipliers(self):
        body = {
            "pickup_lat": 36.3450, "pickup_lng": 43.1450,
            "dropoff_lat": 36.3470, "dropoff_lng": 43.1470,
        }
        prices = {}
        for v in ["kia_pickup", "pickup_truck", "medium_truck", "large_truck"]:
            r = requests.post(f"{API}/pricing/estimate", json={**body, "vehicle_type": v})
            assert r.status_code == 200
            prices[v] = r.json()["final_price"]
        # Should ascend strictly (or at least be non-decreasing). Since values round to 500 IQD they should differ.
        assert prices["kia_pickup"] <= prices["pickup_truck"] <= prices["medium_truck"] <= prices["large_truck"]
        # Verify ratio: large vs kia ~ 1.35
        assert prices["large_truck"] > prices["kia_pickup"]

    def test_estimate_3_to_10_km_range(self):
        # ~5km apart - lat 0.045 ~ 5km
        r = requests.post(
            f"{API}/pricing/estimate",
            json={
                "pickup_lat": 36.3000, "pickup_lng": 43.1000,
                "dropoff_lat": 36.3450, "dropoff_lng": 43.1000,
                "vehicle_type": "kia_pickup",
            },
        )
        assert r.status_code == 200
        data = r.json()
        # Distance with 1.2x road factor will be ~6km
        assert 3 < data["distance_km"] < 10
        # base = 7000 + (distance-3)*1800
        # Should be > 7000
        assert data["base_price"] > 7000


# ---------- Orders ----------
class TestOrders:
    order_id = None

    @classmethod
    def _get_customer_token(cls):
        if TestAuth.customer_token:
            return TestAuth.customer_token
        # fallback
        requests.post(f"{API}/auth/send-otp", json={"phone": TestAuth.test_phone_raw})
        r = requests.post(
            f"{API}/auth/verify-otp",
            json={"phone": TestAuth.test_phone_raw, "code": "123456"},
        )
        return r.json()["token"]

    def test_create_order(self):
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "service_type": "furniture",
            "pickup": {"address": "TEST_Pickup", "latitude": 36.3450, "longitude": 43.1450},
            "dropoff": {"address": "TEST_Dropoff", "latitude": 36.3550, "longitude": 43.1600},
            "vehicle_type": "pickup_truck",
            "cargo_description": "TEST_Sofa and table",
            "cargo_notes": "TEST",
            "cargo_images": [],
        }
        r = requests.post(f"{API}/orders", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        order = data["order"]
        assert order["order_number"].startswith("NG")
        assert order["status"] == "pending"
        assert order["service_type"] == "furniture"
        assert order["vehicle_type"] == "pickup_truck"
        assert order["final_price"] > 0
        assert "_id" not in order  # ObjectId excluded
        TestOrders.order_id = order["id"]

    def test_list_orders_returns_own(self):
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{API}/orders", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "orders" in data
        assert data["count"] >= 1
        # All should belong to this customer
        for o in data["orders"]:
            assert "_id" not in o

    def test_get_single_order(self):
        assert TestOrders.order_id
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{API}/orders/{TestOrders.order_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["order"]["id"] == TestOrders.order_id

    def test_get_other_user_order_forbidden(self):
        # Create a 2nd customer
        phone2 = "7700009922"
        requests.post(f"{API}/auth/send-otp", json={"phone": phone2})
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone2, "code": "123456"})
        token2 = r.json()["token"]
        assert TestOrders.order_id
        r = requests.get(
            f"{API}/orders/{TestOrders.order_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert r.status_code == 403

    def test_simulate_accept(self):
        assert TestOrders.order_id
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{API}/orders/{TestOrders.order_id}/simulate-accept", headers=headers)
        assert r.status_code == 200, r.text
        order = r.json()["order"]
        assert order["status"] == "accepted"
        assert order["driver_id"] is not None
        assert order["driver_location"] is not None
        assert order["driver_name"]

    def test_simulate_progress_cycle(self):
        assert TestOrders.order_id
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        expected = ["arriving", "picked_up", "in_transit", "completed"]
        for status in expected:
            r = requests.post(f"{API}/orders/{TestOrders.order_id}/simulate-progress", headers=headers)
            assert r.status_code == 200, r.text
            assert r.json()["order"]["status"] == status, f"Expected {status} got {r.json()['order']['status']}"

    def test_cancel_order_after_complete_fails(self):
        # Order is now completed, cancel should 400
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{API}/orders/{TestOrders.order_id}/cancel", headers=headers)
        assert r.status_code == 400

    def test_cancel_pending_order(self):
        # Create a fresh order then cancel
        token = self._get_customer_token()
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "service_type": "goods",
            "pickup": {"address": "TEST_P2", "latitude": 36.3450, "longitude": 43.1450},
            "dropoff": {"address": "TEST_D2", "latitude": 36.3470, "longitude": 43.1470},
            "vehicle_type": "kia_pickup",
            "cargo_description": "TEST_Boxes",
        }
        r = requests.post(f"{API}/orders", json=payload, headers=headers)
        oid = r.json()["order"]["id"]
        r = requests.post(f"{API}/orders/{oid}/cancel", headers=headers)
        assert r.status_code == 200
        # Verify
        r = requests.get(f"{API}/orders/{oid}", headers=headers)
        assert r.json()["order"]["status"] == "cancelled"
