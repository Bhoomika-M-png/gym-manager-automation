const express = require('express');
const router = express.Router();
const { verifyRazorpaySignature, handleRazorpayWebhook } = require('../services/paymentService');

/**
 * POST /api/webhooks/razorpay
 * Route A from Chapter 6:
 * Receives Razorpay webhook events, validates HMAC SHA-256 signature,
 * and updates member payment and expiry.
 */
router.post('/razorpay', (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify signature with raw buffer if secret is provided
    if (secret) {
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = verifyRazorpaySignature(rawBody, signature, secret);
      if (!isValid) {
        console.warn('[Webhook] Invalid Razorpay webhook signature rejected.');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = req.body;
    console.log(`[Webhook] Razorpay event received: ${payload.event}`);

    const result = handleRazorpayWebhook(payload);
    res.status(200).json({ status: 'ok', result });
  } catch (err) {
    console.error('[Webhook] Razorpay webhook processing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
