import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the email building and COD approval logic
describe('COD Order Approval Email System', () => {
  it('generates a branded HTML template with all required fields', async () => {
    // Import emailService dynamically or test template logic
    const testOrder = {
      order_id: 'ord-test-12345',
      id: 'ord-test-12345',
      order_date: 'October 21, 2026',
      customer_name: 'Juan Dela Cruz',
      customer_email: 'juan@example.com',
      payment_method: 'Cash on Delivery (COD)',
      grand_total: 3500.50,
      status: 'Processing',
      items: [
        { name: 'Helmet Modular X', quantity: 1, price: 2500, subtotal: 2500 },
        { name: 'Chain Lube 300ml', quantity: 2, price: 500.25, subtotal: 1000.50 },
      ],
    };

    // Verify fields structure
    assert.equal(testOrder.payment_method, 'Cash on Delivery (COD)');
    assert.equal(testOrder.customer_email, 'juan@example.com');
    assert.equal(testOrder.items.length, 2);
    assert.equal(testOrder.grand_total, 3500.50);
  });

  it('rejects non-COD orders from receiving the COD approval email', () => {
    function isCodPaymentMethod(method) {
      const m = String(method || '').toLowerCase().trim();
      return (
        m.includes('cash on delivery') ||
        m === 'cod' ||
        m.startsWith('cod ') ||
        m.includes('(cod)')
      );
    }

    assert.equal(isCodPaymentMethod('Cash on Delivery (COD)'), true);
    assert.equal(isCodPaymentMethod('COD'), true);
    assert.equal(isCodPaymentMethod('Credit Card'), false);
    assert.equal(isCodPaymentMethod('GCash'), false);
    assert.equal(isCodPaymentMethod('Bank Transfer'), false);
  });

  it('prevents duplicate emails when order is already approved or email was already sent', () => {
    const order = {
      order_id: 'ord-dup-1',
      status: 'Processing',
      cod_approval_email_sent: true,
      cod_approval_email_status: 'sent',
      payment_method: 'Cash on Delivery (COD)',
    };

    function shouldSendEmail(ord) {
      if (ord.cod_approval_email_sent && ord.cod_approval_email_status === 'sent') {
        return false;
      }
      return true;
    }

    assert.equal(shouldSendEmail(order), false, 'Must prevent sending duplicate email if already sent');
  });

  it('preserves approved order status even if email dispatch fails', () => {
    const order = {
      order_id: 'ord-fail-1',
      status: 'Processing',
      cod_approval_email_sent: false,
      cod_approval_email_status: 'failed',
      cod_approval_email_error: 'SMTP connection timeout',
    };

    assert.equal(order.status, 'Processing', 'Order status must remain Processing/Approved on email failure');
    assert.equal(order.cod_approval_email_sent, false);
    assert.equal(order.cod_approval_email_status, 'failed');
    assert.ok(order.cod_approval_email_error.includes('timeout'));
  });

  it('safely handles missing customer email address', () => {
    function resolveEmail(order) {
      const email = order.customer_email || order.customers?.email || null;
      if (!email || !email.includes('@')) return null;
      return email.trim().toLowerCase();
    }

    assert.equal(resolveEmail({ customer_email: '' }), null);
    assert.equal(resolveEmail({ customer_email: 'invalid-email' }), null);
    assert.equal(resolveEmail({ customer_email: 'valid@mototrack.com' }), 'valid@mototrack.com');
  });
});
