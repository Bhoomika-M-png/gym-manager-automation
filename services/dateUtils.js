/**
 * Date and formatting utilities following the n8n Gym Manager Setup Guide specifications.
 */

const PLAN_MONTHS = {
  'Monthly': 1,
  'Quarterly': 3,
  'Half-yearly': 6,
  'Yearly': 12
};

/**
 * Returns today's date in YYYY-MM-DD text format in Asia/Kolkata timezone.
 * Locale 'en-CA' gives ISO standard YYYY-MM-DD.
 */
function getTodayKolkata() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Accurately adds N months to a date string (YYYY-MM-DD) accounting for:
 * - Year rollovers
 * - Varying month lengths (e.g. 31 Jan + 1 month = 28/29 Feb)
 * Exactly matches Chapter 4 / 6 in the guide.
 */
function addMonths(isoDate, months) {
  if (!isoDate) return getTodayKolkata();
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = (m - 1) + Number(months);
  const ny = y + Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
}

/**
 * Converts YYYY-MM-DD to UTC timestamp for exact day-difference calculations.
 */
function toUtc(iso) {
  if (!iso) return 0;
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Computes calendar days between target date and today.
 * Positive = future (days remaining until expiry)
 * 0 = expires today
 * Negative = expired
 */
function getDaysUntilExpiry(expiryDate, todayDate = getTodayKolkata()) {
  if (!expiryDate) return -999;
  return Math.round((toUtc(expiryDate) - toUtc(todayDate)) / 86400000);
}

/**
 * Normalizes phone numbers to standard 91XXXXXXXXXX format.
 * Strips out +, spaces, hyphens, and leading 0.
 * If 10 digits, prepends 91.
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  } else if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

module.exports = {
  PLAN_MONTHS,
  getTodayKolkata,
  addMonths,
  toUtc,
  getDaysUntilExpiry,
  cleanPhoneNumber
};
