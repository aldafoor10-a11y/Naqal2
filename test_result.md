#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  NAQAL GO - Premium smart pickup transportation app for Mosul, Iraq.
  Phase 2: Driver App + role-based routing in a single app.
  - Drivers cannot self-register; only admins create them.
  - Customers / Drivers share the same app, AuthContext routes them by user_type.
  - Mock OTP `123456` for now (Twilio later), free map (Waze later), web admin panel later.
  Active fix: Backend `NameError: TWILIO_ENABLED is not defined` crashing /api/auth/send-otp.

backend:
  - task: "Twilio + OTP helpers (TWILIO_ENABLED, _generate_otp_code, _send_otp_sms)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: false
          agent: "main"
          comment: "send_otp referenced TWILIO_ENABLED/_generate_otp_code/_send_otp_sms which were never defined → 500 + JSONDecodeError in tests."
        - working: true
          agent: "main"
          comment: "Added env-driven Twilio init block with safe fallback. Local smoke test passes (send-otp returns mock_code, verify-otp returns driver token)."
        - working: true
          agent: "testing"
          comment: "Verified via public ingress: POST /api/auth/send-otp for +9647701234567 returns 200 with mock_code='123456'. New customer +9647700001234 also gets mock_code='123456'. TWILIO_ENABLED=false correctly exposes mock_code. No 500s observed."

  - task: "Driver auth & profile (verify-otp routes drivers, /driver/profile)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Verified locally: seeded driver +9647701234567 logs in with mock OTP, /driver/profile returns full payload."
        - working: true
          agent: "testing"
          comment: "E2E via ingress: verify-otp returns user_type='driver', token, user.is_approved=true. GET /api/driver/profile (Bearer) returns full driver dict (name=أحمد محمد). Customer token correctly blocked from /driver/profile and /admin/drivers (both 403). No-token /driver/profile returns 401. Unapproved driver (is_approved=false via toggle-approval) verify-otp returns 403 with Arabic message."

  - task: "Driver lifecycle (online toggle, location, accept, status progression, earnings)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Full E2E verified via curl: status→online, see customer order, accept, arriving→picked_up→in_transit→completed, earnings updated."
        - working: true
          agent: "testing"
          comment: "Full lifecycle PASS via ingress. PUT /driver/status {is_online:true} → 200, driver.is_online=true. Customer creates ~6km Mosul order (distance_km=6.03, final_price=12500). GET /driver/orders/available returns it. POST /driver/orders/{id}/accept → status=accepted. State-machine guard: accepted→picked_up directly returns 400 ('Cannot move from accepted to picked_up'). Sequential arriving→picked_up→in_transit→completed all 200. GET /driver/earnings: today_trips=4, total_earnings=38500 (incremented). GET /driver/orders/history contains the completed order."

  - task: "Admin: drivers + manual pricing review"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Admin login (admin/naqal2026) ok; admin/drivers list returns count=1 (seeded)."
        - working: true
          agent: "testing"
          comment: "Admin flow fully verified. POST /auth/admin/login admin/naqal2026 → 200 + token. GET /admin/drivers count=3 (seeded + created). POST /admin/drivers (TEST-001, kia_pickup, +9647709876543) → 200, driver auto-approved. Duplicate phone returns 400 'A user with this phone number already exists'. GET /admin/orders returns 15 orders. Customer creates order with dropoff lat 37.6 → distance_km=166.94, status='pending_review', final_price=0. GET /admin/orders/pending-review contains it. POST /admin/orders/{id}/set-price {price:90000} → status='pending', final_price=90000. Pricing estimates verified: ~50km→final_price=65500 (normal), ~100km→is_capped=true & final_price=75000, ~150km→requires_manual_pricing=true & final_price=null. NOTE: /api/pricing/estimate is POST (not GET as worded in review request) — tested as POST and works correctly."

  - task: "Support tickets (customer<->admin chat)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Endpoints added:
              POST /api/support/tickets  (customer)  -> create ticket with subject + initial msg
              GET  /api/support/tickets  (customer)  -> list own
              GET  /api/support/tickets/{id}  (customer|admin)  -> get + auto-clear unread for viewer
              POST /api/support/tickets/{id}/messages  (customer|admin)  -> append message; reopen on customer reply; flip open→pending on admin reply
              GET  /api/admin/support/tickets  (admin)  -> list all (optional ?status=)
              PUT  /api/admin/support/tickets/{id}/status  (admin)  -> open|pending|resolved|closed
            Local smoke test (urllib) PASS: create→admin reply→status flips to pending→customer reply→admin resolves. Cross-customer access returns 403. Driver blocked from /support/tickets POST (403). Needs re-test by deep_testing_backend_v2 via ingress.
        - working: true
          agent: "testing"
          comment: |
            Full support-ticket suite verified via public ingress (https://naqal-go.preview.emergentagent.com/api).
            Test file: /app/support_tickets_test.py — 16/16 passing.
            ✅ Customer (+9647700001111) creates ticket {subject:"Payment issue", message:"My payment failed but money was deducted"} → 200; ticket.id present, status="open", messages[0].author.role="customer", unread_for_admin=1.
            ✅ GET /api/support/tickets (customer) → 200, count=1.
            ✅ Driver (+9647701234567) POST /api/support/tickets → 403. No-token GET /api/support/tickets → 401. Second customer (+9647700002222) GET /api/support/tickets/{other_id} → 403.
            ✅ Admin (admin/naqal2026) GET /api/admin/support/tickets includes new ticket. Admin POST /api/support/tickets/{id}/messages {"message":"We're investigating"} → 200, status flips open→pending, unread_for_customer=1, messages length=2.
            ✅ Customer GET /api/support/tickets/{id} → unread_for_customer cleared to 0.
            ✅ Customer POST /api/support/tickets/{id}/messages {"message":"Thanks"} → 200, messages length=3.
            ✅ Admin PUT /api/admin/support/tickets/{id}/status {"status":"resolved"} → 200. Subsequent customer reply re-opens (status="open"). Invalid status "foo" → 422 (Pydantic Literal validation). Customer PUT admin status → 403.
            ✅ Edge cases: empty subject → 400, empty message → 400, GET nonexistent ticket id → 404.
            No critical issues. All endpoints behave per spec.

  - task: "Real-time Socket.IO (driver location + order updates + new_order broadcast)"
    implemented: true
    working: true
    file: "/app/backend/server.py, /app/frontend/src/realtime/socket.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Added python-socketio AsyncServer mounted as ASGIApp on FastAPI at /api/socket.io.
            Events emitted by backend:
              - new_order        -> room "drivers"       (on customer create_order if not manual-review)
              - order_update     -> room "order:<id>"    (on driver accept / status change)
              - driver_location  -> room "order:<id>"    (on PUT /api/driver/location for each active order)
            Auth: JWT in auth.token on connect; rejected if invalid. Personal room user:<id>, driver
            extras enter room "drivers". subscribe_order(order_id) ack returns {ok, room|error} after
            checking the caller is customer/driver on the order.
            Local socket.io-client (python async) E2E PASS:
              order_id=f26489ba-... customer received 5 order_update events
              (accepted→arriving→picked_up→in_transit→completed) + 1 driver_location event.
            Frontend wired:
              - app/order/[id].tsx (customer tracking): connects, subscribeOrder, listens for
                order_update & driver_location. Removed auto-simulate-accept polling; kept a 12s
                low-frequency fallback poll for resilience.
              - app/(driver)/index.tsx: listens for "new_order" events to insert incoming jobs without
                waiting for the 15s poll. Polling slowed from 6s to 15s thanks to socket.
              - src/realtime/socket.ts: singleton getSocket() with JWT auth; subscribeOrder /
                unsubscribeOrder helpers; disconnectSocket() called on signOut.
              - Driver job screen openNavigation now offers Waze (preferred) ↔ Apple/Google Maps
                fallback. Mobile prompts user via Alert; web opens Waze directly.
        - working: true
          agent: "testing"
          comment: |
            Re-tested over public ingress with python-socketio AsyncClient. Test file: /app/admin_socket_test.py (24/24 passing).
            Customer (+9647700009999, name "Socket Test") logged in, driver (+9647701234567) logged in + set is_online=true.
            ✅ Customer socket connected at wss://naqal-go.preview.emergentagent.com/api/socket.io (websocket transport, sid cyaABdgrpzliq1SwAAAB). Backend logs confirm [socket] connected user=<customer_id> type=customer.
            ✅ Customer POST /api/orders Mosul→Mosul (distance_km=4.19, final_price=10500, status=pending). subscribe_order ack {ok:true, room:"order:<id>"}.
            ✅ Driver POST /api/driver/orders/{id}/accept → customer socket received order_update with order.status="accepted" in <1s.
            ✅ Driver PUT /api/driver/location {lat:36.35, lng:43.15} → customer received "driver_location" event with same lat/lng in <1s.
            ✅ Driver status progression arriving→picked_up→in_transit→completed → 4 additional order_update events, each carrying the correct new status.
            ✅ GET /api/orders/{id} (customer) → status=completed, driver_location={lat:36.35, lng:43.15}.
            No critical issues. WebSocket ingress, JWT auth, room routing, and event payloads all working as designed.


  - task: "Web Admin Panel (Vite SPA mounted at /api/web-admin/*) + /api/admin/stats analytics endpoint"
    implemented: true
    working: true
    file: "/app/admin/* (built to /app/admin/dist), /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Built a separate Vite React + TS + Tailwind SPA in /app/admin (yarn build → /app/admin/dist).
            Mounted in FastAPI:
              GET /api/web-admin/            → dist/index.html
              GET /api/web-admin/{path}      → SPA fallback (or real file)
              GET /api/web-admin/assets/*    → StaticFiles
            Pages: Login, Dashboard (analytics w/ 7-day bar+line charts via recharts),
            Pricing Review (manual price queue with set-price / reject), Drivers (table +
            online dot + approve toggle + create-driver modal), Orders (filterable),
            Support Inbox (live poll 5s) + TicketChat.
            New backend endpoint GET /api/admin/stats returns totals (orders/drivers/
            online_drivers/completed/revenue/open_tickets), pipeline (pending_review/pending/active),
            today + week aggregates, and series_7d (7-day orders + revenue).
            Auth: existing /api/auth/admin/login (admin/naqal2026); all admin/* require _require_admin.
            Local verified: stats endpoint returns full JSON; SPA & assets reachable via public ingress
            at https://naqal-go.preview.emergentagent.com/api/web-admin/.
        - working: true
          agent: "testing"
          comment: |
            Verified via public ingress (https://naqal-go.preview.emergentagent.com). Test file: /app/admin_socket_test.py — 24/24 passing.
            PART A — /api/admin/stats:
              ✅ POST /auth/admin/login admin/naqal2026 → 200 + token.
              ✅ GET /admin/stats with admin Bearer → 200. Shape verified:
                  totals.{orders:17, drivers:5, online_drivers:1, completed:?, revenue:67500, open_tickets:?}
                  pipeline.{pending_review, pending, active} all int
                  today.{orders_completed, revenue}, week.{orders_completed, revenue} all int/number
                  series_7d: list length 7, each item {day:"YYYY-MM-DD", orders:int, revenue:number}; days strictly ascending (first day '2026-05-12').
              ✅ GET /admin/stats no token → 401.
              ✅ GET /admin/stats with CUSTOMER token (+9647700009999) → 403.
              ✅ GET /admin/stats with DRIVER token (+9647701234567) → 403.
            PART B — Admin SPA:
              ✅ GET /api/web-admin/ → 200, content-type text/html, body contains <div id="root">.
              ✅ GET /api/web-admin/anything-random-XXXXXX → 200, text/html (SPA fallback).
              ✅ GET /api/web-admin/assets/index-C67c-XhE.js → 200, content-type text/javascript; charset=utf-8. CSS asset (index-b3YlglpI.css) also reachable in earlier ingress logs.
            PART D — auth-guard regression:
              ✅ Customer → GET /admin/orders → 403.
              ✅ Driver → POST /admin/drivers → 403.
              ✅ POST /auth/admin/login with wrong password → 401.
            No critical issues found.



frontend:
  - task: "Role-based routing in AuthContext + verify.tsx"
    implemented: true
    working: true
    file: "/app/frontend/app/index.tsx, /app/frontend/app/(auth)/verify.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Driver → /(driver), customer (needs name) → /(auth)/register, else /(tabs). Awaiting user-initiated UI test."
        - working: true
          agent: "testing"
          comment: |
            Verified on iPhone-12 viewport (390x844) via public ingress. Welcome → get-started → login (phone 7701234567) → OTP 123456 auto-submitted → routed to /(driver) showing testID="driver-name"="أحمد محمد". After full re-navigation to "/", index.tsx correctly redirected driver back to /(driver) (driver-name still rendered), confirming role-guard at start works. Only console noise: deprecation warnings for shadow* props and pointerEvents (non-blocking).

  - task: "Driver UI tabs (dashboard, earnings, history, profile, job)"
    implemented: true
    working: true
    file: "/app/frontend/app/(driver)/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "All screens wired to client.ts API. Will not auto-test frontend until user requests."
        - working: true
          agent: "testing"
          comment: |
            E2E UI test PASS on iPhone-12 viewport (390x844) via public ingress.
            ✅ Driver dashboard renders: testID="driver-name"='أحمد محمد', driver-online-switch, driver-tab-{home,earnings,history,profile} all present.
            ✅ Online toggle works: tapping driver-online-switch flipped state; section title shows "مباشر" live indicator; status badge turned green ("نشط" badge — note label is "نشط" not the "متصل" wording from the review request, but functionally identical and clearly indicates online state).
            ✅ Earnings tab: testID="total-earnings" shows "38,500 د.ع" (matches backend earnings from prior driver E2E run). Today/Week cards rendered.
            ✅ History tab: 5 history rows rendered (testID="hist-*"), confirming prior completed orders surface.
            ✅ Profile tab: avatar, name "أحمد محمد", phone "+9647701234567", "سائق معتمد" badge, vehicle "بيك أب" with plate "موصل 12345", testID="driver-logout-btn" visible.
            ⚠️ Incoming-order acceptance + /(driver)/job/[id] progression COULD NOT be exercised: no pending orders existed at test time (driver polled /api/driver/orders/available after going online; zero orders returned). The review request explicitly said to "log it but don't fail" if no orders exist, so this is reported as SKIP, not a failure. The accept/advance-status flow was already verified end-to-end at the API layer in the backend test run (see "Driver lifecycle" backend task), so the job-progression screen wiring is the only piece left unverified via UI.
            ⚠️ Logout-button confirmation Alert and the "Driver cannot access customer routes" hard-navigation check were not exercised explicitly to keep the run within the browser-automation budget; root redirect (index.tsx) was verified instead and correctly keeps drivers in /(driver).
            Recommend main agent: (1) optionally tweak the online badge label to "متصل" for exact-spec match, and (2) seed a fresh pending order or run a parallel customer flow before re-testing job-progression UI.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Hidden owner admin (phone+password) login"
    - "Centralized order workflow (admin-assigned drivers only)"
    - "Pricing settings & price override"
    - "Booking scheduling fields"
    - "OSM light map tiles + Nominatim location search"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

# --- Pivot regression results (testing agent) ---
backend_pivot_tests:
  - task: "Hidden owner admin phone+password login + OTP block"
    implemented: true
    working: true
    file: "/app/backend/server.py (auth/admin/phone-login, send-otp guard)"
    status_history:
        - working: true
          agent: "testing"
          comment: |
            All login + OTP-block cases PASS via public ingress.
            • POST /api/auth/admin/phone-login {phone:"07517300194", password:"yassir00"} → 200 + admin token, admin.user_type=admin.
            • wrong password → 401.
            • +9647517300194 variant → 200 (both forms accepted).
            • POST /api/auth/send-otp for both "07517300194" and "+9647517300194" → 403 "هذا الرقم محجوز".
            • GET /api/admin/stats with owner_token → 200, full payload (totals/pipeline/today/week/series_7d).

  - task: "Hidden admin invisibility in user listings"
    implemented: true
    working: false
    file: "/app/backend/server.py (admin_create_driver, admin_list_drivers)"
    status_history:
        - working: false
          agent: "testing"
          comment: |
            CRITICAL FINDING. The hidden admin itself is correctly stored only in db.admins
            (id 52df233f, phone "07517300194", hidden:true) and does NOT appear in
            /api/admin/drivers as itself. HOWEVER:
            • db.users contains an UNRELATED driver record with phone "+9647517300194"
              (id 710165e6, name "ياسر حسن", vehicle_type medium_truck, created_by_admin="admin",
              created 2026-05-18). This driver shows up in GET /api/admin/drivers.
            • Backend has NO policy preventing the hidden owner phone from being attached
              to a regular customer/driver. admin_create_driver only blocks on user-table
              duplicates; it does not consult db.admins for hidden-reserved phones.
            • Effect: Test #26 (POST /api/admin/drivers with hidden phone) *coincidentally*
              returns 400 only because the legacy driver above already occupies that phone
              in db.users. If that legacy driver is removed, the endpoint would happily
              create another driver with the reserved phone.

            Recommended fix for main agent:
              In admin_create_driver (and any future customer-self-onboard path), additionally
              check `await db.admins.find_one({"phone": {"$in": candidates_of_normalized}})`
              and return 400 "Reserved phone" if matched. Also delete the legacy leaked
              driver (id 710165e6) or rename its phone to free up the reserved number.

  - task: "Centralized order workflow (drivers no longer broadcast)"
    implemented: true
    working: true
    file: "/app/backend/server.py (create_order, driver_available_orders, driver_accept_order, assign-driver)"
    status_history:
        - working: true
          agent: "testing"
          comment: |
            PASS. Customer order with booking_type=scheduled, scheduled_date=2026-06-25,
            scheduled_time=14:30, customer_live_location all stored. status=pending after
            create. Driver online; GET /driver/orders/available returned 0 for that order
            (correct — admin hadn't assigned). POST /driver/orders/{id}/accept on
            un-assigned order returned 409 "الطلب لم يعد متاحاً" (4xx ✓).

  - task: "Admin assigns driver"
    implemented: true
    working: true
    file: "/app/backend/server.py (admin_assign_driver)"
    status_history:
        - working: true
          agent: "testing"
          comment: |
            PASS. POST /admin/orders/{id}/assign-driver → 200, status=assigned, assigned_driver_id matches.
            Order then appears in /driver/orders/available. Driver POST /accept → 200, status=accepted.
            Re-assign accepted order → 400 "Cannot assign order with status accepted".
            Assigning to unapproved driver → 400 "Driver is not approved".

  - task: "Price override + Pricing settings"
    implemented: true
    working: true
    file: "/app/backend/server.py (override-price, pricing-settings GET/PUT)"
    status_history:
        - working: true
          agent: "testing"
          comment: |
            PASS.
            • POST /admin/orders/{id}/override-price {price:99999} (owner) → 200, final_price=99999.
            • {price:500} → 400 "Price too low" (threshold 1000).
            • Same as customer → 403 "Admin access required".
            • GET /admin/pricing-settings → 200 with min_price, max_auto_price, auto_cap_distance_km,
              manual_review_distance_km, peak_multiplier, vehicle_multiplier, tiers.
            • PUT {min_price:12500, max_auto_price:80000} → 200; subsequent GET reflects 12500/80000.
            • PUT as customer → 403.

  - task: "Regression: admin login + pending-review + web-admin SPA"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    status_history:
        - working: true
          agent: "testing"
          comment: |
            PASS. POST /auth/admin/login admin/naqal2026 → 200. GET /admin/orders/pending-review
            (owner) → 200. GET /api/web-admin/ → 200 text/html serving the Vite SPA shell.

agent_communication_pivot:
    - agent: "testing"
      message: |
        Pivot regression test complete via public ingress
        (https://naqal-go.preview.emergentagent.com). Test file: /app/naqal_pivot_test.py
        Result: 31 PASS / 1 FAIL across the 29 review-request scenarios (+ extra checks).

        🔴 FAILURE — Test #7 "Hidden admin invisibility":
          A regular driver in db.users with phone "+9647517300194" (name "ياسر حسن",
          id 710165e6-eb52-48e6-8a14-998962c51ded, created_by_admin="admin" on 2026-05-18)
          appears in GET /api/admin/drivers. The hidden admin itself (db.admins,
          hidden:true, phone "07517300194") is correctly NOT in the list, but the
          backend has no policy that prevents the reserved hidden phone from being
          used to create a customer or driver. This also means test #26 only happens
          to pass because of duplicate-user collision — not because of a "reserved
          phone" rule.

          Fix required (main agent):
            1. In `admin_create_driver` (and any future signup path), reject if
               normalized phone matches any db.admins entry (especially hidden=True).
            2. Delete (or rename) the leaked legacy driver record id 710165e6 so the
               admin/drivers listing no longer shows the hidden owner's phone.

        ✅ All other 28 scenarios from sections A,B(partial),C,D,E,F,G,H PASS:
          • Phone+password login (both 0… and +964…), wrong-password 401, OTP block,
            /admin/stats with owner token.
          • Centralized workflow: order created with scheduling fields & customer_live_location;
            driver doesn't see un-assigned order; accept on un-assigned → 409.
          • Admin assign → 200/assigned; driver sees + accepts → accepted; re-assign accepted → 400;
            assign to unapproved driver → 400.
          • Price override 99999 → applied; 500 → 400; customer → 403.
          • Pricing settings GET/PUT round-trip works; customer PUT → 403.
          • G (#26) returns 400 ONLY because a stale leaked driver already exists with that
            phone — note this is not real reservation enforcement.
          • Original admin login (admin/naqal2026) still works; /admin/orders/pending-review
            → 200; /api/web-admin/ → 200 HTML.

        No mocked integrations involved in these endpoints. Backend log clean (only mock OTP
        notices). Score: 31/32 atomic assertions PASS, 1 critical data-policy gap.

agent_communication:
    - agent: "main"
      message: |
        Fixed the backend crash. Please run the full driver E2E flow against the public ingress:
        1) POST /api/auth/send-otp { phone: "+9647701234567" } → expect mock_code "123456".
        2) POST /api/auth/verify-otp { phone, code: "123456" } → expect user_type=driver, token.
        3) GET /api/driver/profile (Bearer) → returns driver doc.
        4) PUT /api/driver/status {is_online:true}.
        5) Create a customer (phone +9647700001111, code 123456, name), POST /api/orders with short distance order, then GET /api/driver/orders/available → should contain it.
        6) POST /api/driver/orders/{id}/accept → success.
        7) Progress: arriving → picked_up → in_transit → completed via /api/driver/orders/{id}/status.
        8) GET /api/driver/earnings → should reflect the completed trip.
        Also validate: admin login admin/naqal2026, GET /api/admin/drivers, POST /api/admin/drivers to create a new driver, GET /api/admin/orders/pending-review for a >130km order.
        Test credentials in /app/memory/test_credentials.md.
    - agent: "testing"
      message: |
        Full backend E2E test complete via public ingress (https://naqal-go.preview.emergentagent.com).
        Test suite: /app/backend_test.py — 28/28 passing.

        Covered:
        ✅ Driver OTP login (mock_code=123456), /driver/profile returns full payload, is_approved=true.
        ✅ Customer signup + name update; customer correctly blocked (403) from /driver/profile and /admin/drivers.
        ✅ Driver online toggle, short Mosul order created (~6km, 12500 IQD), visible in /driver/orders/available, accepted, full state machine arriving→picked_up→in_transit→completed.
        ✅ State machine enforcement: accepted→picked_up jump returns 400.
        ✅ Earnings reflect completed trip (today_trips incremented, total_earnings>0). History contains completed order.
        ✅ Admin login admin/naqal2026 → token. Admin lists drivers (count≥1), creates new driver +9647709876543/TEST-001/kia_pickup → 200 with auto-approval. Duplicate phone → 400.
        ✅ Long-distance order (dropoff lat 37.6, road distance ~167km) → status=pending_review, final_price=0. Admin pending-review list contains it. POST /admin/orders/{id}/set-price {price:90000} → status=pending, final_price=90000.
        ✅ Pricing /api/pricing/estimate (POST): ~50km → final_price=65500 (normal), ~100km → is_capped=true & final_price=75000, ~150km → requires_manual_pricing=true & final_price=null.
        ✅ Auth guards: /driver/profile without token → 401. Driver flipped is_approved=false via toggle-approval, subsequent verify-otp → 403.

        Minor note (not a bug): review request worded /api/pricing/estimate as GET, but the implementation is POST and works correctly when called as POST.

        No critical issues found. No mocked integrations — Twilio is intentionally disabled (env vars blank) so mock OTP 123456 is the documented behavior. All endpoints behave per spec.
    - agent: "testing"
      message: |
        Driver UI E2E test complete on iPhone-12 viewport (390x844) via public ingress.

        ✅ Welcome screen renders (testID="welcome-screen")
        ✅ "ابدأ" button → login screen
        ✅ Phone +9647701234567 → send-otp → OTP screen
        ✅ OTP 123456 in testID="otp-input" auto-submits → routed to /(driver)
        ✅ Driver dashboard: testID="driver-name"='أحمد محمد', driver-online-switch, all 4 tab testIDs present
        ✅ Toggle online: live indicator "مباشر" appears, green dot active (badge label is "نشط" rather than "متصل" — functional equivalent, minor wording note)
        ✅ Earnings tab: testID="total-earnings" = "38,500 د.ع"
        ✅ History tab: 5 historical orders rendered (testID="hist-*")
        ✅ Profile tab: avatar, name, +9647701234567, "سائق معتمد" badge, vehicle "بيك أب" with plate "موصل 12345", testID="driver-logout-btn" present
        ✅ Role-guard: navigating to "/" while logged in as driver redirects back to /(driver) (driver-name still rendered) — confirms index.tsx role routing

        ⚠️ SKIPPED (not failures, per review-request instruction):
          • Incoming-order accept + /(driver)/job/[id] status-progression UI — no pending orders existed at test time. The state machine itself is already verified via backend E2E (see "Driver lifecycle" task). To exercise the UI, main agent should seed a fresh pending order in Mosul (short distance to avoid manual-review) for the customer flow OR run customer + driver flows simultaneously.
          • Logout-confirmation Alert and the negative case of driver visiting /(tabs) were de-prioritised to stay within the 3-call browser-automation budget; root redirect was verified instead.

        Console output had only deprecation warnings (shadow* style props, pointerEvents) — no runtime errors. Backend logs show all driver endpoints returning 200.

        No critical issues. Both "Driver UI tabs" and "Role-based routing" tasks flipped to working=true.
        Test file: /app/support_tickets_test.py — 16/16 passing.

        Covered all 8 scenarios from review:
        ✅ Customer creates ticket (+9647700001111) → 200 with id, status=open, messages[0].author.role=customer, unread_for_admin=1.
        ✅ GET /api/support/tickets (customer) → 200, count≥1.
        ✅ Driver POST /support/tickets → 403. No-token GET /support/tickets → 401. Other customer (+9647700002222) GET someone else's ticket → 403.
        ✅ Admin login admin/naqal2026. GET /api/admin/support/tickets includes ticket. Admin POST reply → status open→pending, unread_for_customer=1, 2 messages.
        ✅ Customer GET /api/support/tickets/{id} clears unread_for_customer to 0.
        ✅ Customer reply → 3 messages.
        ✅ PUT status=resolved → 200; customer reply re-opens to "open"; invalid status "foo" → 422 (Pydantic Literal); customer PUT admin status → 403.
        ✅ Edge cases: empty subject → 400, empty message → 400, GET nonexistent → 404.

        No critical issues. No mocked integrations. Support tickets feature ready.
    - agent: "testing"
      message: |
        Web Admin Panel + Socket.IO real-time re-test complete via public ingress
        (https://naqal-go.preview.emergentagent.com). Test file: /app/admin_socket_test.py — 24/24 PASS.

        PART A — /api/admin/stats:
          ✅ Admin login admin/naqal2026 → token.
          ✅ GET /admin/stats (admin) → 200 with full shape: totals.{orders:17,drivers:5,online_drivers:1,completed,revenue:67500,open_tickets}, pipeline.{pending_review,pending,active}, today.{orders_completed,revenue}, week.{orders_completed,revenue}, series_7d list of 7 items {day:YYYY-MM-DD,orders,revenue} in ascending order (first day 2026-05-12).
          ✅ /admin/stats no token → 401; customer token → 403; driver token → 403.

        PART B — Admin SPA at /api/web-admin/:
          ✅ GET /api/web-admin/ → 200 text/html with <div id="root">.
          ✅ GET /api/web-admin/anything-random-XXXXXX → 200 text/html (SPA fallback).
          ✅ GET /api/web-admin/assets/index-C67c-XhE.js → 200 text/javascript.

        PART C — Driver E2E with Socket.IO (python-socketio AsyncClient):
          ✅ Customer (+9647700009999, name "Socket Test") + driver (+9647701234567, is_online=true) authenticated.
          ✅ Customer socket connected to wss://.../api/socket.io (websocket transport), backend logs confirm [socket] connected user=<id> type=customer; sid returned.
          ✅ Customer creates Mosul→Mosul order (distance_km=4.19, price=10,500 IQD, status=pending). subscribe_order ack {ok:true, room:"order:<id>"}.
          ✅ Driver accept → customer received order_update {order.status:"accepted"} within <1s.
          ✅ Driver PUT /driver/location {36.35, 43.15} → customer received "driver_location" with same lat/lng within <1s.
          ✅ Driver progression arriving→picked_up→in_transit→completed → customer received 4 more order_update events with correct statuses in order.
          ✅ GET /api/orders/{id} (customer) → status=completed, driver_location={36.35,43.15}.

        PART D — Auth-guard regression:
          ✅ Customer→GET /admin/orders → 403.
          ✅ Driver→POST /admin/drivers → 403.
          ✅ Admin login wrong password → 401.

        No critical issues. No mocked integrations. needs_retesting flipped to false on both target tasks.