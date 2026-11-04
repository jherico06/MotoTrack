import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  sameOrderIdentifier,
  normalizeOrderIdentifier,
} from '../orderIdentifier.js';

// Load orderService, orderWorkflow, and deliveryService without React Native native module bindings
const root = path.resolve(import.meta.dirname, '../../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moto-sync-test-'));

const orderSource = fs.readFileSync(path.join(root, 'src/services/orders/orderService.js'), 'utf8');
const orderBody = orderSource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
const orderModulePath = path.join(dir, 'orderServiceMock.mjs');
fs.writeFileSync(
  orderModulePath,
  `const appStorage = { getItem: () => null, setItem: () => {} };
const supabaseManager = { getClient: () => null };
const emailService = {};
const productService = {};
const promoService = {};
const notificationService = {};
const auditLogService = {};
const getSizePrice = () => 0;
${orderBody}`
);

const {
  ORDER_STATUSES,
  canonicalizeStatus,
  assertStatusTransition,
} = await import(pathToFileURL(orderModulePath).href);

const workflowSource = fs.readFileSync(path.join(root, 'src/utils/orderWorkflow.js'), 'utf8');
const workflowBody = workflowSource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
const workflowModulePath = path.join(dir, 'orderWorkflowMock.mjs');
fs.writeFileSync(
  workflowModulePath,
  `import { ORDER_STATUSES, canonicalizeStatus } from './orderServiceMock.mjs';
const isCodPaymentMethod = () => false;
${workflowBody}`
);

const {
  getStatusTone,
  getStatusExplanation,
  getStepStates,
} = await import(pathToFileURL(workflowModulePath).href);

const deliverySource = fs.readFileSync(path.join(root, 'src/services/delivery/deliveryService.js'), 'utf8');
const deliveryBody = deliverySource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
const deliveryModulePath = path.join(dir, 'deliveryServiceMock.mjs');
fs.writeFileSync(
  deliveryModulePath,
  `const appStorage = { getItem: () => null, setItem: () => {} };
const supabaseManager = { getClient: () => null };
const orderService = {};
const notificationService = {};
const auditLogService = {};
const riderService = {};
const RIDER_STATUSES = {};
const generateSecureToken = () => '';
const hashDeliveryToken = () => '';
const normalizeTokenHash = () => '';
const buildDeliveryConfirmUrl = () => '';
const qrImageUrlForLink = () => '';
const makePhoneReachableConfirmBundle = () => ({});
const dateInputToIso = () => '';
const expectedDeliveryStatusText = () => '';
const classifyOrderIdentifier = () => ({});
const normalizeOrderIdentifier = (s) => s;
const parseDeliveryQrPayload = () => ({});
const sameOrderIdentifier = () => true;
const riderAccessService = {};
const geocodeAddress = () => null;
const resolveImageForDatabase = () => '';
const deliveryLocationService = {};
${deliveryBody}`
);

const {
  DELIVERY_STATUSES,
} = await import(pathToFileURL(deliveryModulePath).href);

describe('Rider Order Confirmation & Status Synchronization Workflow', () => {
  it('canonicalizes all standardized order statuses correctly', () => {
    assert.equal(canonicalizeStatus('Pending'), ORDER_STATUSES.PENDING_APPROVAL);
    assert.equal(canonicalizeStatus('Pending Approval'), ORDER_STATUSES.PENDING_APPROVAL);
    assert.equal(canonicalizeStatus('confirmed'), ORDER_STATUSES.PENDING_APPROVAL);
    assert.equal(canonicalizeStatus('Processing'), ORDER_STATUSES.PROCESSING);
    assert.equal(canonicalizeStatus('Ready for Delivery'), ORDER_STATUSES.READY);
    assert.equal(canonicalizeStatus('ready'), ORDER_STATUSES.READY);
    assert.equal(canonicalizeStatus('Assigned to Rider'), ORDER_STATUSES.ASSIGNED);
    assert.equal(canonicalizeStatus('assigned'), ORDER_STATUSES.ASSIGNED);
    assert.equal(canonicalizeStatus('Accepted by Rider'), ORDER_STATUSES.ACCEPTED);
    assert.equal(canonicalizeStatus('accepted'), ORDER_STATUSES.ACCEPTED);
    assert.equal(canonicalizeStatus('Out for Delivery'), ORDER_STATUSES.OUT);
    assert.equal(canonicalizeStatus('shipped'), ORDER_STATUSES.OUT);
    assert.equal(canonicalizeStatus('Delivered'), ORDER_STATUSES.DELIVERED);
    assert.equal(canonicalizeStatus('Delivery Failed'), ORDER_STATUSES.FAILED);
    assert.equal(canonicalizeStatus('Delivery Issue'), ORDER_STATUSES.FAILED);
    assert.equal(canonicalizeStatus('Cancelled'), ORDER_STATUSES.CANCELLED);
  });

  it('verifies delivery statuses are defined properly', () => {
    assert.equal(DELIVERY_STATUSES.ASSIGNED, 'Assigned to Rider');
    assert.equal(DELIVERY_STATUSES.ACCEPTED, 'Accepted by Rider');
    assert.equal(DELIVERY_STATUSES.OUT, 'Out for Delivery');
    assert.equal(DELIVERY_STATUSES.DELIVERED, 'Delivered');
  });

  it('validates authorized order status transitions through the full delivery lifecycle', () => {
    // 1. Pending Approval -> Processing (Admin approves order)
    const t1 = assertStatusTransition(ORDER_STATUSES.PENDING_APPROVAL, ORDER_STATUSES.PROCESSING);
    assert.equal(t1.ok, true);

    // 2. Processing -> Ready for Delivery (Store packs items)
    const t2 = assertStatusTransition(ORDER_STATUSES.PROCESSING, ORDER_STATUSES.READY);
    assert.equal(t2.ok, true);

    // 3. Ready for Delivery -> Assigned to Rider (Admin assigns a rider)
    const t3 = assertStatusTransition(ORDER_STATUSES.READY, ORDER_STATUSES.ASSIGNED);
    assert.equal(t3.ok, true);

    // 4. Assigned to Rider -> Accepted by Rider (Rider confirms order acceptance)
    const t4 = assertStatusTransition(ORDER_STATUSES.ASSIGNED, ORDER_STATUSES.ACCEPTED);
    assert.equal(t4.ok, true);

    // 5. Accepted by Rider -> Out for Delivery (Rider starts delivery route)
    const t5 = assertStatusTransition(ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.OUT);
    assert.equal(t5.ok, true);

    // 6. Out for Delivery -> Delivered (Rider confirms delivery completed)
    const t6 = assertStatusTransition(ORDER_STATUSES.OUT, ORDER_STATUSES.DELIVERED, { riderConfirm: true });
    assert.equal(t6.ok, true);

    // 7. Alternative: Out for Delivery -> Delivery Failed (Customer unavailable)
    const t7 = assertStatusTransition(ORDER_STATUSES.OUT, ORDER_STATUSES.FAILED);
    assert.equal(t7.ok, true);

    // 8. Delivery Failed -> Rescheduled
    const t8 = assertStatusTransition(ORDER_STATUSES.FAILED, ORDER_STATUSES.RESCHEDULED);
    assert.equal(t8.ok, true);

    // 9. Rescheduled -> Assigned to Rider
    const t9 = assertStatusTransition(ORDER_STATUSES.RESCHEDULED, ORDER_STATUSES.ASSIGNED);
    assert.equal(t9.ok, true);
  });

  it('blocks unauthorized status jumps and invalid transitions', () => {
    // Cannot jump from Pending directly to Delivered
    const bad1 = assertStatusTransition(ORDER_STATUSES.PENDING_APPROVAL, ORDER_STATUSES.DELIVERED);
    assert.equal(bad1.ok, false);

    // Cannot jump from Cancelled to Out for Delivery
    const bad2 = assertStatusTransition(ORDER_STATUSES.CANCELLED, ORDER_STATUSES.OUT);
    assert.equal(bad2.ok, false);

    // Cannot mark Delivered from Out for Delivery without allowDelivered or riderConfirm
    const bad3 = assertStatusTransition(ORDER_STATUSES.OUT, ORDER_STATUSES.DELIVERED);
    assert.equal(bad3.ok, false);
  });

  it('verifies rider assignment matching to prevent unauthorized confirmation', () => {
    const assignedOrder = {
      orderId: 'ORD-ON-2026-00010',
      riderId: 'rider-juan',
      status: 'Assigned to Rider',
    };

    const isRiderAuthorized = (order, callerRiderId) => {
      if (!callerRiderId || !order?.riderId) return false;
      return sameOrderIdentifier(order.riderId, callerRiderId);
    };

    // Authorized rider
    assert.equal(isRiderAuthorized(assignedOrder, 'rider-juan'), true);

    // Unauthorized rider
    assert.equal(isRiderAuthorized(assignedOrder, 'rider-carlo'), false);
    assert.equal(isRiderAuthorized(assignedOrder, 'rider-maria'), false);
    assert.equal(isRiderAuthorized(assignedOrder, null), false);
    assert.equal(isRiderAuthorized(assignedOrder, ''), false);
  });

  it('provides appropriate tone, explanation and step highlights for Assigned and Accepted statuses', () => {
    const toneAssigned = getStatusTone(ORDER_STATUSES.ASSIGNED);
    assert.ok(toneAssigned.bg);
    assert.ok(toneAssigned.color);

    const toneAccepted = getStatusTone(ORDER_STATUSES.ACCEPTED);
    assert.ok(toneAccepted.bg);
    assert.ok(toneAccepted.color);

    const expAssigned = getStatusExplanation(ORDER_STATUSES.ASSIGNED);
    assert.ok(expAssigned.includes('rider'));

    const expAccepted = getStatusExplanation(ORDER_STATUSES.ACCEPTED);
    assert.ok(expAccepted.includes('accepted') || expAccepted.includes('confirmed'));

    // Steps highlights
    const stepsAssigned = getStepStates(ORDER_STATUSES.ASSIGNED);
    assert.equal(stepsAssigned.length, 6);
    // Ready step (index 2) should be current
    assert.equal(stepsAssigned[2].state, 'current');
    assert.equal(stepsAssigned[0].state, 'done');
    assert.equal(stepsAssigned[1].state, 'done');
  });
});
