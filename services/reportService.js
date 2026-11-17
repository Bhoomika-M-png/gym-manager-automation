const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require('../database/db');
const { getTodayKolkata } = require('./dateUtils');

/**
 * Compiles the exact Daily Gym Report specified in Chapter 7.
 */
function generateDailyReportData() {
  const today = getTodayKolkata();
  const members = db.getAllMembers().filter(r => r.member_id);

  const active = members.filter(r => r.expiry_date >= today);
  const expired = members.filter(r => r.expiry_date && r.expiry_date < today);
  const pending = members.filter(r => r.payment_status === 'Pending');

  const names = list => (list.length ? list.map(r => r.name).join(', ') : 'Koi nahi');

  const reportText =
    `Gym report ${today}\n` +
    `Active members: ${active.length}\n` +
    `Expired memberships: ${expired.length} (${names(expired)})\n` +
    `Pending payments: ${pending.length} (${names(pending)})`;

  const oneLineWhatsAppText =
    `Gym report ${today}: Active ${active.length}, Expired ${expired.length}, Pending payments ${pending.length}. Poori list Dashboard par dekhein.`;

  return {
    date: today,
    active_count: active.length,
    expired_count: expired.length,
    pending_count: pending.length,
    expired_names: names(expired),
    pending_names: names(pending),
    text: reportText,
    whatsapp_summary: oneLineWhatsAppText,
    active_members: active,
    expired_members: expired,
    pending_members: pending
  };
}

/**
 * Sends the daily report to the Gym Owner via Email (Nodemailer / SMTP).
 */
async function sendDailyReportEmail(reportData, customRecipientEmail = null) {
  const recipient = customRecipientEmail || process.env.OWNER_EMAIL;
  if (!recipient) {
    return { success: false, reason: 'OWNER_EMAIL not configured in .env' };
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log(`[Report Service] Email simulated for ${recipient}. Subject: Gym report ${reportData.date}`);
    return {
      success: true,
      mode: 'SIMULATED',
      recipient,
      subject: `Gym report ${reportData.date}`,
      body: reportData.text
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const mailOptions = {
    from: `"Gym Manager" <${smtpUser}>`,
    to: recipient,
    subject: `Gym report ${reportData.date}`,
    text: reportData.text
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, mode: 'SMTP', messageId: info.messageId, recipient };
}

/**
 * Sends the daily summary to the Owner via WhatsApp.
 */
async function sendDailyReportWhatsApp(reportData, customOwnerPhone = null) {
  const ownerPhone = customOwnerPhone || process.env.OWNER_WHATSAPP_PHONE;
  if (!ownerPhone) {
    return { success: false, reason: 'OWNER_WHATSAPP_PHONE not configured in .env' };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'gym_daily_report';

  if (token && phoneNumberId) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: ownerPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: reportData.date },
                  { type: 'text', text: String(reportData.active_count) },
                  { type: 'text', text: String(reportData.expired_count) },
                  { type: 'text', text: String(reportData.pending_count) }
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
      return { success: true, mode: 'META_CLOUD_API', details: response.data };
    } catch (err) {
      console.error('[Report Service] WhatsApp dispatch error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // Fallback / simulated
  const directUrl = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(reportData.whatsapp_summary)}`;
  return {
    success: true,
    mode: 'SIMULATED',
    owner_phone: ownerPhone,
    summary: reportData.whatsapp_summary,
    direct_url: directUrl
  };
}

module.exports = {
  generateDailyReportData,
  sendDailyReportEmail,
  sendDailyReportWhatsApp
};
