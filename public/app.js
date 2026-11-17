/**
 * Gym Manager Automation Frontend Application Logic
 */

let allMembers = [];
let currentFilter = 'all';

// On DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  loadAllData();
});

function initDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  const startDateInput = document.getElementById('regStartDate');
  if (startDateInput) {
    startDateInput.value = today;
  }
  updateFormFeeAndExpiry();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800');
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-bell');

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl ${bgColor} text-white text-xs font-semibold shadow-xl border border-white/10 transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function switchTab(tabName) {
  // Hide all contents
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  // Remove active styling on all buttons
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active-tab'));

  const activeContent = document.getElementById(`tab-${tabName}`);
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);

  if (activeContent) activeContent.classList.remove('hidden');
  if (activeBtn) activeBtn.classList.add('active-tab');

  // Trigger tab-specific refresh
  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'members') loadMembers();
  if (tabName === 'reminders') loadReminders();
  if (tabName === 'payments') loadPayments();
  if (tabName === 'report') loadDailyReport();
}

// ---------------- Data Fetching & Sync ----------------

async function loadAllData() {
  await Promise.all([
    loadDashboard(),
    loadMembers(),
    loadReminders(),
    loadPayments(),
    loadDailyReport()
  ]);
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    if (!data.success) return;

    const stats = data.stats;
    document.getElementById('headerTodayDate').innerText = stats.today;
    document.getElementById('statTotalMembers').innerText = stats.totalMembers;
    document.getElementById('statActiveMembers').innerText = stats.activeCount;
    document.getElementById('statExpiredMembers').innerText = stats.expiredCount;
    document.getElementById('statPendingPayments').innerText = stats.pendingPaymentsCount;

    document.getElementById('tabCountAll').innerText = stats.totalMembers;

    // Render upcoming expirations
    const expiringListEl = document.getElementById('dashboardExpiringList');
    if (stats.expiringSoonList.length === 0) {
      expiringListEl.innerHTML = `
        <div class="text-xs text-slate-400 p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center">
          <i class="fa-regular fa-calendar-check text-emerald-400 text-base mb-1 block"></i>
          Koi member agle 3 din mein expire nahi ho raha hai!
        </div>`;
    } else {
      expiringListEl.innerHTML = stats.expiringSoonList.map(m => {
        const directUrl = `https://wa.me/${m.phone}?text=${encodeURIComponent(`Namaste ${m.name}, aapki gym membership ${m.expiry_date} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!`)}`;
        return `
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <div>
              <div class="font-bold text-white flex items-center gap-2">
                <span>${m.name}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ${m.expiry_date === stats.today ? 'Expires Today!' : 'Expiring in ' + m.days_left + ' days'}
                </span>
              </div>
              <div class="text-slate-400 font-mono text-[11px] mt-0.5">Phone: ${m.phone} &bull; Expiry: ${m.expiry_date}</div>
            </div>
            <div class="flex items-center gap-2">
              <a href="${directUrl}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition border border-emerald-500/30 flex items-center gap-1.5 font-semibold">
                <i class="fa-brands fa-whatsapp"></i> <span>Send WA</span>
              </a>
              <button onclick="openPaymentModal('${m.member_id}', '${m.name}', '${m.phone}', '${m.expiry_date}', ${m.fee})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 font-semibold">
                Pay
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

// ---------------- Members Tab ----------------

async function loadMembers() {
  try {
    let url = `/api/members?status=${currentFilter}`;
    const searchVal = document.getElementById('memberSearchInput')?.value;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    allMembers = data.members;
    renderMembersTable(allMembers);
    populateMemberDropdowns(allMembers);
  } catch (err) {
    console.error('Error loading members:', err);
  }
}

function handleMemberSearch() {
  loadMembers();
}

function filterMembers(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  const btnMap = {
    'all': 'btnFilterAll',
    'active': 'btnFilterActive',
    'expiring_soon': 'btnFilterExpiring',
    'expired': 'btnFilterExpired',
    'pending': 'btnFilterPending'
  };
  const activeBtn = document.getElementById(btnMap[status]);
  if (activeBtn) activeBtn.classList.add('active');
  loadMembers();
}

function renderMembersTable(members) {
  const tbody = document.getElementById('membersTableBody');
  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-500 text-xs">
          Koi member record nahi mila.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const isExpired = m.is_expired;
    const isExpiringSoon = m.days_left >= 0 && m.days_left <= 3;

    let expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold badge-active">Active (${m.days_left}d left)</span>`;
    if (isExpired) {
      expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold badge-expired">Expired</span>`;
    } else if (isExpiringSoon) {
      expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold badge-pending">${m.days_left === 0 ? 'Expires Today' : m.days_left + ' Days Left'}</span>`;
    }

    const payBadge = m.payment_status === 'Paid'
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold badge-paid">Paid</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold badge-pending">Pending</span>`;

    const reminderMsg = `Namaste ${m.name}, aapki gym membership ${m.expiry_date} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!`;
    const waUrl = `https://wa.me/${m.phone}?text=${encodeURIComponent(reminderMsg)}`;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-mono font-bold text-amber-400">${m.member_id}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-white">${m.name}</div>
          <div class="text-slate-400 font-mono text-[11px]">${m.phone}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-slate-200 font-medium">${m.plan}</div>
          <div class="text-slate-400">₹${m.fee}</div>
        </td>
        <td class="py-3 px-4 font-mono text-slate-300">
          <div>Start: ${m.start_date}</div>
          <div>Expiry: ${m.expiry_date}</div>
        </td>
        <td class="py-3 px-4">${expiryBadge}</td>
        <td class="py-3 px-4">${payBadge}</td>
        <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
          <a href="${waUrl}" target="_blank" title="Send WhatsApp Message" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition">
            <i class="fa-brands fa-whatsapp text-xs"></i>
          </a>
          <button onclick="openPaymentModal('${m.member_id}', '${m.name}', '${m.phone}', '${m.expiry_date}', ${m.fee})" title="Record Payment" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white transition">
            <i class="fa-solid fa-indian-rupee-sign text-xs"></i>
          </button>
          <button onclick="deleteMemberAction('${m.member_id}')" title="Delete Member" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function populateMemberDropdowns(members) {
  const paySelect = document.getElementById('payMemberSelect');
  const webhookSelect = document.getElementById('webhookMemberSelect');
  if (!paySelect || !webhookSelect) return;

  const options = members.map(m => `
    <option value="${m.member_id}">
      ${m.member_id} - ${m.name} (${m.phone}) - Plan: ${m.plan}
    </option>
  `).join('');

  paySelect.innerHTML = options;
  webhookSelect.innerHTML = options;
}

// ---------------- Member Registration (Workflow 1) ----------------

function updateFormFeeAndExpiry() {
  const planSelect = document.getElementById('regPlan');
  const feeInput = document.getElementById('regFee');
  const startDateInput = document.getElementById('regStartDate');
  const expiryPreview = document.getElementById('regCalculatedExpiry');

  if (!planSelect || !startDateInput || !expiryPreview) return;

  const selectedOpt = planSelect.options[planSelect.selectedIndex];
  const months = Number(selectedOpt.getAttribute('data-months') || 1);
  const defaultFee = selectedOpt.getAttribute('data-fee');

  if (defaultFee && (!feeInput.value || feeInput.dataset.autoFilled === 'true')) {
    feeInput.value = defaultFee;
    feeInput.dataset.autoFilled = 'true';
  }

  const startDate = startDateInput.value;
  if (startDate) {
    expiryPreview.innerText = calculateAddMonthsClient(startDate, months);
  }
}

function calculateAddMonthsClient(isoDate, months) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = (m - 1) + Number(months);
  const ny = y + Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
}

async function handleMemberRegistration(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitRegistration');
  btn.disabled = true;
  btn.innerText = 'Saving...';

  try {
    const payload = {
      name: document.getElementById('regName').value,
      phone: document.getElementById('regPhone').value,
      plan: document.getElementById('regPlan').value,
      fee: Number(document.getElementById('regFee').value),
      start_date: document.getElementById('regStartDate').value,
      payment_status: document.getElementById('regPaidImmediately').checked ? 'Paid' : 'Pending',
      whatsapp_consent: document.getElementById('regConsent').checked
    };

    const res = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(`${data.member.name} registered successfully (${data.member.member_id})!`, 'success');
      document.getElementById('newMemberForm').reset();
      initDefaults();
      await loadAllData();
      switchTab('members');
    } else {
      showToast(data.error || 'Failed to register member', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Save Member to System';
  }
}

async function deleteMemberAction(memberId) {
  if (!confirm(`Are you sure you want to remove member ${memberId}?`)) return;

  try {
    const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Member ${memberId} removed`, 'success');
      loadAllData();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- Expiry Reminders (Workflow 2) ----------------

async function loadReminders() {
  try {
    const [dueRes, logsRes] = await Promise.all([
      fetch('/api/reminders/due'),
      fetch('/api/reminders/logs')
    ]);
    const dueData = await dueRes.json();
    const logsData = await logsRes.json();

    if (dueData.success) {
      document.getElementById('eligibleRemindersCount').innerText = dueData.count;
      document.getElementById('tabCountDue').innerText = dueData.count;

      const listEl = document.getElementById('eligibleRemindersList');
      if (dueData.members.length === 0) {
        listEl.innerHTML = `<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">Sabhi active members ki membership update hai. Aaj koi reminder bhejne ki zaroorat nahi hai.</div>`;
      } else {
        listEl.innerHTML = dueData.members.map(m => `
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div>
              <div class="font-bold text-white flex items-center gap-2">
                <span>${m.name}</span>
                <span class="font-mono text-slate-400">(${m.phone})</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ${m.days_left === 0 ? 'Expires TODAY' : m.days_left + ' Days Left'}
                </span>
              </div>
              <p class="text-slate-400 text-[11px] mt-1 font-mono italic">"${m.message_preview}"</p>
            </div>
            <div class="flex items-center gap-2">
              <a href="${m.direct_whatsapp_url}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center gap-1.5">
                <i class="fa-brands fa-whatsapp"></i> <span>Send via WA Web</span>
              </a>
              <button onclick="sendSingleReminder('${m.member_id}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition">
                API Send
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (logsData.success) {
      const logsBody = document.getElementById('reminderLogsTableBody');
      if (logsData.logs.length === 0) {
        logsBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No reminder history recorded yet.</td></tr>`;
      } else {
        logsBody.innerHTML = logsData.logs.slice(0, 10).map(l => `
          <tr class="hover:bg-slate-800/30 font-medium">
            <td class="py-2.5 px-3 font-mono text-slate-400">${l.date}</td>
            <td class="py-2.5 px-3 text-white">${l.recipient_name}</td>
            <td class="py-2.5 px-3 font-mono text-slate-400">${l.recipient_phone}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.status === 'SENT' ? 'badge-active' : 'badge-expired'}">
                ${l.status}
              </span>
            </td>
            <td class="py-2.5 px-3 text-slate-400 truncate max-w-xs">${l.message}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading reminders:', err);
  }
}

async function triggerRemindersBatch() {
  try {
    const res = await fetch('/api/reminders/run', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Batch completed! Processed ${data.batchResult.total_processed} reminders.`, 'success');
      loadAllData();
    } else {
      showToast(data.error || 'Batch failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function sendSingleReminder(memberId) {
  try {
    const res = await fetch(`/api/reminders/send-single/${memberId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Reminder sent to ${data.member.name}`, 'success');
      loadAllData();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- Payments Tab (Workflow 3) ----------------

async function loadPayments() {
  try {
    const res = await fetch('/api/payments');
    const data = await res.json();
    if (!data.success) return;

    const tbody = document.getElementById('paymentHistoryTableBody');
    if (data.payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No payment records yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.payments.map(p => `
      <tr class="hover:bg-slate-800/30">
        <td class="py-2.5 px-3 font-mono text-slate-400">${p.date}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${p.member_id}</td>
        <td class="py-2.5 px-3 text-white font-semibold">${p.name || '--'}</td>
        <td class="py-2.5 px-3 font-bold text-emerald-400">₹${p.amount}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">${p.payment_mode}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-slate-400 text-[11px]">${p.reference_id}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading payments:', err);
  }
}

async function handleManualPaymentSubmit(e) {
  e.preventDefault();
  const memberId = document.getElementById('payMemberSelect').value;
  const amount = document.getElementById('payAmount').value;
  const mode = document.getElementById('payMode').value;

  try {
    const res = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, amount, payment_mode: mode })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Payment recorded for ${data.result.member.name}. New Expiry: ${data.result.new_expiry}`, 'success');
      loadAllData();
      e.target.reset();
    } else {
      showToast(data.error || 'Payment record failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSimulateWebhook(e) {
  e.preventDefault();
  const memberId = document.getElementById('webhookMemberSelect').value;
  const linkId = document.getElementById('webhookLinkId').value;

  try {
    const res = await fetch('/api/payments/simulate-razorpay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, link_id: linkId })
    });
    const data = await res.json();
    if (data.success) {
      const resData = data.result;
      if (resData.status === 'ALREADY_PROCESSED') {
        showToast('Webhook idempotency test: Event was already processed; expiry was safely untouched.', 'info');
      } else {
        showToast(`Webhook simulated! Member ${resData.member.name} renewed until ${resData.new_expiry}.`, 'success');
      }
      loadAllData();
    } else {
      showToast(data.error || 'Webhook simulation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- Payment Modal ----------------

function openPaymentModal(memberId, name, phone, expiry, fee) {
  document.getElementById('modalMemberId').value = memberId;
  document.getElementById('modalMemberName').innerText = name;
  document.getElementById('modalMemberPhone').innerText = phone;
  document.getElementById('modalMemberExpiry').innerText = expiry;
  document.getElementById('modalAmount').value = fee || 1200;
  document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
}

async function handleModalPaymentSubmit(e) {
  e.preventDefault();
  const memberId = document.getElementById('modalMemberId').value;
  const amount = document.getElementById('modalAmount').value;
  const mode = document.getElementById('modalPayMode').value;

  try {
    const res = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, amount, payment_mode: mode })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Payment saved! New expiry: ${data.result.new_expiry}`, 'success');
      closePaymentModal();
      loadAllData();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- Daily Owner Report (Workflow 4) ----------------

async function loadDailyReport() {
  try {
    const res = await fetch('/api/reports/daily');
    const data = await res.json();
    if (!data.success) return;

    const rep = data.report;
    document.getElementById('reportFullText').innerText = rep.text;
    document.getElementById('reportWhatsAppText').innerText = rep.whatsapp_summary;
  } catch (err) {
    console.error('Error loading daily report:', err);
  }
}

async function sendReportEmail() {
  try {
    const res = await fetch('/api/reports/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.success) {
      showToast(`Daily report email sent (${data.result.mode})!`, 'success');
    } else {
      showToast(data.error || data.result?.reason, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function sendReportWhatsApp() {
  try {
    const res = await fetch('/api/reports/send-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.success) {
      if (data.result.direct_url) {
        window.open(data.result.direct_url, '_blank');
      }
      showToast('WhatsApp report summary opened / dispatched!', 'success');
    } else {
      showToast(data.error || data.result?.reason, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
