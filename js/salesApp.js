(function() {
  'use strict';
  window.Wared = window.Wared || {};

  const { SALES_DEPARTMENTS } = window.Wared.Catalog;
  const { formatCurrency, toArabicDigits, escapeHtml } = window.Wared.Formatters;
  const { syncSalesToGoogleSheets } = window.Wared.SheetsSync;
  const { getCurrentEmployee, loginEmployee, logoutEmployee, renderLogoutButton, confirmLogout, renderLoginScreen } = window.Wared.Auth;

  const CART_KEY = 'wared_sales_cart_v1';
  const BRAND_LOGO_PATH = 'logo.png';

  function loadSavedCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && Array.isArray(parsed.cart) ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveCartState(customerCode, cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify({ customerCode, cart }));
    } catch {
      // Ignore
    }
  }

  const recoveredCart = loadSavedCart();

  let state = {
    customerCode: recoveredCart?.customerCode || '',
    activeDeptId: 'buffet',
    searchQuery: '',
    selectedItemId: SALES_DEPARTMENTS[2].items[0].id,
    qtyInput: 1,
    cart: recoveredCart?.cart || [],
    isSubmitting: false,
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

  function getActiveDept() {
    return SALES_DEPARTMENTS.find((d) => d.id === state.activeDeptId) || SALES_DEPARTMENTS[0];
  }

  function getFilteredItems() {
    const dept = getActiveDept();
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return dept.items;
    return dept.items.filter((it) => it.name.toLowerCase().includes(q));
  }

  function getSelectedItem() {
    const dept = getActiveDept();
    return dept.items.find((it) => it.id === state.selectedItemId) || getFilteredItems()[0] || dept.items[0];
  }

  function attachLogoFallback() {
    const logoImg = document.getElementById('brand-logo-img');
    const logoFallback = document.getElementById('brand-logo-fallback');
    if (!logoImg || !logoFallback) return;
    logoImg.addEventListener('error', () => { logoImg.classList.add('hidden'); logoFallback.classList.remove('hidden'); }, { once: true });
    logoImg.addEventListener('load', () => { logoImg.classList.remove('hidden'); logoFallback.classList.add('hidden'); }, { once: true });
  }

  function renderCartSection() {
    const grandTotal = state.cart.reduce((s, it) => s + it.lineTotal, 0);
    const canSend = Boolean(state.customerCode.trim() && state.cart.length > 0 && !state.isSubmitting);

    return `
      <div class="card p-5 sm:p-6 lg:sticky lg:top-24" id="sales-cart-panel">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-[#132E39]">مسحوبات العميل الحالية</h3>
            <p class="text-xs text-[#637880] mt-0.5">
              ${state.customerCode.trim() ? `كود العميل: ${escapeHtml(state.customerCode)}` : 'أدخل كود العميل أولاً'}
            </p>
          </div>
          <span class="px-2.5 py-1 rounded-full bg-[#E6F4F1] text-[#087E78] text-xs font-bold">
            ${toArabicDigits(state.cart.length)} أصناف
          </span>
        </div>

        ${state.cart.length === 0 ? `
          <div class="py-8 text-center bg-[#F8FAFB] rounded-xl border border-dashed border-[#DCE6E8] text-xs text-[#8FA1A8] mb-5">
            لم يتم إضافة أصناف بعد. اختر القسم والتصنيف واضغط "+ إضافة".
          </div>
        ` : `
          <div class="divide-y divide-[#EAEFF1] max-h-[320px] overflow-y-auto mb-4">
            ${state.cart.map((row) => `
              <div class="py-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-[#132E39] truncate">${escapeHtml(row.itemName)}</div>
                  <div class="text-[11px] text-[#637880] mt-0.5">
                    ${escapeHtml(row.departmentLabel)} • ${formatCurrency(row.unitPrice)} ج.م × ${toArabicDigits(row.qty)}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" data-action="cart-dec" data-row-id="${row.id}" class="w-6 h-6 rounded-lg border border-[#DCE6E8] text-xs font-bold hover:bg-[#F5F7F8] cursor-pointer">-</button>
                  <span class="text-xs font-bold w-5 text-center">${toArabicDigits(row.qty)}</span>
                  <button type="button" data-action="cart-inc" data-row-id="${row.id}" class="w-6 h-6 rounded-lg border border-[#DCE6E8] text-xs font-bold hover:bg-[#F5F7F8] cursor-pointer">+</button>
                  <span class="text-xs font-extrabold text-[#087E78] mr-1">${formatCurrency(row.lineTotal)} ج.م</span>
                  <button type="button" data-action="cart-remove" data-row-id="${row.id}" class="text-[#8FA1A8] hover:text-red-600 p-1 cursor-pointer">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <div class="border-t border-[#EAEFF1] pt-4 mb-5 text-center">
          <div class="text-xs text-[#637880]">الإجمالي الكلي للفاتورة</div>
          <div class="flex items-baseline justify-center gap-1.5 mt-1">
            <span class="text-3xl font-extrabold text-[#132E39]">${formatCurrency(grandTotal)}</span>
            <span class="text-xs font-semibold text-[#637880]">ج.م</span>
          </div>
        </div>

        <button
          type="button"
          data-action="submit-sale"
          ${!canSend ? 'disabled' : ''}
          class="w-full py-3 px-4 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
            canSend ? 'btn-primary' : 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
          }"
        >
          <i data-lucide="send" class="w-4 h-4"></i>
          <span>${state.isSubmitting ? 'جاري الترحيل...' : 'إرسال السحب'}</span>
        </button>
      </div>
    `;
  }

  function renderSalesWorkspace() {
    const dept = getActiveDept();
    const filteredItems = getFilteredItems();
    const selectedItem = getSelectedItem();
    const qty = Math.max(1, Math.floor(Number(state.qtyInput) || 1));
    const previewTotal = (selectedItem?.price || 0) * qty;

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div class="lg:col-span-7 space-y-4">
          <div class="card p-5">
            <label class="block text-xs font-semibold text-[#637880] mb-1.5">
              أولاً: كود العميل <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="أدخل كود العميل (مثال: C-1042)..."
              class="wared-input font-bold text-base tracking-wide"
              value="${escapeHtml(state.customerCode)}"
              data-action="customer-code-input"
            />
          </div>

          <div class="card p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-[#637880] mb-2">ثانياً: اختر القسم الرئيسي</label>
              <div class="grid grid-cols-3 gap-2.5">
                ${SALES_DEPARTMENTS.map((d) => {
                  const active = d.id === state.activeDeptId;
                  return `
                    <button
                      type="button"
                      data-action="select-dept"
                      data-dept-id="${d.id}"
                      class="py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#087E78] text-white border-[#087E78] shadow-sm'
                          : 'bg-[#F8FAFB] text-[#132E39] border-[#DCE6E8] hover:border-[#99D5CF]'
                      }"
                    >
                      ${d.label}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="pt-3 border-t border-[#EAEFF1] space-y-3.5">
              <div>
                <label class="block text-xs font-semibold text-[#637880] mb-1.5">
                  ثالثاً: اختر التصنيف من قسم (${dept.label}) — بحث سريع
                </label>
                <input
                  type="text"
                  placeholder="اكتب أول حروف للبحث السريع..."
                  class="wared-input mb-2.5 text-xs"
                  value="${escapeHtml(state.searchQuery)}"
                  data-action="sales-search-input"
                />
                <select
                  class="wared-input font-semibold cursor-pointer"
                  data-action="sales-item-select"
                >
                  ${filteredItems.length === 0
                    ? '<option value="">لا توجد نتائج مطابقة للبحث</option>'
                    : filteredItems.map((it) => `
                      <option value="${it.id}" ${selectedItem?.id === it.id ? 'selected' : ''}>
                        ${escapeHtml(it.name)} — (${formatCurrency(it.price)} ج.م)
                      </option>
                    `).join('')}
                </select>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div class="sm:col-span-4">
                  <label class="block text-xs font-semibold text-[#637880] mb-1.5">العدد</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    class="wared-input font-bold text-center text-base"
                    value="${qty}"
                    data-action="sales-qty-input"
                  />
                </div>
                <div class="sm:col-span-4">
                  <div class="rounded-xl bg-[#F5F7F8] border border-[#EAEFF1] px-3 py-2 text-center">
                    <div class="text-[10px] text-[#637880]">إجمالي الصنف</div>
                    <div class="text-sm font-extrabold text-[#087E78]" id="line-preview-total">${formatCurrency(previewTotal)} ج.م</div>
                  </div>
                </div>
                <div class="sm:col-span-4">
                  <button type="button" data-action="add-to-cart" class="btn-primary w-full py-2.5 px-4 text-sm">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-5" id="sales-cart-slot">
          ${renderCartSection()}
        </div>
      </div>
    `;
  }

  function render() {
    const root = document.getElementById('sales-app-root');
    if (!root) return;

    const empName = getCurrentEmployee();

    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="flex items-center gap-3">
              <a href="index.html" class="px-2.5 py-1 rounded-lg bg-[#F5F7F8] hover:bg-[#E6F4F1] text-xs font-bold text-[#132E39] hover:text-[#087E78] border border-[#DCE6E8] transition-colors no-underline">← الرئيسية</a>
              <div class="flex items-center">
                <img id="brand-logo-img" src="${BRAND_LOGO_PATH}" alt="شعار تسجيل المبيعات" class="h-9 sm:h-10 w-auto max-w-[150px] object-contain" />
                <div id="brand-logo-fallback" class="hidden h-9 px-3 rounded-xl border border-dashed border-[#A7DCD7] bg-[#EFF8F6] text-[#087E78] items-center justify-center text-xs font-bold whitespace-nowrap flex">LOGO (logo.png)</div>
              </div>
              <div class="text-base sm:text-lg font-extrabold text-[#132E39] leading-none">تسجيل المبيعات والسحب</div>
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
              <h1 class="text-2xl sm:text-[28px] font-extrabold text-[#132E39] tracking-tight">تسجيل المبيعات والسحب</h1>
              <p class="text-xs sm:text-sm text-[#637880] mt-1">أدخل كود العميل، اختر القسم والتصنيف، وأرسل السحب مباشرة.</p>
            </div>
            ${renderSalesWorkspace()}
          ` : renderLoginScreen('تسجيل دخول الموظف — المبيعات والسحب')}
        </main>
      </div>

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
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'global-login-submit') {
      const inp = document.getElementById('global-login-input');
      if (inp && loginEmployee(inp.value)) {
        render();
        showToast(`مرحباً ${getCurrentEmployee()} — تم تسجيل دخولك`);
      }
    } else if (action === 'global-logout') {
      confirmLogout(() => { render(); });
    } else if (action === 'select-dept') {
      const deptId = target.dataset.deptId;
      const dept = SALES_DEPARTMENTS.find((d) => d.id === deptId) || SALES_DEPARTMENTS[0];
      state = { ...state, activeDeptId: deptId, searchQuery: '', selectedItemId: dept.items[0].id };
      render();
    } else if (action === 'add-to-cart') {
      if (!state.customerCode.trim()) {
        showToast('كود العميل إجباري — أدخل كود العميل أولاً');
        return;
      }
      const item = getSelectedItem();
      if (!item) { showToast('اختر تصنيفاً صحيحاً أولاً'); return; }
      const qty = Math.floor(Number(state.qtyInput) || 0);
      if (qty < 1) { showToast('يجب أن يكون العدد ١ فأكثر'); return; }

      const dept = getActiveDept();
      const newRow = {
        id: 'row-' + Date.now() + Math.random().toString(16).slice(2, 6),
        departmentId: dept.id,
        departmentLabel: dept.label,
        itemId: item.id,
        itemName: item.name,
        unitPrice: item.price,
        qty,
        lineTotal: Number((item.price * qty).toFixed(2))
      };
      const nextCart = [...state.cart, newRow];
      saveCartState(state.customerCode, nextCart);
      state = { ...state, cart: nextCart, searchQuery: '', qtyInput: 1 };
      render();
    } else if (action === 'cart-inc' || action === 'cart-dec') {
      const rowId = target.dataset.rowId;
      const delta = action === 'cart-inc' ? 1 : -1;
      const nextCart = state.cart.map((r) => {
        if (r.id !== rowId) return r;
        const nextQty = Math.max(1, r.qty + delta);
        return { ...r, qty: nextQty, lineTotal: Number((r.unitPrice * nextQty).toFixed(2)) };
      });
      saveCartState(state.customerCode, nextCart);
      state = { ...state, cart: nextCart };
      render();
    } else if (action === 'cart-remove') {
      const nextCart = state.cart.filter((r) => r.id !== target.dataset.rowId);
      saveCartState(state.customerCode, nextCart);
      state = { ...state, cart: nextCart };
      render();
    } else if (action === 'submit-sale') {
      if (!state.customerCode.trim()) { showToast('كود العميل إجباري'); return; }
      if (state.cart.length === 0) { showToast('قائمة المسحوبات فارغة'); return; }

      state = { ...state, isSubmitting: true };
      render();

      await syncSalesToGoogleSheets({
        serverTimestamp: new Date().toISOString(),
        employeeName: getCurrentEmployee(),
        customerCode: state.customerCode.trim(),
        items: state.cart
      });

      saveCartState('', []);
      state = {
        ...state,
        isSubmitting: false,
        customerCode: '',
        cart: [],
        qtyInput: 1
      };
      render();
      showToast('تم تسجيل وإرسال السحب بنجاح');
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.dataset?.action === 'sales-item-select') {
      state = { ...state, selectedItemId: e.target.value };
      const item = getSelectedItem();
      const preview = document.getElementById('line-preview-total');
      if (preview && item) preview.textContent = `${formatCurrency(item.price * Math.max(1, Number(state.qtyInput) || 1))} ج.م`;
    }
  });

  document.addEventListener('input', (e) => {
    const action = e.target.dataset?.action;
    if (!action) return;

    if (action === 'customer-code-input') {
      state = { ...state, customerCode: e.target.value };
      saveCartState(state.customerCode, state.cart);
      const cartSlot = document.getElementById('sales-cart-slot');
      if (cartSlot) {
        cartSlot.innerHTML = renderCartSection();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      }
    } else if (action === 'sales-search-input') {
      state = { ...state, searchQuery: e.target.value };
      const filtered = getFilteredItems();
      if (filtered.length > 0 && !filtered.some((it) => it.id === state.selectedItemId)) {
        state.selectedItemId = filtered[0].id;
      }
      render();
      const searchEl = document.querySelector('[data-action="sales-search-input"]');
      if (searchEl) {
        searchEl.focus();
        searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
      }
    } else if (action === 'sales-qty-input') {
      const val = Math.max(1, Math.floor(Number(e.target.value) || 1));
      state = { ...state, qtyInput: val };
      const item = getSelectedItem();
      const preview = document.getElementById('line-preview-total');
      if (preview && item) preview.textContent = `${formatCurrency(item.price * val)} ج.م`;
    }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
