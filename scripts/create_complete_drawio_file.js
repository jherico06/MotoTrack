const fs = require('fs');
const path = require('path');

console.log('Reading original draw.io file...');
const originalXml = fs.readFileSync('downloaded_drawio.tmp', 'utf8');

// Helper to generate mxCell XML
function makeCell(id, parent, style, value, x, y, width, height, vertex = true) {
  const cleanVal = (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  return `<mxCell id="${id}" parent="${parent}" style="${style}" value="${cleanVal}" ${vertex ? 'vertex="1"' : ''}>
    <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
  </mxCell>`;
}

function makeEdge(id, parent, style, value, source, target, points = []) {
  const cleanVal = (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let ptsXml = '';
  if (points.length > 0) {
    ptsXml = `<Array as="points">${points.map(p => `<mxPoint x="${p.x}" y="${p.y}" />`).join('')}</Array>`;
  }

  return `<mxCell id="${id}" parent="${parent}" style="${style}" value="${cleanVal}" edge="1" source="${source}" target="${target}">
    <mxGeometry relative="1" as="geometry">${ptsXml}</mxGeometry>
  </mxCell>`;
}

// Extract existing diagrams from originalXml:
// Main, D, N, P, T, U
const diagramMap = new Map();
const diagRegex = /<diagram\s+name="([^"]+)"\s+id="([^"]+)">([\s\S]*?)<\/diagram>/g;
let dm;
while ((dm = diagRegex.exec(originalXml)) !== null) {
  diagramMap.set(dm[1], { id: dm[2], content: dm[3] });
}

console.log('Original diagrams found:', Array.from(diagramMap.keys()).join(', '));

// =========================================================================
// 1. UPDATE "Main" WITH RIDER WORKFLOW
// =========================================================================
let mainContent = diagramMap.get('Main').content;

// Add Rider branch to Main if not present
if (!mainContent.includes('Rider Dashboard')) {
  // Add Rider nodes:
  // Rider Login Page (parallelogram) at x=950, y=93
  // Rider Login (process) at x=980, y=159
  // Rider Credentials Valid? (decision) at x=970, y=231
  // Rider Dashboard (process) at x=975, y=353
  // Rider modules: RD1, RD2, RD3, RN, X
  const riderMainNodes = `
    <!-- Rider Authentication Branch -->
    ${makeCell('r-page', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Rider Login Page', 920, 93, 160, 40)}
    ${makeCell('r-login', '1', 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#000000,#000000);strokeWidth=1;fontSize=12;fontFamily=Tahoma;', 'Rider Login', 950, 159, 100, 44)}
    ${makeCell('r-dec', '1', 'strokeWidth=1;html=1;shape=mxgraph.flowchart.decision;whiteSpace=wrap;strokeColor=light-dark(#000000,#000000);fillColor=none;fontSize=12;fontFamily=Tahoma;', 'Credentials Valid?', 940, 231, 120, 80)}
    ${makeCell('r-dash', '1', 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#000000,#000000);strokeWidth=2;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'Rider Dashboard', 940, 353, 120, 44)}
    
    <!-- Rider Use Cases & Modules -->
    ${makeCell('r-mod-rd1', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Rider Delivery Run', 920, 425, 160, 40)}
    ${makeCell('r-badge-rd1', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'RD1', 1090, 435, 30, 20)}
    
    ${makeCell('r-mod-rd2', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Proof of Delivery (POD)', 920, 485, 160, 40)}
    ${makeCell('r-badge-rd2', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'RD2', 1090, 495, 30, 20)}
    
    ${makeCell('r-mod-rd3', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Rider Earnings Ledger', 920, 545, 160, 40)}
    ${makeCell('r-badge-rd3', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'RD3', 1090, 555, 30, 20)}

    ${makeCell('r-mod-rn', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Dispatch Notifications', 920, 605, 160, 40)}
    ${makeCell('r-badge-rn', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'RN', 1090, 615, 30, 20)}

    ${makeCell('r-mod-x', '1', 'shape=parallelogram;html=1;strokeWidth=1;perimeter=parallelogramPerimeter;whiteSpace=wrap;rounded=0;arcSize=12;size=0.23;fillColor=none;strokeColor=light-dark(#000000,#000000);fontSize=12;fontFamily=Tahoma;', 'Logout', 920, 665, 160, 40)}
    ${makeCell('r-badge-x', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', 'X', 1090, 675, 30, 20)}

    <!-- Numbered DB Connectors for Rider -->
    ${makeCell('r-db-26', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', '26', 1130, 435, 30, 20)}
    ${makeCell('r-db-27', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', '27', 1130, 495, 30, 20)}
    ${makeCell('r-db-28', '1', 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=12;fontStyle=1;fontFamily=Tahoma;', '28', 1130, 555, 30, 20)}

    <!-- Edges for Rider -->
    ${makeEdge('e-r-1', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'zY6fVd2T09hvfz32yXZp-1', 'r-page')}
    ${makeEdge('e-r-2', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-page', 'r-login')}
    ${makeEdge('e-r-3', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-login', 'r-dec')}
    ${makeEdge('e-r-4', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', 'Yes', 'r-dec', 'r-dash')}
    ${makeEdge('e-r-5', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-dash', 'r-mod-rd1')}
    ${makeEdge('e-r-6', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-dash', 'r-mod-rd2')}
    ${makeEdge('e-r-7', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-dash', 'r-mod-rd3')}
    ${makeEdge('e-r-8', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-dash', 'r-mod-rn')}
    ${makeEdge('e-r-9', '1', 'endArrow=classic;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;', '', 'r-dash', 'r-mod-x')}
    <!-- Edge from 26, 27, 28 into Database -->
    ${makeEdge('e-r-db1', '1', 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1;', '', 'r-db-26', 'zY6fVd2T09hvfz32yXZp-2')}
    ${makeEdge('e-r-db2', '1', 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1;', '', 'r-db-27', 'zY6fVd2T09hvfz32yXZp-2')}
    ${makeEdge('e-r-db3', '1', 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1;', '', 'r-db-28', 'zY6fVd2T09hvfz32yXZp-2')}
  `;

  // Insert before </root>
  mainContent = mainContent.replace('</root>', `${riderMainNodes}\n</root>`);
  console.log('Added Rider branch to Main diagram in draw.io');
}

// =========================================================================
// 2. CREATE ROLE USE CASE PAGES (Admin, Customer, Rider, All Actors)
// =========================================================================

function buildUseCaseDiagramXml(actorName, items, pageWidth = 850, pageHeight = 1100) {
  const itemHeight = 44;
  const boxTop = 30;
  const boxLeft = 320;
  const boxWidth = 260;
  const boxHeight = items.length * itemHeight + 40;
  const actorCenterY = boxTop + boxHeight / 2;

  let cells = `
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- Actor -->
    <mxCell id="actor-node" parent="1" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=none;strokeColor=#000000;fontSize=14;fontStyle=1;fontFamily=Tahoma;" value="${actorName}" vertex="1">
      <mxGeometry x="100" y="${actorCenterY - 60}" width="50" height="90" as="geometry" />
    </mxCell>
    <!-- System Boundary -->
    <mxCell id="boundary" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;verticalAlign=top;align=left;spacingLeft=10;spacingTop=5;fontSize=12;fontStyle=1;fontFamily=Tahoma;" value="MotoTrack System" vertex="1">
      <mxGeometry x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" as="geometry" />
    </mxCell>
  `;

  const ellipseCenterX = boxLeft + boxWidth / 2;
  const ellipseW = 220;
  const ellipseH = 34;

  items.forEach((item, idx) => {
    const cy = boxTop + 35 + idx * itemHeight;
    const ucId = `uc-${idx + 1}`;
    const edgeId = `e-uc-${idx + 1}`;
    const textVal = `[${item.label}] ${item.name}`;

    cells += `
      <mxCell id="${ucId}" parent="1" style="ellipse;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.2;fontSize=11;fontFamily=Tahoma;fontStyle=1;" value="${textVal}" vertex="1">
        <mxGeometry x="${ellipseCenterX - ellipseW / 2}" y="${cy - ellipseH / 2}" width="${ellipseW}" height="${ellipseH}" as="geometry" />
      </mxCell>
      <mxCell id="${edgeId}" parent="1" style="endArrow=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;" edge="1" source="actor-node" target="${ucId}">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>
    `;
  });

  return `<mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${Math.max(boxHeight + 100, pageHeight)}" background="#FFFFFF" math="0" shadow="0">
    <root>
      ${cells}
    </root>
  </mxGraphModel>`;
}

const adminItems = [
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

const customerItems = [
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

const riderItems = [
  { label: 'AUTH', name: 'Login' },
  { label: 'RD1', name: 'Rider Delivery Run' },
  { label: 'RD2', name: 'Proof of Delivery' },
  { label: 'RD3', name: 'Rider Earnings' },
  { label: 'I', name: 'View Notification' },
  { label: 'X', name: 'Logout' }
];

const adminPageXml = buildUseCaseDiagramXml('Admin', adminItems, 850, 1200);
const customerPageXml = buildUseCaseDiagramXml('Customer', customerItems, 850, 900);
const riderPageXml = buildUseCaseDiagramXml('Rider', riderItems, 850, 600);

// =========================================================================
// 3. ASSEMBLE MASTER MULTI-PAGE DRAW.IO FILE
// =========================================================================

const allPages = [];

// Page 1: Main (Updated)
allPages.push(`<diagram name="Main" id="MotoTrackMainDiagram">${mainContent}</diagram>`);

// Page 2..4: Role Use Cases
allPages.push(`<diagram name="Admin Use Cases" id="MotoTrackAdminUsecases">${adminPageXml}</diagram>`);
allPages.push(`<diagram name="Customer Use Cases" id="MotoTrackCustUsecases">${customerPageXml}</diagram>`);
allPages.push(`<diagram name="Rider Use Cases" id="MotoTrackRiderUsecases">${riderPageXml}</diagram>`);

// Page 5..N: Process Pages (D, N, P, T, U from original, plus Rider, A, B, O, Q)
const existingPages = ['D', 'N', 'P', 'T', 'U'];
existingPages.forEach(pName => {
  if (diagramMap.has(pName)) {
    allPages.push(`<diagram name="${pName}" id="${diagramMap.get(pName).id}">${diagramMap.get(pName).content}</diagram>`);
  }
});

// Add Rider Delivery process page
allPages.push(`<diagram name="Rider Delivery" id="MotoTrackRiderProcess">
  <mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850" background="#FFFFFF" math="0" shadow="0">
    <root>
      <mxCell id="0" />
      <mxCell id="1" parent="0" />
      <mxCell id="r-b1" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD1" vertex="1"><mxGeometry x="80" y="50" width="36" height="36" as="geometry" /></mxCell>
      <mxCell id="r-b2" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD2" vertex="1"><mxGeometry x="130" y="50" width="36" height="36" as="geometry" /></mxCell>
      <mxCell id="r-b3" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD3" vertex="1"><mxGeometry x="180" y="50" width="36" height="36" as="geometry" /></mxCell>
      <mxCell id="r-d" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Rider Operations Dashboard" vertex="1"><mxGeometry x="50" y="120" width="200" height="45" as="geometry" /></mxCell>
      <mxCell id="r-m" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Assigned Deliveries Manifest" vertex="1"><mxGeometry x="45" y="195" width="210" height="45" as="geometry" /></mxCell>
      <mxCell id="r-act" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Rider Delivery Action" vertex="1"><mxGeometry x="80" y="270" width="140" height="40" as="geometry" /></mxCell>
      <mxCell id="r-a1" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD1] Start Run &amp; Broadcast GPS" vertex="1"><mxGeometry x="50" y="360" width="180" height="45" as="geometry" /></mxCell>
      <mxCell id="r-nav" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Turn-by-Turn Maps Navigation" vertex="1"><mxGeometry x="45" y="440" width="190" height="45" as="geometry" /></mxCell>
      <mxCell id="r-gps" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Broadcast Live GPS to DB (26)" vertex="1"><mxGeometry x="45" y="520" width="190" height="45" as="geometry" /></mxCell>
      <mxCell id="r-db26" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="26" vertex="1"><mxGeometry x="125" y="600" width="30" height="30" as="geometry" /></mxCell>
      <mxCell id="r-a2" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD2] Scan Customer QR Token" vertex="1"><mxGeometry x="320" y="360" width="180" height="45" as="geometry" /></mxCell>
      <mxCell id="r-dec" parent="1" style="strokeWidth=1;html=1;shape=mxgraph.flowchart.decision;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;" value="QR Token Valid?" vertex="1"><mxGeometry x="340" y="440" width="140" height="60" as="geometry" /></mxCell>
      <mxCell id="r-pod" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Capture POD Photo &amp; Signature" vertex="1"><mxGeometry x="325" y="535" width="170" height="45" as="geometry" /></mxCell>
      <mxCell id="r-db27" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="27" vertex="1"><mxGeometry x="395" y="615" width="30" height="30" as="geometry" /></mxCell>
      <mxCell id="r-a3" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD3] View Earnings Ledger" vertex="1"><mxGeometry x="580" y="360" width="180" height="45" as="geometry" /></mxCell>
      <mxCell id="r-ledg" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Shipping Fee Commission Summary" vertex="1"><mxGeometry x="565" y="440" width="210" height="45" as="geometry" /></mxCell>
      <mxCell id="r-db28" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="28" vertex="1"><mxGeometry x="655" y="525" width="30" height="30" as="geometry" /></mxCell>
    </root>
  </mxGraphModel>
</diagram>`);

// Build final complete mxfile XML
const masterDrawioXml = `<mxfile host="app.diagrams.net" pages="${allPages.length}">
${allPages.join('\n')}
</mxfile>`;

// Write to both docs/diagrams/MotoTrack_Flowcharts.drawio and root MotoTrack_Flowcharts.drawio
fs.writeFileSync('docs/diagrams/MotoTrack_Flowcharts.drawio', masterDrawioXml, 'utf8');
fs.writeFileSync('MotoTrack_Flowcharts.drawio', masterDrawioXml, 'utf8');
fs.writeFileSync('downloaded_drawio.tmp', masterDrawioXml, 'utf8');

console.log(`Master Draw.io file created with ${allPages.length} pages!`);
console.log('Saved to:');
console.log('  1. docs/diagrams/MotoTrack_Flowcharts.drawio');
console.log('  2. MotoTrack_Flowcharts.drawio (Workspace Root)');
console.log('  3. downloaded_drawio.tmp');
