// --- APP STATE ---
let staffData = [];
let shiftData = [];
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth(); // 0-indexed
let cycleType = 'cycle'; // always 21-20 cycle
let selectedDept = 'ALL';
let searchQuery = '';
let activeEditStaffId = null;
let usersData = [];
let activeEditUserId = null;

// Lao Months and Weekdays Names
const MONTH_NAMES_LAO = [
  "ມັງກອນ (January)", "ກຸມພາ (February)", "ມີນາ (March)", "ເມສາ (April)",
  "ພຶດສະພາ (May)", "ມິຖຸນາ (June)", "ກໍລະກົດ (July)", "ສິງຫາ (August)",
  "ກັນຍາ (September)", "ຕຸລາ (October)", "ພະຈິກ (November)", "ທັນວາ (December)"
];

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"]; // Sunday=0, Monday=1, ...

// Lao department translation map
const DEPT_TRANSLATIONS = {
  'Pharmacy': 'ການຢາ',
  'Nurse': 'ພະຍາບານ',
  'Internal medicine': 'ພາຍໃນ',
  'Pediatric Department': 'ເດັກນ້ອຍ',
  'Laboratory Department': 'ວິເຄາະ',
  'Chauffeur': 'ໂຊເຟີ'
};

// --- DOM ELEMENTS ---
const selectMonth = document.getElementById('select-month');
const selectYear = document.getElementById('select-year');
const searchStaffInput = document.getElementById('search-staff-input');
const filterDeptSelect = document.getElementById('filter-dept-select');
const printRosterBtn = document.getElementById('print-roster-btn');
const openStaffModalBtn = document.getElementById('open-staff-modal-btn');
const closeStaffModalBtn = document.getElementById('close-staff-modal-btn');
const staffModal = document.getElementById('staff-modal');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const supabaseStatusBadge = document.getElementById('supabase-status-badge');
const rosterViewTitle = document.getElementById('roster-view-title');

// User Management DOM Elements
const openUsersModalBtn = document.getElementById('open-users-modal-btn');
const closeUsersModalBtn = document.getElementById('close-users-modal-btn');
const usersModal = document.getElementById('users-modal');
const addUserForm = document.getElementById('add-user-form');
const inputUserName = document.getElementById('input-user-name');
const inputUserPassword = document.getElementById('input-user-password');
const inputUserRole = document.getElementById('input-user-role');
const inputUserDept = document.getElementById('input-user-dept');
const submitUserBtn = document.getElementById('submit-user-btn');
const usersListTbody = document.getElementById('users-list-tbody');
const rosterGridTable = document.getElementById('roster-grid-table');

// Dashboard Stats Elements
const statTotalStaff = document.getElementById('stat-total-staff');
const statTotalShifts = document.getElementById('stat-total-shifts');
const statTotalPayroll = document.getElementById('stat-total-payroll');
const statActiveToday = document.getElementById('stat-active-today');

// Staff Form Elements
const addStaffForm = document.getElementById('add-staff-form');
const inputStaffName = document.getElementById('input-staff-name');
const inputStaffDept = document.getElementById('input-staff-dept');
const inputStaffRate = document.getElementById('input-staff-rate');
const inputStaffNotes = document.getElementById('input-staff-notes');
const submitStaffBtn = document.getElementById('submit-staff-btn');
const staffListTbody = document.getElementById('staff-list-tbody');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupYearMonthSelectors();
  initTheme();
  setupEventListeners();
  // Wait for auth to be ready before loading data
  waitForAuth();
});

// Wait for auth.js to finish, then apply UI and load data
function waitForAuth() {
  const check = setInterval(() => {
    if (window.AppAuth && window.AppAuth.isReady) {
      clearInterval(check);
      applyAuthUI();
      loadData();
    }
  }, 100);
  // Timeout fallback: if auth not ready after 5s, still load
  setTimeout(() => {
    clearInterval(check);
    if (!window.AppAuth || !window.AppAuth.isReady) {
      loadData();
    }
  }, 5000);
}

// Apply UI based on user role
function applyAuthUI() {
  const auth = window.AppAuth;
  if (!auth || !auth.profile) return;

  const emailLabel = document.getElementById('user-email-label');
  const roleBadge = document.getElementById('user-role-badge');
  const manageStaffBtn = document.getElementById('open-staff-modal-btn');
  const manageUsersBtn = document.getElementById('open-users-modal-btn');
  const deptFilterContainer = filterDeptSelect ? filterDeptSelect.closest('.control-item') : null;

  if (auth.isAdmin) {
    emailLabel.textContent = 'ຜູ້ດູແລລະບົບ (Admin)';
    roleBadge.textContent = 'admin';
    roleBadge.classList.remove('dept');
    if (manageStaffBtn) manageStaffBtn.style.display = '';
    if (manageUsersBtn) manageUsersBtn.style.display = '';
    if (deptFilterContainer) deptFilterContainer.style.display = '';
  } else {
    const deptName = auth.profile.department || 'ພະແນກ';
    const deptLao = DEPT_TRANSLATIONS[deptName] || deptName;
    emailLabel.textContent = `ພະແນກ: ${deptLao}`;
    roleBadge.textContent = deptLao;
    roleBadge.classList.add('dept');
    if (manageStaffBtn) manageStaffBtn.style.display = '';
    if (manageUsersBtn) manageUsersBtn.style.display = 'none';
    if (deptFilterContainer) deptFilterContainer.style.display = 'none';
  }
}

// Setup Year and Month Dropdowns
function setupYearMonthSelectors() {
  // Populate Months
  MONTH_NAMES_LAO.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = name;
    if (index === currentMonth) option.selected = true;
    selectMonth.appendChild(option);
  });

  // Populate Years (2020 to 2030)
  for (let y = 2020; y <= 2030; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    selectYear.appendChild(option);
  }
}

// Setup Theme (Dark/Light)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');
  const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
  if (moonIcon && sunIcon) {
    moonIcon.style.display = theme === 'dark' ? 'block' : 'none';
    sunIcon.style.display = theme === 'dark' ? 'none' : 'block';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Date Filters
  selectMonth.addEventListener('change', (e) => {
    currentMonth = parseInt(e.target.value);
    loadData();
  });
  selectYear.addEventListener('change', (e) => {
    currentYear = parseInt(e.target.value);
    loadData();
  });

  // Search & Filter
  searchStaffInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderRosterGrid();
  });
  filterDeptSelect.addEventListener('change', (e) => {
    selectedDept = e.target.value;
    renderRosterGrid();
  });

  // Modals
  openStaffModalBtn.addEventListener('click', () => {
    resetStaffForm();
    renderStaffModalList();
    staffModal.classList.add('active');
  });
  closeStaffModalBtn.addEventListener('click', () => {
    closeStaffModal();
  });
  staffModal.addEventListener('click', (e) => {
    if (e.target === staffModal) closeStaffModal();
  });

  // User Management Modal Events
  if (openUsersModalBtn) {
    openUsersModalBtn.addEventListener('click', () => {
      renderUsersModalList();
      usersModal.classList.add('active');
    });
  }
  if (closeUsersModalBtn) {
    closeUsersModalBtn.addEventListener('click', () => {
      closeUsersModal();
    });
  }
  if (usersModal) {
    usersModal.addEventListener('click', (e) => {
      if (e.target === usersModal) closeUsersModal();
    });
  }
  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleUserFormSubmit();
    });
  }

  // Staff Form Submit (Add or Update)
  addStaffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleStaffFormSubmit();
  });

  // Print Roster
  if (printRosterBtn) {
    printRosterBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Theme Toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
}

function closeStaffModal() {
  staffModal.classList.remove('active');
  resetStaffForm();
}

function resetStaffForm() {
  activeEditStaffId = null;
  addStaffForm.reset();
  submitStaffBtn.textContent = 'ບັນທຶກຂໍ້ມູນ';
  addStaffForm.querySelector('h3').textContent = '➕ ເພີ່ມບຸກຄະລາກອນໃໝ່';

  // Lock and pre-select department for non-admin department users
  const auth = window.AppAuth;
  if (auth && auth.isReady && !auth.isAdmin && auth.profile && auth.profile.department) {
    inputStaffDept.value = auth.profile.department;
    inputStaffDept.disabled = true;
  } else {
    inputStaffDept.disabled = false;
  }
}

// --- API DATA CALLS ---
async function loadData() {
  try {
    const dates = calculateDateRange();
    const startDateStr = formatDateISO(dates[0]);
    const endDateStr = formatDateISO(dates[dates.length - 1]);

    // Update Title text
    const cycleText = cycleType === 'cycle'
      ? `ຕາຕະລາງເວນປະຈຳງວດວັນທີ ${dates[0].getDate()} ${MONTH_NAMES_LAO[dates[0].getMonth()]} ${dates[0].getFullYear()} - ${dates[dates.length - 1].getDate()} ${MONTH_NAMES_LAO[dates[dates.length - 1].getMonth()]} ${dates[dates.length - 1].getFullYear()}`
      : `ຕາຕະລາງເວນປະຈຳເດືອນ ${MONTH_NAMES_LAO[currentMonth]} ${currentYear}`;

    rosterViewTitle.textContent = cycleText;

    // Fetch Staff & Shifts parallelly
    const [staffRes, shiftsRes] = await Promise.all([
      fetch('/api/staff'),
      fetch(`/api/shifts?start_date=${startDateStr}&end_date=${endDateStr}`)
    ]);

    if (!staffRes.ok || !shiftsRes.ok) {
      throw new Error('Failed to fetch data from Express server');
    }

    staffData = await staffRes.json();
    shiftData = await shiftsRes.json();

    // Filter by department if non-admin
    const auth = window.AppAuth;
    if (auth && auth.isReady && !auth.isAdmin && auth.profile && auth.profile.department) {
      const userDept = auth.profile.department;
      staffData = staffData.filter(s => s.department === userDept);
    }

    // Update status badge
    // try {
    //   const cfgRes = await fetch('/api/config');
    //   const cfg = await cfgRes.json();
    //   supabaseStatusBadge.textContent = cfg.isSupabaseConfigured ? 'Supabase Live' : 'Local Mock DB';
    //   supabaseStatusBadge.style.background = cfg.isSupabaseConfigured ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
    // } catch(_) {}

    // Populate department list
    populateDepartmentDropdown();

    // Render components
    renderRosterGrid();
    renderStats();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// --- DEPARTMENT DROPDOWN POPULATION ---
function populateDepartmentDropdown() {
  const depts = [...new Set(staffData.map(s => s.department.trim()))];
  const currentSelect = filterDeptSelect.value;

  filterDeptSelect.innerHTML = '<option value="ALL">ທັງໝົດ (ທຸກພະແນກ)</option>';

  depts.forEach(dept => {
    if (dept) {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = DEPT_TRANSLATIONS[dept] || dept;
      if (dept === currentSelect) opt.selected = true;
      filterDeptSelect.appendChild(opt);
    }
  });
}

// --- DATE CALCULATOR HELPER ---
function calculateDateRange() {
  const dates = [];

  if (cycleType === 'month') {
    // 1st to Last day of selected Month
    const numDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let day = 1; day <= numDays; day++) {
      dates.push(new Date(currentYear, currentMonth, day));
    }
  } else {
    // 21st of Previous Month to 20th of Current Month
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    // Number of days in previous month
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

    // Add days from previous month (21st to end)
    for (let day = 21; day <= daysInPrevMonth; day++) {
      dates.push(new Date(prevYear, prevMonth, day));
    }

    // Add days of current month (1st to 20th)
    for (let day = 1; day <= 20; day++) {
      dates.push(new Date(currentYear, currentMonth, day));
    }
  }

  return dates;
}

// --- ROSTER GRID GENERATION ---
function renderRosterGrid() {
  const dates = calculateDateRange();

  // Filter staff data based on inputs
  const filteredStaff = staffData.filter(staff => {
    const matchesDept = selectedDept === 'ALL' || staff.department.trim() === selectedDept;
    const matchesSearch = staff.name.toLowerCase().includes(searchQuery) ||
      (staff.notes && staff.notes.toLowerCase().includes(searchQuery));
    return matchesDept && matchesSearch;
  });

  let html = '';

  // HEADER ROW 1: General categories & dates
  html += '<thead>';
  html += '  <tr>';
  html += '    <th rowspan="2" style="width: 45px;">ລ/ດ</th>';
  html += '    <th rowspan="2" style="width: 180px;">ຊື່ ແລະ ນາມສະກຸນ</th>';
  html += '    <th rowspan="2" style="width: 100px;">ພະແນກ</th>';

  // Dates
  dates.forEach(date => {
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const weekendClass = isWeekend ? 'weekend-header' : '';
    html += `    <th class="date-cell ${weekendClass}">`;
    html += `      <span class="day-num">${date.getDate()}</span>`;
    html += `    </th>`;
  });

  html += '    <th rowspan="2" class="sum-header" style="width: 70px;">ຈົບວັນຍາມ</th>';
  html += '    <th rowspan="2" class="sum-header" style="width: 110px;">ຈ/ນ ຕໍ່ວັນ/ຍາມ</th>';
  html += '    <th rowspan="2" class="sum-header" style="width: 120px;">ລວມ</th>';
  html += '    <th rowspan="2" style="width: 140px;">ໝາຍເຫດ</th>';
  html += '  </tr>';

  // HEADER ROW 2: Days of the week (S, M, T, W...)
  html += '  <tr>';
  dates.forEach(date => {
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const weekendClass = isWeekend ? 'weekend-header' : '';
    const dayName = WEEKDAY_INITIALS[date.getDay()];
    html += `    <th class="date-cell ${weekendClass}">`;
    html += `      <span class="day-of-week">${dayName}</span>`;
    html += `    </th>`;
  });
  html += '  </tr>';
  html += '</thead>';

  // TABLE BODY
  html += '<tbody>';
  if (filteredStaff.length === 0) {
    html += `  <tr><td colspan="${dates.length + 7}" style="text-align: center; padding: 2rem; color: var(--text-muted);">❌ ບໍ່ພົບຂໍ້ມູນບຸກຄະລາກອນຕາມທີ່ລະບຸ</td></tr>`;
  } else {
    filteredStaff.forEach((staff, index) => {
      html += '  <tr>';
      html += `    <td>${index + 1}</td>`;
      html += `    <td>${staff.name}</td>`;
      html += `    <td>${DEPT_TRANSLATIONS[staff.department.trim()] || staff.department}</td>`;

      let shiftsCount = 0;

      // Render cells for each date
      dates.forEach(date => {
        const dateStr = formatDateISO(date);
        const hasShift = hasActiveShift(staff.id, dateStr);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const cellClass = isWeekend ? 'weekend-cell' : '';

        if (hasShift) {
          shiftsCount += 1.0;
        }

        html += `    <td class="shift-cell ${cellClass}" data-staff-id="${staff.id}" data-date="${dateStr}">`;
        if (hasShift) {
          html += '      <span class="shift-badge">1</span>';
        }
        html += `    </td>`;
      });

      // Stats Calculations
      const rate = staff.rate_per_shift || 0;
      const totalPayout = shiftsCount * rate;

      html += `    <td class="sum-cell">${shiftsCount > 0 ? shiftsCount : ''}</td>`;
      html += `    <td class="sum-cell rate-col">${formatCurrency(rate)}</td>`;
      html += `    <td class="sum-cell payout-col">${totalPayout > 0 ? formatCurrency(totalPayout) : '0'}</td>`;
      html += `    <td style="color: var(--text-muted); font-size: 0.8rem;">${staff.notes || ''}</td>`;
      html += '  </tr>';
    });
  }
  html += '</tbody>';

  rosterGridTable.innerHTML = html;

  // Add click listeners to shift cells
  document.querySelectorAll('#roster-grid-table td.shift-cell').forEach(cell => {
    cell.addEventListener('click', async () => {
      const staffId = cell.dataset.staffId;
      const dateStr = cell.dataset.date;
      await toggleShift(staffId, dateStr);
    });
  });
}

// Check if staff member is on duty on a specific day
function hasActiveShift(staffId, dateStr) {
  return shiftData.some(shift => shift.staff_id === staffId && shift.shift_date === dateStr);
}

// Toggle shift via API
async function toggleShift(staffId, dateStr) {
  try {
    const res = await fetch('/api/shifts/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_id: staffId,
        shift_date: dateStr,
        shift_count: 1.0
      })
    });

    if (!res.ok) {
      throw new Error('Failed to toggle shift');
    }

    const result = await res.json();

    if (result.status === 'added') {
      shiftData.push(result.shift);
    } else {
      shiftData = shiftData.filter(s => !(s.staff_id === staffId && s.shift_date === dateStr));
    }

    // Re-render
    renderRosterGrid();
    renderStats();
  } catch (error) {
    console.error('Error toggling shift:', error);
  }
}

// --- DASHBOARD STATS CALCULATION ---
function renderStats() {
  const activeStaffCount = staffData.length;
  statTotalStaff.textContent = activeStaffCount;

  // Total shifts in current scope
  const totalShiftsCount = shiftData.length;
  statTotalShifts.textContent = totalShiftsCount;

  // Total payout in current scope
  let totalPayrollSum = 0;
  shiftData.forEach(shift => {
    const staff = staffData.find(s => s.id === shift.staff_id);
    if (staff) {
      totalPayrollSum += (staff.rate_per_shift || 0);
    }
  });
  statTotalPayroll.textContent = formatCurrency(totalPayrollSum) + " ₭";

  // Active shifts today
  const todayStr = formatDateISO(new Date());
  const activeTodayCount = shiftData.filter(s => s.shift_date === todayStr).length;
  statActiveToday.textContent = activeTodayCount;
}

// --- STAFF DIRECTORY MODAL ---
function renderStaffModalList() {
  let html = '';
  if (staffData.length === 0) {
    html = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">ບໍ່ມີລາຍຊື່ບຸກຄະລາກອນໃນລະບົບ</td></tr>`;
  } else {
    // Sort by name
    const sorted = [...staffData].sort((a, b) => a.name.localeCompare(b.name, 'lo-LA'));
    sorted.forEach(staff => {
      html += `
        <tr>
          <td><strong>${staff.name}</strong></td>
          <td><span class="status-badge" style="background: rgba(255,255,255,0.04); border-color: var(--border-color);">${DEPT_TRANSLATIONS[staff.department.trim()] || staff.department}</span></td>
          <td style="font-family: var(--font-title); font-weight: 600;">${formatCurrency(staff.rate_per_shift)} ₭</td>
          <td><span style="color: var(--text-muted); font-size: 0.8rem;">${staff.notes || '-'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary action-btn edit-staff-btn" data-id="${staff.id}">✏️ ແກ້ໄຂ</button>
              <button class="btn btn-danger action-btn del-staff-btn" data-id="${staff.id}">🗑️ ລົບ</button>
            </div>
          </td>
        </tr>
      `;
    });
  }
  staffListTbody.innerHTML = html;

  // Add click handlers for Edit/Delete buttons inside Modal
  document.querySelectorAll('.edit-staff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      prepareEditStaff(id);
    });
  });

  document.querySelectorAll('.del-staff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      handleDeleteStaff(id);
    });
  });
}

// Fill form for editing
function prepareEditStaff(id) {
  const staff = staffData.find(s => s.id === id);
  if (!staff) return;

  activeEditStaffId = staff.id;
  inputStaffName.value = staff.name;
  inputStaffDept.value = staff.department;
  inputStaffRate.value = staff.rate_per_shift;
  inputStaffNotes.value = staff.notes || '';

  submitStaffBtn.textContent = 'ອັບເດດຂໍ້ມູນ';
  addStaffForm.querySelector('h3').textContent = '✏️ ແກ້ໄຂຂໍ້ມູນບຸກຄະລາກອນ';

  // Keep department locked for non-admins during edit
  const auth = window.AppAuth;
  if (auth && auth.isReady && !auth.isAdmin && auth.profile && auth.profile.department) {
    inputStaffDept.disabled = true;
  } else {
    inputStaffDept.disabled = false;
  }

  // Scroll form into view
  addStaffForm.scrollIntoView({ behavior: 'smooth' });
}

// Handle Add/Edit Form submission
async function handleStaffFormSubmit() {
  const name = inputStaffName.value.trim();
  const department = inputStaffDept.value.trim();
  const rate_per_shift = parseInt(inputStaffRate.value) || 0;
  const notes = inputStaffNotes.value.trim();

  if (!name || !department) {
    alert('ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ (*) ໃຫ້ຄົບຖ້ວນ');
    return;
  }

  const payload = { name, department, rate_per_shift, notes };

  try {
    let res;
    if (activeEditStaffId) {
      // UPDATE (PUT)
      res = await fetch(`/api/staff/${activeEditStaffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // ADD (POST)
      res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'API request failed');
    }

    const updatedOrNewStaff = await res.json();

    if (activeEditStaffId) {
      staffData = staffData.map(s => s.id === activeEditStaffId ? updatedOrNewStaff : s);
    } else {
      staffData.push(updatedOrNewStaff);
    }

    resetStaffForm();
    populateDepartmentDropdown();
    renderStaffModalList();
    renderRosterGrid();
    renderStats();
  } catch (error) {
    console.error('Error saving staff:', error);
    alert(error.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ');
  }
}

// Handle Delete Staff
async function handleDeleteStaff(id) {
  const staff = staffData.find(s => s.id === id);
  if (!staff) return;

  if (!confirm(`ທ່ານແນ່ໃຈຫຼືບໍ່ທີ່ຈະລົບລາຍຊື່ "${staff.name}" ອອກຈາກລະບົບ? ການເຮັດແນວນີ້ຈະລົບຕາຕະລາງເຂົ້າເວນທັງໝົດຂອງບຸກຄົນນີ້ດ້ວຍ!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/staff/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete staff member');

    // Remove from state
    staffData = staffData.filter(s => s.id !== id);
    shiftData = shiftData.filter(s => s.staff_id !== id);

    showToast('ລົບຂໍ້ມູນບຸກຄະລາກອນສຳເລັດ', 'warning');
    populateDepartmentDropdown();
    renderStaffModalList();
    renderRosterGrid();
    renderStats();
  } catch (error) {
    console.error('Error deleting staff:', error);
    showToast('ເກີດຂໍ້ຜິດພາດໃນການລົບຂໍ້ມູນ', 'error');
  }
}

// --- USER DIRECTORY MODAL ---
function closeUsersModal() {
  usersModal.classList.remove('active');
  resetUserForm();
}

function resetUserForm() {
  activeEditUserId = null;
  addUserForm.reset();
  submitUserBtn.textContent = 'ບັນທຶກຂໍ້ມູນ';
  addUserForm.querySelector('h3').textContent = '➕ ເພີ່ມຜູ້ໃຊ້ງານໃຫມ່';
}

async function renderUsersModalList() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    usersData = await res.json();

    let html = '';
    if (usersData.length === 0) {
      html = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">ບໍ່ມີລາຍຊື່ຜູ້ໃຊ້ງານໃນລະບົບ</td></tr>`;
    } else {
      usersData.forEach(user => {
        html += `
          <tr>
            <td><strong>${user.username}</strong></td>
            <td><span class="status-badge" style="background: rgba(255,255,255,0.04); border-color: var(--border-color);">${user.role}</span></td>
            <td>${DEPT_TRANSLATIONS[user.department] || user.department || '-'}</td>
            <td><span style="font-family: monospace;">${user.password}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn btn-secondary action-btn edit-user-btn" data-id="${user.id}">✏️ ແກ້ໄຂ</button>
                <button class="btn btn-danger action-btn del-user-btn" data-id="${user.id}">🗑️ ລົບ</button>
              </div>
            </td>
          </tr>
        `;
      });
    }
    usersListTbody.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        prepareEditUser(id);
      });
    });

    document.querySelectorAll('.del-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        handleDeleteUser(id);
      });
    });
  } catch (error) {
    console.error('Error rendering users list:', error);
  }
}

function prepareEditUser(id) {
  const user = usersData.find(u => u.id === id);
  if (!user) return;

  activeEditUserId = user.id;
  inputUserName.value = user.username;
  inputUserPassword.value = user.password;
  inputUserRole.value = user.role;
  inputUserDept.value = user.department || '';

  submitUserBtn.textContent = 'ອັບເດດຂໍ້ມູນ';
  addUserForm.querySelector('h3').textContent = '✏️ ແກ້ໄຂຂໍ້ມູນຜູ້ໃຊ້ງານ';

  addUserForm.scrollIntoView({ behavior: 'smooth' });
}

async function handleUserFormSubmit() {
  const username = inputUserName.value.trim();
  const password = inputUserPassword.value.trim();
  const role = inputUserRole.value;
  const department = inputUserDept.value || null;

  if (!username || !password || !role) {
    alert('ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ (*) ໃຫ້ຄົບຖ້ວນ');
    return;
  }

  const payload = { username, password, role, department };

  try {
    let res;
    if (activeEditUserId) {
      // UPDATE (PUT)
      res = await fetch(`/api/users/${activeEditUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // ADD (POST)
      res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'API request failed');
    }

    resetUserForm();
    await renderUsersModalList();
  } catch (error) {
    console.error('Error saving user:', error);
    alert(error.message || 'ເກີດຂໍ້ຜິດພາດໃນการບັນທຶກຂໍ້ມູນ');
  }
}

async function handleDeleteUser(id) {
  const user = usersData.find(u => u.id === id);
  if (!user) return;

  if (user.username.toLowerCase() === 'admin') {
    alert('ບໍ່ສາມາດລົບຜູ້ດູແລລະບົບຫຼັກໄດ້!');
    return;
  }

  if (!confirm(`ທ່ານແນ່ໃຈຫຼືບໍ່ທີ່ຈະລົບຜູ້ໃຊ້ງານ "${user.username}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete user');

    await renderUsersModalList();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(error.message || 'ເກີດຂໍ້ຜິດພາດໃນການລົບຂໍ້ມູນ');
  }
}

// --- TOAST SYSTEMS ---
function showToast(message, type = 'success') {
  // Toast notifications disabled by user request
}

// --- GENERAL UTILITY FUNCTIONS ---
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCurrency(num) {
  return Number(num).toLocaleString('en-US');
}
