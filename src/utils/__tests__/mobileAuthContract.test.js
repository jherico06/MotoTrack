import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Mobile Auth Contracts & Validation Logic', () => {
  test('validates login required fields', () => {
    const validateLogin = (email, password) => {
      if (!email.trim() || !password) {
        return { valid: false, error: 'Please enter your email or username and password.' };
      }
      return { valid: true };
    };

    assert.equal(validateLogin('', '').valid, false);
    assert.equal(validateLogin('alex@mototrack.com', '').valid, false);
    assert.equal(validateLogin('', 'password123').valid, false);
    assert.equal(validateLogin('alex@mototrack.com', 'password123').valid, true);
    assert.equal(validateLogin('rider_alex', 'password123').valid, true);
  });

  test('validates all 6 signup fields accurately', () => {
    const validateSignup = ({ name, email, phone, address, password, confirmPassword }) => {
      if (!name || !name.trim()) return { valid: false, error: 'Please enter your full name.' };
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return { valid: false, error: 'Please enter a valid email address.' };
      }
      if (!phone || !phone.trim() || phone.trim().length < 7) {
        return { valid: false, error: 'Please enter a valid contact phone number.' };
      }
      if (!address || !address.trim() || address.trim().length < 5) {
        return { valid: false, error: 'Please enter your complete delivery address.' };
      }
      if (!password || password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long.' };
      }
      if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match.' };
      }
      return { valid: true };
    };

    // Missing name
    assert.equal(
      validateSignup({
        name: '',
        email: 'alex@mototrack.com',
        phone: '09171234567',
        address: '123 Main St, Cebu',
        password: 'password123',
        confirmPassword: 'password123',
      }).valid,
      false
    );

    // Invalid email
    assert.equal(
      validateSignup({
        name: 'Alex Rider',
        email: 'notanemail',
        phone: '09171234567',
        address: '123 Main St, Cebu',
        password: 'password123',
        confirmPassword: 'password123',
      }).valid,
      false
    );

    // Short phone
    assert.equal(
      validateSignup({
        name: 'Alex Rider',
        email: 'alex@mototrack.com',
        phone: '123',
        address: '123 Main St, Cebu',
        password: 'password123',
        confirmPassword: 'password123',
      }).valid,
      false
    );

    // Short address
    assert.equal(
      validateSignup({
        name: 'Alex Rider',
        email: 'alex@mototrack.com',
        phone: '09171234567',
        address: 'N/A',
        password: 'password123',
        confirmPassword: 'password123',
      }).valid,
      false
    );

    // Mismatched passwords
    assert.equal(
      validateSignup({
        name: 'Alex Rider',
        email: 'alex@mototrack.com',
        phone: '09171234567',
        address: '123 Main St, Cebu City',
        password: 'password123',
        confirmPassword: 'password456',
      }).valid,
      false
    );

    // Complete valid submission
    const result = validateSignup({
      name: 'Alex Rider',
      email: 'alex@mototrack.com',
      phone: '09171234567',
      address: '123 Main St, Cebu City',
      password: 'password123',
      confirmPassword: 'password123',
    });
    assert.equal(result.valid, true);
  });
});

