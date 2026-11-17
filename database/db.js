const fs = require('fs');
const path = require('path');
const { getTodayKolkata, getDaysUntilExpiry } = require('../services/dateUtils');

const DATA_DIR = path.join(__dirname, 'data');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// ---------------- Members Methods ----------------

function getAllMembers() {
  return readJsonFile(MEMBERS_FILE, []);
}

function getMemberById(memberId) {
  const members = getAllMembers();
  return members.find(m => m.member_id === memberId) || null;
}

function getMemberByPhone(phone) {
  const members = getAllMembers();
  return members.find(m => m.phone === phone) || null;
}

function createOrUpdateMember(memberData) {
  const members = getAllMembers();
  const existingIndex = members.findIndex(m => m.phone === memberData.phone);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing member (preserve member_id and previous payment/reminder records if not passed)
    const existing = members[existingIndex];
    const updated = {
      ...existing,
      ...memberData,
      member_id: existing.member_id, // keep original ID
      updated_at: now
    };
    members[existingIndex] = updated;
    writeJsonFile(MEMBERS_FILE, members);
    return { member: updated, isNew: false };
  } else {
    // Create new member
    const newMemberId = memberData.member_id || ('GYM-' + String(Date.now()).slice(-6));
    const newMember = {
      member_id: newMemberId,
      name: memberData.name,
      phone: memberData.phone,
      plan: memberData.plan,
      plan_months: Number(memberData.plan_months || 1),
      fee: Number(memberData.fee || 0),
      start_date: memberData.start_date,
      expiry_date: memberData.expiry_date,
      payment_status: memberData.payment_status || 'Pending',
      last_payment_date: memberData.last_payment_date || (memberData.payment_status === 'Paid' ? memberData.start_date : ''),
      last_reminder_date: memberData.last_reminder_date || '',
      last_payment_ref: memberData.last_payment_ref || '',
      whatsapp_consent: memberData.whatsapp_consent !== false,
      created_at: now,
      updated_at: now
    };
    members.push(newMember);
    writeJsonFile(MEMBERS_FILE, members);
    return { member: newMember, isNew: true };
  }
}

function updateMember(memberId, updates) {
  const members = getAllMembers();
  const index = members.findIndex(m => m.member_id === memberId);
  if (index === -1) return null;

  members[index] = {
    ...members[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeJsonFile(MEMBERS_FILE, members);
  return members[index];
}

function deleteMember(memberId) {
  const members = getAllMembers();
  const filtered = members.filter(m => m.member_id !== memberId);
  if (filtered.length !== members.length) {
    writeJsonFile(MEMBERS_FILE, filtered);
    return true;
  }
  return false;
}

// ---------------- Dashboard & Analytics ----------------

function getDashboardStats() {
  const members = getAllMembers();
  const today = getTodayKolkata();

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.expiry_date && m.expiry_date >= today);
  const expiredMembers = members.filter(m => m.expiry_date && m.expiry_date < today);
  const pendingPayments = members.filter(m => m.payment_status === 'Pending');
  const paidMembers = members.filter(m => m.payment_status === 'Paid');

  // Expiring soon (0 to 3 days remaining)
  const expiringSoon = members.filter(m => {
    if (!m.expiry_date || m.expiry_date < today) return false;
    const days = getDaysUntilExpiry(m.expiry_date, today);
    return days >= 0 && days <= 3;
  });

  const totalRevenue = members
    .filter(m => m.payment_status === 'Paid')
    .reduce((sum, m) => sum + (Number(m.fee) || 0), 0);

  return {
    today,
    totalMembers,
    activeCount: activeMembers.length,
    expiredCount: expiredMembers.length,
    pendingPaymentsCount: pendingPayments.length,
    expiringSoonCount: expiringSoon.length,
    paidCount: paidMembers.length,
    totalRevenue,
    activeList: activeMembers,
    expiredList: expiredMembers,
    pendingList: pendingPayments,
    expiringSoonList: expiringSoon
  };
}

// ---------------- Payments Methods ----------------

function getAllPayments() {
  return readJsonFile(PAYMENTS_FILE, []);
}

function recordPaymentTransaction(paymentData) {
  const payments = getAllPayments();
  const newPayment = {
    id: paymentData.id || ('PAY-' + Date.now()),
    member_id: paymentData.member_id,
    name: paymentData.name,
    phone: paymentData.phone,
    amount: Number(paymentData.amount || 0),
    payment_mode: paymentData.payment_mode || 'Cash', // 'Cash' | 'UPI' | 'Razorpay'
    reference_id: paymentData.reference_id || '',
    date: paymentData.date || getTodayKolkata(),
    created_at: new Date().toISOString()
  };
  payments.unshift(newPayment);
  writeJsonFile(PAYMENTS_FILE, payments);
  return newPayment;
}

// ---------------- Notifications Methods ----------------

function getAllNotifications() {
  return readJsonFile(NOTIFICATIONS_FILE, []);
}

function logNotification(notifData) {
  const notifs = getAllNotifications();
  const entry = {
    id: 'NOTIF-' + Date.now(),
    type: notifData.type || 'WhatsApp_Expiry_Reminder',
    recipient_phone: notifData.phone,
    recipient_name: notifData.name,
    message: notifData.message,
    status: notifData.status || 'SENT', // 'SENT' | 'FAILED' | 'SIMULATED'
    date: notifData.date || getTodayKolkata(),
    timestamp: new Date().toISOString()
  };
  notifs.unshift(entry);
  writeJsonFile(NOTIFICATIONS_FILE, notifs);
  return entry;
}

module.exports = {
  getAllMembers,
  getMemberById,
  getMemberByPhone,
  createOrUpdateMember,
  updateMember,
  deleteMember,
  getDashboardStats,
  getAllPayments,
  recordPaymentTransaction,
  getAllNotifications,
  logNotification
};
