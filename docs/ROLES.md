# MotoTrack — Role Functions

This app is a motorcycle parts store. The three roles are:

- [Customer](#customer)
- [Admin](#admin)
- [Rider](#rider)

---

## Customer

### Shopping
- Browse the store (products, filters, search, categories, hero banner)
- Add items to cart, apply promo vouchers, and checkout
- Payment options: Cash on Delivery (COD), GCash, Card

### Orders
- Track orders and view order history
- Cancel / resubmit orders
- Rate delivered orders

### Personalization
- AI Customizer to build a custom motorcycle setup
- Save setups to their Garage (PMS, tuning services)
- Wishlist for later

### Account
- Manage profile, address, and notifications
- Confirm delivery via QR token when receiving an order

---

## Admin (Store Administrator)

### Operations
- **Overview** — dashboard with live stats and pending COD count
- **Orders & COD Fulfillment** — approve COD orders, process, mark ready for delivery / out for delivery, cancel, handle returns
- **Inventory & Stock** — restock, adjust stock, search/filter, low-stock alerts
- **Point of Sale (POS)** — in-store walk-in cashier sales, payment handling, receipts
- **Analytics & Reports** — revenue (POS vs online), average order value, top-selling products, payment method breakdown

### Store Management
- **Products & Prices** — add / edit / delete products, update prices and categories
- **Promo Vouchers** — create, activate/deactivate, and delete discount codes
- **Garage Services** — manage PMS and tuning service listings

### People & Platform
- **Riders / Delivery Staff** — add / edit / delete riders, assign deliveries, manage rider status (available / on-delivery / off-duty), grant rider login access
- **User Accounts** — promote users to admin, delete accounts
- **Notifications** — send and manage alerts
- **Supabase Database Settings** — configure DB credentials, test connection
- **System Settings** — platform-wide settings, factory presets reset

---

## Rider (Delivery Staff)

### Dashboard
- Weekly earnings summary (shipping fees earned)
- Delivered vs. undelivered counts

### Active route
- List of assigned deliveries grouped by area
- Navigate to customer via Google Maps
- Call the customer
- View order details (items, payment method, total)

### Delivery workflow
- Mark orders **Out for Delivery**
- Scan the customer's delivery QR to verify the order
- Confirm delivery using the QR token
- Delivery history with earnings per completed stop