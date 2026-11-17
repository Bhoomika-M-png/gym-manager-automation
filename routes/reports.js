const express = require('express');
const router = express.Router();
const db = require('../database/db');
const {
  generateDailyReportData,
  sendDailyReportEmail,
  sendDailyReportWhatsApp
} = require('../services/reportService');
const { exportMembersToCsv, getSheetFormulasGuide } = require('../services/sheetsService');

/**
 * GET /api/reports/daily
 * Computes and returns the exact 3-count daily report.
 */
router.get('/daily', (req, res) => {
  try {
    const report = generateDailyReportData();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports/send-email
 * Sends the daily report to gym owner via email.
 */
router.post('/send-email', async (req, res) => {
  try {
    const { email } = req.body;
    const reportData = generateDailyReportData();
    const result = await sendDailyReportEmail(reportData, email);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports/send-whatsapp
 * Sends the daily summary to gym owner via WhatsApp.
 */
router.post('/send-whatsapp', async (req, res) => {
  try {
    const { phone } = req.body;
    const reportData = generateDailyReportData();
    const result = await sendDailyReportWhatsApp(reportData, phone);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reports/export-csv
 * Downloads current members as CSV for Google Sheets.
 */
router.get('/export-csv', (req, res) => {
  try {
    const csv = exportMembersToCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=gym_members_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reports/sheets-guide
 * Returns guide and exact formulas for Google Sheets setup.
 */
router.get('/sheets-guide', (req, res) => {
  res.json(getSheetFormulasGuide());
});

module.exports = router;
