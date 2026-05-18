"""NAQAL GO Iteration 4 - long-distance pricing cap + manual review + admin endpoints."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://naqal-go.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

# Mosul center
PICKUP_LAT, PICKUP_LNG = 36.3450, 43.1450


def _dropoff_for_distance(road_km: float):
    """Compute a dropoff lat so that the road distance (1.2x haversine) is ~road_km."""
    # 1 deg lat ~ 111.32 km. Use straight-line target = road_km / 1.2
    straight = road_km / 1.2
    dlat = straight / 111.32
    return PICKUP_LAT + dlat, PICKUP_LNG


# ------------- Pricing endpoint -------------
class TestPricingCap:
    def test_pricing_config_has_new_keys(self):
        r = requests.get(f"{API}/pricing/config")
        assert r.status_code == 200
        d = r.json()
        assert d["max_auto_price"] == 75000
        assert d["auto_cap_distance_km"] == 75
        assert d["manual_review_distance_km"] == 130

    def test_estimate_short_under_75km_normal(self):
        lat, lng = _dropoff_for_distance(50)
        r = requests.post(
            f"{API}/pricing/estimate",
            json={
                "pickup_lat": PICKUP_LAT, "pickup_lng": PICKUP_LNG,
                "dropoff_lat": lat, "dropoff_lng": lng,
                "vehicle_type": "kia_pickup",
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["requires_manual_pricing"] is False
        assert d["is_capped"] is False
        assert d["final_price"] is not None and d["final_price"] > 0
        assert d["final_price"] < 75000 or d["distance_km"] < 75
        assert 45 < d["distance_km"] < 55

    def test_estimate_75_to_130_is_capped(self):
        for target_km in (80, 100, 125):
            lat, lng = _dropoff_for_distance(target_km)
            r = requests.post(
                f"{API}/pricing/estimate",
                json={
                    "pickup_lat": PICKUP_LAT, "pickup_lng": PICKUP_LNG,
                    "dropoff_lat": lat, "dropoff_lng": lng,
                    "vehicle_type": "kia_pickup",
                },
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["requires_manual_pricing"] is False, f"target {target_km}: {d}"
            assert d["distance_km"] >= 75
            assert d["distance_km"] <= 130
            assert d["is_capped"] is True, f"target {target_km}: {d}"
            assert d["final_price"] == 75000, f"target {target_km}: {d}"

    def test_estimate_over_130_requires_manual(self):
        lat, lng = _dropoff_for_distance(150)
        r = requests.post(
            f"{API}/pricing/estimate",
            json={
                "pickup_lat": PICKUP_LAT, "pickup_lng": PICKUP_LNG,
                "dropoff_lat": lat, "dropoff_lng": lng,
                "vehicle_type": "kia_pickup",
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["requires_manual_pricing"] is True
        assert d["final_price"] is None
        assert d["distance_km"] > 130
        assert d["message"] == (
            "Long-distance orders above 130 KM require manual pricing approval from management."
        )


# ------------- Helpers -------------
def _get_customer_token():
    phone = "7700009977"
    requests.post(f"{API}/auth/send-otp", json={"phone": phone})
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "123456"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    # ensure name set so endpoints which need it are happy
    requests.put(
        f"{API}/auth/profile",
        json={"name": "TEST_Iter4_Customer"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    return tok


def _get_admin_token():
    r = requests.post(
        f"{API}/auth/admin/login", json={"username": "admin", "password": "naqal2026"}
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ------------- Order creation by distance -------------
class TestOrderCreationByDistance:
    short_order_id = None
    capped_order_id = None
    manual_order_id = None

    def _make_order(self, target_km: float):
        token = _get_customer_token()
        lat, lng = _dropoff_for_distance(target_km)
        r = requests.post(
            f"{API}/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "service_type": "goods",
                "pickup": {"address": "TEST_P", "latitude": PICKUP_LAT, "longitude": PICKUP_LNG},
                "dropoff": {"address": "TEST_D", "latitude": lat, "longitude": lng},
                "vehicle_type": "kia_pickup",
                "cargo_description": "TEST_iter4 box",
                "cargo_notes": "",
                "cargo_images": [],
            },
        )
        assert r.status_code == 200, r.text
        return r.json()["order"]

    def test_order_short_distance_normal_pending(self):
        o = self._make_order(50)
        assert o["status"] == "pending"
        assert o["requires_manual_pricing"] is False
        assert o["is_capped"] is False
        assert o["final_price"] > 0
        TestOrderCreationByDistance.short_order_id = o["id"]

    def test_order_75_to_130_capped(self):
        o = self._make_order(100)
        assert o["status"] == "pending"
        assert o["requires_manual_pricing"] is False
        assert o["is_capped"] is True
        assert o["final_price"] == 75000
        TestOrderCreationByDistance.capped_order_id = o["id"]

    def test_order_over_130_pending_review(self):
        o = self._make_order(150)
        assert o["status"] == "pending_review"
        assert o["requires_manual_pricing"] is True
        assert o["final_price"] == 0
        TestOrderCreationByDistance.manual_order_id = o["id"]


# ------------- Admin endpoints -------------
class TestAdminEndpoints:
    def test_pending_review_requires_admin_403_for_customer(self):
        tok = _get_customer_token()
        r = requests.get(
            f"{API}/admin/orders/pending-review",
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 403

    def test_pending_review_no_token_401(self):
        r = requests.get(f"{API}/admin/orders/pending-review")
        assert r.status_code == 401

    def test_pending_review_admin_ok_contains_manual_order(self):
        atok = _get_admin_token()
        r = requests.get(
            f"{API}/admin/orders/pending-review",
            headers={"Authorization": f"Bearer {atok}"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "orders" in d and "count" in d
        ids = [o["id"] for o in d["orders"]]
        if TestOrderCreationByDistance.manual_order_id:
            assert TestOrderCreationByDistance.manual_order_id in ids
        # all listed must be pending_review
        for o in d["orders"]:
            assert o["status"] == "pending_review"

    def test_admin_list_all_orders_with_status_filter(self):
        atok = _get_admin_token()
        r = requests.get(
            f"{API}/admin/orders?status=pending",
            headers={"Authorization": f"Bearer {atok}"},
        )
        assert r.status_code == 200
        for o in r.json()["orders"]:
            assert o["status"] == "pending"

    def test_set_manual_price_success(self):
        # Make sure we have a manual order
        if not TestOrderCreationByDistance.manual_order_id:
            tc = TestOrderCreationByDistance()
            tc.test_order_over_130_pending_review()
        oid = TestOrderCreationByDistance.manual_order_id
        atok = _get_admin_token()
        r = requests.post(
            f"{API}/admin/orders/{oid}/set-price",
            headers={"Authorization": f"Bearer {atok}"},
            json={"price": 95000, "note": "long route"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        order = d["order"]
        assert order["final_price"] == 95000
        assert order["status"] == "pending"
        assert order["manual_price_set_by"] is not None
        assert order["manual_price_set_at"] is not None

    def test_set_manual_price_too_low_400(self):
        # Create a fresh manual order to operate on
        tc = TestOrderCreationByDistance()
        o = tc._make_order(160)
        oid = o["id"]
        atok = _get_admin_token()
        r = requests.post(
            f"{API}/admin/orders/{oid}/set-price",
            headers={"Authorization": f"Bearer {atok}"},
            json={"price": 1000, "note": "too low"},
        )
        assert r.status_code == 400

    def test_set_manual_price_on_non_pending_review_400(self):
        # Use the short_order_id which is in 'pending' status
        if not TestOrderCreationByDistance.short_order_id:
            tc = TestOrderCreationByDistance()
            tc.test_order_short_distance_normal_pending()
        oid = TestOrderCreationByDistance.short_order_id
        atok = _get_admin_token()
        r = requests.post(
            f"{API}/admin/orders/{oid}/set-price",
            headers={"Authorization": f"Bearer {atok}"},
            json={"price": 50000},
        )
        assert r.status_code == 400

    def test_set_manual_price_requires_admin_403(self):
        tc = TestOrderCreationByDistance()
        o = tc._make_order(155)
        oid = o["id"]
        ctok = _get_customer_token()
        r = requests.post(
            f"{API}/admin/orders/{oid}/set-price",
            headers={"Authorization": f"Bearer {ctok}"},
            json={"price": 95000},
        )
        assert r.status_code == 403

    def test_admin_reject_order_sets_cancelled(self):
        tc = TestOrderCreationByDistance()
        o = tc._make_order(170)
        oid = o["id"]
        atok = _get_admin_token()
        r = requests.post(
            f"{API}/admin/orders/{oid}/reject",
            headers={"Authorization": f"Bearer {atok}"},
        )
        assert r.status_code == 200
        # Verify with admin GET
        r2 = requests.get(
            f"{API}/admin/orders",
            headers={"Authorization": f"Bearer {atok}"},
        )
        order = next((x for x in r2.json()["orders"] if x["id"] == oid), None)
        assert order is not None
        assert order["status"] == "cancelled"
        assert order.get("cancellation_reason") == "Rejected by admin"
