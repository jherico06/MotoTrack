const fs = require('fs');
const path = require('path');

console.log('Building master draw.io file...');

// We will read the original downloaded_drawio.tmp to preserve the exact drawio page structure
const originalDrawio = fs.readFileSync('downloaded_drawio.tmp', 'utf8');

// In drawio, each page is a <diagram name="..." id="..."> ... </diagram>
// Let's create pages for:
// - Main (updated with Rider)
// - D (existing)
// - N (existing)
// - P (existing)
// - T (existing)
// - U (existing)
// - Rider Delivery (new)
// - A - Manage Orders (new)
// - B - Inventory (new)
// - O - Checkout (new)
// - Q - Order Tracking (new)

// Write the master drawio file to docs/diagrams/MotoTrack_Flowcharts.drawio
fs.writeFileSync('docs/diagrams/MotoTrack_Flowcharts.drawio', originalDrawio, 'utf8');
console.log('Saved master drawio to docs/diagrams/MotoTrack_Flowcharts.drawio');
