const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { processMembershipPayment, handleRazorpayWebhook } = require('../services/paymentService');

/**
 * GET /api/payments
 * Returns history of all recorded payments.
 */
router.get('/', (req, res) => {
  try {
    const payments = db.getAllPayments();
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/manual
 * Route B from Chapter 6:
 * Owner records payment via Cash or UPI.
 * Updates payment_status to 'Paid', extends expiry, and generates manual reference ID.
 */
router.post('/manual', (req, res) => {
  try {
    const { member_id, phone, amount, payment_mode } = req.body;
    const identifier = member_id || phone;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Member ID or Phone is required' });
    }

    const paymentRef = `manual-${Date.now()}`;
    const result = processMembershipPayment(
      identifier,
      paymentRef,
      amount ? Number(amount) : null,
      payment_mode || 'Cash'
    );

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/simulate-razorpay
 * Test tool for Chapter 6 & Chapter 8:
 * Simulates a Razorpay `payment_link.paid` webhook event for a given member.
 */
router.post('/simulate-razorpay', (req, res) => {
  try {
    const { member_id, amount, link_id } = req.body;

    if (!member_id) {
      return res.status(400).json({ success: false, error: 'member_id is required' });
    }

    const dummyLinkId = link_id || ('plink_' + Math.random().toString(36).substring(2, 10));
    const payload = {
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id: dummyLinkId,
            reference_id: member_id,
            amount: (amount || 1200) * 100, // paise
            amount_paid: (amount || 1200) * 100,
            status: 'paid'
          }
        }
      }
    };

    const result = handleRazorpayWebhook(payload);
    res.json({
      success: true,
      message: 'Simulated Razorpay webhook processed',
      event: payload.event,
      result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
