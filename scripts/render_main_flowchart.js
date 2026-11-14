const fs = require('fs');
const path = require('path');
const {
  renderHtmlToPng,
  escapeXml,
  drawStartEnd,
  drawProcess,
  drawProcessMulti,
  drawParallelogram,
  drawParallelogramMulti,
  drawDecision,
  drawDecisionMulti,
  drawConnector,
  drawDatabase,
  drawArrow,
  drawPolyArrow,
  svgDefs,
  outDir
} = require('./flowchart_helpers');

console.log('Generating Main Flowchart Diagram...');

const width = 1680;
const height = 1580;

let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${svgDefs}
  <!-- White Background -->
  <rect width="${width}" height="${height}" fill="#ffffff" />

  <!-- Diagram Header Banner -->
  <rect x="30" y="20" width="${width - 60}" height="55" fill="#f8fafc" stroke="#000000" stroke-width="1.5" />
  <text x="${width / 2}" y="48" font-family="Tahoma, Arial, sans-serif" font-size="20px" font-weight="bold" fill="#000000" text-anchor="middle">MOTOTRACK — MASTER SYSTEM FLOWCHART RULEBOOK</text>
  <text x="${width / 2}" y="66" font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#444444" text-anchor="middle">All Dashboards, 35 Functional Requirements, Role Use Cases (Continuous Letters A–Z / Alphanumeric), and Database Interaction</text>

  <!-- ========================================== -->
  <!-- TOP AUTHENTICATION & ACCESS ROUTING        -->
  <!-- ========================================== -->
  ${drawStartEnd(780, 95, 120, 45, 'Start')}

  ${drawArrow(840, 140, 840, 170)}

  ${drawParallelogramMulti(730, 170, 220, 48, ['User Credentials Entry', '(Email / Google OAuth / Password)'], 14)}

  ${drawArrow(840, 218, 840, 255)}

  ${drawDecisionMulti(840, 290, 160, 70, ['Credentials', 'Valid?'])}

  <!-- Invalid Loop -->
  ${drawPolyArrow(['920,290', '980,290', '980,194', '950,194'], 'No', { x: 995, y: 245 })}

  <!-- Valid split -->
  ${drawArrow(840, 325, 840, 365, 'Yes')}

  ${drawDecisionMulti(840, 400, 180, 70, ['Authenticated', 'Role Type?'])}

  <!-- Routing to Roles -->
  <!-- To Admin (Left) -->
  ${drawPolyArrow(['750,400', '260,400', '260,450'], 'Admin', { x: 480, y: 390 })}

  <!-- To Customer (Center) -->
  ${drawArrow(840, 435, 840, 450, 'Customer')}

  <!-- To Rider (Right) -->
  ${drawPolyArrow(['930,400', '1420,400', '1420,450'], 'Rider', { x: 1190, y: 390 })}

  <!-- ========================================== -->
  <!-- CENTRAL DATABASE CYLINDER & CONNECTORS     -->
  <!-- ========================================== -->
  <!-- Placed in upper-middle between columns -->
  ${drawDatabase(730, 850, 220, 140, 'MotoTrack Supabase DB')}
  <text x="840" y="1015" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" font-weight="bold" fill="#666666" text-anchor="middle">Central Database Core (PostgreSQL &amp; Storage)</text>

  <!-- Numbered Connectors Hub to Database -->
  <!-- Connectors from Admin: 3..15 -->
  <!-- Connectors from Customer: 16..25 -->
  <!-- Connectors from Rider: 26..29 -->
`;

// Helper to draw module row
function renderModuleRow(x, y, w, h, labelLetter, dbNumber, lines) {
  let content = '';
  // Parallelogram box
  content += drawParallelogramMulti(x, y, w, h, lines, 10);
  
  // Letter badge (Right of parallelogram)
  const badgeX = x + w + 24;
  const badgeY = y + h / 2;
  content += drawConnector(badgeX, badgeY, 13, labelLetter, true);
  content += `<line x1="${x + w - 5}" y1="${badgeY}" x2="${badgeX - 13}" y2="${badgeY}" stroke="#000000" stroke-width="1.2" />`;

  // DB Connector (Right of letter badge)
  if (dbNumber) {
    const dbX = badgeX + 32;
    content += drawConnector(dbX, badgeY, 11, dbNumber, false);
    content += `<line x1="${badgeX + 13}" y1="${badgeY}" x2="${dbX - 11}" y2="${badgeY}" stroke="#000000" stroke-width="1.1" stroke-dasharray="2 2" />`;
  }

  return content;
}

// ==========================================
// COLUMN 1: ADMIN DASHBOARD (x: 40, width: 440)
// ==========================================
const adminColX = 50;
const adminColW = 390;
const adminCardW = 270;
const rowH = 38;
const rowGap = 16;
let currentAdminY = 450;

svg += `
  <!-- Admin Header Box -->
  <rect x="${adminColX}" y="${currentAdminY}" width="${adminColW}" height="42" fill="#0f172a" stroke="#000000" stroke-width="1.5" />
  <text x="${adminColX + adminColW / 2}" y="${currentAdminY + 26}" font-family="Tahoma, Arial, sans-serif" font-size="14px" font-weight="bold" fill="#ffffff" text-anchor="middle">ADMIN DASHBOARD (STORE OPS)</text>
`;

currentAdminY += 60;

const adminModules = [
  { label: 'A', db: '3', lines: ['Manage Orders', '& COD Fulfillment'] },
  { label: 'B', db: '4', lines: ['Inventory, Manage Stock', '& Stock Alerts'] },
  { label: 'C', db: '5', lines: ['Manage Suppliers', '& Restock Batches'] },
  { label: 'D', db: '6', lines: ['Manage Products', '& Fitment Compatibility'] },
  { label: 'E', db: '7', lines: ['User Management', '(Customer & Staff Roles)'] },
  { label: 'F', db: '8', lines: ['Manage Purchase Orders', '(Supplier POs)'] },
  { label: 'G', db: '9', lines: ['Manage Promotion', '(Promo Vouchers & Banners)'] },
  { label: 'H', db: '10', lines: ['Analytics & Reports', '(Revenue & Demand Forecast)'] },
  { label: 'I', db: '11', lines: ['Notifications Center', '& Customer Feedback Logs'] },
  { label: 'J', db: '12', lines: ['System Settings, Audit Trail', '& Security PIN Lock'] },
  { label: 'K', db: '13', lines: ['Point of Sale (POS)', 'Counter Cashier Terminal'] },
  { label: 'L', db: '14', lines: ['Assign Delivery', '(Fleet Rider Dispatch)'] },
  { label: 'M', db: '15', lines: ['Booking Management', '(Workshop Bays & Mechanics)'] },
  { label: 'X', db: null, lines: ['Admin Logout', '(Terminate Admin Session)'] }
];

adminModules.forEach((mod, idx) => {
  const rowY = currentAdminY + idx * (rowH + rowGap);
  svg += renderModuleRow(adminColX + 15, rowY, adminCardW, rowH, mod.label, mod.db, mod.lines);
  // Vertical spine connecting admin modules
  if (idx < adminModules.length - 1) {
    svg += `<line x1="${adminColX + 8}" y1="${rowY + rowH / 2}" x2="${adminColX + 8}" y2="${rowY + rowH + rowGap + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;
    svg += `<line x1="${adminColX + 8}" y1="${rowY + rowH / 2}" x2="${adminColX + 15}" y2="${rowY + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;
  } else {
    svg += `<line x1="${adminColX + 8}" y1="${rowY + rowH / 2}" x2="${adminColX + 15}" y2="${rowY + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;
  }
});

// Admin spine top connection
svg += `<line x1="${adminColX + adminColW / 2}" y1="492" x2="${adminColX + 8}" y2="520" stroke="#000000" stroke-width="1.2" />`;

// ==========================================
// COLUMN 2: CUSTOMER DASHBOARD (x: 620, width: 440)
// ==========================================
const custColX = 635;
const custColW = 410;
const custCardW = 280;
let currentCustY = 450;

svg += `
  <!-- Customer Header Box -->
  <rect x="${custColX}" y="${currentCustY}" width="${custColW}" height="42" fill="#ea580c" stroke="#000000" stroke-width="1.5" />
  <text x="${custColX + custColW / 2}" y="${currentCustY + 26}" font-family="Tahoma, Arial, sans-serif" font-size="14px" font-weight="bold" fill="#ffffff" text-anchor="middle">CUSTOMER PORTAL &amp; STOREFRONT</text>
`;

currentCustY += 60;

const customerModules = [
  { label: 'V', db: '16', lines: ['View Products, Catalog Search', '& Compatibility Filters'] },
  { label: 'N', db: '17', lines: ['Cart & Wishlist', '(Add, Variants & Quantities)'] },
  { label: 'O', db: '18', lines: ['Checkout & Payment', '(COD, GCash, Card & Vouchers)'] },
  { label: 'P', db: '19', lines: ['Customer Profile', '& Delivery Address Book'] },
  { label: 'Q', db: '20', lines: ['My Orders', '(Live Tracking & Return Claim)'] },
  { label: 'R', db: '21', lines: ['AI Customizer Studio', '& Visual Part Previews'] },
  { label: 'S', db: '22', lines: ['Book Garage Service', '(PMS & Repairs Appointment)'] },
  { label: 'T', db: '23', lines: ['Service Quotation Approval', '& Vehicle Pickup QR'] },
  { label: 'U', db: '24', lines: ['My Garage', '(Register Owned Motorcycles)'] },
  { label: 'W', db: '25', lines: ['Customer Feedback', '& Delivered Order Ratings'] },
  { label: 'I', db: '11', lines: ['In-App Notifications', '& Realtime Alerts'] },
  { label: 'X', db: null, lines: ['Customer Logout', '(Terminate Client Session)'] }
];

customerModules.forEach((mod, idx) => {
  // We place modules starting at Y=510, with gap for Database at center
  // Rows 0..4 (Y: 510..730), then DB at 850..990, then Rows 5..11 (Y: 1040..1360)
  let rowY = 0;
  if (idx < 5) {
    rowY = currentCustY + idx * (rowH + 15);
  } else {
    rowY = 1045 + (idx - 5) * (rowH + 15);
  }

  svg += renderModuleRow(custColX + 20, rowY, custCardW, rowH, mod.label, mod.db, mod.lines);

  // Vertical spine
  svg += `<line x1="${custColX + 10}" y1="${rowY + rowH / 2}" x2="${custColX + 20}" y2="${rowY + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;
});

// Vertical spine through customer column
svg += `<line x1="${custColX + 10}" y1="492" x2="${custColX + 10}" y2="760" stroke="#000000" stroke-width="1.2" />`;
svg += `<line x1="${custColX + 10}" y1="1045" x2="${custColX + 10}" y2="1480" stroke="#000000" stroke-width="1.2" />`;

// ==========================================
// COLUMN 3: RIDER DASHBOARD (x: 1210, width: 420)
// ==========================================
const riderColX = 1210;
const riderColW = 420;
const riderCardW = 290;
let currentRiderY = 450;

svg += `
  <!-- Rider Header Box -->
  <rect x="${riderColX}" y="${currentRiderY}" width="${riderColW}" height="42" fill="#1e293b" stroke="#000000" stroke-width="1.5" />
  <text x="${riderColX + riderColW / 2}" y="${currentRiderY + 26}" font-family="Tahoma, Arial, sans-serif" font-size="14px" font-weight="bold" fill="#ffffff" text-anchor="middle">RIDER DASHBOARD (DELIVERY FLEET)</text>
`;

currentRiderY += 60;

const riderModules = [
  { label: 'RD1', db: '26', lines: ['Rider Delivery Run', '(Assigned Manifest & GPS Broadcast)'] },
  { label: 'RD2', db: '27', lines: ['Proof of Delivery (POD)', '(Scan Delivery QR & Photo Capture)'] },
  { label: 'RD3', db: '28', lines: ['Rider Earnings Summary', '& Shipping Commission Ledger'] },
  { label: 'RN', db: '29', lines: ['Rider Dispatch Alerts', '& Push Order Notifications'] },
  { label: 'X', db: null, lines: ['Rider Logout', '(Terminate Dispatch Session)'] }
];

riderModules.forEach((mod, idx) => {
  const rowY = currentRiderY + idx * (rowH + 30);
  svg += renderModuleRow(riderColX + 20, rowY, riderCardW, rowH, mod.label, mod.db, mod.lines);

  // Vertical spine
  svg += `<line x1="${riderColX + 10}" y1="${rowY + rowH / 2}" x2="${riderColX + 20}" y2="${rowY + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;
});

// Rider spine
svg += `<line x1="${riderColX + riderColW / 2}" y1="492" x2="${riderColX + 10}" y2="520" stroke="#000000" stroke-width="1.2" />`;
svg += `<line x1="${riderColX + 10}" y1="520" x2="${riderColX + 10}" y2="${currentRiderY + 4 * (rowH + 30) + rowH / 2}" stroke="#000000" stroke-width="1.2" />`;

// ==========================================
// BOTTOM FOOTER: TERMINAL & SYSTEM LEGEND
// ==========================================
svg += `
  <!-- Bottom Common Logout Terminal -->
  ${drawStartEnd(width / 2 - 80, 1500, 160, 45, 'End (Session Terminated)')}
  ${drawConnector(width / 2 - 110, 1522, 14, 'X', true)}
  <line x1="${width / 2 - 96}" y1="1522" x2="${width / 2 - 80}" y2="1522" stroke="#000000" stroke-width="1.2" />

  <!-- Legend Box -->
  <rect x="50" y="1480" width="480" height="75" fill="#f8fafc" stroke="#000000" stroke-width="1.2" />
  <text x="60" y="1500" font-family="Tahoma, Arial, sans-serif" font-size="11.5px" font-weight="bold" fill="#000000">MASTER FLOWCHART SYSTEM CONVENTIONS:</text>
  <text x="60" y="1520" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" fill="#333333">1. Letter Badges [A–Z, RD1–RD3, AUTH, X] identify Use Case Sub-Process Flowcharts.</text>
  <text x="60" y="1538" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" fill="#333333">2. Dotted Numbered Circles (1–29) represent Off-Page Data Read/Write Links to DB Core.</text>
</svg>
`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; width: ${width}px; height: ${height}px; overflow: hidden; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;

const outPngPath = path.join(outDir, 'flowchart_main.png');
renderHtmlToPng(html, outPngPath, width, height);

console.log('Main Flowchart generated successfully!');
