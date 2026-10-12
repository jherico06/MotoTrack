import {
  classifyOrderIdentifier,
  normalizeOrderIdentifier,
  parseDeliveryQrPayload,
  sameOrderIdentifier,
} from '../src/utils/orderIdentifier.js';
import { describeRiderDeliveryDate } from '../src/utils/deliveryDate.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const publicId = normalizeOrderIdentifier('  #ord-on-2026-00001 ');
assert(publicId === 'ORD-ON-2026-00001', `public normalize failed: ${publicId}`);
assert(classifyOrderIdentifier(publicId) === 'public', 'public class');
assert(sameOrderIdentifier('ord-on-2026-00001', 'ORD-ON-2026-00001'), 'public case');
assert(!sameOrderIdentifier('ORD-ON-2026-00001', 'ORD-ON-2026-00002'), 'public must not fuzzy-match');
assert(!sameOrderIdentifier('ORD-ON-2026-00001', 'ord-1790494419563-999463'), 'different orders stay different');

const legacy = normalizeOrderIdentifier('ORD-1790494419563-999463');
assert(legacy === 'ord-1790494419563-999463', `legacy normalize failed: ${legacy}`);
assert(sameOrderIdentifier(legacy, 'ord-1790494419563-999463'), 'legacy case');

const uuid = normalizeOrderIdentifier('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11');
assert(uuid === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'uuid lower');
assert(classifyOrderIdentifier(uuid) === 'uuid', 'uuid class');

const url = parseDeliveryQrPayload(
  'https://mototrack.local/?screen=confirm-delivery&token=AbCDef0123456789abcdef0123456789'
);
assert(url.kind === 'url' && url.token === 'AbCDef0123456789abcdef0123456789', 'url token');
assert(!url.orderId, 'url without order id');

const json = parseDeliveryQrPayload('{"order_id":"ord-on-2026-00001","token":"abc123tokenvalue"}');
assert(json.kind === 'json', 'json kind');
assert(json.orderId === 'ORD-ON-2026-00001', 'json order id');
assert(json.token === 'abc123tokenvalue', 'json token');

const bare = parseDeliveryQrPayload('ORD-ON-2026-00001');
assert(bare.kind === 'order_id' && bare.orderId === 'ORD-ON-2026-00001', 'bare public id');

const junk = parseDeliveryQrPayload('this is not a delivery qr');
assert(junk.kind === 'invalid' && !junk.orderId && !junk.token, 'invalid qr');

const embedded = parseDeliveryQrPayload('note ORD-ON-2026-00001 extra');
assert(embedded.kind === 'invalid', 'no contains() match');

const noon = new Date(2026, 9, 1, 12, 0, 0);
const today = new Date(2026, 9, 4, 15, 0, 0);
const overdue = describeRiderDeliveryDate(noon, null, today);
assert(overdue.tone === 'overdue', `expected overdue, got ${overdue?.tone}`);
assert(!overdue.timeLabel, 'date-only noon must not invent a clock time');
assert(overdue.dateLabel.includes('October'), overdue.dateLabel);

const tomorrow = describeRiderDeliveryDate(new Date(2026, 9, 5, 12, 0, 0), null, today);
assert(tomorrow.tone === 'tomorrow' && tomorrow.title === 'Tomorrow', 'tomorrow label');

const timed = describeRiderDeliveryDate(
  new Date(2026, 9, 4, 14, 0, 0),
  new Date(2026, 9, 4, 16, 0, 0),
  today
);
assert(timed.tone === 'today', 'today window');
assert(timed.timeLabel && timed.timeLabel.includes('–'), `scheduled time missing: ${timed.timeLabel}`);

console.log('qr identifier checks passed');
