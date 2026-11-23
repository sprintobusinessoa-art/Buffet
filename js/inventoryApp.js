(function() {
  'use strict';
  window.Wared = window.Wared || {};

  const { BUFFET_INVENTORY_CATEGORIES } = window.Wared.Catalog;
  const { toArabicDigits, formatNumber, escapeHtml } = window.Wared.Formatters;
  const { syncInventoryToGoogleSheets } = window.Wared.SheetsSync;
  const { getCurrentEmployee, loginEmployee, logoutEmployee, renderLogoutButton, confirmLogout, renderLoginScreen } = window.Wared.Auth;

  const INVENTORY_STORAGE_KEY = 'wared_buffet_inventory_v2';
  const BRAND_LOGO_PATH = 'logo.png';
  const SERVER_DATE_KEY = '2026-11-23';
  const SERVER_DATE_AR = '٢٣ نوفمبر ٢٠٢٦';

  const PERIODS = [
    { id: 'morning', label: 'الجرد الصباحي', short: 'الصباحي', desc: 'بداية اليوم قبل التشغيل' },
    { id: 'midday', label: 'جرد نص اليوم', short: 'نص اليوم', desc: 'مراجعة الكميات أثناء التشغيل' },
    { id: 'closing', label: 'الجرد الختامي', short: 'الختامي', desc: 'العدّ الفعلي قبل الإغلاق' }
  ];

  function createEmptyCounts() {
    const counts = {};
    BUFFET_INVENTORY_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => { counts[item.id] = ''; });
    });
    return counts;
  }

  function loadInventoryState() {
    try {
      const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.serverDate === SERVER_DATE_KEY ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveInventoryState(persisted) {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore
    }
  }

  const saved = loadInventoryState();

  let state = {
    serverDate: SERVER_DATE_KEY,
    activeView: saved?.activeView || 'home',
    activePeriod: saved?.activePeriod || 'morning',
    lockedPeriods: saved?.lockedPeriods || { morning: false, midday: false, closing: false },
    periodTeams: saved?.periodTeams || {
      morning: { shift: '', coWorkers: [] },
      midday: { shift: '', coWorkers: [] },
      closing: { shift: '', coWorkers: [] }
    },
    drafts: saved?.drafts || {
      morning: { counts: createEmptyCounts(), damaged: [] },
      midday: { counts: createEmptyCounts(), damaged: [] },
      closing: { counts: createEmptyCounts(), damaged: [] }
    },
    // Modal state for "انت هتجرد انت ومين؟"
    teamModalPeriod: null,
    coWorkerInput: '',
    dirty: false,
    confirmSubmitModalOpen: false,
    confirmBackModalOpen: false,
    toasts: []
  };

  function persistAll() {
    saveInventoryState({
      serverDate: state.serverDate,
      activeView: state.activeView,
      activePeriod: state.activePeriod,
      lockedPeriods: state.lockedPeriods,
      periodTeams: state.periodTeams,
      drafts: state.drafts
    });
  }

  function showToast(message) {
    const id = 'toast-' + Date.now() + Math.random().toString(16).slice(2);
    state = { ...state, toasts: [...state.toasts, { id, message }] };
    render();
    setTimeout(() => {
      state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
      render();
    }, 3200);
  }

  function canOpenPeriod(periodId) {
    if (state.lockedPeriods[periodId]) return false;
    if (periodId === 'morning') return true;
    if (periodId === 'midday') return Boolean(state.lockedPeriods.morning);
    if (periodId === 'closing') return Boolean(state.lockedPeriods.morning && state.lockedPeriods.midday);
    return false;
  }

  function getAllItemNames() {
    const list = [];
    BUFFET_INVENTORY_CATEGORIES.forEach((c) => c.items.forEach((it) => list.push(it.name)));
    return list;
  }

  function getFullTeamForPeriod(periodId) {
    const me = getCurrentEmployee();
    const co = state.periodTeams[periodId]?.coWorkers || [];
    return me ? [me, ...co] : co;
  }

  function validateCurrentPeriod() {
    const periodDraft = state.drafts[state.activePeriod];
    for (const cat of BUFFET_INVENTORY_CATEGORIES) {
      for (const item of cat.items) {
        const raw = periodDraft.counts[item.id];
        if (raw === '' || raw === null || raw === undefined) {
          return { ok: false, error: `يرجى كتابة العدد الفعلي لصنف "${item.name}" (اكتب 0 إذا كان منتهياً)` };
        }
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
          return { ok: false, error: `قيمة غير صالحة لصنف "${item.name}"` };
        }
      }
    }
    for (const dmg of periodDraft.damaged) {
      const qty = Number(dmg.qty);
      if (!dmg.itemName || !Number.isFinite(qty) || qty <= 0) {
        return { ok: false, error: 'يرجى تحديد اسم الصنف وعدد القطع التالفة (١ فأكثر)' };
      }
    }
    return { ok: true };
  }

  function calcPeriodTotal(periodId) {
    const counts = state.drafts[periodId]?.counts || {};
    return Object.values(counts).reduce((sum, v) => sum + (v === '' ? 0 : Number(v) || 0), 0);
  }

  function renderHomeView() {
    return `
      <div class="card p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div>
            <h2 class="text-base font-bold text-[#132E39]">اختر فترة الجرد</h2>
            <p class="text-xs text-[#637880] mt-0.5">التسلسل الإجباري: الصباحي ← نص اليوم ← الختامي (القفل التام بعد الاعتماد).</p>
          </div>
          <div class="px-3 py-1.5 rounded-xl bg-[#F1F5F7] border border-[#DCE6E8] text-xs font-bold text-[#132E39] flex items-center gap-1.5">
            <i data-lucide="calendar" class="w-4 h-4 text-[#087E78]"></i>
            <span>تاريخ السيرفر: ${SERVER_DATE_AR}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${PERIODS.map((p, idx) => {
            const isLockedDone = Boolean(state.lockedPeriods[p.id]);
            const isAllowed = canOpenPeriod(p.id);
            return `
              <div class="rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                isLockedDone
                  ? 'bg-[#F1F5F7] border-[#DCE6E8] opacity-80'
                  : isAllowed
                  ? 'bg-white border-[#99D5CF] shadow-sm'
                  : 'bg-[#F8FAFB] border-[#EAEFF1] opacity-75'
              }">
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="w-7 h-7 rounded-full text-xs font-bold inline-flex items-center justify-center ${
                      isLockedDone ? 'bg-[#132E39] text-white' : isAllowed ? 'bg-[#087E78] text-white' : 'bg-[#E2E8F0] text-[#64748B]'
                    }">
                      ${isLockedDone ? '<i data-lucide="lock" class="w-3.5 h-3.5"></i>' : toArabicDigits(idx + 1)}
                    </span>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isLockedDone
                        ? 'bg-[#E2E8F0] text-[#475569]'
                        : isAllowed
                        ? 'bg-[#E6F4F1] text-[#087E78]'
                        : 'bg-amber-50 text-amber-700'
                    }">
                      ${isLockedDone ? 'مقفل ومعتمد' : isAllowed ? 'متاح للجرد' : 'مقفل حالياً'}
                    </span>
                  </div>
                  <h3 class="text-base font-bold text-[#132E39]">${p.label}</h3>
                  <p class="text-xs text-[#637880] mt-1">${p.desc}</p>
                </div>

                <button
                  type="button"
                  data-action="click-period-card"
                  data-period="${p.id}"
                  ${!isAllowed ? 'disabled' : ''}
                  class="mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
                    isAllowed ? 'btn-primary' : 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
                  }"
                >
                  <i data-lucide="${isLockedDone ? 'lock' : isAllowed ? 'clipboard-check' : 'lock'}" class="w-4 h-4"></i>
                  <span>${isLockedDone ? 'تم الاعتماد والإغلاق التام' : isAllowed ? 'بدء تسجيل الجرد' : 'بانتظار الفترة السابقة'}</span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderCountingView() {
    const periodMeta = PERIODS.find((p) => p.id === state.activePeriod) || PERIODS[0];
    const periodDraft = state.drafts[state.activePeriod];
    const teamMeta = state.periodTeams[state.activePeriod] || { shift: 'morning', coWorkers: [] };
    const fullTeam = getFullTeamForPeriod(state.activePeriod);
    const totalValid = calcPeriodTotal(state.activePeriod);
    const allNames = getAllItemNames();

    return `
      <div class="grid grid-cols-3 gap-2.5 mb-5">
        ${PERIODS.map((p) => {
          const isCurrent = p.id === state.activePeriod;
          const isLockedDone = Boolean(state.lockedPeriods[p.id]);
          const isAllowed = canOpenPeriod(p.id);
          return `
            <button
              type="button"
              data-action="click-period-card"
              data-period="${p.id}"
              ${!isAllowed && !isCurrent ? 'disabled' : ''}
              class="py-3 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                isCurrent
                  ? 'bg-[#E6F4F1] border-[#087E78] text-[#087E78]'
                  : isLockedDone
                  ? 'bg-[#F1F5F7] border-[#DCE6E8] text-[#94A3B8] cursor-not-allowed'
                  : isAllowed
                  ? 'bg-white border-[#DCE6E8] text-[#132E39] cursor-pointer'
                  : 'bg-[#F8FAFB] border-[#EAEFF1] text-[#94A3B8] cursor-not-allowed'
              }"
            >
              ${isLockedDone || !isAllowed ? '<i data-lucide="lock" class="w-3.5 h-3.5"></i>' : ''}
              <span>${p.short}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="card p-5 sm:p-6 mb-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-[#EAEFF1]">
          <div>
            <h2 class="text-lg font-bold text-[#132E39]">${periodMeta.label}</h2>
            <p class="text-xs text-[#637880] mt-0.5">
              الشيفت: ${teamMeta.shift === 'evening' ? 'مسائي' : 'صباحي'} • المشاركون: ${fullTeam.map(escapeHtml).join('، ')}
            </p>
          </div>
          <div class="px-4 py-2 rounded-xl bg-[#E6F4F1] text-[#087E78] text-sm font-extrabold" id="inv-total-badge">
            الإجمالي السليم: ${formatNumber(totalValid)} قطعة
          </div>
        </div>

        <div class="space-y-5">
          ${BUFFET_INVENTORY_CATEGORIES.map((cat) => `
            <div class="rounded-xl border border-[#EAEFF1] overflow-hidden">
              <div class="bg-[#F8FAFB] px-4 py-2.5 text-xs font-bold text-[#132E39] border-b border-[#EAEFF1]">
                ${cat.label}
              </div>
              <div class="divide-y divide-[#EAEFF1]">
                ${cat.items.map((item) => `
                  <div class="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <span class="text-xs sm:text-sm font-semibold text-[#132E39]">${item.name}</span>
                    <div class="w-32 sm:w-40">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0 فأكثر"
                        class="wared-input text-center font-bold"
                        value="${escapeHtml(periodDraft.counts[item.id] ?? '')}"
                        data-action="count-input"
                        data-item-id="${item.id}"
                      />
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card p-5 sm:p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-[#132E39]">قسم التوالف</h3>
            <p class="text-xs text-[#637880] mt-0.5">رصد أي قطع تالفة أثناء العدّ الفعلي (اختياري).</p>
          </div>
          <button type="button" data-action="add-damaged" class="btn-secondary px-3.5 py-2 text-xs text-[#087E78] border-[#99D5CF]">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>إضافة صنف تالف جديد</span>
          </button>
        </div>

        ${periodDraft.damaged.length === 0 ? `
          <div class="text-center py-6 bg-[#F8FAFB] rounded-xl border border-dashed border-[#DCE6E8] text-xs text-[#8FA1A8]">
            لا توجد توالف مسجلة في هذه الفترة حتى الآن.
          </div>
        ` : `
          <div class="space-y-3">
            ${periodDraft.damaged.map((dmg) => `
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-[#FEF2F2]/60 border border-[#FECACA] rounded-xl p-3">
                <div class="sm:col-span-5">
                  <select class="wared-input text-xs font-semibold" data-action="dmg-name" data-dmg-id="${dmg.id}">
                    ${allNames.map((n) => `<option value="${escapeHtml(n)}" ${dmg.itemName === n ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
                  </select>
                </div>
                <div class="sm:col-span-2">
                  <input type="number" min="1" step="1" placeholder="العدد" class="wared-input text-xs font-bold text-center"
                    value="${Number(dmg.qty) || 1}" data-action="dmg-qty" data-dmg-id="${dmg.id}" />
                </div>
                <div class="sm:col-span-4">
                  <input type="text" placeholder="سبب التلف (إن وُجد)..." class="wared-input text-xs"
                    value="${escapeHtml(dmg.reason || '')}" data-action="dmg-reason" data-dmg-id="${dmg.id}" />
                </div>
                <div class="sm:col-span-1 flex justify-end">
                  <button type="button" data-action="remove-damaged" data-dmg-id="${dmg.id}" class="text-red-500 hover:text-red-700 p-1.5 cursor-pointer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <button type="button" data-action="go-back-home" class="btn-secondary w-full sm:w-auto px-5 py-3 text-xs">
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
          <span>رجوع لأنواع الجرد</span>
        </button>

        <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button type="button" data-action="save-draft" class="btn-secondary w-full sm:w-auto px-5 py-3 text-xs">
            حفظ كمسودة
          </button>
          <button type="button" data-action="request-submit" class="btn-primary w-full sm:w-auto px-6 py-3 text-sm">
            <i data-lucide="lock" class="w-4 h-4"></i>
            <span>حفظ الجرد (اعتماد نهائي)</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderTeamModal() {
    if (!state.teamModalPeriod) return '';
    const pMeta = PERIODS.find((p) => p.id === state.teamModalPeriod) || PERIODS[0];
    const teamMeta = state.periodTeams[state.teamModalPeriod] || { shift: '', coWorkers: [] };
    const me = getCurrentEmployee();

    return `
      <div class="fixed inset-0 bg-[#132E39]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-team-modal">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE6E8]">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-[#132E39]">إنت هتجرد إنت ومين؟ (${pMeta.label})</h3>
              <p class="text-xs text-[#637880] mt-0.5">اسمك متسجل تلقائياً، اختر الشيفت وضيف أي زميل مشارك معاك.</p>
            </div>
            <button type="button" data-action="close-team-modal" class="text-[#8FA1A8] hover:text-[#132E39] cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <div class="space-y-4">
            <!-- Current Logged-in Employee (Auto-included) -->
            <div>
              <label class="block text-xs font-semibold text-[#637880] mb-1.5">الموظف الرئيسي (مسجل تلقائياً)</label>
              <div class="px-3.5 py-2.5 rounded-xl bg-[#E6F4F1] border border-[#99D5CF] text-xs font-bold text-[#087E78] flex items-center gap-2">
                <i data-lucide="user-check" class="w-4 h-4"></i>
                <span>${escapeHtml(me)}</span>
              </div>
            </div>

            <!-- Shift Selection -->
            <div>
              <label class="block text-xs font-semibold text-[#637880] mb-1.5">نوع الشيفت <span class="text-red-500">*</span></label>
              <div class="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-action="modal-select-shift"
                  data-shift="morning"
                  class="py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    teamMeta.shift === 'morning'
                      ? 'bg-[#087E78] text-white border-[#087E78]'
                      : 'bg-[#F8FAFB] text-[#132E39] border-[#DCE6E8]'
                  }"
                >شيفت صباحي</button>
                <button
                  type="button"
                  data-action="modal-select-shift"
                  data-shift="evening"
                  class="py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    teamMeta.shift === 'evening'
                      ? 'bg-[#087E78] text-white border-[#087E78]'
                      : 'bg-[#F8FAFB] text-[#132E39] border-[#DCE6E8]'
                  }"
                >شيفت مسائي</button>
              </div>
            </div>

            <!-- Co-workers -->
            <div>
              <label class="block text-xs font-semibold text-[#637880] mb-1.5">مين هيجرد معاك تاني؟ (موظف، اتنين، تلاتة...)</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="اكتب اسم الزميل المشارك واضغط إضافة..."
                  class="wared-input font-semibold flex-1 text-xs"
                  value="${escapeHtml(state.coWorkerInput)}"
                  data-action="coworker-input"
                />
                <button type="button" data-action="add-coworker" class="btn-secondary px-3.5 py-2 text-xs text-[#087E78] border-[#99D5CF] shrink-0">
                  + إضافة
                </button>
              </div>
              ${teamMeta.coWorkers.length > 0 ? `
                <div class="flex flex-wrap gap-2 mt-2.5">
                  ${teamMeta.coWorkers.map((cw, idx) => `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F7F8] border border-[#DCE6E8] text-xs font-bold text-[#132E39]">
                      <span>${escapeHtml(cw)}</span>
                      <button type="button" data-action="remove-coworker" data-idx="${idx}" class="text-[#637880] hover:text-red-600 cursor-pointer">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                      </button>
                    </span>
                  `).join('')}
                </div>
              ` : `
                <div class="text-[11px] text-[#8FA1A8] mt-1.5">لو بتجرد لوحدك تقدر تبدأ الجرد مباشرة.</div>
              `}
            </div>
          </div>

          <div class="flex gap-2.5 mt-6">
            <button type="button" data-action="confirm-team-start" class="btn-primary flex-1 py-2.5 text-xs">بدء الجرد الآن</button>
            <button type="button" data-action="close-team-modal" class="btn-secondary px-4 py-2.5 text-xs">إلغاء</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachLogoFallback() {
    const logoImg = document.getElementById('brand-logo-img');
    const logoFallback = document.getElementById('brand-logo-fallback');
    if (!logoImg || !logoFallback) return;
    logoImg.addEventListener('error', () => { logoImg.classList.add('hidden'); logoFallback.classList.remove('hidden'); }, { once: true });
    logoImg.addEventListener('load', () => { logoImg.classList.remove('hidden'); logoFallback.classList.add('hidden'); }, { once: true });
  }

  function render() {
    const root = document.getElementById('inventory-app-root');
    if (!root) return;

    const empName = getCurrentEmployee();

    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="flex items-center gap-3">
              <a href="index.html" class="px-2.5 py-1 rounded-lg bg-[#F5F7F8] hover:bg-[#E6F4F1] text-xs font-bold text-[#132E39] hover:text-[#087E78] border border-[#DCE6E8] transition-colors no-underline">← الرئيسية</a>
              <div class="flex items-center">
                <img id="brand-logo-img" src="${BRAND_LOGO_PATH}" alt="شعار جرد البوفيه" class="h-9 sm:h-10 w-auto max-w-[150px] object-contain" />
                <div id="brand-logo-fallback" class="hidden h-9 px-3 rounded-xl border border-dashed border-[#A7DCD7] bg-[#EFF8F6] text-[#087E78] items-center justify-center text-xs font-bold whitespace-nowrap flex">LOGO (logo.png)</div>
              </div>
              <div class="text-base sm:text-lg font-extrabold text-[#132E39] leading-none">جرد البوفيه</div>
            </div>

            ${empName ? `
              <div class="flex items-center gap-2.5">
                <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4F1] text-[#087E78] text-xs font-bold">
                  <i data-lucide="user" class="w-3.5 h-3.5"></i>
                  <span>${escapeHtml(empName)}</span>
                </span>
                ${renderLogoutButton()}
              </div>
            ` : ''}
          </div>
        </header>

        <main class="page-content">
          ${empName ? `
            <div class="mb-5">
              <h1 class="text-2xl sm:text-[28px] font-extrabold text-[#132E39] tracking-tight">وحدة جرد البوفيه</h1>
              <p class="text-xs sm:text-sm text-[#637880] mt-1">اختر فترة الجرد وحدد الزملاء المشاركين معك قبل العدّ.</p>
            </div>
            ${state.activeView === 'home' ? renderHomeView() : renderCountingView()}
          ` : renderLoginScreen('تسجيل دخول الموظف — جرد البوفيه')}
        </main>
      </div>

      ${renderTeamModal()}

      ${state.confirmSubmitModalOpen ? `
        <div class="fixed inset-0 bg-[#132E39]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-submit-modal">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 class="text-base font-bold text-[#132E39] mb-2">تأكيد الاعتماد النهائي للجرد</h3>
            <p class="text-xs text-[#637880] leading-relaxed mb-5">
              بعد الضغط على تأكيد، سيتم إغلاق هذه الفترة نهائياً ولن يتمكن أي شخص من فتحها أو تعديلها أو مشاهدة أرقامها حتى الغد. هل أنت متأكد؟
            </p>
            <div class="flex gap-2.5">
              <button type="button" data-action="confirm-submit" class="btn-primary flex-1 py-2.5 text-xs">نعم، اعتمد واقفل الفترة</button>
              <button type="button" data-action="close-submit-modal" class="btn-secondary flex-1 py-2.5 text-xs">تراجع</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${state.confirmBackModalOpen ? `
        <div class="fixed inset-0 bg-[#132E39]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-back-modal">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 class="text-base font-bold text-[#132E39] mb-2">تحذير قبل الخروج</h3>
            <p class="text-xs text-[#637880] leading-relaxed mb-5">
              قمت بتعديل أرقام ولم تضغط "حفظ كمسودة" أو "حفظ الجرد". البيانات محفوظة تلقائياً على الجهاز، هل تريد الرجوع للشاشة الرئيسية؟
            </p>
            <div class="flex gap-2.5">
              <button type="button" data-action="confirm-back" class="btn-primary flex-1 py-2.5 text-xs">نعم، ارجع للرئيسية</button>
              <button type="button" data-action="close-back-modal" class="btn-secondary flex-1 py-2.5 text-xs">البقاء في الجرد</button>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="toast-container" aria-live="polite">
        ${state.toasts.map((t) => `
          <div class="toast-item">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-[#3BB2AC] shrink-0"></i>
            <span>${escapeHtml(t.message)}</span>
          </div>
        `).join('')}
      </div>
    `;

    attachLogoFallback();
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  document.addEventListener('click', async (e) => {
    if (e.target.dataset?.backdrop === 'close-submit-modal') { state = { ...state, confirmSubmitModalOpen: false }; render(); return; }
    if (e.target.dataset?.backdrop === 'close-back-modal') { state = { ...state, confirmBackModalOpen: false }; render(); return; }
    if (e.target.dataset?.backdrop === 'close-team-modal') { state = { ...state, teamModalPeriod: null }; render(); return; }

    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'global-login-submit') {
      const inp = document.getElementById('global-login-input');
      if (inp && loginEmployee(inp.value)) render();
    } else if (action === 'global-logout') {
      confirmLogout(() => { render(); });
    } else if (action === 'click-period-card') {
      const pId = target.dataset.period;
      if (!canOpenPeriod(pId)) {
        showToast('هذه الفترة مقفلة — تأكد من اعتماد الفترة السابقة');
        return;
      }
      state = { ...state, teamModalPeriod: pId, coWorkerInput: '' };
      render();
    } else if (action === 'close-team-modal') {
      state = { ...state, teamModalPeriod: null };
      render();
    } else if (action === 'modal-select-shift') {
      const pId = state.teamModalPeriod;
      if (!pId) return;
      const cur = state.periodTeams[pId] || { shift: '', coWorkers: [] };
      state = { ...state, periodTeams: { ...state.periodTeams, [pId]: { ...cur, shift: target.dataset.shift } } };
      persistAll();
      render();
    } else if (action === 'add-coworker') {
      const pId = state.teamModalPeriod;
      const name = state.coWorkerInput.trim();
      if (!pId || !name) { showToast('اكتب اسم الزميل المشارك أولاً'); return; }
      const cur = state.periodTeams[pId] || { shift: '', coWorkers: [] };
      if (cur.coWorkers.includes(name) || name === getCurrentEmployee()) {
        showToast('الاسم مضاف بالفعل في الفريق');
        return;
      }
      state = {
        ...state,
        coWorkerInput: '',
        periodTeams: { ...state.periodTeams, [pId]: { ...cur, coWorkers: [...cur.coWorkers, name] } }
      };
      persistAll();
      render();
    } else if (action === 'remove-coworker') {
      const pId = state.teamModalPeriod;
      const idx = Number(target.dataset.idx);
      const cur = state.periodTeams[pId] || { shift: '', coWorkers: [] };
      state = {
        ...state,
        periodTeams: { ...state.periodTeams, [pId]: { ...cur, coWorkers: cur.coWorkers.filter((_, i) => i !== idx) } }
      };
      persistAll();
      render();
    } else if (action === 'confirm-team-start') {
      const pId = state.teamModalPeriod;
      const cur = state.periodTeams[pId] || { shift: '', coWorkers: [] };
      if (!cur.shift) {
        showToast('اختر نوع الشيفت (صباحي أو مسائي) أولاً');
        return;
      }
      state = { ...state, teamModalPeriod: null, activeView: 'count', activePeriod: pId };
      persistAll();
      render();
    } else if (action === 'add-damaged') {
      const firstItem = getAllItemNames()[0] || 'شاي';
      const cur = state.drafts[state.activePeriod];
      const nextDmg = [...cur.damaged, { id: 'dmg-' + Date.now(), itemName: firstItem, qty: 1, reason: '' }];
      state = { ...state, dirty: true, drafts: { ...state.drafts, [state.activePeriod]: { ...cur, damaged: nextDmg } } };
      persistAll();
      render();
    } else if (action === 'remove-damaged') {
      const cur = state.drafts[state.activePeriod];
      const nextDmg = cur.damaged.filter((d) => d.id !== target.dataset.dmgId);
      state = { ...state, dirty: true, drafts: { ...state.drafts, [state.activePeriod]: { ...cur, damaged: nextDmg } } };
      persistAll();
      render();
    } else if (action === 'save-draft') {
      state = { ...state, dirty: false };
      persistAll();
      showToast('تم حفظ المسودة بنجاح على الجهاز');
    } else if (action === 'go-back-home') {
      if (state.dirty) {
        state = { ...state, confirmBackModalOpen: true };
        render();
      } else {
        state = { ...state, activeView: 'home' };
        persistAll();
        render();
      }
    } else if (action === 'confirm-back') {
      state = { ...state, confirmBackModalOpen: false, activeView: 'home', dirty: false };
      persistAll();
      render();
    } else if (action === 'close-back-modal') {
      state = { ...state, confirmBackModalOpen: false };
      render();
    } else if (action === 'request-submit') {
      const check = validateCurrentPeriod();
      if (!check.ok) { showToast(check.error); return; }
      state = { ...state, confirmSubmitModalOpen: true };
      render();
    } else if (action === 'close-submit-modal') {
      state = { ...state, confirmSubmitModalOpen: false };
      render();
    } else if (action === 'confirm-submit') {
      const pId = state.activePeriod;
      const periodDraft = state.drafts[pId];
      const teamMeta = state.periodTeams[pId] || { shift: 'morning', coWorkers: [] };
      await syncInventoryToGoogleSheets({
        serverDate: state.serverDate,
        periodLabel: PERIODS.find((p) => p.id === pId)?.label || pId,
        shift: teamMeta.shift,
        team: getFullTeamForPeriod(pId),
        validItems: Object.entries(periodDraft.counts),
        damagedItems: periodDraft.damaged,
        submittedAt: new Date().toISOString()
      });

      state = {
        ...state,
        confirmSubmitModalOpen: false,
        dirty: false,
        activeView: 'home',
        lockedPeriods: { ...state.lockedPeriods, [pId]: true },
        drafts: { ...state.drafts, [pId]: { counts: createEmptyCounts(), damaged: [] } }
      };
      persistAll();
      render();
      showToast('تم اعتماد الجرد وإغلاق الفترة نهائياً');
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset?.action;
    if (!action) return;

    if (action === 'coworker-input') {
      state = { ...state, coWorkerInput: target.value };
    } else if (action === 'count-input') {
      const itemId = target.dataset.itemId;
      const raw = target.value;
      const clean = raw === '' ? '' : String(Math.max(0, Math.floor(Number(raw) || 0)));
      if (raw !== '' && Number(raw) < 0) target.value = '0';
      const cur = state.drafts[state.activePeriod];
      state = {
        ...state,
        dirty: true,
        drafts: {
          ...state.drafts,
          [state.activePeriod]: { ...cur, counts: { ...cur.counts, [itemId]: clean } }
        }
      };
      persistAll();
      const badge = document.getElementById('inv-total-badge');
      if (badge) badge.textContent = `الإجمالي السليم: ${formatNumber(calcPeriodTotal(state.activePeriod))} قطعة`;
    } else if (action === 'dmg-qty') {
      const cur = state.drafts[state.activePeriod];
      const nextDmg = cur.damaged.map((d) => d.id === target.dataset.dmgId ? { ...d, qty: Math.max(1, Math.floor(Number(target.value) || 1)) } : d);
      state = { ...state, dirty: true, drafts: { ...state.drafts, [state.activePeriod]: { ...cur, damaged: nextDmg } } };
      persistAll();
    } else if (action === 'dmg-reason') {
      const cur = state.drafts[state.activePeriod];
      const nextDmg = cur.damaged.map((d) => d.id === target.dataset.dmgId ? { ...d, reason: target.value } : d);
      state = { ...state, dirty: true, drafts: { ...state.drafts, [state.activePeriod]: { ...cur, damaged: nextDmg } } };
      persistAll();
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset?.action === 'dmg-name') {
      const cur = state.drafts[state.activePeriod];
      const nextDmg = cur.damaged.map((d) => d.id === target.dataset.dmgId ? { ...d, itemName: target.value } : d);
      state = { ...state, dirty: true, drafts: { ...state.drafts, [state.activePeriod]: { ...cur, damaged: nextDmg } } };
      persistAll();
    }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
