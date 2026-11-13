// ─── TRANSACTIONAL EMAIL & OTP DISPATCH SERVICE ──────────────────────────────
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase.js';
import { APP_CONFIG } from '../../config';

function getNotifyApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG.customizeApiUrl || ''
  ).trim();
  if (fromEnv && fromEnv.startsWith('https://')) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0';

      if (isLocalhost) {
        if (fromEnv && fromEnv.startsWith('http://') && !fromEnv.includes('192.168.')) {
          return fromEnv.replace(/\/+$/, '');
        }
        const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${proto}//${hostname}:8787`;
      }

      // Production web environment (e.g. Vercel deployment)
      if (fromEnv && fromEnv.startsWith('https://')) {
        return fromEnv.replace(/\/+$/, '');
      }

      // Default to same origin for Vercel Serverless /api
      return window.location.origin;
    }
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
    return 'http://127.0.0.1:8787';
  }
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

function isValidEmail(value) {
  const email = String(value || '')
    .trim()
    .toLowerCase();
  return email.includes('@') && email.includes('.') ? email : null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function brandEmailHtml({ title, greetingName, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:#24272B;padding:20px 24px;">
      <h1 style="margin:0;color:#FFFFFF;font-size:20px;">MotoTrack</h1>
      <p style="margin:6px 0 0;color:#C7D9CF;font-size:13px;">${escapeHtml(title)}</p>
    </div>
    <div style="padding:24px;color:#334155;font-size:15px;line-height:1.55;">
      <p>Hi <strong>${escapeHtml(greetingName || 'Rider')}</strong>,</p>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#F8FAFC;color:#64748B;font-size:12px;">
      MotoTrack · This is an automated notification about your account activity.
    </div>
  </div>
</body>
</html>`;
}

function buildCodOrderApprovedEmailHtml({
  customerName,
  orderId,
  orderDate,
  totalFormatted,
  items = [],
  supportEmail = 'support@mototrack.com',
  supportPhone = '+63 (2) 8123-4567',
}) {
  const itemRows =
    Array.isArray(items) && items.length > 0
      ? items
          .map((it) => {
            const name = escapeHtml(it.name || it.product_name || 'Motorcycle Part');
            const qty = Number(it.quantity || 1);
            const price = Number(it.price || it.unit_cost || 0);
            const subtotal = Number(it.subtotal || price * qty);
            const priceStr =
              price > 0
                ? `₱${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—';
            const subtotalStr =
              subtotal > 0
                ? `₱${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—';
            return `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 10px 12px; color: #1E293B; font-weight: 600;">${name}</td>
                <td style="padding: 10px 12px; text-align: center; color: #475569; font-weight: 700;">x${qty}</td>
                <td style="padding: 10px 12px; text-align: right; color: #64748B;">${priceStr}</td>
                <td style="padding: 10px 12px; text-align: right; color: #0F172A; font-weight: 700;">${subtotalStr}</td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr>
          <td colspan="4" style="padding: 12px; color: #64748B; font-style: italic; text-align: center;">Item details available in your order dashboard</td>
        </tr>
      `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your MotoTrack COD Order Has Been Approved!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 24px auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background-color: #24272B; padding: 24px 28px; border-bottom: 3px solid #EA580C;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">
        <span style="color: #EA580C;">MOTO</span>TRACK
      </h1>
      <p style="margin: 6px 0 0; color: #CBD5E1; font-size: 13px; font-weight: 500;">Official Cash on Delivery Order Notification</p>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px; color: #334155; font-size: 15px; line-height: 1.6;">
      <p style="margin: 0 0 16px; font-size: 16px; color: #0F172A;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      
      <p style="margin: 0 0 18px; font-size: 15px; color: #1E293B;">
        Good news! Your <strong>Cash on Delivery (COD)</strong> order has been approved by MotoTrack.
      </p>

      <!-- Order Details Summary Card -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; font-weight: 800;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 140px;">Order Number:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 800;">#${escapeHtml(orderId)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Order Date:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${escapeHtml(orderDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Payment Method:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">Cash on Delivery (COD)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Order Status:</td>
            <td style="padding: 6px 0;">
              <span style="background-color: #DCFCE7; color: #15803D; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 12px; display: inline-block;">Approved</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0 0; color: #64748B; border-top: 1px dashed #CBD5E1; font-weight: 700;">Order Total:</td>
            <td style="padding: 10px 0 0; color: #EA580C; font-size: 18px; font-weight: 900; border-top: 1px dashed #CBD5E1;">₱${escapeHtml(totalFormatted)}</td>
          </tr>
        </table>
      </div>

      <!-- Purchased Products Section -->
      <div style="margin: 22px 0;">
        <h3 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; font-weight: 800;">Purchased Products</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <thead>
            <tr style="background-color: #24272B; color: #F8FAFC; text-align: left;">
              <th style="padding: 10px 12px; border-radius: 6px 0 0 0; font-size: 12px; font-weight: 700;">Product</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 700;">Qty</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 700;">Price</th>
              <th style="padding: 10px 12px; text-align: right; border-radius: 0 6px 0 0; font-size: 12px; font-weight: 700;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>

      <!-- Processing Note -->
      <p style="margin: 18px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">
        Your order has been approved and is now being processed. We will notify you when there are further updates regarding your order.
      </p>

      <!-- Cash on Delivery Payment Instructions -->
      <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 4px; font-weight: 800; color: #92400E; font-size: 14px;">Cash on Delivery Instructions</p>
        <p style="margin: 0; color: #78350F; font-size: 13.5px; line-height: 1.55;">
          Please prepare the payment amount upon delivery. You may prepare the exact amount of <strong>₱${escapeHtml(totalFormatted)}</strong> for quick and contactless handover with our rider.
        </p>
      </div>

      <!-- Support / Contact Info -->
      <p style="margin: 22px 0 8px; color: #64748B; font-size: 13px; line-height: 1.5;">
        Need help or have delivery questions? Reach our support desk at <a href="mailto:${escapeHtml(supportEmail)}" style="color: #EA580C; text-decoration: none; font-weight: 600;">${escapeHtml(supportEmail)}</a> or call <strong>${escapeHtml(supportPhone)}</strong>.
      </p>

      <!-- Closing -->
      <p style="margin: 24px 0 4px; color: #1E293B; font-size: 14.5px;">Thank you for shopping with MotoTrack!</p>
      <p style="margin: 0; color: #64748B; font-size: 14px;">
        Best regards,<br>
        <strong style="color: #0F172A;">MotoTrack Team</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 28px; color: #94A3B8; font-size: 12px; text-align: center;">
      MotoTrack Philippines · Automated Order Notification · Please do not reply directly to this automated email.
    </div>
  </div>
</body>
</html>`;
}

function buildBookingApprovedEmailHtml({
  customerName,
  bookingId,
  serviceTitle,
  appointmentDate,
  timeSlot,
  branchName,
  branchAddress,
  mechanicName,
  serviceBay,
  bikeBrand,
  bikeModel,
  plateNumber,
  estimatedTotal,
  downpaymentAmount,
  downpaymentStatus,
  downpaymentMethod,
  remainingBalance,
  isConfirmed = true,
  supportEmail = 'support@mototrack.com',
  supportPhone = '+63 (2) 8123-4567',
}) {
  const brand = String(bikeBrand || '').trim();
  const model = String(bikeModel || '').trim();
  const plate = String(plateNumber || '').trim();
  const bikeSummary = [brand, model].filter(Boolean).join(' ') + (plate ? ` (Plate: ${plate})` : '');
  const bikeDisplay = bikeSummary || 'Your Registered Motorcycle';

  const dateLabel = appointmentDate || 'Scheduled Date';
  const timeLabel = timeSlot || '09:00 AM';
  const branch = branchName || "D'Blockchain Motorparts & Accessories";
  const address = branchAddress || 'Central Naga Highway, Naga City, Cebu';
  const tech = mechanicName || 'Lead Master Pit Technician';
  const bay = serviceBay || 'Pit Bay 02 (Express Bay)';

  const est = Number(estimatedTotal) || 0;
  const dp = Number(downpaymentAmount) || 0;
  const bal = Number(remainingBalance) || (est > dp ? est - dp : 0);
  const payMethod = downpaymentMethod || 'GCash';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Booking Reservation Approved — MotoTrack</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 24px auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);">
    
    <!-- Header -->
    <div style="background-color: #24272B; padding: 24px 28px; border-bottom: 3px solid #EA580C;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">
        <span style="color: #EA580C;">MOTO</span>TRACK
      </h1>
      <p style="margin: 6px 0 0; color: #CBD5E1; font-size: 13px; font-weight: 500;">Workshop Reservation & Pit Schedule Notice</p>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px; color: #334155; font-size: 15px; line-height: 1.6;">
      <p style="margin: 0 0 16px; font-size: 16px; color: #0F172A;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>

      <p style="margin: 0 0 18px; font-size: 15px; color: #1E293B;">
        Great news! Your service booking reservation <strong>#${escapeHtml(bookingId)}</strong> for <strong>${escapeHtml(serviceTitle)}</strong> has been <strong>approved</strong> by the MotoTrack workshop administration.
      </p>

      <!-- REQUIRED ACTION CALLOUT CARD -->
      <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 5px solid #EA580C; border-radius: 8px; padding: 18px 20px; margin: 22px 0;">
        <div style="margin-bottom: 8px;">
          <strong style="font-size: 14px; color: #9A3412; text-transform: uppercase; letter-spacing: 0.6px;">
            ⚠️ ACTION REQUIRED: BRING YOUR MOTORCYCLE TO THE SHOP
          </strong>
        </div>
        <p style="margin: 0 0 12px; font-size: 14px; color: #7C2D12; line-height: 1.55;">
          You are <strong>required to go to the shop with your motorcycle</strong> on your scheduled appointment date and time:
        </p>
        <div style="background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
            <tr>
              <td style="padding: 5px 0; color: #78350F; width: 135px; font-weight: 600;">📅 Scheduled Date:</td>
              <td style="padding: 5px 0; color: #0F172A; font-weight: 800;">${escapeHtml(dateLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #78350F; font-weight: 600;">⏰ Arrival Time:</td>
              <td style="padding: 5px 0; color: #EA580C; font-weight: 800;">${escapeHtml(timeLabel)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #78350F; font-weight: 600;">🏍️ Motorcycle:</td>
              <td style="padding: 5px 0; color: #0F172A; font-weight: 700;">${escapeHtml(bikeDisplay)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #78350F; font-weight: 600;">📍 Shop Location:</td>
              <td style="padding: 5px 0; color: #0F172A; font-weight: 600;">${escapeHtml(branch)}<br/><span style="color: #64748B; font-size: 12px;">${escapeHtml(address)}</span></td>
            </tr>
            ${tech ? `
            <tr>
              <td style="padding: 5px 0; color: #78350F; font-weight: 600;">🔧 Assigned Tech:</td>
              <td style="padding: 5px 0; color: #0F172A; font-weight: 700;">${escapeHtml(tech)}</td>
            </tr>` : ''}
            ${bay ? `
            <tr>
              <td style="padding: 5px 0; color: #78350F; font-weight: 600;">🛠️ Service Bay:</td>
              <td style="padding: 5px 0; color: #0F172A; font-weight: 600;">${escapeHtml(bay)}</td>
            </tr>` : ''}
          </table>
        </div>
        <p style="margin: 0; font-size: 13px; color: #9A3412; line-height: 1.5;">
          • Please arrive <strong>10–15 minutes before</strong> your scheduled time (${escapeHtml(timeLabel)}).<br/>
          • Bring your motorcycle (<strong>${escapeHtml(bikeDisplay)}</strong>) and present your Booking Reference <strong>#${escapeHtml(bookingId)}</strong> at the pit bay gate.
        </p>
      </div>

      <!-- Booking Summary Details Card -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 18px 20px; margin: 22px 0;">
        <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; font-weight: 800;">Reservation Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 140px;">Booking Ref:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 800;">#${escapeHtml(bookingId)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Service Package:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">${escapeHtml(serviceTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Reservation Status:</td>
            <td style="padding: 6px 0;">
              <span style="background-color: #DCFCE7; color: #15803D; font-weight: 800; padding: 3px 10px; border-radius: 12px; font-size: 12px; display: inline-block;">Approved & Confirmed</span>
            </td>
          </tr>
          ${est > 0 ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Service Estimate:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">₱${est.toLocaleString('en-PH')}</td>
          </tr>` : ''}
          ${dp > 0 ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Deposit Status:</td>
            <td style="padding: 6px 0; color: #047857; font-weight: 700;">₱${dp.toLocaleString('en-PH')} Verified (${escapeHtml(payMethod)})</td>
          </tr>` : ''}
          ${bal > 0 ? `
          <tr>
            <td style="padding: 8px 0 0; color: #64748B; border-top: 1px dashed #CBD5E1;">Remaining Balance:</td>
            <td style="padding: 8px 0 0; color: #EA580C; font-size: 16px; font-weight: 800; border-top: 1px dashed #CBD5E1;">₱${bal.toLocaleString('en-PH')} <span style="font-size: 12px; font-weight: 400; color: #64748B;">(payable at counter upon completion)</span></td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Live Tracking Note -->
      <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 12px 16px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 0; color: #1E40AF; font-size: 13px; line-height: 1.5;">
          📡 <strong>Live Bay Telemetry:</strong> You can track your motorcycle's live service stages (Gate Check-In, Service Underway, Ready for Pick Up) directly in your <strong>MotoTrack Garage / My Appointments</strong> dashboard.
        </p>
      </div>

      <!-- Support / Contact Info -->
      <p style="margin: 20px 0 8px; color: #64748B; font-size: 13px; line-height: 1.5;">
        Need to reschedule or have questions? Contact the workshop at <a href="mailto:${escapeHtml(supportEmail)}" style="color: #EA580C; text-decoration: none; font-weight: 600;">${escapeHtml(supportEmail)}</a> or call <strong>${escapeHtml(supportPhone)}</strong>.
      </p>

      <!-- Closing -->
      <p style="margin: 22px 0 4px; color: #1E293B; font-size: 14.5px;">We look forward to servicing your bike!</p>
      <p style="margin: 0; color: #64748B; font-size: 14px;">
        Best regards,<br>
        <strong style="color: #0F172A;">MotoTrack Workshop Team</strong><br>
        <span style="font-size: 12px; color: #94A3B8;">${escapeHtml(branch)}</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 28px; color: #94A3B8; font-size: 12px; text-align: center;">
      MotoTrack Atelier OS · Pit Bay Service Telemetry · Automated Notification
    </div>
  </div>
</body>
</html>`;
}

class EmailService {
  /**
   * Resolve a customer email from order/booking fields or the customers/users table.
   */
  async resolveCustomerEmail({
    email,
    customerEmail,
    userEmail,
    phone,
    userId,
    customerId,
    bookingId,
  } = {}) {
    const direct = isValidEmail(email || customerEmail || userEmail);
    if (direct) return direct;

    const maybePhone = isValidEmail(phone);
    if (maybePhone) return maybePhone;

    // Check window.localStorage for current session user email if on web
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedUser = JSON.parse(window.localStorage.getItem('mototrack_user') || '{}');
        const storedEmail = isValidEmail(storedUser?.email);
        if (storedEmail && (storedUser?.id === userId || storedUser?.customer_id === customerId || !userId)) {
          return storedEmail;
        }
      } catch (_e) {}
    }

    const ids = [...new Set([userId, customerId].map((v) => String(v || '').trim()).filter(Boolean))];
    if (ids.length && supabase) {
      try {
        for (const id of ids) {
          // 1. Check customers table by customer_id
          const byCustomer = await supabase.from('customers').select('email').eq('customer_id', id).maybeSingle();
          const foundCustomer = isValidEmail(byCustomer.data?.email);
          if (foundCustomer) return foundCustomer;

          // 2. Check users table by user_id
          const byUserId = await supabase.from('users').select('email').eq('user_id', id).maybeSingle();
          const foundUserId = isValidEmail(byUserId.data?.email);
          if (foundUserId) return foundUserId;

          // 3. Check users table by id
          const byId = await supabase.from('users').select('email').eq('id', id).maybeSingle();
          const foundId = isValidEmail(byId.data?.email);
          if (foundId) return foundId;
        }
      } catch (_e) {}
    }

    // Check bookings table in Supabase by bookingId if provided
    if (bookingId && supabase) {
      try {
        const fromBooking = await supabase.from('bookings').select('customer_email').eq('booking_id', bookingId).maybeSingle();
        const foundBookingEmail = isValidEmail(fromBooking.data?.customer_email);
        if (foundBookingEmail) return foundBookingEmail;
      } catch (_e) {}
    }

    return null;
  }

  /**
   * Dispatch HTML email via server API → Resend → EmailJS.
   */
  async dispatchHtmlEmail({ to, subject, html, textMessage }) {
    const cleanEmail = isValidEmail(to);
    if (!cleanEmail) {
      return { success: false, dispatched: false, error: 'No valid customer email address.' };
    }

    let dispatched = false;
    const errors = [];

    // Method 1: Server transactional email (preferred — secrets stay on server)
    try {
      const base = getNotifyApiBaseUrl();
      const res = await fetch(`${base}/api/notify/email`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cleanEmail, subject, html }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        console.log('[EmailService] Sent via server to:', cleanEmail);
        return { success: true, dispatched: !!data.dispatched, provider: data.provider || 'server' };
      }
      if (data?.error) errors.push(data.error);
    } catch (e) {
      const isFailedToFetch = e?.name === 'TypeError' || String(e?.message || '').includes('Failed to fetch');
      const errorMsg = isFailedToFetch
        ? `Failed to fetch: Backend server at ${getNotifyApiBaseUrl()} is unreachable. Run npm run server locally or check API deployment.`
        : e?.message || 'Server email unreachable';
      errors.push(errorMsg);
    }

    // Method 2: Resend (client key — legacy/dev)
    const resendApiKey = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'MotoTrack <orders@resend.dev>',
            to: [cleanEmail],
            subject,
            html,
          }),
        });
        if (resendRes.ok) {
          console.log('[EmailService] Sent via Resend to:', cleanEmail);
          dispatched = true;
          return { success: true, dispatched: true, provider: 'resend' };
        }
        errors.push(`Resend HTTP ${resendRes.status}`);
      } catch (e) {
        errors.push(e?.message || 'Resend failed');
      }
    }

    // Method 3: EmailJS generic message template
    const emailJsServiceId =
      APP_CONFIG.emailjsServiceId ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_SERVICE_ID);
    const emailJsTemplateId =
      APP_CONFIG.emailjsTemplateId ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID);
    const emailJsPublicKey =
      APP_CONFIG.emailjsPublicKey ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY);

    if (emailJsServiceId && emailJsTemplateId && emailJsPublicKey) {
      try {
        const emailJsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailJsServiceId,
            template_id: emailJsTemplateId,
            user_id: emailJsPublicKey,
            template_params: {
              to_email: cleanEmail,
              subject,
              message: textMessage || subject,
            },
          }),
        });
        if (emailJsRes.ok) {
          console.log('[EmailService] Sent via EmailJS to:', cleanEmail);
          return { success: true, dispatched: true, provider: 'emailjs' };
        }
      } catch (e) {
        errors.push(e?.message || 'EmailJS failed');
      }
    }

    console.warn('[EmailService] Could not dispatch email to', cleanEmail, errors[0] || '');
    return {
      success: false,
      dispatched: false,
      error: errors[0] || 'No email provider configured.',
    };
  }

  /**
   * Send 6-Digit OTP Email to user's Gmail/Email inbox
   */
  async sendOtpEmail({ email, otpCode, name = 'Rider' }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: 'Email is required' };

    let dispatched = false;
    const errors = [];

    const emailJsServiceId =
      APP_CONFIG.emailjsServiceId ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_SERVICE_ID);
    const emailJsTemplateId =
      APP_CONFIG.emailjsTemplateId ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID);
    const emailJsPublicKey =
      APP_CONFIG.emailjsPublicKey ||
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY);

    if (emailJsServiceId && emailJsTemplateId && emailJsPublicKey) {
      try {
        const emailJsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailJsServiceId,
            template_id: emailJsTemplateId,
            user_id: emailJsPublicKey,
            template_params: {
              to_email: cleanEmail,
              to_name: name || 'Rider',
              otp_code: otpCode,
              passcode: otpCode,
              message: `Your MotoTrack security verification OTP code is: ${otpCode}. Valid for 5 minutes.`,
            },
          }),
        });
        if (emailJsRes.ok) {
          console.log('[EmailService] OTP sent successfully via EmailJS to:', cleanEmail);
          dispatched = true;
        }
      } catch (e) {
        console.warn('[EmailService] EmailJS dispatch note:', e.message);
      }
    }

    const resendApiKey = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'MotoTrack Security <onboarding@resend.dev>',
            to: [cleanEmail],
            subject: `${otpCode} is your MotoTrack Verification Code`,
            html: `<div style="font-family: sans-serif; padding: 20px;"><h2>MotoTrack Account Verification</h2><p>Your 6-digit OTP code is:</p><h1 style="font-size: 32px; letter-spacing: 4px; color: #EA580C;">${otpCode}</h1><p>Enter this code to complete registration. Expires in 5 minutes.</p></div>`,
          }),
        });
        if (resendRes.ok) {
          console.log('[EmailService] OTP sent successfully via Resend to:', cleanEmail);
          dispatched = true;
        }
      } catch (e) {
        console.warn('[EmailService] Resend dispatch note:', e.message);
      }
    }

    if (supabase) {
      try {
        const signUpRes = await supabase.auth.signUp({
          email: cleanEmail,
          password: 'MotoTrackTempPass123!',
          options: {
            data: { name, otp_code: otpCode },
          },
        });

        if (!signUpRes.error) {
          console.log('[EmailService] signUp confirmation dispatched to:', cleanEmail);
          dispatched = true;
        } else if (signUpRes.error.message?.toLowerCase().includes('already registered')) {
          console.log('[EmailService] User already in auth.users, triggering resend...');
          const resendRes = await supabase.auth.resend({
            type: 'signup',
            email: cleanEmail,
          });
          if (!resendRes.error) {
            console.log('[EmailService] resend confirmation dispatched to:', cleanEmail);
            dispatched = true;
          } else {
            console.warn('[EmailService] resend error:', resendRes.error.message);
          }
        } else {
          console.warn('[EmailService] signUp error:', signUpRes.error.message);
        }
      } catch (e) {
        console.warn('[EmailService] Supabase Auth email exception:', e.message);
        errors.push(e.message);
      }
    }

    return {
      success: true,
      dispatched,
      message: `Verification code sent to ${cleanEmail}. Please check your inbox and spam folder.`,
    };
  }

  /**
   * Send Order Confirmation Email & log in-app notification
   */
  async sendOrderConfirmationEmail({ order, customerEmail, customerName }) {
    const orderId = order.order_id || order.id || 'N/A';
    const total = Number(order.grand_total || order.total_amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const itemsDesc =
      order.items_summary || (order.items || []).map((i) => `${i.name} (x${i.quantity})`).join(', ');

    const cleanEmail = await this.resolveCustomerEmail({
      customerEmail,
      email: order.customer_email,
      phone: order.customer_phone,
      userId: order.user_id,
      customerId: order.customer_id,
    });

    console.log(
      `[EmailService] 📧 Sending Order Confirmation for #${orderId} to: ${cleanEmail || 'Customer'}`
    );

    const html = brandEmailHtml({
      title: 'Order confirmation',
      greetingName: customerName || order.customer_name,
      bodyHtml: `
        <p>We received your MotoTrack order and will keep you updated as it progresses.</p>
        <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-weight:700;color:#0F172A;">Order #${escapeHtml(orderId)}</p>
          <p style="margin:0 0 4px;color:#64748B;font-size:14px;"><strong>Items:</strong> ${escapeHtml(itemsDesc)}</p>
          <p style="margin:0 0 4px;color:#64748B;font-size:14px;"><strong>Payment:</strong> ${escapeHtml(order.payment_method || '')}</p>
          <p style="margin:0;color:#EA580C;font-size:16px;font-weight:700;"><strong>Total:</strong> ₱${escapeHtml(total)}</p>
        </div>
        <p style="color:#64748B;font-size:13px;">Courier: ${escapeHtml(order.courier || 'MotoTrack Express')}</p>
        <p style="color:#64748B;font-size:13px;">Tracking: <strong>${escapeHtml(order.tracking_number || 'Pending')}</strong></p>
      `,
    });

    if (cleanEmail) {
      await this.dispatchHtmlEmail({
        to: cleanEmail,
        subject: `Order Confirmed: #${orderId} — MotoTrack`,
        html,
        textMessage: `Order #${orderId} confirmed. Total ₱${total}. Status: ${order.status}.`,
      });
    }

    if (supabase && (order.customer_id || order.user_id)) {
      try {
        await supabase.from('notifications').insert([
          {
            user_id: order.user_id || order.customer_id,
            message: `Order #${orderId} received! Total: ₱${total}. Status: ${order.status}.`,
            type: 'order',
            status: 'unread',
          },
        ]);
      } catch (_e) {}
    }

    return { success: true, emailed: !!cleanEmail };
  }

  /**
   * Send Order Status Update Notification (Approved, Shipped, Delivered, Cancelled)
   */
  async sendOrderStatusNotification({
    orderId,
    oldStatus,
    newStatus,
    customerEmail,
    customerName,
    trackingNumber,
    notes,
    order = null,
  }) {
    const cleanEmail = await this.resolveCustomerEmail({
      customerEmail,
      email: order?.customer_email,
      phone: order?.customer_phone,
      userId: order?.user_id,
      customerId: order?.customer_id,
    });

    console.log(`[EmailService] 🔔 Order #${orderId} status changed from "${oldStatus}" to "${newStatus}"`);

    let message = `Your order #${orderId} is now ${newStatus}.`;
    let subject = `Order #${orderId} Update: ${newStatus}`;
    if (newStatus === 'Processing') {
      message = `Good news! Your order #${orderId} has been approved and is now being packed for delivery.`;
      subject = `Order #${orderId} Approved — MotoTrack`;
    }
    if (newStatus === 'Shipped') {
      message = `Order #${orderId} has shipped! Tracking: ${trackingNumber || 'Available in Orders tab'}.`;
    }
    if (newStatus === 'Delivered') message = `Order #${orderId} has been successfully delivered!`;
    if (newStatus === 'Cancelled') {
      message = `Order #${orderId} was cancelled. ${notes ? `Reason: ${notes}` : ''}`;
    }

    const html = brandEmailHtml({
      title: newStatus === 'Processing' ? 'Order approved' : 'Order status update',
      greetingName: customerName || order?.customer_name,
      bodyHtml: `
        <p style="color:#0F172A;font-size:16px;">${escapeHtml(message)}</p>
        ${notes ? `<p style="color:#64748B;font-size:14px;"><em>${escapeHtml(notes)}</em></p>` : ''}
        ${
          trackingNumber
            ? `<p style="color:#64748B;font-size:14px;">Tracking number: <strong>${escapeHtml(trackingNumber)}</strong></p>`
            : ''
        }
      `,
    });

    if (cleanEmail) {
      await this.dispatchHtmlEmail({
        to: cleanEmail,
        subject,
        html,
        textMessage: message,
      });
    }

    if (supabase) {
      try {
        const userId = order?.user_id || order?.customer_id;
        await supabase.from('notifications').insert([
          {
            ...(userId ? { user_id: userId } : {}),
            message,
            type: 'order_status',
            status: 'unread',
          },
        ]);
      } catch (_e) {}
    }

    return { success: true, message, emailed: !!cleanEmail };
  }

  /**
   * Send dedicated Cash on Delivery (COD) Order Approved confirmation email.
   * Responsive, professional branded template confirming order approval, details,
   * item list, and delivery payment instructions.
   */
  async sendCodOrderApprovedEmail({ order, customerEmail, customerName }) {
    if (!order) {
      return { success: false, dispatched: false, error: 'Order is required.' };
    }
    const orderId = order.order_id || order.id || 'N/A';

    const cleanEmail = await this.resolveCustomerEmail({
      customerEmail,
      email: order.customer_email,
      phone: order.customer_phone,
      userId: order.user_id,
      customerId: order.customer_id,
    });

    if (!cleanEmail) {
      console.warn(`[EmailService] ⚠️ No customer email on file for COD order #${orderId}`);
      return {
        success: false,
        dispatched: false,
        error: 'No customer email address on file for this order.',
      };
    }

    const totalAmount = Number(order.grand_total || order.total_amount || 0);
    const totalFormatted = totalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const rawDate = order.created_at || order.order_date || Date.now();
    let orderDateFormatted = 'Recent';
    try {
      orderDateFormatted = new Date(rawDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_e) {}

    const resolvedName = (customerName || order.customer_name || 'Valued Customer').trim();

    // Collect purchased items
    let items = [];
    if (Array.isArray(order.items) && order.items.length > 0) {
      items = order.items;
    } else if (typeof order.items_summary === 'string' && order.items_summary) {
      items = order.items_summary.split(',').map((part) => {
        const m = part.trim().match(/^(.*?)\s*\(x(\d+)\)$/);
        return {
          name: m ? m[1] : part.trim(),
          quantity: m ? parseInt(m[2], 10) : 1,
          price: 0,
          subtotal: 0,
        };
      });
    }

    const subject = 'Your MotoTrack COD Order Has Been Approved!';
    const html = buildCodOrderApprovedEmailHtml({
      customerName: resolvedName,
      orderId,
      orderDate: orderDateFormatted,
      totalFormatted,
      items,
    });

    const itemsSummaryText = items.map((i) => `- ${i.name} (x${i.quantity || 1})`).join('\n');
    const textMessage = `Hello ${resolvedName},\n\nGood news! Your Cash on Delivery (COD) order has been approved by MotoTrack.\n\nOrder Details\n- Order Number: #${orderId}\n- Order Date: ${orderDateFormatted}\n- Payment Method: Cash on Delivery (COD)\n- Order Total: ₱${totalFormatted}\n- Order Status: Approved\n\nPurchased Products:\n${itemsSummaryText || 'Details in app'}\n\nYour order has been approved and is now being processed. We will notify you when there are further updates regarding your order.\n\nPlease prepare the payment amount upon delivery.\n\nThank you for shopping with MotoTrack!\n\nBest regards,\nMotoTrack Team`;

    console.log(`[EmailService] 📧 Dispatching COD Order Approved email for #${orderId} to ${cleanEmail}`);

    const dispatchRes = await this.dispatchHtmlEmail({
      to: cleanEmail,
      subject,
      html,
      textMessage,
    });

    if (supabase && (order.customer_id || order.user_id)) {
      try {
        await supabase.from('notifications').insert([
          {
            user_id: order.user_id || order.customer_id,
            message: `Your Cash on Delivery (COD) order #${orderId} has been approved! Total: ₱${totalFormatted}. Status: Approved.`,
            type: 'order_approved',
            status: 'unread',
          },
        ]);
      } catch (_e) {}
    }

    return {
      success: dispatchRes.success,
      dispatched: Boolean(dispatchRes.dispatched),
      error: dispatchRes.error,
      provider: dispatchRes.provider,
      recipient: cleanEmail,
    };
  }

  /**
   * Email customer when admin approves a service booking reservation.
   * Prominently informs the customer that their reservation is approved
   * and that they are required to go to the shop with their motorcycle at the scheduled time.
   */
  async sendBookingApprovalEmail({
    booking,
    bookingId,
    customerEmail,
    customerName,
    status,
    downpaymentAmount,
    paymentDeadline,
    serviceTitle,
    appointmentDate,
    timeSlot,
    branchName,
    branchAddress,
    mechanicName,
    serviceBay,
    bikeBrand,
    bikeModel,
    plateNumber,
    estimatedServiceTotal,
    remainingBalance,
  } = {}) {
    // Safely unwrap booking object if passed as an array or single object
    const b = Array.isArray(booking)
      ? booking.find((item) => item?.id === bookingId || item?.booking_id === bookingId) || booking[0] || {}
      : (booking || {});

    const id = bookingId || b?.booking_id || b?.id || 'N/A';
    const cleanEmail = await this.resolveCustomerEmail({
      email: customerEmail,
      customerEmail: customerEmail || b?.customer_email || b?.userEmail || b?.email,
      userEmail: b?.userEmail || b?.email,
      phone: b?.customer_phone || b?.phone,
      userId: b?.user_id || b?.customer_id,
      customerId: b?.customer_id || b?.user_id,
      bookingId: id,
    });

    const name = customerName || b?.customer_name || 'Rider';
    const title = serviceTitle || b?.service_title || b?.package_name || 'Service booking';
    const dateLabel =
      appointmentDate ||
      b?.appointment_date ||
      b?.preferred_date ||
      b?.date ||
      'Scheduled Date';
    const timeLabel = timeSlot || b?.time_slot || b?.preferred_time || b?.time || '09:00 AM';
    const branch = branchName || b?.branch_name || b?.branch || "D'Blockchain Motorparts & Accessories";
    const address = branchAddress || b?.branch_address || 'Central Naga Highway, Naga City, Cebu';
    const assignedTech = mechanicName || b?.mechanic || '';
    const bay = serviceBay || b?.service_bay || b?.bay_name || 'Pit Bay 02 (Express Bay)';

    const brand = bikeBrand || b?.bike_brand || '';
    const model = bikeModel || b?.bike_model || b?.motorcycle_model || b?.motorcycle || '';
    const plate = plateNumber || b?.plate_number || b?.bike_plate || b?.plate || '';
    const bikeSummary = [brand, model].filter(Boolean).join(' ') + (plate ? ` (Plate: ${plate})` : '');
    const bikeDisplay = bikeSummary || 'Your Registered Motorcycle';

    const isPaid =
      b?.downpayment_status === 'Paid' ||
      b?.downpayment_status === 'Settled' ||
      b?.downpayment_paid === true ||
      b?.deposit_paid === true ||
      Number(b?.amount_paid || 0) > 0 ||
      b?.payment_status === 'DOWNPAYMENT_PAID' ||
      b?.payment_status === 'FULLY_PAID' ||
      !b?.is_walk_in;

    const isConfirmed =
      String(status || b?.status || '').toLowerCase() === 'confirmed' ||
      String(status || b?.status || '').toLowerCase() === 'scheduled' ||
      isPaid;

    const dp = Number(downpaymentAmount ?? b?.downpayment_amount ?? b?.amount_paid ?? 0);
    const est = Number(estimatedServiceTotal ?? b?.estimated_service_total ?? b?.quoted_service_rate ?? b?.package_price ?? 0);
    const bal = Number(remainingBalance ?? b?.remaining_balance ?? (est > dp ? est - dp : 0));
    const payMethod = b?.downpayment_method || b?.payment_method || 'GCash / Online';

    const subject = `Booking #${id} Approved: Please Bring Your Motorcycle on ${dateLabel} at ${timeLabel}`;

    const html = buildBookingApprovedEmailHtml({
      customerName: name,
      bookingId: id,
      serviceTitle: title,
      appointmentDate: dateLabel,
      timeSlot: timeLabel,
      branchName: branch,
      branchAddress: address,
      mechanicName: assignedTech,
      serviceBay: bay,
      bikeBrand: brand,
      bikeModel: model,
      plateNumber: plate,
      estimatedTotal: est,
      downpaymentAmount: dp,
      downpaymentStatus: isPaid ? 'Verified' : 'Pending',
      downpaymentMethod: payMethod,
      remainingBalance: bal,
      isConfirmed,
    });

    const textMessage = `Hello ${name},

Great news! Your service booking reservation #${id} for ${title} has been APPROVED by MotoTrack.

=======================================================
REQUIRED ACTION: BRING YOUR MOTORCYCLE TO THE SHOP
=======================================================
You are required to go to the workshop with your motorcycle
at your scheduled appointment date and time:

• Scheduled Date: ${dateLabel}
• Arrival Time: ${timeLabel}
• Motorcycle: ${bikeDisplay}
• Workshop Location: ${branch} (${address})
${assignedTech ? `• Assigned Technician: ${assignedTech}\n` : ''}${bay ? `• Service Bay: ${bay}\n` : ''}
IMPORTANT INSTRUCTIONS:
1. Please arrive 10 to 15 minutes before your scheduled time (${timeLabel}).
2. Bring your motorcycle (${bikeDisplay}) and present your Booking Reference #${id} at the pit bay gate.
3. Our workshop team will mount your bike in the service bay for check-in and scheduled service.

RESERVATION SUMMARY:
• Booking Reference: #${id}
• Service: ${title}
• Status: Approved & Confirmed
${est > 0 ? `• Estimated Total: ₱${est.toLocaleString('en-PH')}\n` : ''}${dp > 0 ? `• Downpayment Verified: ₱${dp.toLocaleString('en-PH')} (${payMethod})\n` : ''}${bal > 0 ? `• Remaining Balance: ₱${bal.toLocaleString('en-PH')} (payable at counter upon completion)\n` : ''}
You can monitor your live pit bay status anytime in the MotoTrack Garage under My Appointments.

Thank you for choosing MotoTrack!

Best regards,
MotoTrack Workshop Team
${branch}`;

    console.log(`[EmailService] 📧 Booking #${id} approval email → ${cleanEmail || '(no email found)'}`);

    let dispatchResult = { success: false, emailed: false };
    if (cleanEmail) {
      dispatchResult = await this.dispatchHtmlEmail({
        to: cleanEmail,
        subject,
        html,
        textMessage,
      });
    }

    return {
      success: true,
      emailed: !!cleanEmail && dispatchResult.success,
      recipient: cleanEmail,
      dispatched: dispatchResult.dispatched,
      provider: dispatchResult.provider,
    };
  }
}

export const emailService = new EmailService();
export default emailService;
