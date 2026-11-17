const axios = require('axios');
const db = require('../database/db');
const { getTodayKolkata, toUtc, getDaysUntilExpiry } = require('./dateUtils');

const REMIND_DAYS = [3, 0]; // 3 days before and day of expiry, per Chapter 5

/**
 * Filters all members who qualify for an expiry reminder today.
 * Implements the exact Chapter 5 filter logic:
 * - Must have expiry_date and phone
 * - Must not have already received reminder today (last_reminder_date === today)
 * - Days left must match REMIND_DAYS ([3, 0])
 * - Must have opt-in consent
 */
function getEligibleMembersForReminder() {
  const members = db.getAllMembers();
  const today = getTodayKolkata();

  return members.filter(r => {
    if (!r.expiry_date || !r.phone) return false;
    if (r.last_reminder_date === today) return false;
    if (r.whatsapp_consent === false) return false;

    const daysLeft = Math.round((toUtc(r.expiry_date) - toUtc(today)) / 86400000);
    return REMIND_DAYS.includes(daysLeft);
  });
}

/**
 * Builds the approved Meta WhatsApp Template text or custom message text.
 */
function formatReminderMessage(member) {
  return `Namaste ${member.name}, aapki gym membership ${member.expiry_date} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!`;
}

/**
 * Generates direct wa.me link for zero-cost instant sending from browser or phone
 */
function getDirectWhatsAppUrl(phone, message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

/**
 * Sends WhatsApp message via Meta Cloud API if configured, otherwise simulates and provides direct link.
 */
async function sendWhatsAppNotification(member) {
  const message = formatReminderMessage(member);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'gym_membership_expiry_reminder';
  const today = getTodayKolkata();

  let sendResult = {
    success: false,
    mode: 'SIMULATED',
    details: null
  };

  if (token && phoneNumberId) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: member.phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: member.name },
                  { type: 'text', text: member.expiry_date }
                ]
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      sendResult = { success: true, mode: 'META_CLOUD_API', details: response.data };
    } catch (apiError) {
      console.error(`WhatsApp Cloud API error for ${member.phone}:`, apiError.response ? apiError.response.data : apiError.message);
      sendResult = { success: false, mode: 'META_CLOUD_API_ERROR', details: apiError.message };
    }
  } else {
    // Simulated delivery (offline / demo mode / manual wa.me link)
    sendResult = {
      success: true,
      mode: 'SIMULATED',
      direct_url: getDirectWhatsAppUrl(member.phone, message)
    };
  }

  // Record notification in DB
  db.logNotification({
    type: 'WhatsApp_Expiry_Reminder',
    phone: member.phone,
    name: member.name,
    message: message,
    status: sendResult.success ? 'SENT' : 'FAILED',
    date: today
  });

  // Update member last_reminder_date in DB
  db.updateMember(member.member_id, {
    last_reminder_date: today
  });

  return sendResult;
}

/**
 * Batch runs expiry reminder checks. Continues on error so one invalid number doesn't halt the rest (Chapter 8).
 */
async function runDailyReminderBatch() {
  const eligible = getEligibleMembersForReminder();
  console.log(`[Reminder Service] Running daily reminder check. Found ${eligible.length} eligible members.`);

  const results = [];
  for (const member of eligible) {
    try {
      const res = await sendWhatsAppNotification(member);
      results.push({
        member_id: member.member_id,
        name: member.name,
        phone: member.phone,
        status: 'SUCCESS',
        mode: res.mode,
        direct_url: res.direct_url || null
      });
    } catch (err) {
      console.error(`[Reminder Service] Error processing reminder for ${member.member_id}:`, err);
      results.push({
        member_id: member.member_id,
        name: member.name,
        phone: member.phone,
        status: 'ERROR',
        error: err.message
      });
    }
  }

  return {
    run_date: getTodayKolkata(),
    total_processed: results.length,
    results
  };
}

module.exports = {
  REMIND_DAYS,
  getEligibleMembersForReminder,
  formatReminderMessage,
  getDirectWhatsAppUrl,
  sendWhatsAppNotification,
  runDailyReminderBatch
};
