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

console.log('Generating Process Flowcharts (PNG only)...');

// Helper to generate a standardized process diagram HTML
function createProcessSvg(title, letterBadge, dbNumber, elementsSvg, width = 1100, height = 800) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${svgDefs}
  <rect width="${width}" height="${height}" fill="#ffffff" />

  <!-- Process Header -->
  <rect x="25" y="20" width="${width - 50}" height="55" fill="#f8fafc" stroke="#000000" stroke-width="1.5" />
  <text x="${width / 2}" y="47" font-family="Tahoma, Arial, sans-serif" font-size="18px" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(title)}</text>
  <text x="${width / 2}" y="65" font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#555555" text-anchor="middle">Sub-Process Flowchart • Connected to Master Main Diagram &amp; Database</text>

  <!-- Letter Badge & DB Link at Header -->
  ${drawConnector(65, 47, 18, letterBadge, true)}
  ${dbNumber ? drawConnector(115, 47, 15, dbNumber, false) : ''}
  ${dbNumber ? `<text x="138" y="52" font-family="Tahoma, Arial, sans-serif" font-size="11px" font-weight="bold" fill="#333333">DB Link: (${dbNumber})</text>` : ''}

  <!-- Body Elements -->
  ${elementsSvg}
</svg>`;
}

function renderProcessDiagram(title, letterBadge, dbNumber, filename, elementsSvg, width = 1100, height = 800) {
  const svg = createProcessSvg(title, letterBadge, dbNumber, elementsSvg, width, height);
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
  const pngPath = path.join(outDir, `${filename}.png`);
  renderHtmlToPng(html, pngPath, width, height);
}

// =========================================================================
// 1. PROCESS [D]: MANAGE PRODUCTS & COMPATIBILITY (Product Page)
// =========================================================================
const dElements = `
  <!-- Entry from Main -->
  ${drawConnector(100, 110, 16, 'D', true)}
  ${drawArrow(100, 126, 100, 160)}

  ${drawParallelogram(30, 160, 140, 42, 'Product Page')}
  ${drawArrow(100, 202, 100, 235)}

  ${drawParallelogram(30, 235, 140, 42, 'Product List')}
  ${drawArrow(100, 277, 100, 315)}

  ${drawProcess(45, 315, 110, 40, 'Action Select')}

  <!-- Horizontal Distribution Spine -->
  <line x1="100" y1="355" x2="100" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="100" y1="385" x2="960" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Activate/Deactivate (x=100) -->
  ${drawArrow(100, 385, 100, 420)}
  ${drawProcessMulti(35, 420, 130, 44, ['Activate /', 'Deactivate Product'])}
  ${drawArrow(100, 464, 100, 495)}
  ${drawDecisionMulti(100, 535, 130, 65, ['Toggle Product', 'Status?'])}
  ${drawArrow(100, 567, 100, 610, 'Yes')}
  ${drawParallelogramMulti(30, 610, 140, 44, ['Status Updated', 'Successfully!'])}
  ${drawArrow(100, 654, 100, 700)}
  ${drawConnector(100, 720, 15, '6', false)}
  <text x="100" y="748" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write to DB</text>

  <!-- Branch 2: Add Product (x=330) -->
  ${drawArrow(330, 385, 330, 420)}
  ${drawProcess(275, 420, 110, 44, 'Add Product')}
  ${drawArrow(330, 464, 330, 495)}
  ${drawParallelogramMulti(255, 495, 150, 44, ['Product Add Form', '(Variants, Photos, Price)'])}
  ${drawArrow(330, 539, 330, 570)}
  ${drawDecisionMulti(330, 605, 120, 60, ['Save New', 'Product?'])}
  ${drawArrow(330, 635, 330, 675, 'Yes')}
  ${drawParallelogramMulti(255, 675, 150, 44, ['Product Added', 'Successfully!'])}
  ${drawArrow(330, 719, 330, 745)}
  ${drawConnector(330, 760, 15, '6', false)}

  <!-- Branch 3: Edit Product & Compatibility (x=570) -->
  ${drawArrow(570, 385, 570, 420)}
  ${drawProcessMulti(505, 420, 130, 44, ['Edit Product &', 'Fitment Mapping'])}
  ${drawArrow(570, 464, 570, 495)}
  ${drawParallelogramMulti(495, 495, 150, 44, ['Edit Product Form', '& Bike Model Picker'])}
  ${drawArrow(570, 539, 570, 570)}
  ${drawDecisionMulti(570, 605, 120, 60, ['Save Fitment', '& Details?'])}
  ${drawArrow(570, 635, 570, 675, 'Yes')}
  ${drawParallelogramMulti(495, 675, 150, 44, ['Product & Fitment', 'Saved Successfully!'])}
  ${drawArrow(570, 719, 570, 745)}
  ${drawConnector(570, 760, 15, '6', false)}

  <!-- Branch 4: View Details (x=780) -->
  ${drawArrow(780, 385, 780, 420)}
  ${drawProcessMulti(720, 420, 120, 44, ['View Product', 'Details & Specs'])}
  ${drawArrow(780, 464, 780, 510)}
  ${drawParallelogramMulti(705, 510, 150, 44, ['Product Details Page', '& Stock Telemetry'])}
  ${drawArrow(780, 554, 780, 610)}
  ${drawConnector(780, 630, 15, '6', false)}
  <text x="780" y="658" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Read DB</text>

  <!-- Branch 5: Export (x=960) -->
  ${drawArrow(960, 385, 960, 420)}
  ${drawProcess(905, 420, 110, 44, 'Export Catalog')}
  ${drawArrow(960, 464, 960, 510)}
  ${drawParallelogramMulti(895, 510, 130, 44, ['Export as PDF', 'or Excel CSV'])}
  ${drawArrow(960, 554, 960, 610)}
  ${drawStartEnd(905, 610, 110, 38, 'File Downloaded')}
`;

// =========================================================================
// 2. PROCESS [N]: CART & WISHLIST (View Cart)
// =========================================================================
const nElements = `
  ${drawConnector(120, 110, 16, 'N', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(50, 160, 140, 42, 'View Cart Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(50, 235, 140, 42, 'Cart Items List')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Cart Action')}

  <!-- Distribution Spine -->
  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="920" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Update Quantity (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(60, 420, 120, 44, ['Change Quantity', '(+/- Buttons)'])}
  ${drawArrow(120, 464, 120, 495)}
  ${drawDecisionMulti(120, 535, 120, 65, ['Stock Available', 'in DB?'])}
  ${drawArrow(120, 567, 120, 615, 'Yes')}
  ${drawParallelogramMulti(50, 615, 140, 44, ['Cart Subtotal', 'Recalculated'])}
  ${drawArrow(120, 659, 120, 710)}
  ${drawConnector(120, 730, 15, '17', false)}
  <text x="120" y="758" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Sync DB</text>

  <!-- Branch 2: Variant Selection (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(315, 420, 130, 44, ['Change Variant', '(Color / Size)'])}
  ${drawArrow(380, 464, 380, 510)}
  ${drawParallelogramMulti(310, 510, 140, 44, ['Variant Options Modal', '& Compatibility Check'])}
  ${drawArrow(380, 554, 380, 615)}
  ${drawParallelogramMulti(310, 615, 140, 44, ['Variant Updated', 'in Cart'])}
  ${drawArrow(380, 659, 380, 710)}
  ${drawConnector(380, 730, 15, '17', false)}

  <!-- Branch 3: Remove / Wishlist (x=650) -->
  ${drawArrow(650, 385, 650, 420)}
  ${drawProcessMulti(585, 420, 130, 44, ['Remove Item or', 'Move to Wishlist'])}
  ${drawArrow(650, 464, 650, 510)}
  ${drawDecisionMulti(650, 545, 120, 60, ['Confirm Item', 'Removal?'])}
  ${drawArrow(650, 575, 650, 625, 'Yes')}
  ${drawParallelogramMulti(580, 625, 140, 44, ['Item Removed /', 'Saved to Wishlist'])}
  ${drawArrow(650, 669, 650, 710)}
  ${drawConnector(650, 730, 15, '17', false)}

  <!-- Branch 4: Proceed to Checkout (x=920) -->
  ${drawArrow(920, 385, 920, 420)}
  ${drawProcess(860, 420, 120, 44, 'Checkout Button')}
  ${drawArrow(920, 464, 920, 510)}
  ${drawDecisionMulti(920, 545, 130, 65, ['Cart Has Valid', 'Active Items?'])}
  ${drawArrow(920, 577, 920, 630, 'Yes')}
  ${drawParallelogramMulti(850, 630, 140, 44, ['Proceed to', 'Checkout Page'])}
  ${drawArrow(920, 674, 920, 715)}
  ${drawConnector(920, 735, 17, 'O', true)}
  <text x="920" y="768" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" font-weight="bold" fill="#000000" text-anchor="middle">Connects to [O]</text>
`;

// =========================================================================
// 3. PROCESS [P]: CUSTOMER PROFILE & ADDRESSES
// =========================================================================
const pElements = `
  ${drawConnector(120, 110, 16, 'P', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'Customer Profile Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(45, 235, 150, 42, 'Profile Data Display')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Account Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Edit Details (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(55, 420, 130, 44, ['Edit Personal Details', '(Name, Phone, Bio)'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawDecisionMulti(120, 540, 120, 65, ['Save Profile', 'Changes?'])}
  ${drawArrow(120, 572, 120, 620, 'Yes')}
  ${drawParallelogramMulti(45, 620, 150, 44, ['Profile Details', 'Saved Successfully!'])}
  ${drawArrow(120, 664, 120, 715)}
  ${drawConnector(120, 735, 15, '19', false)}

  <!-- Branch 2: Manage Addresses (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Manage Addresses', '(Add / Edit / Default)'])}
  ${drawArrow(380, 464, 380, 500)}
  ${drawParallelogramMulti(300, 500, 160, 44, ['Address Book Modal', '& Leaflet/Google Pin'])}
  ${drawArrow(380, 544, 380, 585)}
  ${drawDecisionMulti(380, 620, 120, 60, ['Save Address', 'Coordinates?'])}
  ${drawArrow(380, 650, 380, 695, 'Yes')}
  ${drawParallelogramMulti(305, 695, 150, 44, ['Shipping Address', 'Saved to Account'])}
  ${drawArrow(380, 739, 380, 765)}
  ${drawConnector(380, 778, 15, '19', false)}

  <!-- Branch 3: Password / Security (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(575, 420, 130, 44, ['Change Password', '& Security Options'])}
  ${drawArrow(640, 464, 640, 510)}
  ${drawDecisionMulti(640, 550, 130, 65, ['Password Match', '& Valid Rule?'])}
  ${drawArrow(640, 582, 640, 630, 'Yes')}
  ${drawParallelogramMulti(565, 630, 150, 44, ['Password Changed', 'Successfully!'])}
  ${drawArrow(640, 674, 640, 725)}
  ${drawConnector(640, 745, 15, '19', false)}

  <!-- Branch 4: Dark Mode / Theme (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcessMulti(815, 420, 130, 44, ['Theme & Preferences', '(Dark / Light Mode)'])}
  ${drawArrow(880, 464, 880, 520)}
  ${drawParallelogramMulti(805, 520, 150, 44, ['UI Theme Preference', 'Applied & Stored'])}
  ${drawArrow(880, 564, 880, 625)}
  ${drawStartEnd(820, 625, 120, 40, 'Session Updated')}
`;

// =========================================================================
// 4. PROCESS [T]: BOOK GARAGE SERVICE & QUOTATIONS (Service Page)
// =========================================================================
const tElements = `
  ${drawConnector(120, 110, 16, 'T', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'Service Booking Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'Service Bookings Overview')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Service Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Review Quotation (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(50, 420, 140, 44, ['Review Quotation', '& Multi-Point Inspection'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawDecisionMulti(120, 540, 130, 65, ['Accept Labor', '& Parts Quote?'])}
  ${drawArrow(120, 572, 120, 620, 'Yes')}
  ${drawParallelogramMulti(45, 620, 150, 44, ['Quotation Approved', '& Service Authorized'])}
  ${drawArrow(120, 664, 120, 715)}
  ${drawConnector(120, 735, 15, '23', false)}
  <text x="120" y="763" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write DB</text>

  <!-- Branch 2: Track Progress (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Track Workshop', 'Repair Milestones'])}
  ${drawArrow(380, 464, 380, 500)}
  ${drawParallelogramMulti(295, 500, 170, 44, ['Status: Queued → In Bay →', 'Parts Installed → Ready'])}
  ${drawArrow(380, 544, 380, 610)}
  ${drawConnector(380, 630, 15, '23', false)}
  <text x="380" y="658" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Read DB</text>

  <!-- Branch 3: Pickup QR Authorization (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Present Vehicle', 'Pickup QR Token'])}
  ${drawArrow(640, 464, 640, 505)}
  ${drawDecisionMulti(640, 545, 130, 65, ['Admin / Tech', 'Scans Valid QR?'])}
  ${drawArrow(640, 577, 640, 625, 'Yes')}
  ${drawParallelogramMulti(565, 625, 150, 44, ['Vehicle Released', '& Job Marked Complete'])}
  ${drawArrow(640, 669, 640, 715)}
  ${drawConnector(640, 735, 15, '23', false)}

  <!-- Branch 4: Download Receipt (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcessMulti(815, 420, 130, 44, ['Download Service Receipt', '& Itemized Invoice'])}
  ${drawArrow(880, 464, 880, 515)}
  ${drawParallelogramMulti(805, 515, 150, 44, ['Printable Service PDF', 'Generated & Downloaded'])}
  ${drawArrow(880, 559, 880, 620)}
  ${drawStartEnd(820, 620, 120, 40, 'Complete')}
`;

// =========================================================================
// 5. PROCESS [U]: MY GARAGE (Motorcycle Registration)
// =========================================================================
const uElements = `
  ${drawConnector(120, 110, 16, 'U', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'My Garage Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'View Motorcycle List')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Garage Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Select Active Bike (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(55, 420, 130, 44, ['Select Active Bike', 'for Store Compatibility'])}
  ${drawArrow(120, 464, 120, 510)}
  ${drawParallelogramMulti(45, 510, 150, 44, ['Active Bike Set', 'in Virtual Garage'])}
  ${drawArrow(120, 554, 120, 610)}
  ${drawConnector(120, 630, 15, '24', false)}
  <text x="120" y="658" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write DB</text>

  <!-- Branch 2: Register Motorcycle (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcess(320, 420, 120, 44, 'Register Motorcycle')}
  ${drawArrow(380, 464, 380, 500)}
  ${drawParallelogramMulti(300, 500, 160, 44, ['Bike Registration Form', '(Brand, Model, Year, Photo)'])}
  ${drawArrow(380, 544, 380, 585)}
  ${drawDecisionMulti(380, 620, 120, 60, ['Submit New', 'Motorcycle?'])}
  ${drawArrow(380, 650, 380, 695, 'Yes')}
  ${drawParallelogramMulti(300, 695, 160, 44, ['Motorcycle Registered', 'Successfully!'])}
  ${drawArrow(380, 739, 380, 765)}
  ${drawConnector(380, 778, 15, '24', false)}

  <!-- Branch 3: Common Issues & Schedule (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Common Issues &', 'Troubleshooting Guide'])}
  ${drawArrow(640, 464, 640, 505)}
  ${drawParallelogramMulti(565, 505, 150, 44, ['View Recommended', 'Maintenance Schedule'])}
  ${drawArrow(640, 549, 640, 600)}
  ${drawParallelogramMulti(565, 600, 150, 44, ['View Next Service Due', '& PMS Intervals'])}
  ${drawArrow(640, 644, 640, 700)}
  ${drawConnector(640, 720, 15, '24', false)}

  <!-- Branch 4: Delete Bike (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcess(825, 420, 110, 44, 'Delete Bike')}
  ${drawArrow(880, 464, 880, 520)}
  ${drawDecisionMulti(880, 560, 120, 65, ['Confirm Bike', 'Removal?'])}
  ${drawArrow(880, 592, 880, 645, 'Yes')}
  ${drawParallelogramMulti(805, 645, 150, 44, ['Motorcycle Removed', 'from Garage'])}
  ${drawArrow(880, 689, 880, 735)}
  ${drawConnector(880, 750, 15, '24', false)}
`;

// =========================================================================
// 6. PROCESS [A]: MANAGE ORDERS & COD FULFILLMENT (Admin)
// =========================================================================
const aElements = `
  ${drawConnector(120, 110, 16, 'A', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'Admin Orders Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'Fulfillment Orders Queue')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Order Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: COD Verification (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(50, 420, 140, 44, ['Inspect Pending', 'COD Order Requests'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawDecisionMulti(120, 540, 130, 65, ['Approve Cash on', 'Delivery (COD)?'])}
  ${drawArrow(120, 572, 120, 620, 'Yes')}
  ${drawParallelogramMulti(45, 620, 150, 44, ['Order Confirmed &', 'Ready for Dispatch'])}
  ${drawArrow(120, 664, 120, 715)}
  ${drawConnector(120, 735, 15, '3', false)}
  <text x="120" y="763" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write DB</text>

  <!-- Branch 2: Assign Rider (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Assign Delivery Rider', 'to Verified Order'])}
  ${drawArrow(380, 464, 380, 505)}
  ${drawParallelogramMulti(300, 505, 160, 44, ['Select Available Active', 'Rider & Delivery Sector'])}
  ${drawArrow(380, 549, 380, 600)}
  ${drawParallelogramMulti(300, 600, 160, 44, ['Order Dispatched to', 'Rider Manifest (RD1)'])}
  ${drawArrow(380, 644, 380, 700)}
  ${drawConnector(380, 720, 15, '3', false)}

  <!-- Branch 3: Packing Slips (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Generate Packing Slip', '& Shipping Label'])}
  ${drawArrow(640, 464, 640, 515)}
  ${drawParallelogramMulti(565, 515, 150, 44, ['Thermal / Digital Slip', 'Printed for Package'])}
  ${drawArrow(640, 559, 640, 620)}
  ${drawStartEnd(580, 620, 120, 40, 'Ready to Ship')}

  <!-- Branch 4: Returns / Cancel (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcessMulti(810, 420, 140, 44, ['Process Return Claim', 'or Order Cancellation'])}
  ${drawArrow(880, 464, 880, 510)}
  ${drawDecisionMulti(880, 550, 130, 65, ['Accept Return /', 'Approve Refund?'])}
  ${drawArrow(880, 582, 880, 630, 'Yes')}
  ${drawParallelogramMulti(805, 630, 150, 44, ['Stock Restored &', 'Order Cancelled'])}
  ${drawArrow(880, 674, 880, 725)}
  ${drawConnector(880, 745, 15, '3', false)}
`;

// =========================================================================
// 7. PROCESS [B]: MANAGE STOCK & INVENTORY ALERTS (Admin)
// =========================================================================
const bElements = `
  ${drawConnector(120, 110, 16, 'B', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'Inventory Stock Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'Stock Valuation Table')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Inventory Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Restock Batch (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(50, 420, 140, 44, ['Record Restock Batch', '(Variant, Qty, Cost)'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawDecisionMulti(120, 540, 120, 65, ['Submit Restock', 'Batch?'])}
  ${drawArrow(120, 572, 120, 620, 'Yes')}
  ${drawParallelogramMulti(45, 620, 150, 44, ['Stock Quantities', 'Updated Atomically'])}
  ${drawArrow(120, 664, 120, 715)}
  ${drawConnector(120, 735, 15, '4', false)}
  <text x="120" y="763" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write DB</text>

  <!-- Branch 2: Low-Stock Alerts (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Stock Alert Monitor', '& Threshold Engine'])}
  ${drawArrow(380, 464, 380, 510)}
  ${drawDecisionMulti(380, 550, 130, 65, ['Stock Level <=', 'Safety Threshold?'])}
  ${drawArrow(380, 582, 380, 630, 'Yes')}
  ${drawParallelogramMulti(300, 630, 160, 44, ['Trigger Warning Badge', '& Notification Alert [I]'])}
  ${drawArrow(380, 674, 380, 725)}
  ${drawConnector(380, 745, 15, '4', false)}

  <!-- Branch 3: Forecast (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Demand Forecast &', 'Reorder Suggestion'])}
  ${drawArrow(640, 464, 640, 510)}
  ${drawParallelogramMulti(565, 510, 150, 44, ['OLS Linear Regression', '& Safety Stock Math'])}
  ${drawArrow(640, 554, 640, 615)}
  ${drawParallelogramMulti(565, 615, 150, 44, ['Recommended Restock', 'Batch Quantities'])}
  ${drawArrow(640, 659, 640, 710)}
  ${drawConnector(640, 730, 15, '4', false)}

  <!-- Branch 4: Export (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcess(825, 420, 110, 44, 'Stock Reports')}
  ${drawArrow(880, 464, 880, 515)}
  ${drawParallelogramMulti(805, 515, 150, 44, ['Stock Movement &', 'Valuation Excel/PDF'])}
  ${drawArrow(880, 559, 880, 620)}
  ${drawStartEnd(820, 620, 120, 40, 'Exported')}
`;

// =========================================================================
// 8. PROCESS [O]: CHECKOUT & PAYMENT (Customer)
// =========================================================================
const oElements = `
  ${drawConnector(120, 110, 16, 'O', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'Checkout Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'Order Summary & Address')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Payment Step')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Promo Voucher (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(50, 420, 140, 44, ['Apply Promo Code /', 'Discount Voucher'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawDecisionMulti(120, 540, 120, 65, ['Voucher Code', 'Valid in DB?'])}
  ${drawArrow(120, 572, 120, 620, 'Yes')}
  ${drawParallelogramMulti(45, 620, 150, 44, ['Discount Deducted', 'from Total Amount'])}
  ${drawArrow(120, 664, 120, 715)}
  ${drawConnector(120, 735, 15, '18', false)}

  <!-- Branch 2: COD Option (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Select Payment:', 'Cash on Delivery (COD)'])}
  ${drawArrow(380, 464, 380, 510)}
  ${drawParallelogramMulti(300, 510, 160, 44, ['Review COD Guidelines', '& Downpayment Limit'])}
  ${drawArrow(380, 554, 380, 615)}
  ${drawParallelogramMulti(300, 615, 160, 44, ['Order Placed as Pending', 'Admin Verification [A]'])}
  ${drawArrow(380, 659, 380, 710)}
  ${drawConnector(380, 730, 15, '18', false)}

  <!-- Branch 3: GCash / Card (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Select Payment:', 'GCash / Debit / Card'])}
  ${drawArrow(640, 464, 640, 505)}
  ${drawDecisionMulti(640, 545, 130, 65, ['Gateway Payment', 'Authorized?'])}
  ${drawArrow(640, 577, 640, 625, 'Yes')}
  ${drawParallelogramMulti(565, 625, 150, 44, ['Payment Verified &', 'Receipt Generated'])}
  ${drawArrow(640, 669, 640, 715)}
  ${drawConnector(640, 735, 15, '18', false)}

  <!-- Branch 4: Order Success & Tracking Link (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcessMulti(810, 420, 140, 44, ['Generate Tracking QR', '& Confirmation Token'])}
  ${drawArrow(880, 464, 880, 515)}
  ${drawParallelogramMulti(805, 515, 150, 44, ['Order Success Screen', '& Email Confirmation'])}
  ${drawArrow(880, 559, 880, 620)}
  ${drawConnector(880, 640, 17, 'Q', true)}
  <text x="880" y="672" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" font-weight="bold" fill="#000000" text-anchor="middle">Proceeds to [Q]</text>
`;

// =========================================================================
// 9. PROCESS [Q]: ORDER TRACKING & RETURN (Customer)
// =========================================================================
const qElements = `
  ${drawConnector(120, 110, 16, 'Q', true)}
  ${drawArrow(120, 126, 120, 160)}

  ${drawParallelogram(45, 160, 150, 42, 'My Orders Page')}
  ${drawArrow(120, 202, 120, 235)}

  ${drawParallelogram(40, 235, 160, 42, 'Active Orders Timeline')}
  ${drawArrow(120, 277, 120, 315)}

  ${drawProcess(65, 315, 110, 40, 'Order Action')}

  <line x1="120" y1="355" x2="120" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="120" y1="385" x2="880" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- Branch 1: Live GPS (x=120) -->
  ${drawArrow(120, 385, 120, 420)}
  ${drawProcessMulti(50, 420, 140, 44, ['Live GPS Tracking', '& Dispatched Rider Map'])}
  ${drawArrow(120, 464, 120, 500)}
  ${drawParallelogramMulti(45, 500, 150, 44, ['Real-Time Coordinates', '& Route ETA Broadcast'])}
  ${drawArrow(120, 544, 120, 605)}
  ${drawConnector(120, 625, 15, '20', false)}
  <text x="120" y="653" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Read DB</text>

  <!-- Branch 2: Delivery QR Confirm (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(310, 420, 140, 44, ['Present Delivery QR', 'Token to Rider'])}
  ${drawArrow(380, 464, 380, 505)}
  ${drawDecisionMulti(380, 545, 130, 65, ['Rider Scans Valid', 'Delivery Token?'])}
  ${drawArrow(380, 577, 380, 625, 'Yes')}
  ${drawParallelogramMulti(300, 625, 160, 44, ['Order Verified & Marked', 'Delivered by Rider [RD2]'])}
  ${drawArrow(380, 669, 380, 715)}
  ${drawConnector(380, 735, 15, '20', false)}

  <!-- Branch 3: Rate & Feedback (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(570, 420, 140, 44, ['Rate Delivered Order', '& Leave Review'])}
  ${drawArrow(640, 464, 640, 510)}
  ${drawParallelogramMulti(565, 510, 150, 44, ['5-Star Rating Modal', '& Photo Upload'])}
  ${drawArrow(640, 554, 640, 615)}
  ${drawParallelogramMulti(565, 615, 150, 44, ['Review Submitted', 'to Store & Rider'])}
  ${drawArrow(640, 659, 640, 710)}
  ${drawConnector(640, 730, 15, '25', false)}

  <!-- Branch 4: Return / Claim (x=880) -->
  ${drawArrow(880, 385, 880, 420)}
  ${drawProcessMulti(810, 420, 140, 44, ['Request Return /', 'File Damage Claim'])}
  ${drawArrow(880, 464, 880, 510)}
  ${drawDecisionMulti(880, 550, 130, 65, ['Order within 7-Day', 'Return Policy?'])}
  ${drawArrow(880, 582, 880, 630, 'Yes')}
  ${drawParallelogramMulti(805, 630, 150, 44, ['Return Request Filed', 'for Admin Review [A]'])}
  ${drawArrow(880, 674, 880, 725)}
  ${drawConnector(880, 745, 15, '20', false)}
`;

// =========================================================================
// 10. PROCESS [RD1/RD2/RD3]: RIDER FLEET OPERATIONS (RULE 3: ADD RIDER)
// =========================================================================
const riderElements = `
  <!-- Rider Header Badges -->
  ${drawConnector(80, 110, 16, 'RD1', true)}
  ${drawConnector(125, 110, 16, 'RD2', true)}
  ${drawConnector(170, 110, 16, 'RD3', true)}
  ${drawArrow(125, 126, 125, 160)}

  ${drawParallelogram(45, 160, 160, 42, 'Rider Dashboard')}
  ${drawArrow(125, 202, 125, 235)}

  ${drawParallelogram(40, 235, 170, 42, 'Assigned Deliveries Manifest')}
  ${drawArrow(125, 277, 125, 315)}

  ${drawProcess(70, 315, 110, 40, 'Rider Action')}

  <line x1="125" y1="355" x2="125" y2="385" stroke="#000000" stroke-width="1.3" />
  <line x1="125" y1="385" x2="900" y2="385" stroke="#000000" stroke-width="1.3" />

  <!-- RD1: Delivery Run & GPS (x=125) -->
  ${drawArrow(125, 385, 125, 420)}
  ${drawProcessMulti(50, 420, 150, 44, ['[RD1] Start Run &', 'Broadcast Live GPS'])}
  ${drawArrow(125, 464, 125, 500)}
  ${drawParallelogramMulti(45, 500, 160, 44, ['Navigate via Google Maps', '& Contact Customer'])}
  ${drawArrow(125, 544, 125, 600)}
  ${drawParallelogramMulti(45, 600, 160, 44, ['Broadcast Realtime GPS', 'to Tracking Screen [Q]'])}
  ${drawArrow(125, 644, 125, 700)}
  ${drawConnector(125, 720, 15, '26', false)}
  <text x="125" y="748" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Write DB</text>

  <!-- RD2: Scan QR & POD Photo (x=380) -->
  ${drawArrow(380, 385, 380, 420)}
  ${drawProcessMulti(305, 420, 150, 44, ['[RD2] Arrive at Stop &', 'Scan Customer QR'])}
  ${drawArrow(380, 464, 380, 505)}
  ${drawDecisionMulti(380, 545, 130, 65, ['QR Token Valid', '& Matches Order?'])}
  ${drawArrow(380, 577, 380, 625, 'Yes')}
  ${drawParallelogramMulti(300, 625, 160, 44, ['Capture POD Photo &', 'Recipient Signature'])}
  ${drawArrow(380, 669, 380, 715)}
  ${drawConnector(380, 735, 15, '27', false)}

  <!-- RD3: Earnings Ledger (x=640) -->
  ${drawArrow(640, 385, 640, 420)}
  ${drawProcessMulti(565, 420, 150, 44, ['[RD3] View Earnings', '& Payout Ledger'])}
  ${drawArrow(640, 464, 640, 505)}
  ${drawParallelogramMulti(560, 505, 160, 44, ['Completed Run Tally', '& Shipping Fee Ledger'])}
  ${drawArrow(640, 549, 640, 610)}
  ${drawConnector(640, 630, 15, '28', false)}
  <text x="640" y="658" font-family="Tahoma, Arial, sans-serif" font-size="10px" font-weight="bold" fill="#000000" text-anchor="middle">Read DB</text>

  <!-- Exception Handling: Reschedule (x=900) -->
  ${drawArrow(900, 385, 900, 420)}
  ${drawProcessMulti(825, 420, 150, 44, ['Delivery Issue /', 'Buyer Unavailable'])}
  ${drawArrow(900, 464, 900, 510)}
  ${drawDecisionMulti(900, 550, 130, 65, ['Reschedule', 'Delivery Attempt?'])}
  ${drawArrow(900, 582, 900, 630, 'Yes')}
  ${drawParallelogramMulti(820, 630, 160, 44, ['Exception Logged &', 'Re-queued in Manifest'])}
  ${drawArrow(900, 674, 900, 725)}
  ${drawConnector(900, 745, 15, '26', false)}
`;

// Render all process diagrams to PNG!
renderProcessDiagram('Process [D]: Manage Products & Compatibility Flowchart', 'D', '6', 'flowchart_process_D_product', dElements);
renderProcessDiagram('Process [N]: Cart & Wishlist Operations Flowchart', 'N', '17', 'flowchart_process_N_cart', nElements);
renderProcessDiagram('Process [P]: Customer Profile & Address Book Flowchart', 'P', '19', 'flowchart_process_P_profile', pElements);
renderProcessDiagram('Process [T]: Service Booking & Quotations Flowchart', 'T', '23', 'flowchart_process_T_service', tElements);
renderProcessDiagram('Process [U]: My Garage & Motorcycle Fitment Flowchart', 'U', '24', 'flowchart_process_U_garage', uElements);
renderProcessDiagram('Process [A]: Manage Orders & COD Fulfillment Flowchart', 'A', '3', 'flowchart_process_A_orders', aElements);
renderProcessDiagram('Process [B]: Inventory Stock & Low-Stock Alerts Flowchart', 'B', '4', 'flowchart_process_B_inventory', bElements);
renderProcessDiagram('Process [O]: Checkout & Payment Operations Flowchart', 'O', '18', 'flowchart_process_O_checkout', oElements);
renderProcessDiagram('Process [Q]: Order Tracking, Delivery QR & Returns Flowchart', 'Q', '20', 'flowchart_process_Q_tracking', qElements);
renderProcessDiagram('Processes [RD1, RD2, RD3]: Rider Fleet Delivery Operations Flowchart', 'RD', '26', 'flowchart_process_rider_delivery', riderElements);

console.log('All Process Flowcharts rendered to PNG successfully!');
