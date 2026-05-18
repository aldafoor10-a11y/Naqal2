# NAQAL GO - Product Requirements Document

## Overview
NAQAL GO is a premium transportation marketplace mobile app connecting customers needing furniture/goods/appliance transport with truck drivers in Mosul, Iraq (expanding to Dohuk and all Iraqi provinces).

## Phase 1 Scope (CURRENT - MVP COMPLETE)
- ✅ Customer App with phone+OTP login (mock OTP `123456`)
- ✅ 4 service types: Furniture / Goods / Appliances / Special
- ✅ Interactive map (Leaflet + CartoDB dark tiles) for pickup/dropoff selection
- ✅ Dynamic pricing engine (distance tiers + vehicle multiplier + peak surcharge)
- ✅ Order creation with cargo description and base64 photo upload
- ✅ Order tracking with status stepper and driver card
- ✅ Order history with filtering (all/active/completed)
- ✅ Profile screen with stats, settings menu, logout
- ✅ Arabic RTL UI by default with luxury dark + gold theme
- ✅ Auto-driver-assignment simulation for demo

## Tech Stack
- **Frontend**: Expo SDK 54 + Expo Router (file-based), TypeScript
- **Map**: Leaflet via WebView with CartoDB DarkMatter tiles (no API key needed)
- **Backend**: FastAPI + MongoDB (motor async), JWT auth, bcrypt for admin
- **Storage**: `/app/frontend/src/utils/storage` (SecureStore for tokens)
- **i18n**: Arabic primary, English fallback (Arabic forced via I18nManager.forceRTL)

## Pricing Logic
- 0-3 km: 7,000 IQD fixed
- 3-10 km: 1,800 IQD/km (additive)
- 10-25 km: 1,400 IQD/km
- 25+ km: 1,000 IQD/km
- Vehicle multipliers: Kia 1.0×, Pickup 1.1×, Medium 1.2×, Large 1.35×
- Peak hours (7-9, 17-20 Iraq time): +15%
- Minimum order: 5,000 IQD; rounded to nearest 500
- **Long-distance cap (NEW)**: at ≥75 km, total price stops increasing — fixed at **75,000 IQD** maximum.
- **Manual review (NEW)**: orders with road distance > 130 km cannot be auto-priced. The customer sees a notice and the order is sent to the admin/manager with status `pending_review` for manual price approval.

## Admin Pricing Endpoints
- `GET /api/admin/orders/pending-review` — list orders awaiting manual price
- `GET /api/admin/orders[?status=]` — list all orders with optional filter
- `POST /api/admin/orders/{id}/set-price` body `{price, note?}` — set manual price (min 5000 IQD); flips status `pending_review → pending`
- `POST /api/admin/orders/{id}/reject` — admin rejects long-distance order; status→`cancelled`

## Backend Endpoints
- `POST /api/auth/send-otp` — mock OTP (any phone, code 123456)
- `POST /api/auth/verify-otp` — returns JWT, creates user
- `PUT /api/auth/profile` — set user name
- `GET /api/auth/me` — current user
- `POST /api/auth/admin/login` — admin username/password
- `POST /api/pricing/estimate` — distance + vehicle → price
- `GET /api/pricing/config` — pricing tiers
- `POST /api/orders` — create order
- `GET /api/orders` — list (filtered by role)
- `GET /api/orders/{id}` — single order
- `POST /api/orders/{id}/cancel` — customer cancel
- `POST /api/orders/{id}/rate` — rate completed order
- `POST /api/orders/{id}/simulate-accept` — demo driver acceptance
- `POST /api/orders/{id}/simulate-progress` — advance status (demo)

## Phase 2 (Planned)
- Driver App (separate flow): login, order list, accept/reject, navigation
- Socket.io for real-time tracking and chat
- Push notifications via Expo
- Admin web dashboard (driver CRUD, order monitoring, pricing config)

## Phase 3 (Planned)
- Real SMS OTP via Twilio
- Zain Cash payment integration
- Multi-language (English, Kurdish)
- Rating system with reviews
- Multi-stop deliveries
