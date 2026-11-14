import { Platform } from 'react-native';
import { emailService } from '../../../services/notifications/emailService.js';

export function isValidReceiptEmail(value) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatReceiptItemName(item) {
  const baseName = item?.name || 'Motorcycle Part';
  const tags = [];
  if (item?.size) tags.push(`Size ${item.size}`);
  if (item?.color) tags.push(item.color);
  return tags.length > 0 ? `${baseName} (${tags.join(' · ')})` : baseName;
}

export function buildPosDigitalReceiptHtml(order = {}) {
  const orderId = order.order_id || order.id || 'POS-RECEIPT';
  const orderDate =
    order.order_date ||
    new Date(order.created_at || Date.now()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  const customerName = order.customer_name || 'Walk-in Customer';
  const cashier = order.cashier || 'Admin Cashier';
  const paymentMethod = order.payment_method || 'Cash';
  const subtotal = Number(order.total_amount ?? order.grand_total ?? 0);
  const discount = Number(order.discount_amount || 0);
  const discountCode = String(order.discount_code || '').trim();
  const grandTotal = Number(order.grand_total ?? subtotal);
  const tendered = Number(order.amount_tendered ?? grandTotal);
  const change = Number(order.change_amount ?? 0);
  const items = Array.isArray(order.items) ? order.items : [];

  const itemRowsHtml =
    items.length > 0
      ? items
          .map((item) => {
            const qty = Number(item.quantity || 1);
            const price = Number(item.price || 0);
            const lineTotal = price * qty;
            return `
              <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:13px;">${escapeHtml(formatReceiptItemName(item))}</td>
                <td style="padding:10px 12px;text-align:center;color:#475569;font-weight:600;font-size:13px;">x${qty}</td>
                <td style="padding:10px 12px;text-align:right;color:#64748B;font-size:13px;">₱${formatMoney(price)}</td>
                <td style="padding:10px 12px;text-align:right;color:#111827;font-weight:700;font-size:13px;">₱${formatMoney(lineTotal)}</td>
              </tr>`;
          })
          .join('')
      : `
          <tr>
            <td colspan="4" style="padding:12px;text-align:center;color:#64748B;font-size:13px;">
              ${escapeHtml(order.items_summary || 'In-store counter purchase')}
            </td>
          </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MotoTrack Digital Receipt #${escapeHtml(orderId)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:24px auto;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.05);">
    <div style="background-color:#24272B;padding:22px 26px;border-bottom:3px solid #EA580C;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td>
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.4px;">
              <span style="color:#EA580C;">MOTO</span>TRACK
            </div>
            <div style="color:#CBD5E1;font-size:12px;margin-top:4px;">
              Official Counter POS Digital Receipt
            </div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <span style="display:inline-block;background-color:#DCFCE7;color:#166534;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;">
              PAID
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:24px 26px;color:#334155;font-size:14px;line-height:1.55;">
      <p style="margin:0 0 14px;color:#111827;font-size:15px;">
        Hello <strong>${escapeHtml(customerName)}</strong>,
      </p>
      <p style="margin:0 0 18px;color:#475569;font-size:13.5px;">
        Thank you for shopping at <strong>MotoTrack Motorparts &amp; Accessories</strong>. Here is your official digital POS sales receipt.
      </p>

      <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:4px 0;color:#64748B;width:130px;">Receipt No:</td>
            <td style="padding:4px 0;color:#111827;font-weight:700;">#${escapeHtml(orderId)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748B;">Date:</td>
            <td style="padding:4px 0;color:#111827;font-weight:600;">${escapeHtml(orderDate)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748B;">Cashier:</td>
            <td style="padding:4px 0;color:#111827;font-weight:600;">${escapeHtml(cashier)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748B;">Channel:</td>
            <td style="padding:4px 0;color:#111827;font-weight:600;">Direct In-Store Counter</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748B;">Payment Method:</td>
            <td style="padding:4px 0;color:#111827;font-weight:700;">${escapeHtml(paymentMethod)}</td>
          </tr>
        </table>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <thead>
          <tr style="background-color:#24272B;color:#F8FAFC;text-align:left;">
            <th style="padding:10px 12px;font-size:11.5px;font-weight:600;border-radius:6px 0 0 0;">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:11.5px;font-weight:600;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11.5px;font-weight:600;">Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:11.5px;font-weight:600;border-radius:0 6px 0 0;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;">
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          <tr>
            <td style="padding:4px 0;color:#64748B;">Subtotal:</td>
            <td style="padding:4px 0;text-align:right;color:#111827;font-weight:600;">₱${formatMoney(subtotal)}</td>
          </tr>
          ${
            discount > 0
              ? `<tr>
                  <td style="padding:4px 0;color:#059669;">Voucher Discount${discountCode ? ` (${escapeHtml(discountCode)})` : ''}:</td>
                  <td style="padding:4px 0;text-align:right;color:#059669;font-weight:600;">-₱${formatMoney(discount)}</td>
                </tr>`
              : ''
          }
          <tr>
            <td style="padding:10px 0 4px;border-top:1px dashed #CBD5E1;color:#111827;font-size:15px;font-weight:700;">Total Paid:</td>
            <td style="padding:10px 0 4px;border-top:1px dashed #CBD5E1;text-align:right;color:#EA580C;font-size:18px;font-weight:700;">₱${formatMoney(grandTotal)}</td>
          </tr>
          ${
            paymentMethod === 'Cash'
              ? `<tr>
                  <td style="padding:4px 0;color:#64748B;">Cash Tendered:</td>
                  <td style="padding:4px 0;text-align:right;color:#111827;font-weight:600;">₱${formatMoney(tendered)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#64748B;">Change Given:</td>
                  <td style="padding:4px 0;text-align:right;color:#059669;font-weight:700;">₱${formatMoney(change)}</td>
                </tr>`
              : ''
          }
        </table>
      </div>

      <p style="margin:20px 0 0;color:#64748B;font-size:12.5px;text-align:center;">
        Thank you for choosing MotoTrack! Drive safe.
      </p>
    </div>

    <div style="background-color:#F8FAFC;border-top:1px solid #E5E7EB;padding:14px 26px;color:#94A3B8;font-size:11.5px;text-align:center;">
      MotoTrack Motorparts &amp; Accessories · In-Store POS Digital Receipt
    </div>
  </div>
</body>
</html>`;
}

export function buildPosDigitalReceiptText(order = {}) {
  const orderId = order.order_id || order.id || 'POS-RECEIPT';
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items
    .map((it) => `- ${formatReceiptItemName(it)} x${it.quantity || 1}: ₱${formatMoney((it.price || 0) * (it.quantity || 1))}`)
    .join('\n');
  const discountLine =
    Number(order.discount_amount || 0) > 0
      ? `Discount: -₱${formatMoney(order.discount_amount)}\n`
      : '';
  const cashLines =
    order.payment_method === 'Cash'
      ? `Tendered: ₱${formatMoney(order.amount_tendered)}\nChange: ₱${formatMoney(order.change_amount)}\n`
      : '';

  return `MotoTrack Official Counter POS Digital Receipt
Receipt No: #${orderId}
Date: ${order.order_date || ''}
Customer: ${order.customer_name || 'Walk-in Customer'}
Cashier: ${order.cashier || 'Admin Cashier'}
Payment Method: ${order.payment_method || 'Cash'}

Items:
${itemLines || order.items_summary || ''}

Subtotal: ₱${formatMoney(order.total_amount ?? order.grand_total)}
${discountLine}Total Paid: ₱${formatMoney(order.grand_total)}
${cashLines}
Thank you for choosing MotoTrack! Drive safe.`;
}

export async function sendPosDigitalReceiptEmail({ order, recipientEmail }) {
  const cleanEmail = isValidReceiptEmail(recipientEmail);
  if (!cleanEmail) {
    return {
      success: false,
      dispatched: false,
      error: 'Please enter a valid customer Gmail address.',
    };
  }

  const orderId = order?.order_id || order?.id || 'POS';
  const subject = `MotoTrack Digital Receipt #${orderId}`;
  const html = buildPosDigitalReceiptHtml(order);
  const textMessage = buildPosDigitalReceiptText(order);

  const res = await emailService.dispatchHtmlEmail({
    to: cleanEmail,
    subject,
    html,
    textMessage,
  });

  return {
    ...res,
    recipient: cleanEmail,
  };
}

export function buildPosPrintableThermalReceiptHtml(order = {}) {
  const orderId = order.order_id || order.id || 'POS-RECEIPT';
  const orderDate = order.order_date || '';
  const customerName = order.customer_name || 'Walk-in Customer';
  const cashier = order.cashier || 'Admin Cashier';
  const paymentMethod = order.payment_method || 'Cash';
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(order.total_amount ?? order.grand_total ?? 0);
  const discount = Number(order.discount_amount || 0);
  const grandTotal = Number(order.grand_total ?? subtotal);
  const tendered = Number(order.amount_tendered ?? grandTotal);
  const change = Number(order.change_amount ?? 0);

  const itemsHtml = items
    .map((it) => {
      const qty = Number(it.quantity || 1);
      const price = Number(it.price || 0);
      return `
        <div class="item">
          <div class="item-name">${escapeHtml(formatReceiptItemName(it))}</div>
          <div class="row">
            <span>${qty} x ₱${formatMoney(price)}</span>
            <strong>₱${formatMoney(price * qty)}</strong>
          </div>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>POS Receipt #${escapeHtml(orderId)}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    body {
      margin: 0;
      padding: 16px;
      font-family: 'Courier New', Courier, monospace;
      color: #111827;
      background: #FFFFFF;
      width: 300px;
      font-size: 12px;
      line-height: 1.45;
    }
    .center { text-align: center; }
    .title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .sub { font-size: 11px; color: #475569; }
    .divider { border-top: 1px dashed #94A3B8; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    .item { margin: 6px 0; }
    .item-name { font-weight: 700; }
    .total-row { font-size: 14px; font-weight: 700; margin-top: 6px; }
    .barcode {
      margin: 12px 0;
      padding: 8px;
      border: 1px solid #CBD5E1;
      text-align: center;
      letter-spacing: 3px;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">MotoTrack Motorparts &amp; Accessories</div>
    <div class="sub">Official Counter POS Sales Invoice</div>
    <div class="sub">Receipt No: ${escapeHtml(orderId)} • ${escapeHtml(orderDate)}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>Customer:</span><strong>${escapeHtml(customerName)}</strong></div>
  <div class="row"><span>Cashier:</span><strong>${escapeHtml(cashier)}</strong></div>
  <div class="row"><span>Channel:</span><strong>Direct In-Store Counter</strong></div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="row"><span>Subtotal:</span><strong>₱${formatMoney(subtotal)}</strong></div>
  ${discount > 0 ? `<div class="row"><span>Voucher Discount:</span><strong>-₱${formatMoney(discount)}</strong></div>` : ''}
  <div class="row total-row"><span>TOTAL PAID:</span><span>₱${formatMoney(grandTotal)}</span></div>
  <div class="row"><span>Payment Method:</span><strong>${escapeHtml(paymentMethod)}</strong></div>
  ${
    paymentMethod === 'Cash'
      ? `<div class="row"><span>Tendered:</span><strong>₱${formatMoney(tendered)}</strong></div>
         <div class="row"><span>Change Given:</span><strong>₱${formatMoney(change)}</strong></div>`
      : ''
  }
  <div class="barcode">|||||||| | ||||| |||| | |||||||</div>
  <div class="center sub">Thank you for choosing MotoTrack! Drive safe.</div>
  <script>
    setTimeout(function () {
      window.focus();
      window.print();
    }, 200);
  </script>
</body>
</html>`;
}

export function printPosReceipt(order) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { success: false, fallback: false };
  }
  const html = buildPosPrintableThermalReceiptHtml(order);
  const popup = window.open('', '_blank', 'width=400,height=660');
  if (!popup) {
    window.print?.();
    return { success: true, fallback: true };
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return { success: true, fallback: false };
}

