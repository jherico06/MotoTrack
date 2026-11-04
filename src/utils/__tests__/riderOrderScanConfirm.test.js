import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDeliveryQrPayload,
  normalizeOrderIdentifier,
  classifyOrderIdentifier,
  sameOrderIdentifier,
} from '../orderIdentifier.js';

describe('Rider Order QR Scan & Confirmation Verification', () => {
  it('parses various order QR formats including public, legacy, tracking, and deep links', () => {
    // 1. Standard public order format
    const res1 = parseDeliveryQrPayload('ORD-ON-2026-00001');
    assert.equal(res1.kind, 'order_id');
    assert.equal(res1.orderId, 'ORD-ON-2026-00001');

    // 2. Short / general order format
    const res2 = parseDeliveryQrPayload('ORD-12345');
    assert.equal(res2.kind, 'order_id');
    assert.equal(res2.orderId, 'ORD-12345');

    // 3. Leading hash format (from UI copy/display)
    const res3 = parseDeliveryQrPayload('#ORD-POS-2026-00042');
    assert.equal(res3.kind, 'order_id');
    assert.equal(res3.orderId, 'ORD-POS-2026-00042');

    // 4. Barcode tracking format
    const res4 = parseDeliveryQrPayload('MT00012345PH');
    assert.equal(res4.kind, 'order_id');
    assert.equal(res4.orderId, 'MT00012345PH');

    // 5. Deep link with token
    const res5 = parseDeliveryQrPayload(
      'https://mototrack.app/?screen=confirm-delivery&token=3b07384d113edec49eaa6238ad5ff001'
    );
    assert.equal(res5.kind, 'url');
    assert.equal(res5.token, '3b07384d113edec49eaa6238ad5ff001');

    // 6. Deep link with orderId
    const res6 = parseDeliveryQrPayload(
      'https://mototrack.app/?orderId=ORD-ON-2026-00001'
    );
    assert.equal(res6.kind, 'url');
    assert.equal(res6.orderId, 'ORD-ON-2026-00001');

    // 7. Expo deep link with orderId
    const res7 = parseDeliveryQrPayload(
      'exp://192.168.1.100:8081/?orderId=ORD-ON-2026-00001'
    );
    assert.equal(res7.kind, 'url');
    assert.equal(res7.orderId, 'ORD-ON-2026-00001');

    // 8. Custom app scheme with URL path
    const res8 = parseDeliveryQrPayload('mototrack://orders/ORD-ON-2026-00001');
    assert.equal(res8.kind, 'url');
    assert.equal(res8.orderId, 'ORD-ON-2026-00001');

    // 9. JSON payload with id
    const res9 = parseDeliveryQrPayload(JSON.stringify({ id: 'ORD-ON-2026-00001' }));
    assert.equal(res9.kind, 'json');
    assert.equal(res9.orderId, 'ORD-ON-2026-00001');

    // 10. Raw hex token
    const res10 = parseDeliveryQrPayload('3b07384d113edec49eaa6238ad5ff001');
    assert.equal(res10.kind, 'token');
    assert.equal(res10.token, '3b07384d113edec49eaa6238ad5ff001');
  });

  it('correctly matches order identifiers regardless of prefix case, hash, or whitespace', () => {
    assert.equal(sameOrderIdentifier('ORD-ON-2026-00001', 'ord-on-2026-00001'), true);
    assert.equal(sameOrderIdentifier('#ORD-12345', 'ord-12345'), true);
    assert.equal(sameOrderIdentifier(' ORD-2026-001 ', 'ORD-2026-001'), true);
    assert.equal(sameOrderIdentifier('ORD-1', 'ORD-2'), false);
    // Suffix match for 5-digit number
    assert.equal(sameOrderIdentifier('ORD-ON-2026-00001', '00001'), true);
  });

  it('separates delivered orders and need confirmation orders appropriately', () => {
    const mockDeliveries = [
      { orderId: 'ORD-1', deliveryStatus: 'Assigned' },
      { orderId: 'ORD-2', deliveryStatus: 'Out for Delivery' },
      { orderId: 'ORD-3', deliveryStatus: 'Delivered', deliveredAt: '2026-11-01T10:00:00Z' },
      { orderId: 'ORD-4', deliveryStatus: 'Reported' },
      { orderId: 'ORD-5', deliveryStatus: 'Ready for Delivery' },
      { orderId: 'ORD-6', deliveryStatus: 'delivered', deliveredAt: '2026-10-31T15:30:00Z' },
    ];

    const isDelivered = (d) => String(d.deliveryStatus || '').toLowerCase() === 'delivered';
    const needConfirmation = mockDeliveries.filter((d) => !isDelivered(d));
    const delivered = mockDeliveries.filter((d) => isDelivered(d));

    assert.equal(needConfirmation.length, 4);
    assert.equal(delivered.length, 2);

    assert.deepEqual(
      needConfirmation.map((d) => d.orderId),
      ['ORD-1', 'ORD-2', 'ORD-4', 'ORD-5']
    );
    assert.deepEqual(
      delivered.map((d) => d.orderId),
      ['ORD-3', 'ORD-6']
    );
  });
});
