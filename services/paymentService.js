const crypto = require('crypto');
const db = require('../database/db');
const { getTodayKolkata, addMonths } = require('./dateUtils');

/**
 * Validates Razorpay Webhook HMAC-SHA256 signature against the raw body buffer.
 * Specified in Chapter 6 & Chapter 8.
 */
function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!secret) {
    console.warn('[Payment Service] No RAZORPAY_WEBHOOK_SECRET configured; skipping signature verification in development/testing.');
    return true;
  }
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}

/**
 * Core business logic for processing a payment and extending membership expiry.
 * Strictly adheres to Chapter 6 calculation rules:
 * - If last_payment_ref === paymentRef: ignore duplicate (idempotency)
 * - If firstPayment (!last_payment_date): keep calculated expiry_date from start_date
 * - If renewal and active (expiry_date > today): extend from current expiry_date
 * - If renewal and already expired (expiry_date <= today): extend from today
 */
function processMembershipPayment(memberIdOrPhone, paymentRef, amount, paymentMode = 'Cash') {
  let member = db.getMemberById(memberIdOrPhone);
  if (!member) {
    member = db.getMemberByPhone(memberIdOrPhone);
  }

  if (!member) {
    throw new Error(`Member not found for identifier: ${memberIdOrPhone}`);
  }

  const today = getTodayKolkata();

  // 1. Idempotency Check: Prevent duplicate processing if paymentRef already matched
  if (member.last_payment_ref && member.last_payment_ref === paymentRef) {
    return {
      status: 'ALREADY_PROCESSED',
      message: 'This payment reference has already been processed.',
      member
    };
  }

  // 2. Compute New Expiry Date
  const firstPayment = !member.last_payment_date;
  let newExpiry;
  if (firstPayment && member.expiry_date >= today) {
    // New member paying for their initial active period
    newExpiry = member.expiry_date;
  } else {
    // Renewal: if still active, extend from current expiry; if expired, extend from today
    const base = member.expiry_date > today ? member.expiry_date : today;
    newExpiry = addMonths(base, Number(member.plan_months));
  }

  // 3. Update Member Record
  const updatedMember = db.updateMember(member.member_id, {
    payment_status: 'Paid',
    last_payment_date: today,
    expiry_date: newExpiry,
    last_payment_ref: paymentRef,
    fee: amount ? Number(amount) : member.fee
  });

  // 4. Log Transaction
  const transaction = db.recordPaymentTransaction({
    member_id: member.member_id,
    name: member.name,
    phone: member.phone,
    amount: amount || member.fee,
    payment_mode: paymentMode,
    reference_id: paymentRef,
    date: today
  });

  return {
    status: 'SUCCESS',
    first_payment: firstPayment,
    previous_expiry: member.expiry_date,
    new_expiry: newExpiry,
    member: updatedMember,
    transaction
  };
}

/**
 * Handles incoming Razorpay Webhook Event `payment_link.paid`.
 */
function handleRazorpayWebhook(payload) {
  const event = payload.event;
  if (event !== 'payment_link.paid') {
    return { status: 'IGNORED', message: `Unhandled event type: ${event}` };
  }

  const entity = payload.payload?.payment_link?.entity;
  if (!entity) {
    throw new Error('Invalid Razorpay payload structure: missing payment_link.entity');
  }

  const memberId = entity.reference_id;
  const linkId = entity.id;
  const amountPaid = (entity.amount_paid || entity.amount || 0) / 100; // Razorpay returns paise

  if (!memberId) {
    throw new Error('Payment link is missing reference_id (member_id)');
  }

  return processMembershipPayment(memberId, linkId, amountPaid, 'Razorpay');
}

module.exports = {
  verifyRazorpaySignature,
  processMembershipPayment,
  handleRazorpayWebhook
};
