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

frontend:
  - task: "Role-based routing in AuthContext + verify.tsx"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/index.tsx, /app/frontend/app/(auth)/verify.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Driver → /(driver), customer (needs name) → /(auth)/register, else /(tabs). Awaiting user-initiated UI test."

  - task: "Driver UI tabs (dashboard, earnings, history, profile, job)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(driver)/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "All screens wired to client.ts API. Will not auto-test frontend until user requests."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Twilio + OTP helpers (TWILIO_ENABLED, _generate_otp_code, _send_otp_sms)"
    - "Driver auth & profile (verify-otp routes drivers, /driver/profile)"
    - "Driver lifecycle (online toggle, location, accept, status progression, earnings)"
    - "Admin: drivers + manual pricing review"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

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
        Support tickets endpoint suite verified via public ingress.
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