import crypto from 'crypto';

const PASSWORD_HASH_PREFIX = 'sha256$';

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

/** Match client hashPassword(password, emailSalt) format: sha256$email:password */
export function hashPassword(password, salt = '') {
  const input = salt ? `${String(salt).toLowerCase()}:${password}` : String(password);
  return `${PASSWORD_HASH_PREFIX}${sha256Hex(input)}`;
}

export function hashOtp(otpCode, email = '') {
  return sha256Hex(`${String(email).toLowerCase()}:${String(otpCode).trim()}`);
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Cryptographically strong temporary password.
 * Example shape: M7!qR2@vL9#xP4
 */
export function generateStrongPassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const picks = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  for (let i = picks.length; i < length; i += 1) {
    picks.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }

  return picks.join('');
}

export function generateUserId(role) {
  const prefix = role === 'rider' ? 'usr-rider-' : role === 'mechanic' ? 'usr-mech-' : 'usr-';
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export function generateUsername(email, role) {
  const local = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 18);
  const suffix = crypto.randomBytes(2).toString('hex');
  const roleTag = role === 'mechanic' ? 'm' : 'r';
  return `${local || roleTag}${roleTag}${suffix}`.slice(0, 24);
}
