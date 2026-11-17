const express = require('express');
const router = express.Router();
const db = require('../database/db');
const {
  PLAN_MONTHS,
  getTodayKolkata,
  addMonths,
  cleanPhoneNumber,
  getDaysUntilExpiry
} = require('../services/dateUtils');

/**
 * GET /api/members
 * Query parameters:
 *  - search: string (matches name or phone or member_id)
 *  - status: 'all' | 'active' | 'expired' | 'pending' | 'expiring_soon'
 */
router.get('/', (req, res) => {
  try {
    const { search, status } = req.query;
    let list = db.getAllMembers();
    const today = getTodayKolkata();

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q)) ||
        (m.member_id && m.member_id.toLowerCase().includes(q))
      );
    }

    if (status) {
      if (status === 'active') {
        list = list.filter(m => m.expiry_date && m.expiry_date >= today);
      } else if (status === 'expired') {
        list = list.filter(m => m.expiry_date && m.expiry_date < today);
      } else if (status === 'pending') {
        list = list.filter(m => m.payment_status === 'Pending');
      } else if (status === 'expiring_soon') {
        list = list.filter(m => {
          if (!m.expiry_date || m.expiry_date < today) return false;
          const days = getDaysUntilExpiry(m.expiry_date, today);
          return days >= 0 && days <= 3;
        });
      }
    }

    // Annotate list with calculated daysLeft
    const annotated = list.map(m => {
      const daysLeft = getDaysUntilExpiry(m.expiry_date, today);
      const isExpired = m.expiry_date ? m.expiry_date < today : false;
      return {
        ...m,
        days_left: daysLeft,
        is_expired: isExpired
      };
    });

    res.json({ success: true, count: annotated.length, members: annotated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/members/:id
 */
router.get('/:id', (req, res) => {
  try {
    const member = db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    const today = getTodayKolkata();
    const daysLeft = getDaysUntilExpiry(member.expiry_date, today);
    res.json({
      success: true,
      member: {
        ...member,
        days_left: daysLeft,
        is_expired: member.expiry_date < today
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/members/register
 * Workflow 1 implementation from Chapter 4:
 * Form Trigger -> Code (addMonths, phone 91 cleanup) -> Save/Update Member
 */
router.post('/register', (req, res) => {
  try {
    const { name, phone, plan, fee, start_date, whatsapp_consent, payment_status } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and Phone are required' });
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    if (cleanedPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required' });
    }

    const chosenPlan = plan || 'Monthly';
    const months = PLAN_MONTHS[chosenPlan] || 1;
    const startDate = start_date ? String(start_date).slice(0, 10) : getTodayKolkata();
    const calculatedExpiry = addMonths(startDate, months);

    const initialStatus = payment_status === 'Paid' ? 'Paid' : 'Pending';

    const result = db.createOrUpdateMember({
      name: name.trim(),
      phone: cleanedPhone,
      plan: chosenPlan,
      plan_months: months,
      fee: Number(fee || 0),
      start_date: startDate,
      expiry_date: calculatedExpiry,
      payment_status: initialStatus,
      whatsapp_consent: whatsapp_consent !== false
    });

    res.json({
      success: true,
      message: result.isNew ? 'Member registered successfully' : 'Existing member record updated',
      member: result.member
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/members/:id
 */
router.put('/:id', (req, res) => {
  try {
    const memberId = req.params.id;
    const updates = req.body;

    if (updates.phone) {
      updates.phone = cleanPhoneNumber(updates.phone);
    }
    if (updates.plan && PLAN_MONTHS[updates.plan]) {
      updates.plan_months = PLAN_MONTHS[updates.plan];
    }

    const updated = db.updateMember(memberId, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    res.json({ success: true, member: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/members/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteMember(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    res.json({ success: true, message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
