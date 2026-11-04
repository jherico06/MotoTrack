# MotoTrack — Use Case Functions

Use-case style function lists and cross-reference catalog for every login role in MotoTrack.

## System Roles

MotoTrack features four authenticated user roles, each with dedicated dashboards, workflows, and access control:

- [Admin (Store Administrator)](#admin-store-administrator)
- [Customer](#customer)
- [Rider (Delivery Staff)](#rider-delivery-staff)
- [Mechanic (Service Technician)](#mechanic-service-technician)

For comprehensive role descriptions, see [ROLES.md](./ROLES.md).  
For step-by-step Input–Process–Output tables, see [USE_CASE_PROCESSES.md](./USE_CASE_PROCESSES.md).  
For the master requirements catalog, see [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md).

---

## Admin (Store Administrator)

1. **Login & Session Authentication** — Secure multi-device login with credential verification and automatic session security PIN lock.
2. **Executive Dashboard Overview** — Real-time telemetry: revenue, orders, inventory valuation, active deliveries, and pending garage appointments.
3. **Manage Users & Role Assignment** — View, create, update, activate/deactivate user accounts across Admin, Customer, Rider, and Mechanic roles.
4. **Manage Products & Variants** — Full catalog CRUD operations: title, description, category, brand, pricing, sizes, colors, and media gallery.
5. **Manage Product Compatibility** — Map parts to specific motorcycle brands, models, and year ranges for automated fitment matching.
6. **Manage Motorcycle Models** — Maintain master catalog of motorcycle manufacturers, models, displacement, and production years.
7. **Manage Inventory & Restock Batches** — Track variant-level stock quantities, restock histories, purchase costs, and automated stock valuations.
8. **Stock Alert Notifications** — Automated warning badges and push alerts for low-stock and critically depleted SKUs.
9. **Sales Demand Forecasting & Stock Optimization** — Simple Linear Regression (OLS) demand forecasting, safety stock thresholds, and suggested reorder points.
10. **Manage Suppliers** — Vendor directory CRUD, lead time tracking, contact persons, and inventory restock association.
11. **Manage Purchase Orders** — Draft, submit, and receive purchase orders from accredited suppliers to restock warehouse inventory.
12. **Manage Orders & COD Verification** — Review customer orders, approve or reject Cash on Delivery (COD) requests, update fulfillment stages, and process cancellations/returns.
13. **Order Dispatch & Rider Assignment** — Assign verified delivery orders to active riders based on delivery sector and route efficiency.
14. **Point of Sale (POS) Cashier Sales** — Process counter walk-in transactions, scan/select products, accept multiple tenders, and decrement stock atomically.
15. **Generate Receipts & Delivery Packing Slips** — Print thermal/digital POS receipts, packing tokens, and shipping slips.
16. **View Sales Analytics & Performance Reports** — Real-time charts for gross revenue, POS vs. online sales mix, payment channel breakdown, and Average Order Value (AOV).
17. **View Inventory & Movement Reports** — Stock turnover rates, inventory value by category, restock history, and wastage audit reports.
18. **Manage Promo Vouchers** — Create discount codes (fixed or percentage), set validity periods, usage caps, and minimum spend limits.
19. **Manage Marketing Banners** — Configure dynamic hero carousel slides, promotional banners, badges, and headline call-to-actions on the storefront.
20. **Manage Customer Feedback & Issue Reports** — Inspect customer ratings, review comments, flagged delivery issues, and technical inquiries with resolution tracking.
21. **Manage Garage Services & Bookings** — Review service appointments, schedule slots, allocate service bays, and inspect quotation statuses.
22. **Manage Mechanics & Bay Assignments** — Manage technician profiles, skill specializations, working schedules, and repair bay allocation.
23. **Approve Service Quotations & Downpayments** — Finalize mechanic repair estimates, send quotes to customers, and verify downpayment/final balance payments.
24. **Pickup QR Code Authorization & Release** — Scan customer pickup QR codes to authenticate ownership and formally release serviced motorcycles.
25. **Manage Riders & Fleet Operations** — Monitor delivery staff availability, vehicle types, performance metrics, and commission/shipping earnings.
26. **Audit Trail & System Logs** — Review immutable operational logs: status changes, order approvals, inventory overrides, and security events.
27. **System Settings & Data Backup** — Store operational parameters, delivery rates, business hours, payment gateway keys, and manual/automated database backups.
28. **Logout** — Safely terminate administrative session and clear cached credentials.

---

## Customer

1. **User Registration & Account Verification** — Create new account via email/password or Google OAuth with email verification.
2. **Login & Session Management** — Authenticate securely with persistent token storage and profile switching.
3. **Browse Catalog & Category Exploration** — Discover parts and accessories with categorization, brand sorting, and price range filters.
4. **Search Products** — Keyword search with real-time autocompletion and match highlighting.
5. **Manage My Motorcycles (Virtual Garage)** — Save owned motorcycles (brand, model, year, displacement, photo) to enable personalized vehicle fitment.
6. **Check Part Compatibility** — Instant compatibility verification badge showing whether a part fits the customer's registered motorcycle(s).
7. **Filter Compatible Products** — 1-click toggle to display only parts verified to fit the currently active motorcycle.
8. **Manage Wishlist** — Save prospective parts for future review and easily move items to the cart.
9. **Cart Management** — Add items, configure options (size, color, variant), adjust quantities, and review live subtotals.
10. **Apply Promo Voucher** — Enter active discount codes during checkout for instant discount calculation.
11. **Checkout & Payment Selection** — Finalize orders with address selection and multiple payment options: Cash on Delivery (COD), GCash, and Debit/Credit Card.
12. **Track Orders & Live GPS Map** — Track order lifecycle from processing to delivery, including real-time GPS tracking of the dispatched rider.
13. **View Order History & Invoices** — Access past order receipts, item breakdowns, transaction statuses, and delivery confirmations.
14. **Cancel / Resubmit Orders** — Cancel unverified orders or resubmit corrected payment/address information.
15. **Confirm Delivery (QR / Confirmation Link)** — Present delivery QR code to rider or confirm receipt online via secure verification link.
16. **Rate Delivered Orders & Submit Feedback** — Submit 1-to-5 star ratings, write reviews, and report order or delivery issues.
17. **Request Return / Exchange** — File return or replacement claims for damaged or incorrect items with photo evidence.
18. **AI Customizer & Install Studio** — Preview aesthetic modifications and part installations on motorcycle models using generative AI and save custom setups.
19. **Book Garage Service (PMS & Repairs)** — Schedule periodic maintenance service (PMS) or custom repairs with preferred branch, date, and issue notes.
20. **Review Service Quotations** — Inspect inspection reports, approve or decline itemized labor and parts quotations, and authorize additional repairs.
21. **Present Pickup QR Code** — Display dynamic pickup QR code at the service center for secure motorcycle release after service completion.
22. **Manage Customer Profile & Addresses** — Update personal details, contact numbers, avatar, and multiple shipping addresses.
23. **In-App Notifications** — Receive real-time alerts for order status changes, restock alerts, service quotes, and promotional discounts.
24. **Logout** — Terminate session securely across client platforms.

---

## Rider (Delivery Staff)

1. **Login & Availability Toggle** — Authenticate with rider credentials and toggle on-duty/off-duty dispatch status.
2. **Rider Dashboard & Earnings Summary** — Review daily/weekly completed deliveries, pending stops, and accumulated shipping fee earnings.
3. **View Assigned Deliveries** — Access dispatch manifest organized by neighborhood/area with route optimization priority.
4. **View Order Details & Packing Slips** — Inspect recipient information, delivery instructions, item checklist, and COD collection amount.
5. **Turn-by-Turn GPS Navigation** — Launch Google Maps / Waze navigation directly from the order destination address.
6. **Customer Contact Integration** — Direct 1-tap phone call or SMS communication with the recipient for delivery coordination.
7. **Mark Out for Delivery & Broadcast Live GPS** — Transition order status to Out for Delivery and begin real-time GPS location broadcasting.
8. **Scan Recipient Delivery QR Token** — Scan recipient's delivery QR code to cryptographically verify parcel handoff.
9. **Confirm Delivery & Submit Proof of Delivery (POD)** — Complete order handoff with recipient signature capture and photo proof.
10. **Report Delivery Exception / Reschedule** — Flag delivery hurdles (customer unavailable, unreachable, incorrect address) and reschedule attempt.
11. **View Delivery History & Pay Ledger** — Review completed run archives and calculated commission balances.
12. **In-App Notifications** — Receive instant dispatch notifications when new delivery orders are assigned.
13. **Logout** — Terminate rider session.

---

## Mechanic (Service Technician)

1. **Login & Authentication** — Authenticate via mechanic credentials to access specialized workshop tools.
2. **Mechanic Dashboard Overview** — View assigned service bookings filtered by status: *Today*, *Pending Inspection*, *Quotation Estimate*, *In Service*, and *Completed*.
3. **Vehicle Check-in & Multi-Point Inspection** — Inspect incoming motorcycle, record odometer mileage, document vehicle condition, take photos, and complete diagnostic checklist.
4. **Draft Labor & Parts Quotation Estimate** — Build itemized estimate selecting required replacement parts from store inventory and defining labor charges for Admin review.
5. **Request Additional Work / Scope Expansion** — Flag discovered auxiliary defects during repair and submit add-on quote requests for customer authorization.
6. **Update Service Progress Milestones** — Transition repair status across active stages (*In Progress*, *Waiting for Parts*, *Quality Testing*, *Service Done*).
7. **Document Completion Notes** — Record technical notes, recommendations, and mark vehicle ready for administrative billing and pickup.
8. **View Service History & Work Logs** — Review previously completed repair jobs, service notes, and personal maintenance logs.
9. **In-App Notifications** — Receive immediate alerts when Admin assigns new service bookings or customers approve quotations.
10. **Logout** — Terminate technician session.

---

## Master Functional Requirements Mapping (001 – 060)

| Use Case ID | Use Case Name | Primary Actor(s) | System Module |
|---|---|---|---|
| **UC-001** | Login | All Roles | Authentication |
| **UC-002** | User Registration | Customer | Authentication |
| **UC-003** | Manage Users | Admin | User Management |
| **UC-004** | Manage Products | Admin | Product Catalog |
| **UC-005** | View Products | Customer, Guest | Storefront |
| **UC-006** | Search Products | Customer, Guest | Storefront |
| **UC-007** | Filter Products | Customer, Guest | Storefront |
| **UC-008** | Manage Inventory | Admin | Inventory & Stock |
| **UC-009** | Stock Alert Notification | Admin | Inventory & Stock |
| **UC-010** | Stock Optimization & Demand Forecast | Admin | Analytics & Forecasting |
| **UC-011** | Point of Sale (POS) | Admin | Sales & Counter |
| **UC-012** | Generate Receipt & Packing Slip | Admin, Customer | Sales & Orders |
| **UC-013** | View Sales Reports | Admin | Analytics & Reports |
| **UC-014** | View Inventory Reports | Admin | Analytics & Reports |
| **UC-015** | Add to Cart | Customer | Cart & Checkout |
| **UC-016** | View Cart | Customer | Cart & Checkout |
| **UC-017** | Update Cart & Variants | Customer | Cart & Checkout |
| **UC-018** | Checkout & Order Placement | Customer | Cart & Checkout |
| **UC-019** | Apply Promo Voucher | Customer | Cart & Checkout |
| **UC-020** | Manage Orders & COD Fulfillment | Admin | Orders & Fulfillment |
| **UC-021** | View Order Status | Customer | Orders & Fulfillment |
| **UC-022** | View Order History | Customer | Orders & Fulfillment |
| **UC-023** | Cancel Order | Customer | Orders & Fulfillment |
| **UC-024** | Request Return / Exchange | Customer | Orders & Fulfillment |
| **UC-025** | Confirm Delivery (QR / Token) | Customer, Rider | Delivery & Logistics |
| **UC-026** | Live Delivery Tracking (GPS) | Customer | Delivery & Logistics |
| **UC-027** | Manage Customers | Admin | CRM & Users |
| **UC-028** | Customer Profile & Addresses | Customer | Account Management |
| **UC-029** | Manage Suppliers | Admin | Supply Chain |
| **UC-030** | Manage Promo Vouchers | Admin | Marketing & Sales |
| **UC-031** | Manage Motorcycle Models | Admin | Fitment & Garage |
| **UC-032** | Manage Product Compatibility | Admin | Fitment & Garage |
| **UC-033** | Register My Motorcycle | Customer | Fitment & Garage |
| **UC-034** | Check Part Compatibility | Customer | Fitment & Garage |
| **UC-035** | Manage Wishlist | Customer | Storefront |
| **UC-036** | AI Customizer / Install Studio | Customer | Customizer Studio |
| **UC-037** | Save Customization Setup | Customer | Customizer Studio |
| **UC-038** | Book Garage Service | Customer | Garage & Bookings |
| **UC-039** | Review Service Quotation | Customer | Garage & Bookings |
| **UC-040** | Manage Garage Bookings | Admin | Garage & Bookings |
| **UC-041** | Pickup QR Release | Admin, Customer | Garage & Bookings |
| **UC-042** | Manage Mechanics | Admin | Garage & Bookings |
| **UC-043** | Mechanic Job Workflow | Mechanic | Workshop Operations |
| **UC-044** | Manage Riders | Admin | Fleet & Delivery |
| **UC-045** | Assign Delivery | Admin | Fleet & Delivery |
| **UC-046** | Rider Delivery Run | Rider | Fleet & Delivery |
| **UC-047** | Scan Delivery QR | Rider | Fleet & Delivery |
| **UC-048** | Confirm Rider Delivery (POD) | Rider | Fleet & Delivery |
| **UC-049** | View Rider Earnings | Rider | Fleet & Delivery |
| **UC-050** | Notifications System | All Roles | Communications |
| **UC-051** | View Dashboard Overview | Admin | Admin Operations |
| **UC-052** | Export Reports (Excel / CSV) | Admin | Analytics & Reports |
| **UC-053** | System Settings & Config | Admin | Administration |
| **UC-054** | Audit Trail & Event Logs | Admin | Security & Compliance |
| **UC-055** | Admin Security Lock (PIN) | Admin | Security & Compliance |
| **UC-056** | Logout | All Roles | Authentication |
| **UC-057** | Rate Delivered Order & Submit Report | Customer | Feedback & Reviews |
| **UC-058** | Manage Marketing Banners | Admin | Marketing & Content |
| **UC-059** | Manage Customer Feedback & Reports | Admin | CRM & Quality Control |
| **UC-060** | Manage Purchase Orders | Admin | Supply Chain & Restock |
