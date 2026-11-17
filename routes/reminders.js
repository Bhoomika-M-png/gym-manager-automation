const express = require('express');
const router = express.Router();
const db = require('../database/db');
const {
  getEligibleMembersForReminder,
  sendWhatsAppNotification,
  runDailyReminderBatch,
  formatReminderMessage,
  getDirectWhatsAppUrl
} = require('../services/reminderService');
const { getTodayKolkata, getDaysUntilExpiry } = require('../services/dateUtils');

/**
 * GET /api/reminders/due
 * Returns list of members eligible for an expiry reminder today.
 */
router.get('/due', (req, res) => {
  try {
    const today = getTodayKolkata();
    const members = getEligibleMembersForReminder();
    const enriched = members.map(m => ({
      ...m,
      days_left: getDaysUntilExpiry(m.expiry_date, today),
      message_preview: formatReminderMessage(m),
      direct_whatsapp_url: getDirectWhatsAppUrl(m.phone, formatReminderMessage(m))
    }));
    res.json({
      success: true,
      today,
      count: enriched.length,
      members: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reminders/run
 * Triggers the automated daily reminder batch (Workflow 2).
 */
router.post('/run', async (req, res) => {
  try {
    const batchResult = await runDailyReminderBatch();
    res.json({ success: true, batchResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reminders/send-single/:id
 * Sends an immediate reminder to a specific member.
 */
router.post('/send-single/:id', async (req, res) => {
  try {
    const member = db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    const result = await sendWhatsAppNotification(member);
    res.json({
      success: true,
      member: db.getMemberById(req.params.id),
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reminders/logs
 * Retrieves sent notifications history.
 */
router.get('/logs', (req, res) => {
  try {
    const logs = db.getAllNotifications();
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
