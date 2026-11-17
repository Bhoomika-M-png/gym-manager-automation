require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const membersRouter = require('./routes/members');
const paymentsRouter = require('./routes/payments');
const webhooksRouter = require('./routes/webhooks');
const remindersRouter = require('./routes/reminders');
const reportsRouter = require('./routes/reports');

const db = require('./database/db');
const { runDailyReminderBatch } = require('./services/reminderService');
const { generateDailyReportData, sendDailyReportEmail, sendDailyReportWhatsApp } = require('./services/reportService');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Raw body parser for webhook HMAC-SHA256 signature verification (Chapter 6 & 8)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/members', membersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/reports', reportsRouter);

// Dashboard KPI Stats endpoint
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    name: 'Gym Manager Automation',
    version: '1.0.0',
    time: new Date().toISOString(),
    timezone: 'Asia/Kolkata'
  });
});

// Setup Automated Cron Tasks (Chapter 5 & Chapter 7)
// Schedule 1: Expiry Reminders daily at 9:00 AM Asia/Kolkata
const reminderCronExpr = process.env.REMINDER_CRON || '0 9 * * *';
cron.schedule(reminderCronExpr, async () => {
  console.log('[Cron] Running scheduled daily expiry reminders at 9:00 AM Asia/Kolkata...');
  try {
    const result = await runDailyReminderBatch();
    console.log(`[Cron] Daily reminders completed. Processed: ${result.total_processed}`);
  } catch (err) {
    console.error('[Cron] Error running scheduled daily reminders:', err);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Schedule 2: Daily Owner Report daily at 8:00 AM Asia/Kolkata
const reportCronExpr = process.env.REPORT_CRON || '0 8 * * *';
cron.schedule(reportCronExpr, async () => {
  console.log('[Cron] Running scheduled daily owner report at 8:00 AM Asia/Kolkata...');
  try {
    const reportData = generateDailyReportData();
    if (process.env.OWNER_EMAIL) {
      await sendDailyReportEmail(reportData);
    }
    if (process.env.OWNER_WHATSAPP_PHONE) {
      await sendDailyReportWhatsApp(reportData);
    }
    console.log('[Cron] Daily owner report successfully generated and dispatched.');
  } catch (err) {
    console.error('[Cron] Error generating daily owner report:', err);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Start server on 0.0.0.0 (accessible locally and across network/tablets/phones)
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 Gym Manager Automation Server is running on:`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`👉 Network: http://192.168.0.145:${PORT}`);
  console.log(`📅 Timezone: Asia/Kolkata`);
  console.log(`⏰ Expiry Reminders Schedule: ${reminderCronExpr}`);
  console.log(`📊 Daily Owner Report Schedule: ${reportCronExpr}`);
  console.log('====================================================');
});
