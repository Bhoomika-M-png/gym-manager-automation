const db = require('../database/db');
const { getTodayKolkata, addMonths } = require('../services/dateUtils');

function seedDemoMembers() {
  const today = getTodayKolkata();
  console.log(`[Seed] Seeding sample members based on today: ${today}`);

  // Calculate dynamic dates relative to today
  const [y, m, d] = today.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));

  const addDays = (days) => {
    const copy = new Date(dateObj.getTime() + days * 86400000);
    return copy.toISOString().slice(0, 10);
  };

  const sampleMembers = [
    {
      member_id: 'GYM-001',
      name: 'Rohit Kumar',
      phone: '919876543210',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: addDays(-10),
      expiry_date: addDays(20),
      payment_status: 'Paid',
      last_payment_date: addDays(-10),
      last_reminder_date: '',
      last_payment_ref: 'plink_init001',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-002',
      name: 'Neha Singh',
      phone: '919876543211',
      plan: 'Quarterly',
      plan_months: 3,
      fee: 3000,
      start_date: addDays(-87),
      expiry_date: addDays(3), // EXACTLY 3 days left -> triggers reminder
      payment_status: 'Paid',
      last_payment_date: addDays(-87),
      last_reminder_date: '',
      last_payment_ref: 'plink_init002',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-003',
      name: 'Amit Verma',
      phone: '919876543212',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: addDays(-30),
      expiry_date: today, // EXPIRES TODAY -> triggers reminder
      payment_status: 'Pending',
      last_payment_date: '',
      last_reminder_date: '',
      last_payment_ref: '',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-004',
      name: 'Priya Sharma',
      phone: '919876543213',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: addDays(-40),
      expiry_date: addDays(-10), // ALREADY EXPIRED
      payment_status: 'Pending',
      last_payment_date: addDays(-40),
      last_reminder_date: addDays(-10),
      last_payment_ref: 'manual_old004',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-005',
      name: 'Vikram Malhotra',
      phone: '919876543214',
      plan: 'Half-yearly',
      plan_months: 6,
      fee: 5500,
      start_date: addDays(-30),
      expiry_date: addDays(150),
      payment_status: 'Paid',
      last_payment_date: addDays(-30),
      last_reminder_date: '',
      last_payment_ref: 'plink_init005',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-006',
      name: 'Rahul Gupta',
      phone: '919876543215',
      plan: 'Yearly',
      plan_months: 12,
      fee: 10000,
      start_date: addDays(-60),
      expiry_date: addDays(305),
      payment_status: 'Paid',
      last_payment_date: addDays(-60),
      last_reminder_date: '',
      last_payment_ref: 'plink_init006',
      whatsapp_consent: true
    },
    {
      member_id: 'GYM-007',
      name: 'Pooja Desai',
      phone: '919876543216',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1500,
      start_date: today,
      expiry_date: addMonths(today, 1),
      payment_status: 'Pending',
      last_payment_date: '',
      last_reminder_date: '',
      last_payment_ref: '',
      whatsapp_consent: true
    }
  ];

  for (const m of sampleMembers) {
    db.createOrUpdateMember(m);
  }

  console.log(`[Seed] Successfully seeded ${sampleMembers.length} sample members.`);
}

if (require.main === module) {
  seedDemoMembers();
}

module.exports = { seedDemoMembers };
