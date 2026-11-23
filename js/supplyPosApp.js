(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { PRODUCT_PRESETS } = window.Wared.Catalog;
  const { formatNumber, toArabicDigits, formatTodayArabic, escapeHtml, sanitizeImageDataUrl } = window.Wared.Formatters;
  const { getCurrentEmployee, loginEmployee, logoutEmployee, renderLoginScreen } = window.Wared.Auth;
/* ==========================================================================
   Standalone Page: توريد من المخزن إلى نقطة البيع (With Employee Name + PNG)
   ========================================================================== */


const SUPPLY_STORAGE_KEY = 'wared_pos_supplies_v1';
const BRAND_LOGO_PATH = 'logo.png';

function createSupplyItem(presetIndex = 0) {
  const preset = PRODUCT_PRESETS[presetIndex] || PRODUCT_PRESETS[0];
  return {
    id: 'sup-item-' + Date.now() + Math.random().toString(16).slice(2, 6),
    name: preset.name,
    isCustomName: false,
    piecesQty: 1
  };
}

let state = {
  helpModalOpen: false,
  employeeName: getCurrentEmployee(),
  receiptImageUrl: '',
  receiptOrderNumber: '',
  items: [createSupplyItem(0)],
  suppliesHistory: (() => {
    try {
      const raw = localStorage.getItem(SUPPLY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })(),
  toasts: []
};

function showToast(message) {
  const id = 'toast-' + Date.now() + Math.random().toString(16).slice(2);
  state = { ...state, toasts: [...state.toasts, { id, message }] };
  render();
  setTimeout(() => {
    state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
    render();
  }, 3200);
}

function generateSupplyReceiptImage(items, orderNum, employeeName) {
  const rowHeight = 52;
  const headerHeight = 220;
  const footerHeight = 150;
  const width = 760;
  const height = headerHeight + items.length * rowHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#132E39';
  ctx.fillRect(0, 0, width, 134);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText('توريد من المخزن إلى نقطة البيع', width / 2, 50);

  ctx.fillStyle = '#99D5CF';
  ctx.font = '16px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(`إذن توريد رقم #${orderNum}  •  ${formatTodayArabic()}`, width / 2, 86);
  ctx.fillText(`الموظف المسؤول: ${employeeName}`, width / 2, 114);

  const tableTop = 164;
  ctx.fillStyle = '#F5F7F8';
  ctx.fillRect(40, tableTop, width - 80, 44);
  ctx.strokeStyle = '#DCE6E8';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, tableTop, width - 80, 44);

  ctx.fillStyle = '#637880';
  ctx.font = 'bold 16px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('اسم الصنف', width - 64, tableTop + 28);
  ctx.textAlign = 'left';
  ctx.fillText('العدد المورد', 64, tableTop + 28);

  let y = tableTop + 44;
  items.forEach((it, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = '#FAFCFD';
      ctx.fillRect(40, y, width - 80, rowHeight);
    }
    ctx.strokeStyle = '#EAEFF1';
    ctx.beginPath();
    ctx.moveTo(40, y + rowHeight);
    ctx.lineTo(width - 40, y + rowHeight);
    ctx.stroke();

    ctx.fillStyle = '#132E39';
    ctx.font = 'bold 17px "IBM Plex Sans Arabic", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${toArabicDigits(idx + 1)}. ${it.name}`, width - 64, y + 32);

    ctx.fillStyle = '#087E78';
    ctx.textAlign = 'left';
    ctx.fillText(`${formatNumber(it.piecesQty)} قطعة`, 64, y + 32);

    y += rowHeight;
  });

  const totalPieces = items.reduce((s, it) => s + (Number(it.piecesQty) || 0), 0);
  const boxTop = y + 24;
  ctx.fillStyle = '#E6F4F1';
  ctx.fillRect(40, boxTop, width - 80, 88);
  ctx.strokeStyle = '#99D5CF';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(40, boxTop, width - 80, 88);

  ctx.fillStyle = '#132E39';
  ctx.font = 'bold 20px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`إجمالي المورد (${toArabicDigits(items.length)} صنف)`, width - 64, boxTop + 52);

  ctx.fillStyle = '#087E78';
  ctx.font = 'bold 28px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${formatNumber(totalPieces)} قطعة`, 64, boxTop + 54);

  return canvas.toDataURL('image/png');
}

function attachLogoFallback() {
  const logoImg = document.getElementById('brand-logo-img');
  const logoFallback = document.getElementById('brand-logo-fallback');
  if (!logoImg || !logoFallback) return;

  logoImg.addEventListener('error', () => {
    logoImg.classList.add('hidden');
    logoFallback.classList.remove('hidden');
  }, { once: true });

  logoImg.addEventListener('load', () => {
    logoImg.classList.remove('hidden');
    logoFallback.classList.add('hidden');
  }, { once: true });
}

function renderSummaryCard() {
  const totalItems = state.items.length;
  const totalPieces = state.items.reduce((sum, it) => sum + (Number(it.piecesQty) || 0), 0);
  const activeEmp = getCurrentEmployee() || state.employeeName;
  const hasEmployee = Boolean(String(activeEmp || '').trim());
  const canSubmit = hasEmployee && totalItems > 0 && totalPieces > 0 && state.items.every((it) => String(it.name || '').trim() && (Number(it.piecesQty) || 0) > 0);

  return `
    <div class="card p-5 sm:p-6 lg:sticky lg:top-24" id="supply-summary-card">
      <h3 class="text-base font-bold text-[#132E39]">ملخص التوريد</h3>
      <p class="text-xs text-[#637880] mt-0.5 mb-5">من المخزن إلى نقطة البيع</p>

      <div class="space-y-3 text-xs border-b border-[#EAEFF1] pb-4">
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">اسم الموظف</span>
          <span class="font-bold text-[#132E39]">${hasEmployee ? escapeHtml(activeEmp) : 'لم يُحدد'}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">عدد الأصناف</span>
          <span class="font-bold text-[#132E39]">${toArabicDigits(totalItems)} صنف</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">التاريخ</span>
          <span class="font-bold text-[#132E39]">${escapeHtml(formatTodayArabic())}</span>
        </div>
      </div>

      <div class="py-5 text-center">
        <div class="text-xs text-[#637880] mb-1">إجمالي الكمية الموردة</div>
        <div class="flex items-baseline justify-center gap-1.5">
          <span class="text-3xl font-extrabold text-[#087E78]">${formatNumber(totalPieces)}</span>
          <span class="text-xs font-semibold text-[#637880]">قطعة</span>
        </div>
      </div>

      <button
        type="button"
        data-action="submit-supply"
        ${!canSubmit ? 'disabled' : ''}
        class="w-full py-3 px-4 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
          canSubmit
            ? 'btn-primary'
            : 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
        }"
      >
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>تأكيد وإصدار صورة التوريد</span>
      </button>

      <p class="text-[11px] text-[#8FA1A8] text-center mt-3.5 leading-relaxed">
        ${!hasEmployee ? 'يرجى إدخال اسم الموظف المسؤول أولاً لتفعيل التأكيد.' : 'بعد التأكيد سيتم إنشاء ورقة التوريد كصورة جاهزة للتحميل.'}
      </p>
    </div>
  `;
}

function render() {
  const root = document.getElementById('supply-app-root');
  if (!root) return;

  const safeReceiptUrl = sanitizeImageDataUrl(state.receiptImageUrl);

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="flex items-center gap-3">
            <a href="index.html" class="px-2.5 py-1 rounded-lg bg-[#F5F7F8] hover:bg-[#E6F4F1] text-xs font-bold text-[#132E39] hover:text-[#087E78] border border-[#DCE6E8] transition-colors no-underline">← الرئيسية</a>
            <div class="flex items-center">
              <img
                id="brand-logo-img"
                src="${BRAND_LOGO_PATH}"
                alt="شعار توريد من المخزن إلى نقطة البيع"
                class="h-9 sm:h-10 w-auto max-w-[150px] object-contain brand-logo-animated"
              />
              <div
                id="brand-logo-fallback"
                class="hidden h-9 px-3 rounded-xl border border-dashed border-[#A7DCD7] bg-[#EFF8F6] text-[#087E78] items-center justify-center text-xs font-bold whitespace-nowrap flex"
              >
                LOGO (logo.png)
              </div>
            </div>
            <div class="text-sm sm:text-lg font-extrabold text-[#132E39] leading-none">توريد من المخزن إلى نقطة البيع</div>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              data-action="reset-supply"
              class="px-3.5 py-1.5 rounded-full border border-[#DCE6E8] bg-[#F8FAFB] hover:bg-[#EFF8F6] hover:border-[#99D5CF] text-xs font-semibold text-[#132E39] transition-colors cursor-pointer"
            >
              توريد جديد
            </button>
            <button
              type="button"
              data-action="open-help"
              class="p-2 rounded-full text-[#637880] hover:bg-[#F5F7F8] hover:text-[#132E39] transition-colors cursor-pointer"
              aria-label="مساعدة"
            >
              <i data-lucide="help-circle" class="w-5 h-5"></i>
            </button>
          </div>
        </div>
      </header>

      <main class="page-content">
        <div class="mb-6">
          <h1 class="text-2xl sm:text-[28px] font-extrabold text-[#132E39] tracking-tight">توريد من المخزن إلى نقطة البيع</h1>
          <p class="text-xs sm:text-sm text-[#637880] mt-1">سجّل اسم الموظف، ثم اختر اسم الصنف وحدد العدد المورد بالقطعة.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div class="lg:col-span-8 space-y-4">
            <!-- Active Employee Badge -->
            <div class="card px-5 py-3.5 flex items-center justify-between">
              <span class="text-xs text-[#637880]">الموظف المسؤول عن التوريد</span>
              <span class="px-3 py-1 rounded-full bg-[#E6F4F1] text-[#087E78] text-xs font-bold">${escapeHtml(getCurrentEmployee())}</span>
            </div>

            ${state.items.map((item, idx) => {
              const isPreset = !item.isCustomName && PRODUCT_PRESETS.some((p) => p.name === item.name);
              return `
                <div class="card p-5 sm:p-6">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-full bg-[#E6F4F1] text-[#087E78] text-xs font-bold inline-flex items-center justify-center">
                        ${toArabicDigits(idx + 1)}
                      </span>
                      <span class="text-sm font-bold text-[#132E39]">بيانات الصنف</span>
                    </div>
                    <button
                      type="button"
                      data-action="remove-item"
                      data-item-id="${item.id}"
                      class="text-[#8FA1A8] hover:text-red-600 transition-colors p-1 cursor-pointer"
                      title="حذف الصنف"
                    >
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                    <div class="sm:col-span-8">
                      <label class="block text-xs font-semibold text-[#637880] mb-1.5">اسم الصنف</label>
                      <select
                        class="wared-input font-semibold cursor-pointer"
                        data-action="select-preset"
                        data-item-id="${item.id}"
                      >
                        ${PRODUCT_PRESETS.map((p) => `
                          <option value="${escapeHtml(p.name)}" ${isPreset && item.name === p.name ? 'selected' : ''}>${escapeHtml(p.name)}</option>
                        `).join('')}
                        <option value="__custom__" ${!isPreset ? 'selected' : ''}>+ إضافة صنف جديد (كتابة يدوية)...</option>
                      </select>

                      ${!isPreset ? `
                        <input
                          type="text"
                          placeholder="اكتب اسم الصنف الجديد هنا..."
                          class="wared-input mt-2.5 font-semibold border-[#087E78]"
                          value="${escapeHtml(item.name)}"
                          data-action="item-name-input"
                          data-item-id="${item.id}"
                        />
                      ` : ''}
                    </div>

                    <div class="sm:col-span-4">
                      <label class="block text-xs font-semibold text-[#637880] mb-1.5">العدد المورد</label>
                      <div class="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          class="wared-input font-bold text-base pl-14 highlight-teal"
                          value="${Number(item.piecesQty) || 0}"
                          data-action="item-qty-input"
                          data-item-id="${item.id}"
                        />
                        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#087E78]">قطعة</span>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}

            <button
              type="button"
              data-action="add-item"
              class="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-[#A7DCD7] bg-[#EFF8F6] hover:bg-[#E2F3EF] text-[#087E78] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>إضافة صنف آخر</span>
            </button>
          </div>

          <div class="lg:col-span-4" id="supply-summary-slot">
            ${renderSummaryCard()}
          </div>
        </div>
      </main>
    </div>

    ${safeReceiptUrl ? `
      <div class="fixed inset-0 bg-[#132E39]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-receipt">
        <div class="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-[#DCE6E8]">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-bold text-[#132E39]">ورقة إجمالي المورد (جاهزة للتحميل)</h3>
            <button type="button" data-action="close-receipt" class="text-[#8FA1A8] hover:text-[#132E39] cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="bg-[#F5F7F8] rounded-xl p-3 border border-[#EAEFF1] max-h-[62vh] overflow-y-auto">
            <img src="${safeReceiptUrl}" alt="صورة ورقة إجمالي المورد" class="w-full h-auto rounded-lg shadow-sm" />
          </div>
          <div class="flex flex-col sm:flex-row items-center gap-2.5 mt-4">
            <a
              href="${safeReceiptUrl}"
              download="توريد_${escapeHtml(state.receiptOrderNumber)}.png"
              class="btn-primary w-full sm:flex-1 py-2.5 px-4 text-xs text-center no-underline"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>تحميل الورقة كصورة PNG</span>
            </a>
            <button
              type="button"
              data-action="close-receipt"
              class="btn-secondary w-full sm:w-auto py-2.5 px-5 text-xs"
            >
              إغلاق وبدء توريد جديد
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    ${state.helpModalOpen ? `
      <div class="fixed inset-0 bg-[#132E39]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-help">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-bold text-[#132E39]">توريد من المخزن إلى نقطة البيع</h3>
            <button type="button" data-action="close-help" class="text-[#8FA1A8] hover:text-[#132E39] cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <p class="text-xs text-[#637880] leading-relaxed">
            سجّل اسم الموظف ثم اختر الصنف وأدخل الكمية الموردة بالقطعة واضغط <strong class="text-[#132E39]">تأكيد وإصدار صورة التوريد</strong> لتحصل على ورقة الإجمالي كصورة PNG قابلة للتحميل.
          </p>
          <button type="button" data-action="close-help" class="btn-primary w-full py-2.5 text-xs mt-5">فهمت</button>
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

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function setupEvents() {
  document.addEventListener('click', (e) => {
    if (e.target.dataset?.backdrop === 'close-help') {
      state = { ...state, helpModalOpen: false };
      render();
      return;
    }
    if (e.target.dataset?.backdrop === 'close-receipt') {
      state = { ...state, receiptImageUrl: '', items: [createSupplyItem(0)] };
      render();
      return;
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'open-help') {
      state = { ...state, helpModalOpen: true };
      render();
    } else if (action === 'close-help') {
      state = { ...state, helpModalOpen: false };
      render();
    } else if (action === 'close-receipt') {
      state = { ...state, receiptImageUrl: '', items: [createSupplyItem(0)] };
      render();
    } else if (action === 'add-item') {
      const nextIdx = state.items.length % PRODUCT_PRESETS.length;
      state = { ...state, items: [...state.items, createSupplyItem(nextIdx)] };
      render();
    } else if (action === 'remove-item') {
      if (state.items.length <= 1) {
        showToast('يجب أن يحتوي التوريد على صنف واحد على الأقل');
        return;
      }
      state = { ...state, items: state.items.filter((it) => it.id !== target.dataset.itemId) };
      render();
    } else if (action === 'reset-supply') {
      state = { ...state, receiptImageUrl: '', items: [createSupplyItem(0)] };
      render();
      showToast('تم فتح إذن توريد جديد');
    } else if (action === 'submit-supply') {
      const curEmp = getCurrentEmployee() || state.employeeName;
      if (!String(curEmp || '').trim()) {
        showToast('يرجى إدخال اسم الموظف الذي قام بالتوريد');
        return;
      }
      const valid = state.items.every((it) => String(it.name || '').trim() && (Number(it.piecesQty) || 0) > 0);
      if (!valid) {
        showToast('يرجى التأكد من اسم الصنف والكمية بالقطعة');
        return;
      }
      const orderNum = toArabicDigits(1001 + state.suppliesHistory.length);
      const receiptUrl = generateSupplyReceiptImage(state.items, orderNum, curEmp.trim());
      const record = {
        id: 'sup-' + Date.now(),
        orderNumber: orderNum,
        employeeName: curEmp.trim(),
        createdAt: new Date().toISOString(),
        items: state.items.map(({ id, name, piecesQty }) => ({ id, name, piecesQty: Number(piecesQty) }))
      };
      const nextHistory = [record, ...state.suppliesHistory];
      try {
        localStorage.setItem(SUPPLY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        // Ignore storage errors
      }
      state = {
        ...state,
        suppliesHistory: nextHistory,
        receiptImageUrl: receiptUrl,
        receiptOrderNumber: orderNum
      };
      render();
      showToast('تم إنشاء ورقة إجمالي المورد كصورة بنجاح');
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset?.action === 'select-preset') {
      const itemId = target.dataset.itemId;
      if (target.value === '__custom__') {
        state = {
          ...state,
          items: state.items.map((it) => (it.id === itemId ? { ...it, isCustomName: true, name: '' } : it))
        };
      } else {
        state = {
          ...state,
          items: state.items.map((it) => (it.id === itemId ? { ...it, isCustomName: false, name: target.value } : it))
        };
      }
      render();
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset?.action;
    if (!action) return;

    if (action === 'employee-name-input') {
      state = { ...state, employeeName: target.value };
      const summarySlot = document.getElementById('supply-summary-slot');
      if (summarySlot) {
        summarySlot.innerHTML = renderSummaryCard();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      }
    } else if (action === 'item-name-input') {
      const itemId = target.dataset.itemId;
      state = {
        ...state,
        items: state.items.map((it) => (it.id === itemId ? { ...it, name: target.value } : it))
      };
      const summarySlot = document.getElementById('supply-summary-slot');
      if (summarySlot) {
        summarySlot.innerHTML = renderSummaryCard();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      }
    } else if (action === 'item-qty-input') {
      const itemId = target.dataset.itemId;
      const num = Math.max(0, Math.floor(Number(target.value) || 0));
      state = {
        ...state,
        items: state.items.map((it) => (it.id === itemId ? { ...it, piecesQty: num } : it))
      };
      const summarySlot = document.getElementById('supply-summary-slot');
      if (summarySlot) {
        summarySlot.innerHTML = renderSummaryCard();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  render();
});


})();
