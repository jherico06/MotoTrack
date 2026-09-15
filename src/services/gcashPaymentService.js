// ─── GCASH PAYMENT GATEWAY SERVICE (SANDBOX / TEST MODE) ─────────────────────
import { appStorage } from './storageAdapter';
import { supabase } from './supabaseClient';

export const GCASH_CONFIG = {
  ENVIRONMENT: 'sandbox', // 'sandbox' | 'production'
  TEST_PUBLIC_KEY: 'pk_test_mototrack_gcash_9841028a7b',
  TEST_SECRET_KEY: 'sk_test_mototrack_gcash_3891042c9d',
  MERCHANT_NAME: 'MotoTrack Official PH',
  MERCHANT_ID: 'MID-MOTOTRACK-NAGA-2026',
  MERCHANT_MOBILE: '0917-582-9410',
  DEFAULT_TEST_OTP: '123456',
  DEFAULT_TEST_MPIN: '1234',
  SANDBOX_WALLET_BALANCE: 150000.0,
};

const STORAGE_KEYS = {
  GCASH_WALLET: 'mototrack_gcash_test_wallet',
  GCASH_TRANSACTIONS: 'mototrack_gcash_test_txns',
};

class GCashPaymentService {
  constructor() {
    this.initWallet();
  }

  initWallet() {
    try {
      const balance = appStorage.getItem(STORAGE_KEYS.GCASH_WALLET);
      if (!balance) {
        appStorage.setItem(STORAGE_KEYS.GCASH_WALLET, String(GCASH_CONFIG.SANDBOX_WALLET_BALANCE));
      }
    } catch (e) {}
  }

  /**
   * Get Current Sandbox GCash Wallet Balance
   */
  getWalletBalance() {
    try {
      const balance = appStorage.getItem(STORAGE_KEYS.GCASH_WALLET);
      return balance ? parseFloat(balance) : GCASH_CONFIG.SANDBOX_WALLET_BALANCE;
    } catch (e) {
      return GCASH_CONFIG.SANDBOX_WALLET_BALANCE;
    }
  }

  /**
   * Generate Authentic Philippine GCash Reference Number
   */
  generateReferenceNumber() {
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `MP-GCASH-${timestamp}${rand}`;
  }

  /**
   * Create GCash Payment Intent / Source (PayMongo / GCash Sandbox API standard)
   */
  async createPaymentIntent({ amount, description, customerName, customerEmail, customerPhone }) {
    const sourceId = `src_gcash_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const referenceNumber = this.generateReferenceNumber();

    const intent = {
      id: sourceId,
      reference_number: referenceNumber,
      amount: parseFloat(amount),
      currency: 'PHP',
      status: 'pending',
      description: description || 'MotoTrack High Performance Motorcycle Gear & Parts',
      merchant: {
        name: GCASH_CONFIG.MERCHANT_NAME,
        id: GCASH_CONFIG.MERCHANT_ID,
        phone: GCASH_CONFIG.MERCHANT_MOBILE,
      },
      customer: {
        name: customerName || '',
        email: customerEmail || '',
        phone: customerPhone || '',
      },
      test_mode: true,
      public_key: GCASH_CONFIG.TEST_PUBLIC_KEY,
      created_at: new Date().toISOString(),
    };

    return {
      success: true,
      intent,
      checkout_url: `https://gcash-sandbox.mototrack.ph/pay/${sourceId}`,
    };
  }

  /**
   * Step 1: Send SMS OTP to Customer Mobile Number
   */
  async sendOtp(mobileNumber) {
    const cleanNumber = (mobileNumber || '').replace(/[^0-9]/g, '');
    await new Promise((resolve) => setTimeout(resolve, 800)); // Network delay simulation

    return {
      success: true,
      mobile: cleanNumber,
      otpCode: GCASH_CONFIG.DEFAULT_TEST_OTP,
      expiresIn: 300,
      message: `[GCash Sandbox] 6-digit authentication code sent to +63 ${cleanNumber.slice(-10)}. Test OTP: ${GCASH_CONFIG.DEFAULT_TEST_OTP}`,
    };
  }

  /**
   * Step 2: Verify 6-Digit SMS OTP
   */
  async verifyOtp(mobileNumber, otp) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const cleanOtp = (otp || '').trim();

    // Accept sandbox code or valid 6-digit code
    if (cleanOtp === GCASH_CONFIG.DEFAULT_TEST_OTP || cleanOtp.length === 6) {
      return { success: true, verified: true };
    }

    return {
      success: false,
      error: `Invalid authentication code. Use test code: ${GCASH_CONFIG.DEFAULT_TEST_OTP}`,
    };
  }

  /**
   * Step 3: Verify 4-Digit GCash MPIN
   */
  async verifyMpin(mobileNumber, mpin) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const cleanMpin = (mpin || '').trim();

    if (cleanMpin === GCASH_CONFIG.DEFAULT_TEST_MPIN || cleanMpin.length === 4) {
      return { success: true, verified: true };
    }

    return {
      success: false,
      error: `Invalid MPIN. Use test sandbox MPIN: ${GCASH_CONFIG.DEFAULT_TEST_MPIN}`,
    };
  }

  /**
   * Step 4: Finalize and Deduct Payment from GCash Wallet
   */
  async processPayment({ amount, mobileNumber, referenceNumber, orderId = null }) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const chargeAmount = parseFloat(amount);
    const currentBalance = this.getWalletBalance();

    if (currentBalance < chargeAmount) {
      return {
        success: false,
        error: `Insufficient GCash wallet balance. Available: ₱${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      };
    }

    // Deduct from test wallet balance
    const newBalance = currentBalance - chargeAmount;
    try {
      appStorage.setItem(STORAGE_KEYS.GCASH_WALLET, String(newBalance));
    } catch (e) {}

    const refNo = referenceNumber || this.generateReferenceNumber();
    const transactionRecord = {
      id: `txn_${Date.now()}`,
      reference_number: refNo,
      order_id: orderId,
      amount: chargeAmount,
      currency: 'PHP',
      fee: 0.0,
      net_amount: chargeAmount,
      payer_phone: mobileNumber,
      merchant_name: GCASH_CONFIG.MERCHANT_NAME,
      status: 'PAID',
      test_mode: true,
      paid_at: new Date().toISOString(),
      balance_after: newBalance,
    };

    // Save transaction in local storage
    try {
      const existing = appStorage.getItem(STORAGE_KEYS.GCASH_TRANSACTIONS);
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(transactionRecord);
      appStorage.setItem(STORAGE_KEYS.GCASH_TRANSACTIONS, JSON.stringify(list));
    } catch (e) {}

    // Note: Single write path for payments table is managed by orderService.createOrder
    // to prevent duplicate payment records and maintain transaction consistency.

    return {
      success: true,
      transaction: transactionRecord,
      reference_number: refNo,
      balance_after: newBalance,
      message: 'GCash Payment Authorized & Completed Successfully',
    };
  }
}

export const gcashPaymentService = new GCashPaymentService();
