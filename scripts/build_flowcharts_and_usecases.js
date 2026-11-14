const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const outDir = path.resolve(__dirname, '../docs/diagrams');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function renderHtmlToPng(htmlContent, pngPath, width, height) {
  const tempHtmlPath = path.resolve(__dirname, `../scratch/temp_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
  try {
    const fileUrl = 'file:///' + tempHtmlPath.replace(/\\/g, '/');
    execFileSync(CHROME_PATH, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      `--screenshot=${pngPath}`,
      `--window-size=${width},${height}`,
      fileUrl
    ]);
    console.log(`[SUCCESS] Rendered PNG: ${path.basename(pngPath)} (${width}x${height})`);
  } catch (err) {
    console.error(`[ERROR] Rendering ${pngPath}:`, err.message);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

console.log('Starting diagram and flowchart builder...');

// =========================================================================
// PART 1: MASTER LABELED USE CASES MAPPING (35 REQUIREMENTS)
// =========================================================================
// All labels match the systematic letters in the main flowchart and draw.io:
// A - Manage Orders
// B - Manage Stock & Inventory Alerts
// C - Manage Suppliers
// D - Manage Products & Compatibility
// E - User Management
// F - Manage Purchase Orders
// G - Manage Promotion
// H - View Reports & Forecast (Analytics)
// I - View Notification & Alerts
// J - System Settings & Security Lock
// K - Point of Sale (POS)
// L - Assign Delivery
// M - Booking Management
// N - Cart & Wishlist
// O - Checkout & Payment
// P - Customer Profile
// Q - Order Tracking & Returns
// R - AI Customizer
// S - Book Garage Service
// T - Service Page
// U - My Garage
// V - View Products
// W - Customer Feedback
// RD1 - Rider Delivery Run
// RD2 - Proof of Delivery
// RD3 - Rider Earnings
// AUTH - Login & Registration
// X - Logout

const adminUseCasesLabeled = [
  { label: 'AUTH', name: 'Login' },
  { label: 'E', name: 'User Management' },
  { label: 'D', name: 'Manage Product' },
  { label: 'D', name: 'Product Compatibility' },
  { label: 'A', name: 'Manage Order' },
  { label: 'W', name: 'Customer Feedback' },
  { label: 'L', name: 'Assign Delivery' },
  { label: 'M', name: 'Booking Management' },
  { label: 'B', name: 'Manage Stock' },
  { label: 'B', name: 'View Stock' },
  { label: 'B', name: 'Stock Alert Notification' },
  { label: 'H', name: 'View Forecast' },
  { label: 'C', name: 'Manage Supplier' },
  { label: 'F', name: 'Manage Purchase Order' },
  { label: 'K', name: 'Point of Sale (POS)' },
  { label: 'G', name: 'Manage Promotion' },
  { label: 'H', name: 'View Report' },
  { label: 'I', name: 'View Notification' },
  { label: 'J', name: 'System Settings' },
  { label: 'J', name: 'System Activity Log' },
  { label: 'J', name: 'Admin Security Lock' },
  { label: 'X', name: 'Logout' }
];

const customerUseCasesLabeled = [
  { label: 'AUTH', name: 'Login' },
  { label: 'AUTH', name: 'Registration' },
  { label: 'P', name: 'Customer Profile' },
  { label: 'U', name: 'My Garage' },
  { label: 'V', name: 'View Products' },
  { label: 'V', name: 'Product Compatibility' },
  { label: 'R', name: 'AI Customizer' },
  { label: 'N', name: 'Cart & Wishlist' },
  { label: 'O', name: 'Checkout & Payment' },
  { label: 'Q', name: 'Order Tracking' },
  { label: 'Q', name: 'Order Return' },
  { label: 'W', name: 'Customer Feedback' },
  { label: 'S', name: 'Book Garage Service' },
  { label: 'I', name: 'View Notification' },
  { label: 'X', name: 'Logout' }
];

const riderUseCasesLabeled = [
  { label: 'AUTH', name: 'Login' },
  { label: 'RD1', name: 'Rider Delivery Run' },
  { label: 'RD2', name: 'Proof of Delivery' },
  { label: 'RD3', name: 'Rider Earnings' },
  { label: 'I', name: 'View Notification' },
  { label: 'X', name: 'Logout' }
];

// All 35 Unique Functional Requirements with Master Primary Labels
const all35MasterList = [
  { label: 'AUTH', name: 'Login', roles: ['Admin', 'Customer', 'Rider'] },
  { label: 'AUTH', name: 'Registration', roles: ['Customer'] },
  { label: 'E', name: 'User Management', roles: ['Admin'] },
  { label: 'P', name: 'Customer Profile', roles: ['Customer'] },
  { label: 'U', name: 'My Garage', roles: ['Customer'] },
  { label: 'V', name: 'View Products', roles: ['Customer'] },
  { label: 'D', name: 'Manage Product', roles: ['Admin'] },
  { label: 'D', name: 'Product Compatibility', roles: ['Admin', 'Customer'] },
  { label: 'R', name: 'AI Customizer', roles: ['Customer'] },
  { label: 'N', name: 'Cart & Wishlist', roles: ['Customer'] },
  { label: 'O', name: 'Checkout & Payment', roles: ['Customer'] },
  { label: 'A', name: 'Manage Order', roles: ['Admin'] },
  { label: 'Q', name: 'Order Tracking', roles: ['Customer'] },
  { label: 'Q', name: 'Order Return', roles: ['Customer'] },
  { label: 'W', name: 'Customer Feedback', roles: ['Admin', 'Customer'] },
  { label: 'L', name: 'Assign Delivery', roles: ['Admin'] },
  { label: 'RD1', name: 'Rider Delivery Run', roles: ['Rider'] },
  { label: 'RD2', name: 'Proof of Delivery', roles: ['Rider'] },
  { label: 'RD3', name: 'Rider Earnings', roles: ['Rider'] },
  { label: 'S', name: 'Book Garage Service', roles: ['Customer'] },
  { label: 'M', name: 'Booking Management', roles: ['Admin'] },
  { label: 'B', name: 'Manage Stock', roles: ['Admin'] },
  { label: 'B', name: 'View Stock', roles: ['Admin'] },
  { label: 'B', name: 'Stock Alert Notification', roles: ['Admin'] },
  { label: 'H', name: 'View Forecast', roles: ['Admin'] },
  { label: 'C', name: 'Manage Supplier', roles: ['Admin'] },
  { label: 'F', name: 'Manage Purchase Order', roles: ['Admin'] },
  { label: 'K', name: 'Point of Sale (POS)', roles: ['Admin'] },
  { label: 'G', name: 'Manage Promotion', roles: ['Admin'] },
  { label: 'H', name: 'View Report', roles: ['Admin'] },
  { label: 'I', name: 'View Notification', roles: ['Admin', 'Customer', 'Rider'] },
  { label: 'J', name: 'System Settings', roles: ['Admin'] },
  { label: 'J', name: 'System Activity Log', roles: ['Admin'] },
  { label: 'J', name: 'Admin Security Lock', roles: ['Admin'] },
  { label: 'X', name: 'Logout', roles: ['Admin', 'Customer', 'Rider'] }
];

// =========================================================================
// PART 2: GENERATE ROLE USE CASE DIAGRAMS (PNG ONLY)
// =========================================================================

function generateSingleActorUseCasePng(actorName, items, outFilename) {
  const itemHeight = 44;
  const paddingY = 40;
  const boxTop = 25;
  const boxWidth = 260;
  const boxLeft = 320;
  const boxHeight = Math.max(items.length * itemHeight + paddingY, 320);
  const totalHeight = boxTop + boxHeight + 60;
  const totalWidth = 620;

  const actorCenterY = boxTop + boxHeight / 2;
  const actorHeadR = 40;
  const actorHeadY = actorCenterY - 110;
  const actorNeckY = actorHeadY + actorHeadR;
  const actorTorsoEndY = actorCenterY + 45;
  const actorArmY = actorCenterY - 20;
  const actorArmLeft = 35;
  const actorArmRight = 205;
  const actorLegEndY = actorCenterY + 140;

  const ellipseCenterX = boxLeft + boxWidth / 2;
  const ellipseRx = 110;
  const ellipseRy = 16;

  let connLines = '';
  let ellipsesHtml = '';

  items.forEach((item, idx) => {
    const cy = boxTop + 30 + idx * itemHeight;
    const targetX = ellipseCenterX - ellipseRx;
    const targetY = cy;

    connLines += `<line x1="${actorArmRight}" y1="${actorArmY}" x2="${targetX}" y2="${targetY}" stroke="#000000" stroke-width="1.1" />\n`;

    const displayText = `[${item.label}] ${item.name}`;
    ellipsesHtml += `
      <g>
        <ellipse cx="${ellipseCenterX}" cy="${cy}" rx="${ellipseRx}" ry="${ellipseRy}" fill="#ffffff" stroke="#000000" stroke-width="1.3" />
        <text x="${ellipseCenterX}" y="${cy}" font-family="Segoe UI, Tahoma, sans-serif" font-size="10.5px" font-weight="600" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(displayText)}</text>
      </g>
    `;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; width: ${totalWidth}px; height: ${totalHeight}px; overflow: hidden; }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff" />
    
    <!-- Actor (Stick Figure) -->
    <g id="actor">
      <circle cx="120" cy="${actorHeadY}" r="${actorHeadR}" fill="#ffffff" stroke="#000000" stroke-width="2.2" />
      <line x1="120" y1="${actorNeckY}" x2="120" y2="${actorTorsoEndY}" stroke="#000000" stroke-width="2.2" />
      <line x1="${actorArmLeft}" y1="${actorArmY}" x2="${actorArmRight}" y2="${actorArmY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="120" y1="${actorTorsoEndY}" x2="45" y2="${actorLegEndY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="120" y1="${actorTorsoEndY}" x2="195" y2="${actorLegEndY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <text x="120" y="${actorLegEndY + 35}" font-family="Segoe UI, Tahoma, sans-serif" font-size="16px" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(actorName)}</text>
    </g>

    <!-- System Boundary Box -->
    <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="#000000" stroke-width="1.5" />
    <text x="${boxLeft + 12}" y="${boxTop + 20}" font-family="Segoe UI, Tahoma, sans-serif" font-size="11px" font-weight="bold" fill="#555555">MotoTrack System</text>

    <!-- Connections -->
    <g id="connections">
      ${connLines}
    </g>

    <!-- Ellipses -->
    <g id="use-cases">
      ${ellipsesHtml}
    </g>
  </svg>
</body>
</html>`;

  const pngPath = path.join(outDir, `${outFilename}.png`);
  renderHtmlToPng(html, pngPath, totalWidth, totalHeight);
}

function generateCombined35UseCasePng() {
  const itemHeight = 44;
  const paddingY = 40;
  const boxTop = 30;
  const boxWidth = 280;
  const boxLeft = 450;
  const boxHeight = all35MasterList.length * itemHeight + paddingY;
  const totalHeight = boxTop + boxHeight + 50;
  const totalWidth = 1180;

  const adminCenterY = boxTop + boxHeight / 2;
  const adminArmRight = 205;
  const adminArmY = adminCenterY - 20;

  const customerCenterY = boxTop + 400;
  const customerArmLeft = boxLeft + boxWidth + 245;
  const customerArmY = customerCenterY - 20;

  const riderCenterY = boxTop + 1150;
  const riderArmLeft = boxLeft + boxWidth + 245;
  const riderArmY = riderCenterY - 20;

  const ellipseCenterX = boxLeft + boxWidth / 2;
  const ellipseRx = 120;
  const ellipseRy = 16;

  let connLines = '';
  let ellipsesHtml = '';

  all35MasterList.forEach((item, idx) => {
    const cy = boxTop + 35 + idx * itemHeight;

    if (item.roles.includes('Admin')) {
      const targetLeftX = ellipseCenterX - ellipseRx;
      const targetLeftY = cy;
      connLines += `<line x1="${adminArmRight}" y1="${adminArmY}" x2="${targetLeftX}" y2="${targetLeftY}" stroke="#000000" stroke-width="1.1" />\n`;
    }

    if (item.roles.includes('Customer')) {
      const targetRightX = ellipseCenterX + ellipseRx;
      const targetRightY = cy;
      connLines += `<line x1="975" y1="${customerArmY}" x2="${targetRightX}" y2="${targetRightY}" stroke="#000000" stroke-width="1.1" />\n`;
    }

    if (item.roles.includes('Rider')) {
      const targetRightX = ellipseCenterX + ellipseRx;
      const targetRightY = cy;
      connLines += `<line x1="975" y1="${riderArmY}" x2="${targetRightX}" y2="${targetRightY}" stroke="#000000" stroke-width="1.1" />\n`;
    }

    const displayText = `[${item.label}] ${item.name}`;
    ellipsesHtml += `
      <g>
        <ellipse cx="${ellipseCenterX}" cy="${cy}" rx="${ellipseRx}" ry="${ellipseRy}" fill="#ffffff" stroke="#000000" stroke-width="1.3" />
        <text x="${ellipseCenterX}" y="${cy}" font-family="Segoe UI, Tahoma, sans-serif" font-size="10.5px" font-weight="600" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(displayText)}</text>
      </g>
    `;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; width: ${totalWidth}px; height: ${totalHeight}px; overflow: hidden; }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff" />

    <!-- Admin Actor (Left) -->
    <g id="actor-admin">
      <circle cx="120" cy="${adminCenterY - 110}" r="40" fill="#ffffff" stroke="#000000" stroke-width="2.2" />
      <line x1="120" y1="${adminCenterY - 70}" x2="120" y2="${adminCenterY + 45}" stroke="#000000" stroke-width="2.2" />
      <line x1="35" y1="${adminArmY}" x2="${adminArmRight}" y2="${adminArmY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="120" y1="${adminCenterY + 45}" x2="45" y2="${adminCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="120" y1="${adminCenterY + 45}" x2="195" y2="${adminCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <text x="120" y="${adminCenterY + 175}" font-family="Segoe UI, Tahoma, sans-serif" font-size="16px" font-weight="bold" fill="#000000" text-anchor="middle">Admin</text>
    </g>

    <!-- Customer Actor (Right - Top) -->
    <g id="actor-customer">
      <circle cx="1060" cy="${customerCenterY - 110}" r="40" fill="#ffffff" stroke="#000000" stroke-width="2.2" />
      <line x1="1060" y1="${customerCenterY - 70}" x2="1060" y2="${customerCenterY + 45}" stroke="#000000" stroke-width="2.2" />
      <line x1="975" y1="${customerArmY}" x2="1145" y2="${customerArmY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="1060" y1="${customerCenterY + 45}" x2="985" y2="${customerCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="1060" y1="${customerCenterY + 45}" x2="1135" y2="${customerCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <text x="1060" y="${customerCenterY + 175}" font-family="Segoe UI, Tahoma, sans-serif" font-size="16px" font-weight="bold" fill="#000000" text-anchor="middle">Customer</text>
    </g>

    <!-- Rider Actor (Right - Bottom) -->
    <g id="actor-rider">
      <circle cx="1060" cy="${riderCenterY - 110}" r="40" fill="#ffffff" stroke="#000000" stroke-width="2.2" />
      <line x1="1060" y1="${riderCenterY - 70}" x2="1060" y2="${riderCenterY + 45}" stroke="#000000" stroke-width="2.2" />
      <line x1="975" y1="${riderArmY}" x2="1145" y2="${riderArmY}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="1060" y1="${riderCenterY + 45}" x2="985" y2="${riderCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <line x1="1060" y1="${riderCenterY + 45}" x2="1135" y2="${riderCenterY + 140}" stroke="#000000" stroke-width="2.2" stroke-linecap="round" />
      <text x="1060" y="${riderCenterY + 175}" font-family="Segoe UI, Tahoma, sans-serif" font-size="16px" font-weight="bold" fill="#000000" text-anchor="middle">Rider</text>
    </g>

    <!-- System Boundary Box -->
    <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="#000000" stroke-width="1.5" />
    <text x="${boxLeft + 15}" y="${boxTop + 22}" font-family="Segoe UI, Tahoma, sans-serif" font-size="11.5px" font-weight="bold" fill="#555555">MotoTrack System Boundary</text>

    <!-- Connections -->
    <g id="connections">
      ${connLines}
    </g>

    <!-- Ellipses -->
    <g id="use-cases">
      ${ellipsesHtml}
    </g>
  </svg>
</body>
</html>`;

  const pngPath = path.join(outDir, 'usecase_all_actors.png');
  renderHtmlToPng(html, pngPath, totalWidth, totalHeight);
}

// Generate the 4 Role Use Case Diagrams (In-Place Edit/Overwrite)
generateSingleActorUseCasePng('Admin', adminUseCasesLabeled, 'usecase_admin');
generateSingleActorUseCasePng('Customer', customerUseCasesLabeled, 'usecase_customer');
generateSingleActorUseCasePng('Rider', riderUseCasesLabeled, 'usecase_rider');
generateCombined35UseCasePng();

console.log('Role Use Case Diagrams generated successfully!');
