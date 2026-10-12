# MotoTrack — Role Functions

This app is a motorcycle parts store with garage service and delivery. The login roles are:

- [Customer](#customer)
- [Admin](#admin)
- [Rider](#rider)
- [Mechanic](#mechanic)

For numbered use cases, see [USE_CASES.md](./USE_CASES.md).  
For Input–Process–Output diagrams, see [USE_CASE_PROCESSES.md](./USE_CASE_PROCESSES.md).

---

## Customer

### Shopping
- Browse the store (products, filters, search, categories)
- Check part compatibility against registered motorcycles
- Add items to cart, apply promo vouchers, and checkout
- Payment options: Cash on Delivery (COD), GCash, Card
- Wishlist for later

### Orders
- Track orders, view order history, and live GPS when out for delivery
- Cancel orders while pending/processing; request returns after delivery
- Confirm delivery via QR token / public confirm link

### Garage & personalization
- Register motorcycles (brand, model, year, photos)
- Book PMS / repair (flexible quote-after-inspection workflow)
- Accept or decline service quotations and additional work
- Show pickup QR when the bike is ready
- AI Customizer / Install Studio to preview parts and save setups

### Account
- Manage profile, address, password, and notifications
- Dark mode preference

---

## Admin (Store Administrator)

### Operations
- **Overview** — stocks, sales trends, financial snapshot, pending COD
- **Orders & COD Fulfillment** — approve COD, process, assign riders, delivery tokens, live GPS, returns/reschedule
- **Inventory & Stock** — restock by size/color, low-stock alerts, valuation
- **Point of Sale (POS)** — walk-in cashier sales and receipts
- **Analytics & Reports** — revenue (POS vs online), AOV, payment mix, Excel export
- **Forecast** — demand forecast, safety stock, restock recommendations
- **Customizations** — review customer AI / saved customization records

### Store management
- **Products & Prices** — CRUD catalog, sizes/colors, compatibility picker
- **Moto Models** — brand/model catalog for compatibility
- **Promo Vouchers** — create, activate/deactivate, delete
- **Suppliers** — partner CRUD and restock linking

### Garage & people
- **Bookings** — approve/reject, assign mechanic/bay, quotations, payments, pickup QR release
- **Mechanics** — roster, specializations, linked login accounts
- **Riders** — status, login access, delivery assignment

### Platform
- **Users** — roles and account management
- **Notifications / Audit** — alerts and security-ops log
- **System Settings** — branding, shipping, delivery/pickup, downpayment, backup, PIN lock

---

## Rider (Delivery Staff)

### Dashboard
- Weekly earnings summary (shipping fees)
- Delivered vs open assignment counts

### Active route
- Assigned deliveries grouped by area
- Navigate via Google Maps; call customer
- View order details (items, payment, total)

### Delivery workflow
- Mark **Out for Delivery** and share live GPS
- Scan delivery QR to verify the order
- Confirm delivery with optional proof-of-delivery photo
- Report delivery issues; view history and earnings

---

## Mechanic

### Assigned jobs
- View jobs filtered by today, upcoming, inspection, estimate, in service, completed

### Workflow
- Start / save inspection (checklist, odometer, findings)
- Submit labor/parts estimate for admin quotation
- Update service progress and request additional work
- Complete service notes (payment and bike release remain admin-only)
