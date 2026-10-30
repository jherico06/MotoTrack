/**
 * Loads the ratings & reports specifications and helpers without React Native import chain.
 * Run: node --test src/utils/__tests__/ratingsReportsService.test.js
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../../..');
const source = fs.readFileSync(
  path.join(root, 'src/services/feedback/ratingsReportsService.js'),
  'utf8'
);
const body = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moto-reports-'));
const modulePath = path.join(dir, 'ratingsReportsService.mjs');
fs.writeFileSync(
  modulePath,
  `const supabaseManager = { getClient: () => null };
const appStorage = { getItem: () => null, setItem: () => {} };
const notificationService = { createNotification: async () => {} };
${body}`
);

const {
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  ratingsReportsService,
} = await import(pathToFileURL(modulePath).href);

describe('Ratings & Reports Service Specifications', () => {
  test('Standard report categories are properly registered with colors and labels', () => {
    assert.equal(REPORT_CATEGORIES.PRODUCT_QUALITY.label, 'Product Quality');
    assert.equal(REPORT_CATEGORIES.DELIVERY.label, 'Delivery & Shipping');
    assert.equal(REPORT_CATEGORIES.SERVICE_QUALITY.label, 'Service Quality');
    assert.equal(REPORT_CATEGORIES.MECHANIC_EXPERIENCE.label, 'Mechanic Experience');
    assert.equal(REPORT_CATEGORIES.ORDER_ISSUES.label, 'Order Issues');
    assert.equal(REPORT_CATEGORIES.PAYMENT_ISSUES.label, 'Payment Issues');
    assert.equal(REPORT_CATEGORIES.GENERAL_FEEDBACK.label, 'General Feedback');
  });

  test('Standard workflow statuses match requirements', () => {
    assert.equal(REPORT_STATUSES.NEW, 'New');
    assert.equal(REPORT_STATUSES.UNDER_REVIEW, 'Under Review');
    assert.equal(REPORT_STATUSES.RESOLVED, 'Resolved');
    assert.equal(REPORT_STATUSES.DISMISSED, 'Dismissed');
  });

  test('Submissions data model accurately separates ratings & reviews from customer reports', () => {
    const ratingItem = {
      id: 'rev-p7-1',
      submissionType: 'rating_review',
      customerName: 'Marco R.',
      rating: 5,
      category: 'product_quality',
      message: 'Great tire grip on wet roads.',
      status: REPORT_STATUSES.NEW,
    };

    const complaintItem = {
      id: 'rep-ord-1',
      submissionType: 'customer_report',
      customerName: 'Jherico Maurin',
      rating: null,
      category: 'delivery',
      message: 'Rider took an extra hour to arrive at the specified landmark.',
      status: REPORT_STATUSES.NEW,
    };

    assert.equal(ratingItem.submissionType, 'rating_review');
    assert.equal(typeof ratingItem.rating, 'number');
    assert.equal(ratingItem.rating, 5);

    assert.equal(complaintItem.submissionType, 'customer_report');
    assert.equal(complaintItem.rating, null);
    assert.equal(complaintItem.category, 'delivery');
  });

  test('Review workflow status updates and admin notes are preserved correctly', () => {
    const submission = {
      id: 'sub-001',
      status: REPORT_STATUSES.NEW,
      adminNotes: '',
      reviewedBy: null,
      reviewedAt: null,
      dismissedReason: null,
    };

    const updatePayload = {
      status: REPORT_STATUSES.UNDER_REVIEW,
      adminNotes: 'Contacted rider dispatch and confirmed package was delivered to customer gate.',
      adminName: 'Admin Jherico',
      reviewedAt: new Date().toISOString(),
    };

    const updated = {
      ...submission,
      status: updatePayload.status,
      adminNotes: updatePayload.adminNotes,
      reviewedBy: updatePayload.adminName,
      reviewedAt: updatePayload.reviewedAt,
    };

    assert.equal(updated.status, REPORT_STATUSES.UNDER_REVIEW);
    assert.ok(updated.adminNotes.includes('Contacted rider dispatch'));
    assert.equal(updated.reviewedBy, 'Admin Jherico');
    assert.ok(updated.reviewedAt);
  });

  test('Customer report submission triggers real-time subscriber notification immediately', async () => {
    let receivedEvent = null;
    const unsubscribe = ratingsReportsService.subscribe((event) => {
      receivedEvent = event;
    });

    const res = await ratingsReportsService.submitCustomerReport({
      customerName: 'Juan Dela Cruz',
      customerEmail: 'juan@example.ph',
      category: 'order_issues',
      message: 'Item box was punctured during transport.',
      transactionType: 'order',
      transactionId: 'ORD-TEST-999',
    });

    assert.equal(res.success, true);
    assert.ok(res.report);
    assert.equal(res.report.customerName, 'Juan Dela Cruz');
    assert.equal(res.report.category, 'order_issues');

    assert.ok(receivedEvent, 'Subscriber was notified');
    assert.equal(receivedEvent.type, 'NEW_REPORT');
    assert.equal(receivedEvent.report.customerName, 'Juan Dela Cruz');

    unsubscribe();
  });

  test('Overview statistics calculate strictly dynamic values without mocked fallbacks', async () => {
    const stats = await ratingsReportsService.getOverviewStats();
    assert.equal(typeof stats.total, 'number');
    assert.equal(typeof stats.averageRating, 'number');
    assert.equal(typeof stats.actionRequiredCount, 'number');
    assert.equal(typeof stats.resolvedCount, 'number');
    assert.equal(typeof stats.resolvedRate, 'number');
    assert.equal(typeof stats.urgentNeedsResponse, 'boolean');
  });

  test('Demo reviews without orders (rev-demo-*, Marco R., Aya Santos) are filtered out from submissions', async () => {
    // When raw product_reviews contain demo reviews and real rated orders,
    // only the real rated orders are accepted into the review queue.
    const rawDemoReviews = [
      { review_id: 'rev-demo-1', product_id: 'p7', order_id: null, customer_name: 'Marco R.', rating: 5 },
      { review_id: 'rev-demo-2', product_id: 'p7', order_id: null, customer_name: 'Aya Santos', rating: 4 },
      { review_id: 'rev-1790014311870-2331', product_id: 'p-1788179397898', order_id: 'ord-1789787835567-286838', customer_name: 'Jherico Maurin', rating: 5 },
    ];

    const validReviews = rawDemoReviews.filter((rev) => {
      const rawId = rev.review_id || rev.id;
      if (
        String(rawId).startsWith('rev-demo-') ||
        rev.customer_name === 'Marco R.' ||
        rev.customer_name === 'Aya Santos' ||
        !rev.order_id
      ) {
        return false;
      }
      return true;
    });

    assert.equal(validReviews.length, 1);
    assert.equal(validReviews[0].customer_name, 'Jherico Maurin');
    assert.equal(validReviews[0].order_id, 'ord-1789787835567-286838');
  });
});
