/**
 * Printable packing label: customer info + delivery QR for wrapping on the parcel.
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
    items: itemLines(order),
    qrImageUrl,
    confirmUrl: bundle.confirmUrl || '',
    notes: order.delivery_notes || order.notes || '',
  };
}

function buildPackingSlipHtml(fields) {
  const itemsHtml = fields.items.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const totalText = fields.total != null && fields.total !== '' ? formatPhp(fields.total) : '';
  const paymentBadge = fields.isCod ? 'CASH ON DELIVERY' : escapeHtml(fields.payment);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Delivery label · Order #${escapeHtml(fields.orderId)}</title>
  <style>
    @page { size: A6 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    .label {
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      border: 2px solid #0C6258;
      border-radius: 12px;
      padding: 16px 18px 18px;
    }
    .brand {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0C6258;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; color: #0C6258; }
    .brand p { margin: 2px 0 0; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .order-id { font-size: 13px; font-weight: 800; color: #0C6258; text-align: right; }
    .qr-wrap { text-align: center; margin: 8px 0 10px; }
    .qr-wrap img { width: 220px; height: 220px; background: #fff; }
    .scan {
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0C6258;
      margin: 0 0 12px;
    }
    .section { margin-bottom: 10px; }
    .label-k {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .name { font-size: 18px; font-weight: 800; line-height: 1.2; }
    .phone { font-size: 13px; font-weight: 700; margin-top: 2px; }
    .addr { font-size: 13px; line-height: 1.35; margin-top: 4px; white-space: pre-wrap; }
    ul { margin: 4px 0 0; padding-left: 16px; font-size: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .badge {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      background: ${fields.isCod ? '#FEF3C7' : '#D1FAE5'};
      color: ${fields.isCod ? '#92400E' : '#065F46'};
    }
    .foot {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
    @media print {
      body { background: #fff; }
      .label { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">
      <div>
        <h1>MotoTrack</h1>
        <p>Delivery packing label</p>
      </div>
      <div class="order-id">Order #${escapeHtml(fields.orderId)}</div>
    </div>
    ${
      fields.qrImageUrl
        ? `<div class="qr-wrap"><img id="qr" src="${escapeHtml(fields.qrImageUrl)}" alt="Delivery QR" /></div>
           <p class="scan">Rider: scan after drop-off</p>`
        : `<p class="scan">No QR available — generate one in Admin</p>`
    }
    <div class="section">
      <div class="label-k">Deliver to</div>
      <div class="name">${escapeHtml(fields.customerName)}</div>
      ${fields.phone ? `<div class="phone">${escapeHtml(fields.phone)}</div>` : ''}
      ${fields.address ? `<div class="addr">${escapeHtml(fields.address)}</div>` : '<div class="addr">No address on file</div>'}
    </div>
    <div class="row">
      <div class="section" style="flex:1">
        <div class="label-k">Items</div>
        <ul>${itemsHtml}</ul>
      </div>
      <div class="section" style="flex:1">
        <div class="label-k">Payment</div>
        <div class="badge">${paymentBadge}</div>
        ${totalText ? `<div class="phone" style="margin-top:6px">${escapeHtml(totalText)}</div>` : ''}
        ${fields.riderName ? `<div class="label-k" style="margin-top:8px">Rider</div><div class="phone">${escapeHtml(fields.riderName)}${fields.riderContact ? ` · ${escapeHtml(fields.riderContact)}` : ''}</div>` : ''}
      </div>
    </div>
    ${fields.notes ? `<div class="section"><div class="label-k">Notes</div><div class="addr">${escapeHtml(fields.notes)}</div></div>` : ''}
    <div class="foot">Wrap this label on the parcel. One-time confirmation QR · MotoTrack</div>
  </div>
  <script>
    function startPrint() {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    }
    var img = document.getElementById('qr');
    if (img) {
      if (img.complete) startPrint();
      else { img.onload = startPrint; img.onerror = startPrint; }
    } else {
      startPrint();
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
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=480,height=740');
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
    `MotoTrack delivery · Order #${f.orderId}`,
    `Customer: ${f.customerName}`,
    f.phone ? `Phone: ${f.phone}` : null,
    f.address ? `Address: ${f.address}` : null,
    f.items.length ? `Items: ${f.items.join(', ')}` : null,
    f.riderName ? `Rider: ${f.riderName}` : null,
    `Payment: ${f.payment}`,
    f.confirmUrl || null,
    'Scan the QR after drop-off to confirm delivery.',
  ]
    .filter(Boolean)
    .join('\n');
  await Share.share({ title: `Order #${f.orderId} packing label`, message });
  return { success: true };
}

export default {
  getDeliverySlipFields,
  printDeliveryPackingSlip,
  shareDeliveryPackingSlip,
};
