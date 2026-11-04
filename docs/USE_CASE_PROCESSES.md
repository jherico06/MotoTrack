# MotoTrack — Use Case Processes (IPO)

Input–Process–Output diagrams for major system processes.  
Companion catalog: [USE_CASES.md](./USE_CASES.md)

---

### Column legend

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Data or action the actor provides | What the system does | Result shown or stored |

---

## 1. User Registration Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| User details (name, email, password) | Validate input and store account in database | Account created confirmation / redirect to shop |

```
[ User details ] → [ Store user information in database ] → [ Account created confirmation ]
```

---

## 2. Login Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Email/username and password (or Google OAuth) | Verify credentials and resolve role | Homepage, Admin Dashboard, Rider Dashboard, or Mechanic Dashboard |

```
[ Username and Password ] → [ Verify login credentials ] → [ Role homepage / dashboard ]
```

---

## 3. Manage Users Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| User data (view / change role / delete) | Update user records and permissions | Updated user list |

```
[ User data (edit / delete / view) ] → [ Updating user records ] → [ Updated User List ]
```

---

## 4. Manage Products Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Product details (add / edit / delete, sizes, colors, images) | Save product information and compatibility links | Updated product list / catalog |

```
[ Product details (add / edit / delete) ] → [ Saving product information ] → [ Updated Product List ]
```

---

## 5. View Products Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Product browse request | Retrieve product data with stock and category info | Product display in store |

```
[ Product request ] → [ Retrieving product data ] → [ Product Display ]
```

---

## 6. Search Products Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Search keyword | Match products by name or description | Search results |

```
[ Search keyword ] → [ Matching products ] → [ Search Results ]
```

---

## 7. Filter Products Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Filter criteria (category, price, sort, compatibility) | Apply filters against catalog and active motorcycle | Filtered product list |

```
[ Filter criteria ] → [ Apply catalog filters ] → [ Filtered Product List ]
```

---

## 8. Manage Inventory Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Restock quantities, unit cost, supplier | Update stock levels by size/color and valuation | Updated inventory status |

```
[ Restock details ] → [ Update stock levels ] → [ Updated Inventory Status ]
```

---

## 9. Stock Alert Notification Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Current stock levels and thresholds | Detect low / out-of-stock SKUs | Admin stock alert notification |

```
[ Stock levels ] → [ Detect low stock ] → [ Stock Alert Notification ]
```

---

## 10. Stock Optimization (Forecast) Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Sales history by product/category | Run demand forecast and safety-stock calculation | Restock recommendations |

```
[ Sales history ] → [ Forecast demand & safety stock ] → [ Restock Recommendations ]
```

---

## 11. POS / Manage Sales Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Walk-in cart items and tender | Record in-store sale and deduct stock | Sale recorded + receipt |

```
[ Cart items & payment ] → [ Record POS transaction ] → [ Receipt / Sale Confirmation ]
```

---

## 12. Checkout Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Cart, address, payment method, optional promo | Create order, reserve stock, apply payment rules | Order placed (Pending Approval or prepaid confirmed) |

```
[ Cart & payment details ] → [ Create order & apply payment ] → [ Order Confirmation ]
```

---

## 13. Manage Orders Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Order action (approve COD, process, assign rider, update status) | Advance order workflow and delivery assignment | Updated order status / packing token |

```
[ Order action ] → [ Update order workflow ] → [ Updated Order Status ]
```

---

## 14. View Order Status / Live Tracking Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Customer order request | Retrieve status timeline and live rider GPS (if out for delivery) | Order tracking view / live map |

```
[ Order request ] → [ Retrieve status & GPS ] → [ Tracking Display ]
```

---

## 15. Confirm Delivery (QR) Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Delivery QR token (scan or link) | Verify token against order and mark delivered | Delivery confirmed message |

```
[ Delivery QR token ] → [ Verify token & confirm order ] → [ Delivery Confirmed ]
```

---

## 16. Rider Delivery Run Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Assigned order + Out for Delivery action | Start GPS tracking, navigate, scan QR, confirm delivery | Delivery reported / completed stop |

```
[ Assigned delivery ] → [ Track GPS · scan QR · confirm ] → [ Delivery Completed ]
```

---

## 17. AI Customizer Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Motorcycle photo + selected part (or upload) | Build install prompt and generate AI preview | Customization preview / saved setup |

```
[ Bike & part selection ] → [ Generate AI install preview ] → [ Customization Preview ]
```

---

## 18. Book Garage Service Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Bike, service type, notes/media, preferred schedule | Create flexible booking for admin review | Booking submitted (Pending Review) |

```
[ Booking details ] → [ Create garage booking ] → [ Booking Confirmation ]
```

---

## 19. Service Quotation Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Inspection findings, labor, parts, downpayment | Build quotation and await customer approval | Accepted / declined quotation status |

```
[ Labor & parts estimate ] → [ Build quotation & notify customer ] → [ Quotation Decision ]
```

---

## 20. Mechanic Job Workflow Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Assigned job actions (inspect, estimate, progress, complete) | Update booking workflow for admin/customer visibility | Updated job status |

```
[ Job action ] → [ Update service progress ] → [ Updated Job Status ]
```

---

## 21. Pickup QR Release Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Customer pickup QR token | Validate token and release motorcycle | Bike released / booking completed |

```
[ Pickup QR token ] → [ Validate & release motorcycle ] → [ Pickup Completed ]
```

---

## 22. Customer Profile Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Updated profile fields (name, phone, address, password) | Validate and save profile changes | Updated customer profile |

```
[ Profile data ] → [ Save profile changes ] → [ Updated Profile ]
```

---

## 23. Manage Suppliers Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Supplier details (add / edit / status) | Save supplier records for restock linking | Updated supplier list |

```
[ Supplier details ] → [ Save supplier information ] → [ Updated Supplier List ]
```

---

## 24. Notifications Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| System event (order, stock, booking, promo, security) | Create and deliver role-targeted alerts | Notification inbox update |

```
[ System event ] → [ Create role alert ] → [ Notification Delivered ]
```

---

## 25. Rate Delivered Order & Customer Feedback Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Order ID, star rating (1–5), review text, issue category, photos | Verify delivered status, persist review/report, update product rating aggregates | Feedback recorded confirmation / Admin feedback log entry |

```
[ Star rating, review & issue details ] → [ Verify delivery & record feedback ] → [ Rating & Feedback Log Updated ]
```

---

## 26. Return / Exchange Request Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Delivered order ID, return reason, proof photo upload | Validate order return window, record return ticket, flag order status | Return ticket submitted / Admin review prompt |

```
[ Return reason & photo proof ] → [ Create return claim & update order state ] → [ Return Claim Pending Review ]
```

---

## 27. Cart Management & Promo Voucher Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Product variant selection, quantity increment/decrement, voucher code | Check real-time stock availability, validate voucher rules (min spend, expiry), compute discount | Updated cart subtotals and applied discount breakdown |

```
[ Cart items & promo code ] → [ Check stock & validate voucher rules ] → [ Updated Subtotal & Discount Applied ]
```

---

## 28. Manage Marketing Banners Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Banner image, headline title, badge, subtitle, target link, active status | Store banner configuration in admin settings and broadcast updates | Dynamic storefront hero banner updated |

```
[ Banner image & copy ] → [ Save marketing banner settings ] → [ Updated Storefront Hero Showcase ]
```

---

## 29. Manage Purchase Orders Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Supplier selection, items, restock quantities, unit costs, expected date | Generate purchase order record, track shipment status, increment stock on receiving | Created purchase order / inventory replenished |

```
[ Supplier & restock order items ] → [ Generate purchase order & receive shipment ] → [ Warehouse Inventory Replenished ]
```

---

## 30. Motorcycle Models & Compatibility Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Motorcycle brand, model name, displacement, years; product mapping | Store vehicle specifications and link part compatibility matrix | Updated compatibility master catalog |

```
[ Vehicle specs & part associations ] → [ Map vehicle compatibility matrix ] → [ Accurate Customer Fitment Badges ]
```

---

## 31. Mechanic Vehicle Inspection & Estimate Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Booking ID, odometer reading, checklist items, condition photos, parts & labor draft | Save inspection findings, transition booking status, compile quotation estimate for admin approval | Inspection report completed / quotation pending customer review |

```
[ Odometer, checklist & parts estimate ] → [ Record diagnostics & draft quotation ] → [ Quotation Ready for Review ]
```

---

## 32. Audit Log & Security Lock Process

| INPUT | PROCESS | OUTPUT |
| :---: | :---: | :---: |
| Administrative event (order status change, stock override, role update) or idle timer | Log immutable event to audit trail or trigger PIN lock screen | Secure audit trail record / screen locked until PIN verified |

```
[ Admin event / idle timeout ] → [ Record audit event / enforce PIN lock ] → [ Secure Audit Record / Locked Session ]
```

---

## Mermaid overview (end-to-end system flows)

```mermaid
flowchart TD
  subgraph Customer Shopping & Checkout
    A1[Browse & Compatibility Check] --> A2[Add to Cart & Apply Promo]
    A2 --> A3[Checkout: COD or GCash]
    A3 --> A4[Order Created: Pending Admin Approval]
  end

  subgraph Admin Order Fulfillment & Dispatch
    A4 --> B1[Admin Approves COD & Packs Order]
    B1 --> B2[Assign Rider & Generate Delivery QR]
  end

  subgraph Rider Delivery Execution
    B2 --> C1[Rider Accepts & Marks Out for Delivery]
    C1 --> C2[Live GPS Broadcast & Google Maps Navigation]
    C2 --> C3[Scan Delivery QR & Upload Proof of Delivery]
    C3 --> C4[Order Delivered & Shipping Fee Earned]
  end

  subgraph Customer Post-Delivery
    C4 --> D1[Rate Order & Submit Feedback]
    C4 --> D2[Optional: Request Return/Exchange]
  end

  subgraph Garage PMS & Repair Workflow
    G1[Customer Books Service] --> G2[Admin Assigns Mechanic & Bay]
    G2 --> G3[Mechanic Diagnostic Inspection]
    G3 --> G4[Itemized Labor & Parts Quotation]
    G4 --> G5[Customer Approves Quotation]
    G5 --> G6[Mechanic Performs Repair & Updates Milestones]
    G6 --> G7[Admin Scans Pickup QR & Releases Vehicle]
  end

  subgraph Inventory & Demand Forecasting
    I1[Daily Sales & POS Transactions] --> I2[OLS Linear Regression Demand Forecast]
    I2 --> I3[Safety Stock & Reorder Point Alerts]
    I3 --> I4[Admin Purchase Order to Supplier]
  end
```
