# MotoTrack — Use Case Functions

Use-case style function lists and cross-reference catalog for every login role in MotoTrack.

## System Roles & Visual Diagrams

MotoTrack features three authenticated user roles, each with dedicated dashboards, workflows, and access control:

- [Admin (Store Administrator)](#admin-store-administrator) — Diagram: [usecase_admin.png](./diagrams/usecase_admin.png)
- [Customer](#customer) — Diagram: [usecase_customer.png](./diagrams/usecase_customer.png)
- [Rider (Delivery Staff)](#rider-delivery-staff) — Diagram: [usecase_rider.png](./diagrams/usecase_rider.png)
- [All Actors Combined Diagram](./diagrams/usecase_all_actors.png)
- [Master System Flowchart](./diagrams/flowchart_main.png)
- Master Editable Source: [MotoTrack_Flowcharts.drawio](./diagrams/MotoTrack_Flowcharts.drawio)

> [!NOTE]
> Workshop mechanics do not have login accounts or a separate dashboard. Pit-bay technicians are managed entirely as an administrative roster by the Store Administrator, who handles appointment scheduling, bay allocation, diagnostic inspection logs, itemized quotations, service progress, and motorcycle releases.

For comprehensive role descriptions, see [ROLES.md](./ROLES.md).  
For step-by-step Input–Process–Output tables, see [USE_CASE_PROCESSES.md](./USE_CASE_PROCESSES.md).  
For the master requirements catalog, see [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md).

---

## Admin (Store Administrator)

1. **[AUTH] Login & Session Authentication** — Secure multi-device login with credential verification and automatic session security PIN lock.
2. **[H] Executive Dashboard Overview** — Real-time telemetry: revenue, orders, inventory valuation, active deliveries, and pending garage appointments.
3. **[E] Manage Users & Role Assignment** — View, create, update, activate/deactivate user accounts across Admin, Customer, and Rider roles.
4. **[D] Manage Products & Variants** — Full catalog CRUD operations: title, description, category, brand, pricing, sizes, colors, and media gallery.
5. **[D] Manage Product Compatibility** — Map parts to specific motorcycle brands, models, and year ranges for automated fitment matching.
6. **[D] Manage Motorcycle Models** — Maintain master catalog of motorcycle manufacturers, models, displacement, and production years.
7. **[B] Manage Inventory & Restock Batches** — Track variant-level stock quantities, restock histories, purchase costs, and automated stock valuations.
8. **[B] Stock Alert Notifications** — Automated warning badges and push alerts for low-stock and critically depleted SKUs.
9. **[H] Sales Demand Forecasting & Stock Optimization** — Simple Linear Regression (OLS) demand forecasting, safety stock thresholds, and suggested reorder points.
10. **[C] Manage Suppliers** — Vendor directory CRUD, lead time tracking, contact persons, and inventory restock association.
11. **[F] Manage Purchase Orders** — Draft, submit, and receive purchase orders from accredited suppliers to restock warehouse inventory.
12. **[A] Manage Orders & COD Verification** — Review customer orders, approve or reject Cash on Delivery (COD) requests, update fulfillment stages, and process cancellations/returns.
13. **[L] Order Dispatch & Rider Assignment** — Assign verified delivery orders to active riders based on delivery sector and route efficiency.
14. **[K] Point of Sale (POS) Cashier Sales** — Process counter walk-in transactions, scan/select products, accept multiple tenders, and decrement stock atomically.
15. **[A] Generate Receipts & Delivery Packing Slips** — Print thermal/digital POS receipts, packing tokens, and shipping slips.
16. **[H] View Sales Analytics & Performance Reports** — Real-time charts for gross revenue, POS vs. online sales mix, payment channel breakdown, and Average Order Value (AOV).
17. **[B] View Inventory & Movement Reports** — Stock turnover rates, inventory value by category, restock history, and wastage audit reports.
18. **[G] Manage Promo Vouchers** — Create discount codes (fixed or percentage), set validity periods, usage caps, and minimum spend limits.
19. **[G] Manage Marketing Banners** — Configure dynamic hero carousel slides, promotional banners, badges, and headline call-to-actions on the storefront.
20. **[W] Manage Customer Feedback & Issue Reports** — Inspect customer ratings, review comments, flagged delivery issues, and technical inquiries with resolution tracking.
21. **[M] Manage Garage Services & Bookings** — Review service appointments, schedule slots, allocate service bays, and track service status.
22. **[M] Manage Mechanics & Bay Assignments** — Manage technician profiles, skill specializations, working schedules, and repair bay allocation (admin-managed roster; no mechanic login accounts).
23. **[M] Diagnostic Inspection & Quotation Management** — Record multi-point vehicle inspection findings, build itemized labor and parts quotations, send quotes to customers, and verify payments.
24. **[M] Track Service Milestones & Completion** — Update workshop repair status stages, record technical notes, and mark vehicles ready for billing and release.
25. **[M] Pickup QR Code Authorization & Release** — Scan customer pickup QR codes to authenticate ownership and formally release serviced motorcycles.
26. **[L] Manage Riders & Fleet Operations** — Monitor delivery staff availability, vehicle types, performance metrics, and commission/shipping earnings.
27. **[J] Audit Trail & System Logs** — Review immutable operational logs: status changes, order approvals, inventory overrides, and security events.
28. **[J] System Settings & Data Backup** — Store operational parameters, delivery rates, business hours, payment gateway keys, and manual/automated database backups.
29. **[X] Logout** — Safely terminate administrative session and clear cached credentials.

---

## Customer

1. **[AUTH] User Registration & Account Verification** — Create new account via email/password or Google OAuth with email verification.
2. **[AUTH] Login & Session Management** — Authenticate securely with persistent token storage and profile switching.
3. **[V] Browse Catalog & Category Exploration** — Discover parts and accessories with categorization, brand sorting, and price range filters.
4. **[V] Search Products** — Keyword search with real-time autocompletion and match highlighting.
5. **[U] Manage My Motorcycles (Virtual Garage)** — Save owned motorcycles (brand, model, year, displacement, photo) to enable personalized vehicle fitment.
6. **[V] Check Part Compatibility** — Instant compatibility verification badge showing whether a part fits the customer's registered motorcycle(s).
7. **[V] Filter Compatible Products** — 1-click toggle to display only parts verified to fit the currently active motorcycle.
8. **[N] Manage Wishlist** — Save prospective parts for future review and easily move items to the cart.
9. **[N] Cart Management** — Add items, configure options (size, color, variant), adjust quantities, and review live subtotals.
10. **[O] Apply Promo Voucher** — Enter active discount codes during checkout for instant discount calculation.
11. **[O] Checkout & Payment Selection** — Finalize orders with address selection and multiple payment options: Cash on Delivery (COD), GCash, and Debit/Credit Card.
12. **[Q] Track Orders & Live GPS Map** — Track order lifecycle from processing to delivery, including real-time GPS tracking of the dispatched rider.
13. **[Q] View Order History & Invoices** — Access past order receipts, item breakdowns, transaction statuses, and delivery confirmations.
14. **[Q] Cancel / Resubmit Orders** — Cancel unverified orders or resubmit corrected payment/address information.
15. **[Q] Confirm Delivery (QR / Confirmation Link)** — Present delivery QR code to rider or confirm receipt online via secure verification link.
16. **[W] Rate Delivered Orders & Submit Feedback** — Submit 1-to-5 star ratings, write reviews, and report order or delivery issues.
17. **[Q] Request Return / Exchange** — File return or replacement claims for damaged or incorrect items with photo evidence.
18. **[R] AI Customizer & Install Studio** — Preview aesthetic modifications and part installations on motorcycle models using generative AI and save custom setups.
19. **[S] Book Garage Service (PMS & Repairs)** — Schedule periodic maintenance service (PMS) or custom repairs with preferred branch, date, and issue notes.
20. **[T] Review Service Quotations** — Inspect inspection reports, approve or decline itemized labor and parts quotations, and authorize additional repairs.
21. **[P] Manage Customer Profile & Addresses** — Update personal details, contact numbers, avatar, and multiple shipping addresses.
22. **[I] In-App Notifications** — Receive real-time alerts for order status changes, restock alerts, service quotes, and promotional discounts.
23. **[X] Logout** — Terminate session securely across client platforms.

---

## Rider (Delivery Staff)

1. **[AUTH] Login & Availability Toggle** — Authenticate with rider credentials and toggle on-duty/off-duty dispatch status.
2. **[RD3] Rider Dashboard & Earnings Summary** — Review daily/weekly completed deliveries, pending stops, and accumulated shipping fee earnings.
3. **[RD1] View Assigned Deliveries** — Access dispatch manifest organized by neighborhood/area with route optimization priority.
4. **[RD1] View Order Details & Packing Slips** — Inspect recipient information, delivery instructions, item checklist, and COD collection amount.
5. **[RD1] Turn-by-Turn GPS Navigation** — Launch Google Maps / Waze navigation directly from the order destination address.
6. **[RD1] Customer Contact Integration** — Direct 1-tap phone call or SMS communication with the recipient for delivery coordination.
7. **[RD1] Mark Out for Delivery & Broadcast Live GPS** — Transition order status to Out for Delivery and begin real-time GPS location broadcasting.
8. **[RD2] Scan Recipient Delivery QR Token** — Scan recipient's delivery QR code to cryptographically verify parcel handoff.
9. **[RD2] Confirm Delivery & Submit Proof of Delivery (POD)** — Complete order handoff with recipient signature capture and photo proof.
10. **[RD1] Report Delivery Exception / Reschedule** — Flag delivery hurdles (customer unavailable, unreachable, incorrect address) and reschedule attempt.
11. **[RD3] View Delivery History & Pay Ledger** — Review completed run archives and calculated commission balances.
12. **[I] In-App Notifications** — Receive instant dispatch notifications when new delivery orders are assigned.
13. **[X] Logout** — Terminate rider session.

---

## Master Functional Requirements Mapping (001 – 035)

| Req No. | Functional Requirement | Flowchart Label | DB Link | Primary Actor(s) | System Module |
|---|---|:---:|:---:|---|---|
| **001** | Login | `AUTH` | (1, 2) | All Roles | Authentication |
| **002** | Registration | `AUTH` | (1, 2) | Customer | Authentication |
| **003** | User Management | `E` | (7) | Admin | User Management |
| **004** | Customer Profile | `P` | (19) | Customer | Account Management |
| **005** | My Garage | `U` | (24) | Customer | Virtual Garage |
| **006** | View Products | `V` | (16) | Customer, Guest | Storefront |
| **007** | Manage Product | `D` | (6) | Admin | Product Catalog |
| **008** | Product Compatibility | `D` / `V` | (6, 16) | Admin, Customer | Fitment Engine |
| **009** | AI Customizer | `R` | (21) | Customer | Customizer Studio |
| **010** | Cart & Wishlist | `N` | (17) | Customer | Cart & Checkout |
| **011** | Checkout & Payment | `O` | (18) | Customer | Cart & Checkout |
| **012** | Manage Order | `A` | (3) | Admin | Orders & Fulfillment |
| **013** | Order Tracking | `Q` | (20) | Customer | Orders & Fulfillment |
| **014** | Order Return | `Q` | (20) | Customer | Orders & Fulfillment |
| **015** | Customer Feedback | `W` | (25) | Customer, Admin | Feedback & Reviews |
| **016** | Assign Delivery | `L` | (14) | Admin | Fleet & Delivery |
| **017** | Rider Delivery Run | `RD1` | (26) | Rider | Fleet & Delivery |
| **018** | Proof of Delivery | `RD2` | (27) | Rider | Fleet & Delivery |
| **019** | Rider Earnings | `RD3` | (28) | Rider | Fleet & Delivery |
| **020** | Book Garage Service | `S` | (22) | Customer | Garage & Bookings |
| **021** | Booking Management | `M` | (15) | Admin | Garage & Bookings |
| **022** | Manage Stock | `B` | (4) | Admin | Inventory & Stock |
| **023** | View Stock | `B` | (4) | Admin | Inventory & Stock |
| **024** | Stock Alert Notification | `B` / `I` | (4, 11) | Admin | Inventory & Stock |
| **025** | View Forecast | `H` | (10) | Admin | Analytics & Forecasting |
| **026** | Manage Supplier | `C` | (5) | Admin | Supply Chain |
| **027** | Manage Purchase Order | `F` | (8) | Admin | Supply Chain & Restock |
| **028** | Point of Sale (POS) | `K` | (13) | Admin | Sales & Counter |
| **029** | Manage Promotion | `G` | (9) | Admin | Marketing & Sales |
| **030** | View Report | `H` | (10) | Admin | Analytics & Reports |
| **031** | View Notification | `I` / `RN` | (11, 29) | All Roles | Communications |
| **032** | System Settings | `J` | (12) | Admin | Administration |
| **033** | System Activity Log | `J` | (12) | Admin | Security & Compliance |
| **034** | Admin Security Lock | `J` | (12) | Admin | Security & Compliance |
| **035** | Logout | `X` | — | All Roles | Authentication |
