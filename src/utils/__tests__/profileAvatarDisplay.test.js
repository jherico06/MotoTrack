import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Profile Avatar Resolution & Web Display Logic', () => {
  const MAX_IMAGE_MB = 1;
  const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

  function estimateDataUriBytes(uri) {
    const raw = String(uri || '');
    if (!raw) return 0;
    if (raw.startsWith('data:')) {
      const comma = raw.indexOf(',');
      if (comma < 0) return 0;
      const b64 = raw.slice(comma + 1);
      return Math.floor((b64.length * 3) / 4);
    }
    return 0;
  }

  function isImageTooLarge(bytes) {
    const n = Number(bytes || 0);
    return Number.isFinite(n) && n > MAX_IMAGE_BYTES;
  }

  // Standardized avatar resolution across Web components (UserProfileButton, UserProfileDropdown, ProfilePage)
  function resolveUserAvatar(user) {
    const raw =
      user?.avatar ||
      user?.photoUri ||
      user?.photoURL ||
      user?.avatar_url ||
      null;

    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  }

  function resolveRiderAvatar(riderProfile, currentUser) {
    return riderProfile?.avatar || currentUser?.avatar || currentUser?.photoUri || '';
  }

  test('resolves avatar from direct avatar property including Unsplash presets', () => {
    const user = {
      name: 'Jherico Maurin',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    };
    assert.equal(resolveUserAvatar(user), user.avatar);
  });

  test('resolves avatar from admin seeded preset (photo-1534528741775)', () => {
    const adminUser = {
      name: 'MotoTrack Administrator',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };
    assert.equal(resolveUserAvatar(adminUser), adminUser.avatar);
  });

  test('resolves avatar from Google Auth metadata fallbacks (photoUri, photoURL, avatar_url)', () => {
    const googleUser1 = {
      name: 'Google Rider',
      photoUri: 'https://lh3.googleusercontent.com/a/ACg8ocL...',
    };
    assert.equal(resolveUserAvatar(googleUser1), googleUser1.photoUri);

    const googleUser2 = {
      name: 'Google Rider 2',
      photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocM...',
    };
    assert.equal(resolveUserAvatar(googleUser2), googleUser2.photoURL);

    const googleUser3 = {
      name: 'Google Rider 3',
      avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocN...',
    };
    assert.equal(resolveUserAvatar(googleUser3), googleUser3.avatar_url);
  });

  test('resolves data URL and blob URIs correctly', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    assert.equal(resolveUserAvatar({ avatar: dataUri }), dataUri);

    const blobUri = 'blob:http://localhost:8081/abc-123';
    assert.equal(resolveUserAvatar({ avatar: blobUri }), blobUri);
  });

  test('returns null for empty, whitespace, or missing avatar fields to trigger placeholder icon', () => {
    assert.equal(resolveUserAvatar(null), null);
    assert.equal(resolveUserAvatar({}), null);
    assert.equal(resolveUserAvatar({ avatar: '' }), null);
    assert.equal(resolveUserAvatar({ avatar: '   ' }), null);
    assert.equal(resolveUserAvatar({ avatar: null, photoUri: undefined }), null);
  });

  test('rider avatar resolution falls back seamlessly to currentUser avatar', () => {
    const riderProfileWithoutAvatar = {
      id: 'rider-juan',
      name: 'Juan Dela Cruz',
      avatar: '',
    };
    const currentUserWithAvatar = {
      name: 'Juan Dela Cruz',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    };

    assert.equal(
      resolveRiderAvatar(riderProfileWithoutAvatar, currentUserWithAvatar),
      currentUserWithAvatar.avatar
    );
  });

  test('validates image byte size estimation and boundary check', () => {
    // 100 bytes of base64
    const sampleB64 = 'data:image/jpeg;base64,' + 'A'.repeat(100);
    const bytes = estimateDataUriBytes(sampleB64);
    assert.equal(bytes, 75);
    assert.equal(isImageTooLarge(bytes), false);

    // Over 1MB (MAX_IMAGE_BYTES)
    const overLimitBytes = MAX_IMAGE_BYTES + 1;
    assert.equal(isImageTooLarge(overLimitBytes), true);
  });
});
