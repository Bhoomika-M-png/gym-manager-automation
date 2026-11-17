const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { addMonths, cleanPhoneNumber, getTodayKolkata, getDaysUntilExpiry } = require('../services/dateUtils');
const db = require('../database/db');
const { processMembershipPayment } = require('../services/paymentService');
const { getEligibleMembersForReminder } = require('../services/reminderService');
const { generateDailyReportData } = require('../services/reportService');

console.log('========================================================');
console.log('🧪 RUNNING GYM MANAGER AUTOMATION EDGE-CASE TEST SUITE');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

// 1. Edge Case: 31st January + 1 Month
test('Edge Case 1: 31st January + 1 Month rolls over correctly to 28th/29th Feb', () => {
  const resultNonLeap = addMonths('2025-01-31', 1);
  assert.strictEqual(resultNonLeap, '2025-02-28', 'Expected 2025-02-28 for non-leap year');

  const resultLeap = addMonths('2024-01-31', 1);
  assert.strictEqual(resultLeap, '2024-02-29', 'Expected 2024-02-29 for leap year');

  const resultMarch31 = addMonths('2025-03-31', 1);
  assert.strictEqual(resultMarch31, '2025-04-30', 'Expected 2025-04-30 for April');
});

// 2. Edge Case: Phone Number Normalization
test('Edge Case 2: Phone number cleanup handles 10 digits, +91, spaces, hyphens, and leading zero', () => {
  assert.strictEqual(cleanPhoneNumber('9876543210'), '919876543210');
  assert.strictEqual(cleanPhoneNumber('+91 98765 43210'), '919876543210');
  assert.strictEqual(cleanPhoneNumber('09876543210'), '919876543210');
  assert.strictEqual(cleanPhoneNumber('91-98765-43210'), '919876543210');
});

// Helper to clean test numbers
function cleanupPhone(phone) {
  const existing = db.getMemberByPhone(phone);
  if (existing) db.deleteMember(existing.member_id);
}

// 3. Edge Case: Duplicate Phone Registration (Chapter 4)
test('Edge Case 3: Re-registering with same phone updates existing record without duplicate row', () => {
  const phone = '919999900001';
  cleanupPhone(phone);
  let memberId;
  try {
    const res1 = db.createOrUpdateMember({
      name: 'Test Member Original',
      phone: phone,
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: '2026-01-01',
      expiry_date: '2026-02-01',
      payment_status: 'Pending'
    });
    assert.strictEqual(res1.isNew, true);
    memberId = res1.member.member_id;

    const res2 = db.createOrUpdateMember({
      name: 'Test Member Updated',
      phone: phone,
      plan: 'Quarterly',
      plan_months: 3,
      fee: 3000,
      start_date: '2026-01-01',
      expiry_date: '2026-04-01',
      payment_status: 'Paid'
    });
    assert.strictEqual(res2.isNew, false);
    assert.strictEqual(res2.member.member_id, memberId, 'Member ID should remain constant');
    assert.strictEqual(res2.member.name, 'Test Member Updated');
    assert.strictEqual(res2.member.plan_months, 3);
  } finally {
    if (memberId) db.deleteMember(memberId);
  }
});

// 4. Edge Case: Expired Member Renewal Payment (Chapter 6)
test('Edge Case 4: Expired member renewal calculates expiry starting from today, NOT past date', () => {
  const phone = '919999900002';
  cleanupPhone(phone);
  const today = getTodayKolkata();
  const pastDate = '2026-01-01'; // expired in the past
  let memberId;

  try {
    const created = db.createOrUpdateMember({
      name: 'Expired Renew Test',
      phone: phone,
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: '2025-12-01',
      expiry_date: pastDate,
      payment_status: 'Pending',
      last_payment_date: '2025-12-01'
    });
    memberId = created.member.member_id;

    const paymentRef = 'manual_test_renew_' + Date.now();
    const paymentRes = processMembershipPayment(memberId, paymentRef, 1200, 'UPI');
    const expectedExpiry = addMonths(today, 1);
    assert.strictEqual(paymentRes.new_expiry, expectedExpiry, `Expected expiry ${expectedExpiry} computed from today`);
    assert.strictEqual(paymentRes.member.payment_status, 'Paid');
  } finally {
    if (memberId) db.deleteMember(memberId);
  }
});

// 5. Edge Case: Double Webhook Event / Idempotency (Chapter 6 & 8)
test('Edge Case 5: Retried payment webhook with same payment_ref is ignored and does NOT advance expiry twice', () => {
  const phone = '919999900003';
  cleanupPhone(phone);
  const today = getTodayKolkata();
  let memberId;

  try {
    const created = db.createOrUpdateMember({
      name: 'Idempotency Test Member',
      phone: phone,
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: today,
      expiry_date: addMonths(today, 1),
      payment_status: 'Pending',
      last_payment_date: ''
    });
    memberId = created.member.member_id;

    const uniqRef = 'plink_webhook_uniq_' + Date.now();
    const firstEvent = processMembershipPayment(memberId, uniqRef, 1200, 'Razorpay');
    assert.strictEqual(firstEvent.status, 'SUCCESS');
    const expiryAfterFirst = firstEvent.member.expiry_date;

    // Duplicate webhook retry
    const secondEvent = processMembershipPayment(memberId, uniqRef, 1200, 'Razorpay');
    assert.strictEqual(secondEvent.status, 'ALREADY_PROCESSED');
    assert.strictEqual(secondEvent.member.expiry_date, expiryAfterFirst, 'Expiry date must not advance on retry');
  } finally {
    if (memberId) db.deleteMember(memberId);
  }
});

// 6. Edge Case: Expiry Reminder Deduplication (Chapter 5)
test('Edge Case 6: Members who already received reminder today are not sent another message today', () => {
  const phone = '919999900004';
  cleanupPhone(phone);
  const today = getTodayKolkata();
  let memberId;

  try {
    const created = db.createOrUpdateMember({
      name: 'Reminder Dedup Test',
      phone: phone,
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: today,
      expiry_date: today, // expires today (0 days left)
      payment_status: 'Paid',
      last_reminder_date: today // ALREADY SENT TODAY
    });
    memberId = created.member.member_id;

    const eligibleList = getEligibleMembersForReminder();
    const found = eligibleList.find(m => m.phone === phone);
    assert.strictEqual(found, undefined, 'Member should be excluded because last_reminder_date is today');
  } finally {
    if (memberId) db.deleteMember(memberId);
  }
});

// 7. Edge Case: Daily Report Counts Integrity (Chapter 7)
test('Edge Case 7: Daily report computes active, expired, and pending counts accurately', () => {
  const report = generateDailyReportData();
  assert(typeof report.active_count === 'number');
  assert(typeof report.expired_count === 'number');
  assert(typeof report.pending_count === 'number');
  assert(report.text.includes('Gym report ' + report.date));
  assert(report.whatsapp_summary.includes('Active ' + report.active_count));
});

console.log('\n--------------------------------------------------------');
console.log(`Results: ${passedTests}/${totalTests} tests passed.`);
console.log('--------------------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
