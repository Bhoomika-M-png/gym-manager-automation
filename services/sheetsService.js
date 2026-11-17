const db = require('../database/db');

const SHEET_HEADERS = [
  'member_id',
  'name',
  'phone',
  'plan',
  'plan_months',
  'fee',
  'start_date',
  'expiry_date',
  'payment_status',
  'last_payment_date',
  'last_reminder_date',
  'last_payment_ref'
];

/**
 * Exports current members to CSV string matching Chapter 3 & 6 Google Sheets column specification.
 */
function exportMembersToCsv() {
  const members = db.getAllMembers();
  const rows = [SHEET_HEADERS.join(',')];

  for (const m of members) {
    const row = SHEET_HEADERS.map(header => {
      let val = m[header] !== undefined && m[header] !== null ? String(m[header]) : '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Returns Google Sheets setup guide and ready-to-copy formulas for Tab 2 (Dashboard).
 */
function getSheetFormulasGuide() {
  return {
    tab1_name: 'Members',
    columns: SHEET_HEADERS,
    tab2_name: 'Dashboard',
    formulas: {
      total_members: '=COUNTA(Members!A2:A)',
      active_members: '=SUMPRODUCT((Members!H2:H<>"")*(Members!H2:H>=TEXT(TODAY(),"yyyy-mm-dd")))',
      expired_members: '=SUMPRODUCT((Members!H2:H<>"")*(Members!H2:H<TEXT(TODAY(),"yyyy-mm-dd")))',
      pending_payments: '=COUNTIF(Members!I2:I,"Pending")'
    },
    note: 'Dates must be formatted as Plain Text in YYYY-MM-DD format to ensure correct SUMPRODUCT comparisons.'
  };
}

module.exports = {
  SHEET_HEADERS,
  exportMembersToCsv,
  getSheetFormulasGuide
};
