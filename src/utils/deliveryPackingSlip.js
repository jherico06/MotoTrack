/**
 * Printable packing label: customer info + delivery QR for wrapping on the parcel.
 * Formatted as an industrial logistics shipping label matching standard commercial package design.
 */
import { Platform, Share } from 'react-native';
import { formatPhp } from './currency.js';
import { qrImageUrlForLink } from './deliveryToken.js';
import { systemSettingsService } from '../services/system/systemSettingsService.js';

/** Known placeholder / demo store addresses — never print these on labels. */
const MOCK_STORE_ADDRESSES = [
  'KM 14 West Service Rd, Sun Valley',
  'Parañaque, Metro Manila',
  '108 Katipunan Ave, Quezon City, Metro Manila, Philippines',
  '108 Katipunan Ave, Quezon City, Metro Manila',
];

function isMockStoreAddress(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return true;
  return MOCK_STORE_ADDRESSES.some((m) => s === m.toLowerCase() || s.includes(m.toLowerCase()));
}

/** Split store address into label lines (street / city / zip). */
function resolveStoreFromFields(settings = {}) {
  const company = String(settings.storeName || 'MotoTrack').trim() || 'MotoTrack';
  const rawAddress = String(settings.storeAddress || '').trim();
  const cityLocation = String(settings.cityLocation || '').trim();
  const usableAddress = isMockStoreAddress(rawAddress) ? '' : rawAddress;

  if (!usableAddress && !cityLocation) {
    return {
      fromCompany: company,
      fromPhone: '6044-4409',
      fromAddress: 'Naualio B. Bacalso St National Hwy',
      fromCity: 'South Poblacion, Naga, 6037 Cebu',
      fromZip: '6037',
    };
  }

  // Prefer explicit newlines; otherwise split on commas into up to 3 lines
  let parts = usableAddress
    ? usableAddress.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    : [];
  if (parts.length <= 1 && usableAddress.includes(',')) {
    parts = usableAddress.split(',').map((p) => p.trim()).filter(Boolean);
  }

  let fromAddress = parts[0] || 'Naualio B. Bacalso St National Hwy';
  let fromCity = parts[1] || (parts[0] && cityLocation && parts[0] !== cityLocation ? cityLocation : 'South Poblacion, Naga, 6037 Cebu');
  let fromPhone = settings.storePhone || '6044-4409';
  let fromZip = parts.slice(2).join(', ') || '6037';

  return { fromCompany: company, fromPhone, fromAddress, fromCity, fromZip };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemLines(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length) {
    return items.map((it) => {
      const qty = Number(it.quantity || it.qty || 1);
      const name = it.name || it.product_name || it.title || 'Item';
      return `${qty}× ${name}`;
    });
  }
  const summary = String(order?.items_summary || '').trim();
  if (summary) return [summary];
  const count = order?.items_count || 1;
  return [`${count} item(s)`];
}

function formatSpacedTracking(orderId) {
  const s = String(orderId || 'ORD-ON-2026-00004').trim();
  const parts = s.split('-');
  if (parts.length >= 3) {
    const prefix = parts.slice(0, 2).join('').toUpperCase().split('').join('  ');
    const numbers = parts.slice(2).join('').split('').join('  ');
    return `${prefix}    ${numbers}`;
  }
  const clean = s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length > 5) {
    return `${clean.slice(0, 5).split('').join('  ')}    ${clean.slice(5).split('').join('  ')}`;
  }
  return clean.split('').join('  ');
}

function formatItemNnr(orderId) {
  const digits = String(orderId || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    // 202600004 -> 2600004
    return `${digits.slice(2, 4)}${digits.slice(-5)}`;
  }
  if (digits.length >= 7) return digits.slice(-7);
  return digits ? digits.padStart(7, '0') : '2600004';
}

function resolveRiderDisplayName(riderName) {
  const s = String(riderName || '').trim();
  if (!s) return 'Maurin';
  const parts = s.split(/\s+/);
  return parts[parts.length - 1] || s;
}

export function getDeliverySlipFields(order = {}, bundle = {}) {
  const orderId = order.order_id || order.id || 'ORD-ON-2026-00004';
  const customerName = order.customer_name || order.userName || 'Jherico Maurin';
  const phone = order.customer_phone || order.userPhone || order.phone || '09664904841';
  const address = order.customer_address || order.address || 'Purok Avocado 4, Inoburan, City of Naga, Cebu';
  const riderName = order.rider_name || order.courier || '';
  const riderContact = order.rider_contact || '';
  const payment = order.payment_method || 'Cash on Delivery';
  const isCod = String(payment).toLowerCase().includes('cod') || String(payment).toLowerCase().includes('cash on');
  const total = order.grand_total ?? order.total_amount ?? order.total ?? 500;
  const qrImageUrl = bundle.qrImageUrl || (bundle.confirmUrl ? qrImageUrlForLink(bundle.confirmUrl, 400) : '');

  // Extract first item or item summary for prominent product title (e.g. 2× Side Mirror)
  const items = itemLines(order);
  const firstItem = Array.isArray(order?.items) && order.items[0];
  const mainProductName = firstItem
    ? `${firstItem.quantity || firstItem.qty || 1}× ${firstItem.name || firstItem.product_name || firstItem.title || 'Side Mirror'}`
    : items[0] || '2× Side Mirror';
  const extraCount = items.length > 1 ? ` (+${items.length - 1} more)` : '';
  const productName = `${mainProductName}${extraCount}`;

  const formattedSpacedId = formatSpacedTracking(orderId);
  const itemNnr = formatItemNnr(orderId);

  let settings = {};
  try {
    settings = systemSettingsService.getSettings?.() || {};
  } catch (_e) {
    settings = {};
  }
  const from = resolveStoreFromFields(settings);

  return {
    orderId,
    customerName,
    phone,
    address,
    riderName,
    riderContact,
    payment,
    isCod,
    total,
    items,
    productName,
    formattedSpacedId,
    itemNnr,
    qrImageUrl,
    confirmUrl: bundle.confirmUrl || '',
    notes: order.delivery_notes || order.notes || '',
    ...from,
  };
}

function buildPackingSlipHtml(fields) {
  const riderDisplay = resolveRiderDisplayName(fields.riderName);
  let instructionText = '';
  if (fields.isCod) {
    const amountStr = fields.total != null && fields.total !== '' ? formatPhp(fields.total).replace(/\.00$/, '') : '₱500';
    instructionText = `CASH ON DELIVERY: Collect ${amountStr} upon drop-off - Rider: ${riderDisplay}`;
  } else {
    instructionText = `PREPAID ORDER (${escapeHtml(fields.payment || 'PAID')}): No collection required - Rider: ${riderDisplay}`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shipping Label · Order #${escapeHtml(fields.orderId)}</title>
  <style>
    @page {
      size: landscape;
      margin: 6mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #D7C7B2;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000000;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    /* Screen-only top action bar */
    .screen-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .btn-action {
      background: #EA580C;
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: background 0.2s ease, transform 0.1s ease;
    }
    .btn-action:hover {
      background: #C2410C;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #475569;
    }
    .btn-secondary:hover {
      background: #334155;
    }

    /* Outer Shipping Label Package Frame */
    .shipping-label {
      width: 860px;
      max-width: 100%;
      background: #FFFFFF;
      border: 3px solid #000000;
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: row;
      box-shadow: 0 10px 28px rgba(0,0,0,0.16);
    }

    /* Left Major Section (68% width) */
    .label-left-col {
      width: 68%;
      display: flex;
      flex-direction: column;
    }

    /* Row 1: Header Logo & Product Name */
    .row-header {
      display: flex;
      flex-direction: row;
      border-bottom: 2.5px solid #000000;
      min-height: 56px;
    }
    .cell-logo {
      width: 44%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 8px 16px;
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-title {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.5px;
      font-style: italic;
      display: inline-flex;
      align-items: center;
    }
    .brand-moto {
      color: #000000;
    }
    .brand-track {
      color: #EA580C;
    }
    .logo-orange-bar {
      height: 3.5px;
      background: #EA580C;
      width: 100%;
      margin-top: 4px;
      border-radius: 2px;
    }
    .cell-product {
      width: 56%;
      border-left: 2.5px solid #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 14px;
      text-align: center;
    }
    .product-text {
      font-size: 21px;
      font-weight: 900;
      color: #000000;
      line-height: 1.2;
    }

    /* Row 2: Addresses & Handling Icons */
    .row-addresses {
      display: flex;
      flex-direction: row;
      border-bottom: 2.5px solid #000000;
      min-height: 110px;
    }
    .cell-from {
      width: 44%;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 2px;
      font-size: 12px;
    }
    .cell-to {
      width: 56%;
      border-left: 2.5px solid #000000;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 4px;
    }
    .addr-head {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 2px;
    }
    .addr-tag {
      font-weight: 900;
      font-size: 13px;
      color: #000000;
    }
    .addr-name {
      font-weight: 900;
      font-size: 13.5px;
      color: #000000;
    }
    .addr-indent {
      padding-left: 48px;
      font-size: 11.5px;
      font-weight: 600;
      color: #111111;
      line-height: 1.35;
    }
    .handling-icons-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 6px;
      padding-top: 4px;
    }
    .handling-icon-box {
      width: 36px;
      height: 36px;
      border: 2px solid #000000;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
    }

    /* Row 3: Spaced Tracking Bar */
    .row-tracking {
      border-bottom: 2.5px solid #000000;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      background: #FFFFFF;
    }
    .tracking-code-text {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      font-size: 16px;
      font-weight: 900;
      color: #000000;
      letter-spacing: 7px;
      text-transform: uppercase;
      text-align: center;
      word-spacing: 14px;
    }

    /* Row 4: Item NNR & Delivery Instruction */
    .row-bottom {
      display: flex;
      flex-direction: row;
      min-height: 80px;
      flex: 1;
    }
    .cell-item-nnr {
      width: 44%;
      padding: 8px 14px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .item-nnr-title {
      font-size: 13.5px;
      font-weight: 900;
      color: #000000;
    }
    .item-nnr-number {
      font-size: 26px;
      font-weight: 900;
      color: #000000;
      margin-top: 2px;
      line-height: 1.1;
      letter-spacing: 0.5px;
    }
    .cell-instruction {
      width: 56%;
      border-left: 2.5px solid #000000;
      padding: 8px 14px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }
    .instruction-title {
      font-size: 13px;
      font-weight: 900;
      color: #000000;
    }
    .instruction-body {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 800;
      color: #000000;
      line-height: 1.3;
    }

    /* Right Major Section (32% width) - Full-Height QR Code with Orange Corners */
    .label-right-col {
      width: 32%;
      border-left: 2.5px solid #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #FFFFFF;
      position: relative;
    }
    .qr-frame-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }
    .qr-img {
      width: 195px;
      height: 195px;
      display: block;
      background: #FFFFFF;
    }
    .qr-placeholder-box {
      width: 195px;
      height: 195px;
      border: 2px dashed #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      padding: 10px;
    }
    .qr-corner {
      position: absolute;
      width: 34px;
      height: 34px;
      border-color: #EA580C;
      border-style: solid;
      pointer-events: none;
    }
    .qr-corner-tl {
      top: 0;
      left: 0;
      border-width: 5.5px 0 0 5.5px;
      border-top-left-radius: 12px;
    }
    .qr-corner-tr {
      top: 0;
      right: 0;
      border-width: 5.5px 5.5px 0 0;
      border-top-right-radius: 12px;
    }
    .qr-corner-bl {
      bottom: 0;
      left: 0;
      border-width: 0 0 5.5px 5.5px;
      border-bottom-left-radius: 12px;
    }
    .qr-corner-br {
      bottom: 0;
      right: 0;
      border-width: 0 5.5px 5.5px 0;
      border-bottom-right-radius: 12px;
    }

    /* Print Styles */
    @media print {
      body {
        background: #FFFFFF !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .screen-actions {
        display: none !important;
      }
      .shipping-label {
        width: 100% !important;
        max-width: 100% !important;
        border: 3px solid #000000 !important;
        border-radius: 16px !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <!-- Print Controls (hidden on paper) -->
  <div class="screen-actions">
    <button class="btn-action" onclick="window.print()">
      <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
        <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
      </svg>
      Print Shipping Label
    </button>
    <button class="btn-action btn-secondary" onclick="window.close()">Close</button>
  </div>

  <!-- The Package Shipping Label -->
  <div class="shipping-label">
    <!-- Left Major Column -->
    <div class="label-left-col">
      <!-- Row 1: Logo & Product Name -->
      <div class="row-header">
        <div class="cell-logo">
          <div class="logo-row">
            <!-- Motorcycle with speed lines -->
            <svg viewBox="0 0 48 26" width="38" height="22" fill="none">
              <line x1="2" y1="9" x2="10" y2="9" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" />
              <line x1="0" y1="13" x2="8" y2="13" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" />
              <line x1="3" y1="17" x2="11" y2="17" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" />
              <circle cx="18" cy="17" r="5" stroke="#000" stroke-width="2.5" fill="#fff" />
              <circle cx="38" cy="17" r="5" stroke="#000" stroke-width="2.5" fill="#fff" />
              <circle cx="18" cy="17" r="2" fill="#000" />
              <circle cx="38" cy="17" r="2" fill="#000" />
              <path d="M18 17l6-8h8l6 8" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M24 9l-4-4h-4" stroke="#000" stroke-width="2" stroke-linecap="round" />
              <path d="M26 9l6-4h4" stroke="#000" stroke-width="2.5" stroke-linecap="round" />
              <circle cx="30" cy="4.5" r="2.5" fill="#000" />
              <path d="M24 13h8" stroke="#EA580C" stroke-width="3" stroke-linecap="round" />
            </svg>
            <div class="brand-title">
              <span class="brand-moto">MOTO</span><span class="brand-track">TRACK</span>
            </div>
          </div>
          <div class="logo-orange-bar"></div>
        </div>
        <div class="cell-product">
          <span class="product-text">${escapeHtml(fields.productName)}</span>
        </div>
      </div>

      <!-- Row 2: Addresses & Handling Icons -->
      <div class="row-addresses">
        <!-- From: -->
        <div class="cell-from">
          <div class="addr-head">
            <span class="addr-tag">From :</span>
            <span class="addr-name">${escapeHtml(fields.fromCompany)}</span>
          </div>
          ${fields.fromPhone ? `<div class="addr-indent">${escapeHtml(fields.fromPhone)}</div>` : ''}
          ${fields.fromAddress ? `<div class="addr-indent">${escapeHtml(fields.fromAddress)}</div>` : ''}
          ${fields.fromCity ? `<div class="addr-indent">${escapeHtml(fields.fromCity)}</div>` : ''}
        </div>

        <!-- To: + 3 Handling Icons -->
        <div class="cell-to">
          <div>
            <div class="addr-head">
              <span class="addr-tag">To :</span>
              <span class="addr-name">${escapeHtml(fields.customerName)}</span>
            </div>
            <div class="addr-indent">${escapeHtml(fields.address || 'Purok Avocado 4, Inoburan, City of Naga, Cebu')}</div>
            ${fields.phone ? `<div class="addr-indent">Tel: ${escapeHtml(fields.phone)}</div>` : ''}
          </div>

          <!-- 3 Handling Icons (Fragile, Handle with Care, This Side Up) -->
          <div class="handling-icons-row">
            <!-- 1. Fragile (Wine glass) -->
            <div class="handling-icon-box" title="Fragile">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 22h8" />
                <path d="M12 15v7" />
                <path d="M12 15a5 5 0 0 0 5-5V3H7v7a5 5 0 0 0 5 5z" />
              </svg>
            </div>

            <!-- 2. Handle with Care (Downward arrow onto package tray) -->
            <div class="handling-icon-box" title="Handle with Care">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v10" />
                <path d="M8 9l4 4 4-4" />
                <path d="M4 17h16" />
                <path d="M4 17v3h16v-3" />
              </svg>
            </div>

            <!-- 3. This Side Up (Two arrows pointing up with base bar) -->
            <div class="handling-icon-box" title="This Side Up">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16V4" />
                <path d="M4 7l3-3 3 3" />
                <path d="M17 16V4" />
                <path d="M14 7l3-3 3 3" />
                <path d="M3 20h18" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Spaced Tracking Number Bar -->
      <div class="row-tracking">
        <div class="tracking-code-text">${escapeHtml(fields.formattedSpacedId)}</div>
      </div>

      <!-- Row 4: Item NNR & Delivery Instruction -->
      <div class="row-bottom">
        <div class="cell-item-nnr">
          <div class="item-nnr-title">Item NNR:</div>
          <div class="item-nnr-number">${escapeHtml(fields.itemNnr)}</div>
        </div>
        <div class="cell-instruction">
          <div class="instruction-title">Delivery Instruction</div>
          <div class="instruction-body">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#EA580C" style="flex-shrink:0;">
              <path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            <span>${escapeHtml(instructionText)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Major Column: Full-Height QR Code with 4 Orange Corners -->
    <div class="label-right-col">
      <div class="qr-frame-wrap">
        <!-- 4 Orange Corner Brackets -->
        <div class="qr-corner qr-corner-tl"></div>
        <div class="qr-corner qr-corner-tr"></div>
        <div class="qr-corner qr-corner-bl"></div>
        <div class="qr-corner qr-corner-br"></div>

        <!-- The QR Code Image -->
        ${
          fields.qrImageUrl
            ? `<img id="qr" class="qr-img" src="${escapeHtml(fields.qrImageUrl)}" alt="Delivery QR Code" />`
            : `<div class="qr-placeholder-box">DELIVERY CONFIRMATION QR</div>`
        }
      </div>
    </div>
  </div>

  <script>
    function triggerPrint() {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 300);
    }
    var qrImg = document.getElementById('qr');
    if (qrImg) {
      if (qrImg.complete) {
        triggerPrint();
      } else {
        qrImg.onload = triggerPrint;
        qrImg.onerror = triggerPrint;
      }
    } else {
      triggerPrint();
    }
  </script>
</body>
</html>`;
}

export function printDeliveryPackingSlip(order, bundle) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { success: false, error: 'web-only' };
  }
  if (!bundle?.qrImageUrl && !bundle?.confirmUrl) {
    return { success: false, error: 'Generate a QR first.' };
  }
  const html = buildPackingSlipHtml(getDeliverySlipFields(order, bundle));
  // NOTE: Do NOT use noopener/noreferrer — they nullify the popup reference
  // and prevent document.write() from injecting HTML, causing a blank page.
  const popup = window.open('', '_blank', 'width=960,height=620');
  if (!popup) {
    return { success: false, error: 'Allow pop-ups to print the packing label.' };
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return { success: true };
}

export async function shareDeliveryPackingSlip(order, bundle) {
  const f = getDeliverySlipFields(order, bundle);
  const message = [
    `MotoTrack Delivery Package Label · Order #${f.orderId}`,
    `Product: ${f.productName}`,
    `Customer: ${f.customerName}`,
    f.phone ? `Phone: ${f.phone}` : null,
    f.address ? `Address: ${f.address}` : null,
    f.items.length ? `Items: ${f.items.join(', ')}` : null,
    f.riderName ? `Rider: ${f.riderName}` : null,
    `Payment: ${f.payment}`,
    `Tracking: ${f.formattedSpacedId}`,
    `Item NNR: ${f.itemNnr}`,
    f.confirmUrl || null,
    'Scan the QR on the package after drop-off to confirm delivery.',
  ]
    .filter(Boolean)
    .join('\n');
  await Share.share({ title: `Order #${f.orderId} Shipping Label`, message });
  return { success: true };
}

export default {
  getDeliverySlipFields,
  printDeliveryPackingSlip,
  shareDeliveryPackingSlip,
};
