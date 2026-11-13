# MotoTrack — Master Functional Requirements Catalog (001–035)

Systematic mapping of all 35 functional requirements to roles, dashboards, continuous letter labels, and database off-page connectors.

| Functional Requirement | Primary Role(s) | Dashboard / Module | Flowchart Label | DB Link | Process Flowchart | Description |
|---|---|---|:---:|:---:|:---:|---|
| **Login** | All Roles | Authentication | `AUTH` | (1, 2) | [Main Flowchart](./diagrams/flowchart_main.png) | Allows users to securely access the system using registered credentials or Google OAuth. |
| **Registration** | Customer | Storefront / Auth | `AUTH` | (1, 2) | [Main Flowchart](./diagrams/flowchart_main.png) | Allows new customers to register an account and initialize their virtual garage. |
| **User Management** | Admin | Admin Dashboard | `E` | (7) | [Process E](./diagrams/flowchart_main.png) | Allows administrators to create, update, deactivate, and manage user accounts across roles. |
| **Customer Profile** | Customer | Customer Portal | `P` | (19) | [Process P](./diagrams/flowchart_process_P_profile.png) | Allows customers to manage personal information, delivery addresses, and security settings. |
| **My Garage** | Customer | Customer Portal | `U` | (24) | [Process U](./diagrams/flowchart_process_U_garage.png) | Allows customers to save motorcycles (brand, model, year) for automatic parts fitment. |
| **View Products** | Customer, Guest | Storefront | `V` | (16) | [Process V](./diagrams/flowchart_main.png) | Allows users to browse, search, and filter available motorcycle parts and catalog details. |
| **Manage Product** | Admin | Admin Dashboard | `D` | (6) | [Process D](./diagrams/flowchart_process_D_product.png) | Full catalog CRUD operations: variants, prices, sizes, colors, and media galleries. |
| **Product Compatibility** | Admin, Customer | Fitment Engine | `D` / `V` | (6, 16) | [Process D](./diagrams/flowchart_process_D_product.png) | Allows admin to map fitment and customers to verify compatible parts for their bike. |
| **AI Customizer** | Customer | Atelier Studio | `R` | (21) | [Process R](./diagrams/flowchart_main.png) | Allows customers to preview parts and visual cosmetic modifications on motorcycles using AI. |
| **Cart & Wishlist** | Customer | Storefront | `N` | (17) | [Process N](./diagrams/flowchart_process_N_cart.png) | Allows customers to manage shopping cart items, select variants, and save wishlist items. |
| **Checkout & Payment** | Customer | Storefront | `O` | (18) | [Process O](./diagrams/flowchart_process_O_checkout.png) | Allows customers to place orders with delivery addresses, promo vouchers, COD, GCash, or Card. |
| **Manage Order** | Admin | Admin Dashboard | `A` | (3) | [Process A](./diagrams/flowchart_process_A_orders.png) | Allows administrators to review orders, verify COD requests, and track fulfillment. |
| **Order Tracking** | Customer | Customer Portal | `Q` | (20) | [Process Q](./diagrams/flowchart_process_Q_tracking.png) | Allows customers to monitor live fulfillment status and track rider via realtime GPS map. |
| **Order Return** | Customer | Customer Portal | `Q` | (20) | [Process Q](./diagrams/flowchart_process_Q_tracking.png) | Allows customers to submit return/replacement claims for delivered items within 7 days. |
| **Customer Feedback** | Customer, Admin | Feedback System | `W` | (25) | [Process W](./diagrams/flowchart_process_Q_tracking.png) | Allows customers to rate delivered orders (1-5 stars) and admin to inspect feedback. |
| **Assign Delivery** | Admin | Fleet Operations | `L` | (14) | [Process L](./diagrams/flowchart_process_A_orders.png) | Allows administrators to assign verified delivery orders to active riders by area. |
| **Rider Delivery Run** | Rider | Rider Dashboard | `RD1` | (26) | [Process RD](./diagrams/flowchart_process_rider_delivery.png) | Allows riders to accept dispatches, view routes, broadcast GPS location, and call buyers. |
| **Proof of Delivery** | Rider | Rider Dashboard | `RD2` | (27) | [Process RD](./diagrams/flowchart_process_rider_delivery.png) | Allows riders to scan recipient delivery QR tokens and submit proof-of-delivery photos. |
| **Rider Earnings** | Rider | Rider Dashboard | `RD3` | (28) | [Process RD](./diagrams/flowchart_process_rider_delivery.png) | Allows riders to review completed delivery runs and accumulated shipping fee earnings. |
| **Book Garage Service** | Customer | Garage Bookings | `S` | (22) | [Process S](./diagrams/flowchart_process_T_service.png) | Allows customers to schedule PMS maintenance or repairs with preferred date and branch. |
| **Booking Management** | Admin | Admin Dashboard | `M` | (15) | [Process M](./diagrams/flowchart_process_T_service.png) | Allows administrators to review appointments, allocate mechanic service bays, and update jobs. |
| **Manage Stock** | Admin | Inventory | `B` | (4) | [Process B](./diagrams/flowchart_process_B_inventory.png) | Allows administrators to monitor stock levels, manage variants, and record restock batches. |
| **View Stock** | Admin | Inventory | `B` | (4) | [Process B](./diagrams/flowchart_process_B_inventory.png) | Allows administrators to inspect stock quantities, valuations, and category movements. |
| **Stock Alert Notification** | Admin | Inventory | `B` / `I` | (4, 11) | [Process B](./diagrams/flowchart_process_B_inventory.png) | Alerts administrators when inventory levels reach low-stock or depleted thresholds. |
| **View Forecast** | Admin | Analytics | `H` | (10) | [Process H](./diagrams/flowchart_process_B_inventory.png) | Provides restock quantity recommendations based on Ordinary Least Squares (OLS) trends. |
| **Manage Supplier** | Admin | Supply Chain | `C` | (5) | [Process C](./diagrams/flowchart_main.png) | Allows administrators to maintain vendor directory details and link restock purchase costs. |
| **Manage Purchase Order** | Admin | Supply Chain | `F` | (8) | [Process F](./diagrams/flowchart_main.png) | Allows administrators to draft, submit, and receive purchase orders from accredited vendors. |
| **Point of Sale (POS)** | Admin | Sales Counter | `K` | (13) | [Process K](./diagrams/flowchart_main.png) | Allows administrators to process in-store walk-in sales transactions and generate receipts. |
| **Manage Promotion** | Admin | Marketing | `G` | (9) | [Process G](./diagrams/flowchart_main.png) | Allows administrators to create discount vouchers and manage dynamic hero marketing banners. |
| **View Report** | Admin | Analytics | `H` | (10) | [Process H](./diagrams/flowchart_main.png) | Allows administrators to view and export sales, inventory, and booking reports. |
| **View Notification** | All Roles | Communications | `I` / `RN` | (11, 29) | [Main Flowchart](./diagrams/flowchart_main.png) | Delivers automated push and in-app notifications for order updates, restocks, and bookings. |
| **System Settings** | Admin | Administration | `J` | (12) | [Process J](./diagrams/flowchart_main.png) | Allows administrators to configure store operational parameters, delivery rates, and policies. |
| **System Activity Log** | Admin | Security | `J` | (12) | [Process J](./diagrams/flowchart_main.png) | Records administrative system actions, status transitions, and security events. |
| **Admin Security Lock** | Admin | Security | `J` | (12) | [Process J](./diagrams/flowchart_main.png) | Automatically secures administrative sessions with a PIN lock after inactivity. |
| **Logout** | All Roles | Authentication | `X` | — | [Main Flowchart](./diagrams/flowchart_main.png) | Allows authenticated users across all roles to safely terminate active sessions. |

---

## Flowchart and Diagram References

All diagrams are provided in PNG format:
- [Master Main System Flowchart](./diagrams/flowchart_main.png)
- [Admin Role Use Case Diagram (Labeled)](./diagrams/usecase_admin.png)
- [Customer Role Use Case Diagram (Labeled)](./diagrams/usecase_customer.png)
- [Rider Role Use Case Diagram (Labeled)](./diagrams/usecase_rider.png)
- [All Actors Combined Use Case Diagram (Labeled)](./diagrams/usecase_all_actors.png)
- [Process D: Manage Products & Compatibility](./diagrams/flowchart_process_D_product.png)
- [Process N: Cart & Wishlist Operations](./diagrams/flowchart_process_N_cart.png)
- [Process P: Customer Profile & Addresses](./diagrams/flowchart_process_P_profile.png)
- [Process T: Service Booking & Quotations](./diagrams/flowchart_process_T_service.png)
- [Process U: My Garage & Fitment](./diagrams/flowchart_process_U_garage.png)
- [Process A: Manage Orders & COD Verification](./diagrams/flowchart_process_A_orders.png)
- [Process B: Inventory Stock & Low-Stock Alerts](./diagrams/flowchart_process_B_inventory.png)
- [Process O: Checkout & Payment](./diagrams/flowchart_process_O_checkout.png)
- [Process Q: Order Tracking, Delivery QR & Returns](./diagrams/flowchart_process_Q_tracking.png)
- [Processes RD1/RD2/RD3: Rider Fleet Operations](./diagrams/flowchart_process_rider_delivery.png)
- Master Editable File: [MotoTrack_Flowcharts.drawio](./diagrams/MotoTrack_Flowcharts.drawio)
