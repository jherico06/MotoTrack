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
    try {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    } catch (e) {
      // Windows file lock race condition: ignore
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

// =========================================================================
// FLOWCHART SVG PRIMITIVE BUILDERS (Exact draw.io style)
// =========================================================================

// Terminal (Pill / Oval)
function drawStartEnd(x, y, w, h, text) {
  const rx = h / 2;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text x="${x + w / 2}" y="${y + h / 2}" font-family="Tahoma, Arial, sans-serif" font-size="12px" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// Process / Action (Rectangle)
function drawProcess(x, y, w, h, text) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text x="${x + w / 2}" y="${y + h / 2}" font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// Multi-line Process
function drawProcessMulti(x, y, w, h, lines) {
  const lineSpacing = 14;
  const startY = y + h / 2 - ((lines.length - 1) * lineSpacing) / 2;
  let textSpans = lines.map((line, idx) => `<tspan x="${x + w / 2}" y="${startY + idx * lineSpacing}">${escapeXml(line)}</tspan>`).join('');
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#000000" text-anchor="middle" dominant-baseline="middle">${textSpans}</text>
    </g>
  `;
}

// Screen / Page / Data (Parallelogram)
function drawParallelogram(x, y, w, h, text, skew = 12) {
  const p1 = `${x + skew},${y}`;
  const p2 = `${x + w},${y}`;
  const p3 = `${x + w - skew},${y + h}`;
  const p4 = `${x},${y + h}`;
  return `
    <g>
      <polygon points="${p1} ${p2} ${p3} ${p4}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text x="${x + w / 2}" y="${y + h / 2}" font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// Multi-line Parallelogram
function drawParallelogramMulti(x, y, w, h, lines, skew = 12) {
  const p1 = `${x + skew},${y}`;
  const p2 = `${x + w},${y}`;
  const p3 = `${x + w - skew},${y + h}`;
  const p4 = `${x},${y + h}`;
  const lineSpacing = 13.5;
  const startY = y + h / 2 - ((lines.length - 1) * lineSpacing) / 2;
  let textSpans = lines.map((line, idx) => `<tspan x="${x + w / 2}" y="${startY + idx * lineSpacing}">${escapeXml(line)}</tspan>`).join('');
  return `
    <g>
      <polygon points="${p1} ${p2} ${p3} ${p4}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text font-family="Tahoma, Arial, sans-serif" font-size="11.5px" fill="#000000" text-anchor="middle" dominant-baseline="middle">${textSpans}</text>
    </g>
  `;
}

// Decision (Diamond)
function drawDecision(cx, cy, w, h, text) {
  const p1 = `${cx},${cy - h / 2}`;
  const p2 = `${cx + w / 2},${cy}`;
  const p3 = `${cx},${cy + h / 2}`;
  const p4 = `${cx - w / 2},${cy}`;
  return `
    <g>
      <polygon points="${p1} ${p2} ${p3} ${p4}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text x="${cx}" y="${cy}" font-family="Tahoma, Arial, sans-serif" font-size="11px" font-weight="500" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </g>
  `;
}

function drawDecisionMulti(cx, cy, w, h, lines) {
  const p1 = `${cx},${cy - h / 2}`;
  const p2 = `${cx + w / 2},${cy}`;
  const p3 = `${cx},${cy + h / 2}`;
  const p4 = `${cx - w / 2},${cy}`;
  const lineSpacing = 13;
  const startY = cy - ((lines.length - 1) * lineSpacing) / 2;
  let textSpans = lines.map((line, idx) => `<tspan x="${cx}" y="${startY + idx * lineSpacing}">${escapeXml(line)}</tspan>`).join('');
  return `
    <g>
      <polygon points="${p1} ${p2} ${p3} ${p4}" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
      <text font-family="Tahoma, Arial, sans-serif" font-size="11px" fill="#000000" text-anchor="middle" dominant-baseline="middle">${textSpans}</text>
    </g>
  `;
}

// Connector Badge (Circle with Letter or Number)
function drawConnector(cx, cy, r, text, isLetter = true) {
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#000000" stroke-width="1.4" />
      <text x="${cx}" y="${cy}" font-family="Tahoma, Arial, sans-serif" font-size="${r >= 14 ? '11px' : '9.5px'}" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// Database (Cylinder)
function drawDatabase(x, y, w, h, text) {
  const ellipseH = 20;
  return `
    <g>
      <!-- Cylinder body -->
      <path d="M ${x} ${y + ellipseH / 2} L ${x} ${y + h - ellipseH / 2} A ${w / 2} ${ellipseH / 2} 0 0 0 ${x + w} ${y + h - ellipseH / 2} L ${x + w} ${y + ellipseH / 2} Z" fill="#ffffff" stroke="#000000" stroke-width="2" />
      <!-- Bottom rim -->
      <ellipse cx="${x + w / 2}" cy="${y + h - ellipseH / 2}" rx="${w / 2}" ry="${ellipseH / 2}" fill="none" stroke="#000000" stroke-width="1.5" />
      <!-- Top lid -->
      <ellipse cx="${x + w / 2}" cy="${y + ellipseH / 2}" rx="${w / 2}" ry="${ellipseH / 2}" fill="#ffffff" stroke="#000000" stroke-width="2" />
      <!-- Text -->
      <text x="${x + w / 2}" y="${y + h / 2 + 6}" font-family="Tahoma, Arial, sans-serif" font-size="14px" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// Arrow connector (Directed orthogonal or straight line)
function drawArrow(x1, y1, x2, y2, label = '') {
  let labelTag = '';
  if (label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 6;
    labelTag = `<text x="${mx}" y="${my}" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(label)}</text>`;
  }
  return `
    <g>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="1.3" marker-end="url(#arrowhead)" />
      ${labelTag}
    </g>
  `;
}

function drawPolyArrow(points, label = '', labelPos = null) {
  const pts = points.join(' ');
  let labelTag = '';
  if (label && labelPos) {
    labelTag = `<text x="${labelPos.x}" y="${labelPos.y}" font-family="Tahoma, Arial, sans-serif" font-size="10.5px" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(label)}</text>`;
  }
  return `
    <g>
      <polyline points="${pts}" fill="none" stroke="#000000" stroke-width="1.3" marker-end="url(#arrowhead)" />
      ${labelTag}
    </g>
  `;
}

const svgDefs = `
  <defs>
    <marker id="arrowhead" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 9 3, 0 6" fill="#000000" />
    </marker>
  </defs>
`;

module.exports = {
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
};
