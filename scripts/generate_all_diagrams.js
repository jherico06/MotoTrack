const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const outDir = path.resolve(__dirname, '../docs/diagrams');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function renderSvgToPng(svgPath, pngPath, width, height) {
  try {
    const fileUrl = 'file:///' + svgPath.replace(/\\/g, '/');
    execFileSync(CHROME_PATH, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      `--screenshot=${pngPath}`,
      `--window-size=${width},${height}`,
      fileUrl
    ]);
    console.log(`Rendered PNG: ${pngPath}`);
  } catch (err) {
    console.error(`Error rendering ${pngPath}:`, err.message);
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

// ==========================================
// 1. INDIVIDUAL USE CASE DIAGRAM GENERATOR
// ==========================================
function generateSingleActorUseCase(actorName, useCases, filenameBase) {
  const itemHeight = 44;
  const paddingY = 40;
  const boxTop = 25;
  const boxWidth = 230;
  const boxLeft = 320;
  const boxHeight = Math.max(useCases.length * itemHeight + paddingY, 320);
  const totalHeight = boxTop + boxHeight + 60;
  const totalWidth = 590;

  const actorCenterY = boxTop + boxHeight / 2;
  const actorHeadR = 40;
  const actorHeadY = actorCenterY - 110;
  const actorNeckY = actorHeadY + actorHeadR;
  const actorTorsoEndY = actorCenterY + 45;
  const actorArmY = actorCenterY - 20;
  const actorArmLeft = 35;
  const actorArmRight = 205;
  const actorLegEndY = actorCenterY + 140;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <style>
    .bg { fill: #ffffff; }
    .stroke-box { fill: none; stroke: #000000; stroke-width: 1.5; }
    .stroke-actor { stroke: #000000; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .actor-head { fill: #ffffff; stroke: #000000; stroke-width: 2.2; }
    .line-conn { stroke: #000000; stroke-width: 1.1; }
    .ellipse-uc { fill: #ffffff; stroke: #000000; stroke-width: 1.3; }
    .text-uc { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; fill: #000000; text-anchor: middle; dominant-baseline: middle; }
    .text-actor { font-family: "Segoe UI", Arial, sans-serif; font-size: 15px; font-weight: bold; fill: #000000; text-anchor: middle; }
  </style>

  <!-- Background -->
  <rect width="${totalWidth}" height="${totalHeight}" class="bg" />

  <!-- Actor (Stick Figure) -->
  <g id="actor">
    <!-- Head -->
    <circle cx="120" cy="${actorHeadY}" r="${actorHeadR}" class="actor-head" />
    <!-- Torso -->
    <line x1="120" y1="${actorNeckY}" x2="120" y2="${actorTorsoEndY}" class="stroke-actor" />
    <!-- Arms -->
    <line x1="${actorArmLeft}" y1="${actorArmY}" x2="${actorArmRight}" y2="${actorArmY}" class="stroke-actor" />
    <!-- Left Leg -->
    <line x1="120" y1="${actorTorsoEndY}" x2="45" y2="${actorLegEndY}" class="stroke-actor" />
    <!-- Right Leg -->
    <line x1="120" y1="${actorTorsoEndY}" x2="195" y2="${actorLegEndY}" class="stroke-actor" />
    <!-- Actor Label -->
    <text x="120" y="${actorLegEndY + 35}" class="text-actor">${escapeXml(actorName)}</text>
  </g>

  <!-- System Boundary Box -->
  <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" class="stroke-box" />

  <!-- Connecting Lines -->
  <g id="connections">
`;

  const ellipseCenterX = boxLeft + boxWidth / 2;
  const ellipseRx = 95;
  const ellipseRy = 16;

  useCases.forEach((uc, idx) => {
    const cy = boxTop + 30 + idx * itemHeight;

    // Connect strictly to the left side apex of the oval
    const targetX = ellipseCenterX - ellipseRx;
    const targetY = cy;

    svg += `    <line x1="${actorArmRight}" y1="${actorArmY}" x2="${targetX}" y2="${targetY}" class="line-conn" />\n`;
  });

  svg += `  </g>

  <!-- Use Case Ellipses -->
  <g id="use-cases">
`;

  useCases.forEach((uc, idx) => {
    const cy = boxTop + 30 + idx * itemHeight;
    svg += `    <g id="uc-${idx + 1}">
      <ellipse cx="${ellipseCenterX}" cy="${cy}" rx="${ellipseRx}" ry="${ellipseRy}" class="ellipse-uc" />
      <text x="${ellipseCenterX}" y="${cy}" class="text-uc">${escapeXml(uc)}</text>
    </g>\n`;
  });

  svg += `  </g>
</svg>`;

  const svgPath = path.join(outDir, `${filenameBase}.svg`);
  const pngPath = path.join(outDir, `${filenameBase}.png`);
  fs.writeFileSync(svgPath, svg, 'utf-8');
  console.log(`Saved SVG: ${svgPath}`);
  renderSvgToPng(svgPath, pngPath, totalWidth, totalHeight);
}

// ==========================================
// 2. COMBINED ALL-IN-ONE 35 USE CASE DIAGRAM
// ==========================================
function generateCombined35UseCase() {
  const master35UseCases = [
    'Login',
    'Registration',
    'User Management',
    'Customer Profile',
    'My Garage',
    'View Products',
    'Manage Product',
    'Product Compatibility',
    'AI Customizer',
    'Cart & Wishlist',
    'Checkout & Payment',
    'Manage Order',
    'Order Tracking',
    'Order Return',
    'Customer Feedback',
    'Assign Delivery',
    'Rider Delivery Run',
    'Proof of Delivery',
    'Rider Earnings',
    'Book Garage Service',
    'Booking Management',
    'Manage Stock',
    'View Stock',
    'Stock Alert Notification',
    'View Forecast',
    'Manage Supplier',
    'Manage Purchase Order',
    'Point of Sale (POS)',
    'Manage Promotion',
    'View Report',
    'View Notification',
    'System Settings',
    'System Activity Log',
    'Admin Security Lock',
    'Logout'
  ];

  // Actor mappings based on the 35 requirements
  const adminSet = new Set([
    'Login',
    'User Management',
    'Manage Product',
    'Product Compatibility',
    'Manage Order',
    'Customer Feedback',
    'Assign Delivery',
    'Booking Management',
    'Manage Stock',
    'View Stock',
    'Stock Alert Notification',
    'View Forecast',
    'Manage Supplier',
    'Manage Purchase Order',
    'Point of Sale (POS)',
    'Manage Promotion',
    'View Report',
    'View Notification',
    'System Settings',
    'System Activity Log',
    'Admin Security Lock',
    'Logout'
  ]);

  const customerSet = new Set([
    'Login',
    'Registration',
    'Customer Profile',
    'My Garage',
    'View Products',
    'Product Compatibility',
    'AI Customizer',
    'Cart & Wishlist',
    'Checkout & Payment',
    'Order Tracking',
    'Order Return',
    'Customer Feedback',
    'Book Garage Service',
    'View Notification',
    'Logout'
  ]);

  const riderSet = new Set([
    'Login',
    'Rider Delivery Run',
    'Proof of Delivery',
    'Rider Earnings',
    'View Notification',
    'Logout'
  ]);

  const itemHeight = 44;
  const paddingY = 40;
  const boxTop = 30;
  const boxWidth = 250;
  const boxLeft = 450;
  const boxHeight = master35UseCases.length * itemHeight + paddingY;
  const totalHeight = boxTop + boxHeight + 50;
  const totalWidth = 1150;

  // Actors placement
  // Admin on Left (centered vertically)
  const adminCenterY = boxTop + boxHeight / 2;
  const adminArmRight = 205;
  const adminArmY = adminCenterY - 20;

  // Customer on Right (upper section)
  const customerCenterY = boxTop + 400;
  const customerArmLeft = boxLeft + boxWidth + 245;
  const customerArmY = customerCenterY - 20;

  // Rider on Right (lower section)
  const riderCenterY = boxTop + 1150;
  const riderArmLeft = boxLeft + boxWidth + 245;
  const riderArmY = riderCenterY - 20;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <style>
    .bg { fill: #ffffff; }
    .stroke-box { fill: none; stroke: #000000; stroke-width: 1.5; }
    .stroke-actor { stroke: #000000; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .actor-head { fill: #ffffff; stroke: #000000; stroke-width: 2.2; }
    .line-admin { stroke: #000000; stroke-width: 1.0; }
    .line-customer { stroke: #000000; stroke-width: 1.0; }
    .line-rider { stroke: #000000; stroke-width: 1.0; }
    .ellipse-uc { fill: #ffffff; stroke: #000000; stroke-width: 1.3; }
    .text-uc { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; fill: #000000; text-anchor: middle; dominant-baseline: middle; }
    .text-actor { font-family: "Segoe UI", Arial, sans-serif; font-size: 15px; font-weight: bold; fill: #000000; text-anchor: middle; }
    .box-title { font-family: "Segoe UI", Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #000000; text-anchor: middle; }
  </style>

  <!-- Background -->
  <rect width="${totalWidth}" height="${totalHeight}" class="bg" />

  <!-- Actor 1: Admin (Left) -->
  <g id="actor-admin">
    <circle cx="120" cy="${adminCenterY - 110}" r="40" class="actor-head" />
    <line x1="120" y1="${adminCenterY - 70}" x2="120" y2="${adminCenterY + 45}" class="stroke-actor" />
    <line x1="35" y1="${adminArmY}" x2="${adminArmRight}" y2="${adminArmY}" class="stroke-actor" />
    <line x1="120" y1="${adminCenterY + 45}" x2="45" y2="${adminCenterY + 140}" class="stroke-actor" />
    <line x1="120" y1="${adminCenterY + 45}" x2="195" y2="${adminCenterY + 140}" class="stroke-actor" />
    <text x="120" y="${adminCenterY + 175}" class="text-actor">Admin</text>
  </g>

  <!-- Actor 2: Customer (Right - Top) -->
  <g id="actor-customer">
    <circle cx="1030" cy="${customerCenterY - 110}" r="40" class="actor-head" />
    <line x1="1030" y1="${customerCenterY - 70}" x2="1030" y2="${customerCenterY + 45}" class="stroke-actor" />
    <line x1="945" y1="${customerArmY}" x2="1115" y2="${customerArmY}" class="stroke-actor" />
    <line x1="1030" y1="${customerCenterY + 45}" x2="955" y2="${customerCenterY + 140}" class="stroke-actor" />
    <line x1="1030" y1="${customerCenterY + 45}" x2="1105" y2="${customerCenterY + 140}" class="stroke-actor" />
    <text x="1030" y="${customerCenterY + 175}" class="text-actor">Customer</text>
  </g>

  <!-- Actor 3: Rider (Right - Bottom) -->
  <g id="actor-rider">
    <circle cx="1030" cy="${riderCenterY - 110}" r="40" class="actor-head" />
    <line x1="1030" y1="${riderCenterY - 70}" x2="1030" y2="${riderCenterY + 45}" class="stroke-actor" />
    <line x1="945" y1="${riderArmY}" x2="1115" y2="${riderArmY}" class="stroke-actor" />
    <line x1="1030" y1="${riderCenterY + 45}" x2="955" y2="${riderCenterY + 140}" class="stroke-actor" />
    <line x1="1030" y1="${riderCenterY + 45}" x2="1105" y2="${riderCenterY + 140}" class="stroke-actor" />
    <text x="1030" y="${riderCenterY + 175}" class="text-actor">Rider</text>
  </g>

  <!-- System Boundary Box -->
  <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" class="stroke-box" />

  <!-- Connections -->
  <g id="connections">
`;

  const ellipseCenterX = boxLeft + boxWidth / 2;
  const ellipseRx = 105;
  const ellipseRy = 16;

  master35UseCases.forEach((uc, idx) => {
    const cy = boxTop + 35 + idx * itemHeight;

    // Admin connection (from left to left side of oval)
    if (adminSet.has(uc)) {
      const targetLeftX = ellipseCenterX - ellipseRx;
      const targetLeftY = cy;
      svg += `    <line x1="${adminArmRight}" y1="${adminArmY}" x2="${targetLeftX}" y2="${targetLeftY}" class="line-admin" />\n`;
    }

    // Customer connection (from right to right side of oval)
    if (customerSet.has(uc)) {
      const targetRightX = ellipseCenterX + ellipseRx;
      const targetRightY = cy;
      svg += `    <line x1="945" y1="${customerArmY}" x2="${targetRightX}" y2="${targetRightY}" class="line-customer" />\n`;
    }

    // Rider connection (from right to right side of oval)
    if (riderSet.has(uc)) {
      const targetRightX = ellipseCenterX + ellipseRx;
      const targetRightY = cy;
      svg += `    <line x1="945" y1="${riderArmY}" x2="${targetRightX}" y2="${targetRightY}" class="line-rider" />\n`;
    }
  });

  svg += `  </g>

  <!-- Use Case Ellipses -->
  <g id="use-cases">
`;

  master35UseCases.forEach((uc, idx) => {
    const cy = boxTop + 35 + idx * itemHeight;
    svg += `    <g id="uc-${idx + 1}">
      <ellipse cx="${ellipseCenterX}" cy="${cy}" rx="${ellipseRx}" ry="${ellipseRy}" class="ellipse-uc" />
      <text x="${ellipseCenterX}" y="${cy}" class="text-uc">${escapeXml(uc)}</text>
    </g>\n`;
  });

  svg += `  </g>
</svg>`;

  const svgPath = path.join(outDir, 'usecase_all_actors.svg');
  const pngPath = path.join(outDir, 'usecase_all_actors.png');
  fs.writeFileSync(svgPath, svg, 'utf-8');
  console.log(`Saved Combined SVG: ${svgPath}`);
  renderSvgToPng(svgPath, pngPath, totalWidth, totalHeight);
}

// ==========================================
// 3. EXECUTE USE CASE GENERATION FOR 35 ITEMS
// ==========================================

// Exact Admin subset from the 35 list
const admin35 = [
  'Login',
  'User Management',
  'Manage Product',
  'Product Compatibility',
  'Manage Order',
  'Customer Feedback',
  'Assign Delivery',
  'Booking Management',
  'Manage Stock',
  'View Stock',
  'Stock Alert Notification',
  'View Forecast',
  'Manage Supplier',
  'Manage Purchase Order',
  'Point of Sale (POS)',
  'Manage Promotion',
  'View Report',
  'View Notification',
  'System Settings',
  'System Activity Log',
  'Admin Security Lock',
  'Logout'
];

// Exact Customer subset from the 35 list
const customer35 = [
  'Login',
  'Registration',
  'Customer Profile',
  'My Garage',
  'View Products',
  'Product Compatibility',
  'AI Customizer',
  'Cart & Wishlist',
  'Checkout & Payment',
  'Order Tracking',
  'Order Return',
  'Customer Feedback',
  'Book Garage Service',
  'View Notification',
  'Logout'
];

// Exact Rider subset from the 35 list
const rider35 = [
  'Login',
  'Rider Delivery Run',
  'Proof of Delivery',
  'Rider Earnings',
  'View Notification',
  'Logout'
];

generateSingleActorUseCase('Admin', admin35, 'usecase_admin');
generateSingleActorUseCase('Customer', customer35, 'usecase_customer');
generateSingleActorUseCase('Rider', rider35, 'usecase_rider');
generateCombined35UseCase();

console.log('Use Cases based on the 35 Functional Requirements generated successfully!');
