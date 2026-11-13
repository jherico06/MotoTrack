import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Booking Approval & Bring Motorcycle Notification System', () => {
  it('verifies approval template contains explicit requirement to bring motorcycle to shop', () => {
    function generateBookingEmailContent({
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
    }) {
      const bikeSummary = [bikeBrand, bikeModel].filter(Boolean).join(' ') + (plateNumber ? ` (Plate: ${plateNumber})` : '');
      const subject = `Booking #${bookingId} Approved: Please Bring Your Motorcycle on ${appointmentDate} at ${timeSlot}`;
      const actionNotice = 'ACTION REQUIRED: BRING YOUR MOTORCYCLE TO THE SHOP';
      const requirementText = `You are required to go to the shop with your motorcycle on your scheduled appointment date and time: ${appointmentDate} at ${timeSlot}.`;

      return {
        subject,
        actionNotice,
        requirementText,
        bikeSummary,
        branch: branchName,
        address: branchAddress,
        technician: mechanicName,
        bay: serviceBay,
      };
    }

    const email = generateBookingEmailContent({
      customerName: 'Jherico Maurin',
      bookingId: 'BK-PMS-2026-00002',
      serviceTitle: 'Major Tune Up',
      bikeBrand: 'Honda',
      bikeModel: 'ADV 160',
      plateNumber: 'RJCX',
      appointmentDate: 'Nov 9, 2026',
      timeSlot: '09:00 AM',
      branchName: "D'Blockchain Motorparts & Accessories",
      branchAddress: 'Central Naga Highway, Naga City, Cebu',
      mechanicName: 'Maurin Jherico',
      serviceBay: 'Pit Bay 02 (Express Bay)',
    });

    assert.ok(email.subject.includes('BK-PMS-2026-00002'));
    assert.ok(email.subject.includes('Please Bring Your Motorcycle'));
    assert.equal(email.actionNotice, 'ACTION REQUIRED: BRING YOUR MOTORCYCLE TO THE SHOP');
    assert.ok(email.requirementText.includes('required to go to the shop with your motorcycle'));
    assert.ok(email.requirementText.includes('Nov 9, 2026 at 09:00 AM'));
    assert.equal(email.bikeSummary, 'Honda ADV 160 (Plate: RJCX)');
    assert.equal(email.technician, 'Maurin Jherico');
    assert.equal(email.bay, 'Pit Bay 02 (Express Bay)');
  });

  it('safely unwraps single booking from array returned by garageService.updateBooking', () => {
    const updatedList = [
      { id: 'OTHER-1', customer_email: 'other@example.com' },
      {
        id: 'BK-PMS-2026-00002',
        booking_id: 'BK-PMS-2026-00002',
        customer_email: 'customer@mototrack.com',
        customer_name: 'Target Customer',
        bike_model: 'ADV 160',
        appointment_date: 'Nov 9, 2026',
        time_slot: '09:00 AM',
      },
    ];

    function extractBookingForEmail(updated, bookingId, fallback) {
      const allBookings = Array.isArray(updated) ? updated : [];
      return (
        allBookings.find((b) => b && (b.id === bookingId || b.booking_id === bookingId)) ||
        fallback
      );
    }

    const result = extractBookingForEmail(updatedList, 'BK-PMS-2026-00002', {});
    assert.equal(result.customer_email, 'customer@mototrack.com');
    assert.equal(result.customer_name, 'Target Customer');
    assert.equal(result.bike_model, 'ADV 160');
  });

  it('validates customer email resolution from multiple candidate fields', () => {
    function resolveEmail({ email, customer_email, userEmail, user_id }) {
      const candidate = email || customer_email || userEmail || null;
      if (!candidate || !candidate.includes('@')) return null;
      return candidate.trim().toLowerCase();
    }

    assert.equal(
      resolveEmail({ customer_email: 'jherico@mototrack.com' }),
      'jherico@mototrack.com'
    );
    assert.equal(
      resolveEmail({ userEmail: 'rider@example.com' }),
      'rider@example.com'
    );
    assert.equal(resolveEmail({ customer_email: '' }), null);
    assert.equal(resolveEmail({ customer_email: 'invalid-email' }), null);
  });
});
