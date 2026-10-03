/**
 * Printable packing label: customer info + delivery QR for wrapping on the parcel.
 * Formatted as an industrial logistics shipping label matching standard commercial package design.
 */
import { Platform, Share } from 'react-native';
import { formatPhp } from './currency';
import { qrImageUrlForLink } from './deliveryToken';

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

export function getDeliverySlipFields(order = {}, bundle = {}) {
  const orderId = order.order_id || order.id || '—';
  const customerName = order.customer_name || order.userName || 'Walk-in Customer';
  const phone = order.customer_phone || order.userPhone || order.phone || '';
  const address = order.customer_address || order.address || '';
  const riderName = order.rider_name || order.courier || '';
  const riderContact = order.rider_contact || '';
  const payment = order.payment_method || '—';
  const isCod = String(payment).toLowerCase().includes('cod') || String(payment).toLowerCase().includes('cash on');
  const total = order.grand_total ?? order.total_amount ?? order.total;
  const qrImageUrl = bundle.qrImageUrl || (bundle.confirmUrl ? qrImageUrlForLink(bundle.confirmUrl, 360) : '');

  // Extract first item or item summary for prominent product title
  const items = itemLines(order);
  const firstItem = Array.isArray(order?.items) && order.items[0];
  const mainProductName = firstItem
    ? `${firstItem.quantity || firstItem.qty || 1}× ${firstItem.name || firstItem.product_name || firstItem.title || 'Motorcycle Part'}`
    : items[0] || 'Motorcycle Parts & Accessories';
  const extraCount = items.length > 1 ? ` (+${items.length - 1} more)` : '';
  const productName = `${mainProductName}${extraCount}`;

  // Formatted tracking barcode string
  const cleanId = String(orderId).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const trackingNumber = (cleanId.length >= 8 ? cleanId.slice(0, 14) : `MT${cleanId.padStart(8, '0')}PH`).slice(0, 14);
  const formattedBarcodeText = trackingNumber.split('').join(' ');

  // Formatted numeric Item No.
  const numericOnly = String(orderId).replace(/\D/g, '');
  const itemNo = numericOnly ? numericOnly.padStart(7, '0').slice(-7) : cleanId.slice(0, 7) || '0004321';

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
    trackingNumber,
    formattedBarcodeText,
    itemNo,
    qrImageUrl,
    confirmUrl: bundle.confirmUrl || '',
    notes: order.delivery_notes || order.notes || '',
    fromCompany: 'MotoTrack Performance Hub',
    fromAddress: 'KM 14 West Service Rd, Sun Valley',
    fromCity: 'Parañaque, Metro Manila',
    fromZip: '1700 PH',
  };
}

/**
 * Builds realistic SVG Barcode stripes
 */
function generateBarcodeSvg() {
  const stripeWidths = [
    3, 1, 2, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 4, 1,
    2, 3, 1, 2, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 1, 2, 2, 2, 1, 3, 1, 2, 4, 1,
    2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 4, 2, 1, 2, 3, 2, 1, 3, 1, 2, 4, 1, 2, 2,
  ];
  let curX = 6;
  const bars = stripeWidths
    .map((w, idx) => {
      const isBlack = idx % 2 === 0;
      const bar = isBlack
        ? `<rect x="${curX}" y="0" width="${w * 1.6}" height="48" fill="#000" />`
        : '';
      curX += w * 1.6;
      return bar;
    })
    .join('');
  return `<svg viewBox="0 0 ${curX + 6} 48" width="100%" height="48" preserveAspectRatio="none">${bars}</svg>`;
}

function buildPackingSlipHtml(fields) {
  const totalText = fields.total != null && fields.total !== '' ? formatPhp(fields.total) : '';

  // Delivery instructions text
  let instruction = '';
  if (fields.isCod) {
    instruction = `⚠️ CASH ON DELIVERY: Collect ${totalText} upon drop-off.`;
  } else {
    instruction = `✅ PREPAID ORDER (${escapeHtml(fields.payment)}): No collection required.`;
  }
  if (fields.notes) {
    instruction += ` · Note: ${escapeHtml(fields.notes)}`;
  }
  if (fields.riderName) {
    instruction += ` · Rider: ${escapeHtml(fields.riderName)}`;
  }

  const barcodeSvg = generateBarcodeSvg();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shipping Label · Order #${escapeHtml(fields.orderId)}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm;
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
      background: #1D4533;
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
      background: #143124;
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
      width: 820px;
      max-width: 100%;
      background: #FFFFFF;
      border: 3.5px solid #000000;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0,0,0,0.18);
    }

    /* Grid layout */
    .label-header {
      display: flex;
      border-bottom: 3.5px solid #000000;
      min-height: 64px;
    }
    .header-logo-box {
      width: 44%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      gap: 10px;
    }
    .header-logo-text {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #000000;
      text-transform: uppercase;
    }
    .header-product-box {
      width: 56%;
      border-left: 3.5px solid #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      text-align: center;
    }
    .header-product-text {
      font-size: 20px;
      font-weight: 800;
      color: #000000;
      line-height: 1.25;
    }

    /* Main Middle Row */
    .label-body {
      display: flex;
    }

    /* Left Column (From / Barcode / Item No) */
    .body-left-col {
      width: 44%;
      display: flex;
      flex-direction: column;
    }

    .box-from {
      padding: 12px 16px;
      min-height: 94px;
      border-bottom: 3.5px solid #000000;
    }
    .box-title-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }
    .bold-title {
      font-size: 14px;
      font-weight: 900;
      color: #000000;
      text-transform: capitalize;
    }
    .company-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #000000;
    }
    .detail-text {
      font-size: 12px;
      font-weight: 600;
      color: #111111;
      line-height: 1.35;
      padding-left: 56px;
    }

    /* Barcode Box */
    .box-barcode {
      padding: 10px 16px;
      text-align: center;
      border-bottom: 3.5px solid #000000;
      background: #FFFFFF;
    }
    .barcode-code-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 3.5px;
      color: #000000;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .barcode-img-wrap {
      width: 100%;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Item No. Box */
    .box-item-no {
      padding: 10px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .item-no-title {
      font-size: 13.5px;
      font-weight: 900;
      color: #000000;
      letter-spacing: 0.5px;
    }
    .item-no-val {
      font-size: 13px;
      font-weight: 800;
      font-family: 'Courier New', Courier, monospace;
      color: #000000;
      margin-top: 3px;
    }

    /* Right Column (To / Icons / QR / Instructions) */
    .body-right-col {
      width: 56%;
      border-left: 3.5px solid #000000;
      display: flex;
      flex-direction: column;
    }

    .right-top-grid {
      display: flex;
      border-bottom: 3.5px solid #000000;
    }

    .to-and-icons-subcol {
      flex: 1;
      display: flex;
      flex-direction: column;
      border-right: 3.5px solid #000000;
    }

    .box-to {
      padding: 12px 16px;
      min-height: 94px;
      border-bottom: 3.5px solid #000000;
    }
    .box-to-details {
      padding-left: 42px;
    }

    /* 3 Handling Icons Box */
    .box-handling-icons {
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #FFFFFF;
      flex: 1;
    }
    .handling-icon-box {
      width: 44px;
      height: 44px;
      border: 2px solid #000000;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
    }

    /* QR Code Box */
    .qr-subcol {
      width: 175px;
      min-width: 175px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px;
      background: #FFFFFF;
    }
    .qr-img {
      width: 140px;
      height: 140px;
      display: block;
      background: #fff;
    }
    .qr-placeholder-box {
      width: 140px;
      height: 140px;
      border: 2px dashed #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      padding: 8px;
    }

    /* Delivery Instruction Box */
    .box-delivery-instruction {
      padding: 10px 16px;
      background: #FFFFFF;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .instruction-title {
      font-size: 13.5px;
      font-weight: 900;
      color: #000000;
      margin-bottom: 3px;
    }
    .instruction-body {
      font-size: 12px;
      font-weight: 700;
      color: #111111;
      line-height: 1.35;
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
        border: 3.5px solid #000000 !important;
        border-radius: 20px !important;
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
    <!-- Header Row: LOGO | Product Name -->
    <div class="label-header">
      <div class="header-logo-box">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6h-3l-3 6.5h7.5l-2-6.5z" />
          <path d="M9 12.5L5.5 17.5" />
          <path d="M14.5 12.5L18.5 17.5" />
        </svg>
        <span class="header-logo-text">MOTOTRACK</span>
      </div>
      <div class="header-product-box">
        <span class="header-product-text">${escapeHtml(fields.productName)}</span>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="label-body">
      <!-- Left Column -->
      <div class="body-left-col">
        <!-- From : -->
        <div class="box-from">
          <div class="box-title-row">
            <span class="bold-title">From :</span>
            <span class="company-title">${escapeHtml(fields.fromCompany)}</span>
          </div>
          <div class="detail-text">${escapeHtml(fields.fromAddress)}</div>
          <div class="detail-text">${escapeHtml(fields.fromCity)}</div>
          <div class="detail-text">${escapeHtml(fields.fromZip)}</div>
        </div>

        <!-- 1 2 3 A B C D ... + Barcode -->
        <div class="box-barcode">
          <div class="barcode-code-text">${escapeHtml(fields.formattedBarcodeText)}</div>
          <div class="barcode-img-wrap">
            ${barcodeSvg}
          </div>
        </div>

        <!-- Item No: -->
        <div class="box-item-no">
          <div class="item-no-title">Item N&#x2116;:</div>
          <div class="item-no-val">${escapeHtml(fields.itemNo)}</div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="body-right-col">
        <div class="right-top-grid">
          <!-- Subcol 1: To & 3 Handling Icons -->
          <div class="to-and-icons-subcol">
            <!-- To : -->
            <div class="box-to">
              <div class="box-title-row">
                <span class="bold-title">To :</span>
                <span class="company-title">${escapeHtml(fields.customerName)}</span>
              </div>
              <div class="detail-text box-to-details">${escapeHtml(fields.address || 'Standard Delivery Address')}</div>
              <div class="detail-text box-to-details">${escapeHtml(fields.phone ? `Tel: ${fields.phone}` : 'Metro Manila, PH')}</div>
            </div>

            <!-- 3 Standard Packaging Handling Icons -->
            <div class="box-handling-icons">
              <!-- 1. Fragile (Broken Wine Glass) -->
              <div class="handling-icon-box" title="Fragile - Handle with Care">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#000000">
                  <path d="M12 2C7.58 2 6 5.58 6 9c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91 0-3.42-1.58-7-6-7zm-1 3.5l1.5 2-2 2 2 2-1 1.5C8.84 11.5 8 9.5 8 9c0-2.3 1.05-4.5 3-5.5z"/>
                </svg>
              </div>

              <!-- 2. Handle with Care (Hands supporting parcel box) -->
              <div class="handling-icon-box" title="Handle with Care">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#000000">
                  <path d="M8 5h8v5H8z"/>
                  <path d="M4 11c0 4.42 3.58 8 8 8s8-3.58 8-8h-2.2c0 3.2-2.6 5.8-5.8 5.8s-5.8-2.6-5.8-5.8H4zm-1 9h18v2H3z"/>
                </svg>
              </div>

              <!-- 3. This Way Up (Two upward arrows with horizontal bar) -->
              <div class="handling-icon-box" title="This Way Up">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#000000">
                  <path d="M6 3l3.5 4H7.5v8h-3V7H2.5L6 3zm12 0l3.5 4h-2v8h-3V7h-2l3.5-4zM2 18h20v2.5H2V18z"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- Subcol 2: Delivery Confirmation QR Code -->
          <div class="qr-subcol">
            ${
              fields.qrImageUrl
                ? `<img id="qr" class="qr-img" src="${escapeHtml(fields.qrImageUrl)}" alt="Delivery QR Code" />`
                : `<div class="qr-placeholder-box">SCAN CONFIRMATION QR</div>`
            }
          </div>
        </div>

        <!-- Delivery Instruction -->
        <div class="box-delivery-instruction">
          <div class="instruction-title">Delivery Instruction</div>
          <div class="instruction-body">${instruction}</div>
        </div>
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
  const popup = window.open('', '_blank', 'width=940,height=640');
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
    `Tracking: ${f.trackingNumber}`,
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
