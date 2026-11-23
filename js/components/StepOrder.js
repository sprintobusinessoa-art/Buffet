(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { PRODUCT_PRESETS } = window.Wared.Catalog;
  const { calcUnitCost, calcItemTotal, calcProfitMetrics, calcOrderSummary, getExpiryStatus } = window.Wared.Calculations;
  const { formatCurrency, formatNumber, toArabicDigits, escapeHtml } = window.Wared.Formatters;
/* ==========================================================================
   Step 3: Order Items (Profit Margin + 30-Day Expiry Alert + Custom Item)
   ========================================================================== */



const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

function renderProfitPill(item) {
  const { unitProfit, marginPct, isLoss } = calcProfitMetrics(item);
  if (isLoss) {
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
        <i data-lucide="trending-down" class="w-3.5 h-3.5"></i>
        <span>تنبيه: سعر البيع أقل من التكلفة (${formatNumber(unitProfit)} ج.م)</span>
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E6F4F1] text-[#087E78] text-[11px] font-bold">
      <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
      <span>ربح القطعة: ${formatNumber(unitProfit)} ج.م (${toArabicDigits(marginPct)}٪)</span>
    </span>
  `;
}

function renderSummaryPanel(state) {
  const { draft } = state;
  const summary = calcOrderSummary(draft.items, draft.invoiceAmount);

  return `
    <div class="card p-5 sm:p-6 lg:sticky lg:top-24" data-summary-panel>
      <h3 class="text-base font-bold text-[#132E39]">ملخص الطلبية</h3>
      <p class="text-xs text-[#637880] mt-0.5 mb-5">راجع الإجمالي قبل الإرسال</p>

      <div class="space-y-3 text-xs border-b border-[#EAEFF1] pb-4">
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">عدد الأصناف</span>
          <span class="font-bold text-[#132E39]">${toArabicDigits(summary.itemCount)} صنف</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">إجمالي الكراتين</span>
          <span class="font-bold text-[#132E39]">${formatNumber(summary.totalCartons)} كرتونة</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[#637880]">مبلغ الفاتورة</span>
          <span class="font-bold text-[#132E39]">${formatCurrency(summary.targetAmount)} ج.م</span>
        </div>
      </div>

      <div class="py-4 text-center">
        <div class="text-xs text-[#637880] mb-1">إجمالي شراء الأصناف</div>
        <div class="flex items-baseline justify-center gap-1.5">
          <span class="text-3xl font-extrabold text-[#132E39]">${formatCurrency(summary.itemsTotal)}</span>
          <span class="text-xs font-semibold text-[#637880]">ج.م</span>
        </div>
      </div>

      ${summary.expiredCount > 0 ? `
        <div class="rounded-xl bg-[#FEF2F2] border border-[#EF4444] py-2 px-3 flex items-center justify-center gap-2 text-xs font-bold text-[#DC2626] mb-2.5">
          <i data-lucide="alert-octagon" class="w-4 h-4 shrink-0"></i>
          <span>يوجد ${toArabicDigits(summary.expiredCount)} صنف منتهي الصلاحية</span>
        </div>
      ` : ''}

      ${summary.expiringSoonCount > 0 ? `
        <div class="rounded-xl bg-[#FEF3C7] border border-[#F59E0B] py-2 px-3 flex items-center justify-center gap-2 text-xs font-bold text-[#B45309] mb-2.5">
          <i data-lucide="clock" class="w-4 h-4 shrink-0"></i>
          <span>${toArabicDigits(summary.expiringSoonCount)} صنف ينتهي خلال ٣٠ يوماً</span>
        </div>
      ` : ''}

      ${summary.isMatched ? `
        <div class="rounded-xl bg-[#E6F4F1] border border-[#C3E7E2] py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-bold text-[#087E78] mb-5">
          <i data-lucide="check" class="w-4 h-4"></i>
          <span>الإجمالي مطابق لمبلغ الفاتورة</span>
        </div>
      ` : `
        <div class="rounded-xl bg-[#FEF2F2] border border-[#FECACA] py-2.5 px-3 text-center text-xs font-bold text-[#DC2626] mb-5">
          <div class="flex items-center justify-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
            <span>${summary.diff > 0
              ? `الإجمالي أكبر من الفاتورة بـ ${formatCurrency(summary.diff)} ج.م`
              : `متبقي لمطابقة الفاتورة ${formatCurrency(Math.abs(summary.diff))} ج.م`
            }</span>
          </div>
          <div class="text-[11px] font-normal text-[#B91C1C] mt-1">
            لن يتم إرسال الطلبية حتى يتطابق الإجمالي مع مبلغ الفاتورة
          </div>
        </div>
      `}

      <div class="space-y-2.5">
        <button
          type="button"
          data-action="save-order"
          ${!summary.isMatched ? 'disabled' : ''}
          class="w-full py-3 px-4 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
            summary.isMatched
              ? 'btn-primary'
              : 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
          }"
        >
          <i data-lucide="${summary.isMatched ? 'check' : 'lock'}" class="w-4 h-4"></i>
          <span>${summary.isMatched ? 'إرسال وحفظ الطلبية' : 'في انتظار تطابق المبلغ'}</span>
        </button>
        <button type="button" data-action="save-draft" class="btn-secondary w-full py-2.5 px-4 text-xs">
          حفظ كمسودة
        </button>
      </div>

      <p class="text-[11px] text-[#8FA1A8] text-center mt-4 leading-relaxed">
        بعد الحفظ، تقدر ترجع للفاتورة وتراجع تفاصيلها.
      </p>
    </div>
  `;
}

function renderStepOrder(state) {
  const { draft } = state;

  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <!-- Right Column: Supplier Header + Items -->
      <div class="lg:col-span-8 space-y-4">
        <!-- Supplier Bar -->
        <div class="card px-5 py-3.5 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#E6F4F1] text-[#087E78] flex items-center justify-center shrink-0">
              <i data-lucide="file-text" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="text-sm font-bold text-[#132E39]">${escapeHtml(draft.supplierName)}</div>
              <div class="text-[11px] text-[#637880] mt-0.5">
                فاتورة ${escapeHtml(draft.invoiceNumber)} • ${formatCurrency(draft.invoiceAmount)} ج.م
              </div>
            </div>
          </div>
          <button
            type="button"
            data-action="go-step"
            data-step="2"
            class="text-xs font-bold text-[#087E78] hover:underline cursor-pointer px-2 py-1"
          >
            تعديل
          </button>
        </div>

        <!-- Item Cards -->
        ${draft.items.map((item, idx) => {
          const unitCost = calcUnitCost(item.cartonBuyPrice, item.piecesPerCarton);
          const itemTotal = calcItemTotal(item);
          const exp = getExpiryStatus(item.expiryDate);
          const isExpired = exp.status === 'expired';
          const isSoon = exp.status === 'expiring-soon';

          const title = ORDINALS[idx] ? `الصنف ${ORDINALS[idx]}` : `الصنف ${toArabicDigits(idx + 1)}`;
          const isPreset = !item.isCustomName && PRODUCT_PRESETS.some((p) => p.name === item.name);

          const cardBorderClass = isExpired
            ? 'border-red-500 ring-1 ring-red-200'
            : isSoon
            ? 'border-amber-400 ring-1 ring-amber-200'
            : '';

          if (!item.expanded) {
            return `
              <div class="card px-5 py-4 flex items-center justify-between gap-4 transition-colors ${
                isExpired ? 'border-red-500 bg-red-50/40' : isSoon ? 'border-amber-400 bg-amber-50/40' : 'hover:border-[#99D5CF]'
              }">
                <button
                  type="button"
                  data-action="toggle-item"
                  data-item-id="${item.id}"
                  class="flex-1 text-right flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-bold text-[#132E39]">${escapeHtml(item.name || 'صنف جديد')}</span>
                      ${isExpired ? '<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">منتهي الصلاحية</span>' : ''}
                      ${isSoon ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">ينتهي خلال ${toArabicDigits(exp.daysLeft)} يوم</span>` : ''}
                    </div>
                    <div class="text-xs text-[#637880] mt-0.5" data-collapsed-meta="${item.id}">
                      ${formatNumber(item.cartonQty)} كرتونة × ${formatCurrency(item.cartonBuyPrice)} ج.م = ${formatCurrency(itemTotal)} ج.م
                      ${item.expiryDate ? ` • انتهاء: ${escapeHtml(item.expiryDate)}` : ''}
                    </div>
                  </div>
                  <i data-lucide="chevron-down" class="w-4 h-4 text-[#637880]"></i>
                </button>
              </div>
            `;
          }

          return `
            <div class="card p-5 sm:p-6 ${cardBorderClass}" data-item-card="${item.id}">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    data-action="toggle-item"
                    data-item-id="${item.id}"
                    class="flex items-center gap-2 text-sm font-bold text-[#132E39] cursor-pointer"
                  >
                    <i data-lucide="chevron-up" class="w-4 h-4 text-[#637880]"></i>
                    <span>${title}</span>
                  </button>
                  ${isExpired ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                      <i data-lucide="alert-circle" class="w-3 h-3"></i>
                      <span>منتهي الصلاحية</span>
                    </span>
                  ` : ''}
                  ${isSoon ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                      <i data-lucide="clock" class="w-3 h-3"></i>
                      <span>ينتهي خلال ${toArabicDigits(exp.daysLeft)} يوم</span>
                    </span>
                  ` : ''}
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

              <!-- Product Name + Expiry Date Row -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5 mb-4">
                <div class="sm:col-span-8">
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1.5">اسم الصنف</label>
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
                      class="wared-input mt-2 font-semibold border-[#087E78]"
                      value="${escapeHtml(item.name)}"
                      data-action="item-text-input"
                      data-item-id="${item.id}"
                      data-field="name"
                    />
                  ` : ''}
                </div>

                <div class="sm:col-span-4">
                  <label class="block text-[11px] font-semibold ${
                    isExpired ? 'text-red-600' : isSoon ? 'text-amber-700' : 'text-[#637880]'
                  } mb-1.5">
                    تاريخ الانتهاء ${isExpired ? '(منتهي!)' : isSoon ? '(قريب الانتهاء)' : ''}
                  </label>
                  <input
                    type="date"
                    class="wared-input font-semibold ${
                      isExpired
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : isSoon
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : ''
                    }"
                    value="${escapeHtml(item.expiryDate || '')}"
                    data-action="item-date-input"
                    data-item-id="${item.id}"
                    data-field="expiryDate"
                  />
                </div>
              </div>

              <!-- 6 Numeric Fields Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">سعر شراء الكرتونة</label>
                  <div class="relative">
                    <input type="number" min="0" step="0.01" class="wared-input font-semibold pl-11"
                      value="${item.cartonBuyPrice}"
                      data-action="item-input" data-item-id="${item.id}" data-field="cartonBuyPrice" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8FA1A8]">ج.م</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">عدد القطع في الكرتونة</label>
                  <div class="relative">
                    <input type="number" min="1" step="1" class="wared-input font-semibold pl-12"
                      value="${item.piecesPerCarton}"
                      data-action="item-input" data-item-id="${item.id}" data-field="piecesPerCarton" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8FA1A8]">قطعة</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">الكمية بالكرتونة</label>
                  <div class="relative">
                    <input type="number" min="0" step="0.5" class="wared-input font-semibold pl-14"
                      value="${item.cartonQty}"
                      data-action="item-input" data-item-id="${item.id}" data-field="cartonQty" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8FA1A8]">كرتونة</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">سعر بيع الكرتونة</label>
                  <div class="relative">
                    <input type="number" min="0" step="0.01" class="wared-input font-semibold pl-11"
                      value="${item.cartonSellPrice}"
                      data-action="item-input" data-item-id="${item.id}" data-field="cartonSellPrice" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8FA1A8]">ج.م</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">تكلفة القطعة - تلقائي</label>
                  <div class="relative">
                    <input type="text" readonly class="wared-input font-bold text-[#637880] bg-[#F1F5F7] pl-11 cursor-default"
                      value="${formatNumber(unitCost)}"
                      data-unit-cost="${item.id}" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8FA1A8]">ج.م</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-[#637880] mb-1">سعر بيع القطعة - يدوي</label>
                  <div class="relative">
                    <input type="number" min="0" step="0.25" class="wared-input highlight-teal pl-11"
                      value="${item.unitSellPrice}"
                      data-action="item-input" data-item-id="${item.id}" data-field="unitSellPrice" />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#087E78]">ج.م</span>
                  </div>
                </div>
              </div>

              <!-- Card Footer (Total + Live Profit Margin) -->
              <div class="mt-4 pt-3.5 border-t border-[#EAEFF1] flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div class="font-bold text-[#132E39]">
                  إجمالي الشراء <span class="text-[#087E78]" data-item-total="${item.id}">${formatCurrency(itemTotal)}</span> ج.م
                </div>
                <div data-profit-slot="${item.id}">
                  ${renderProfitPill(item)}
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Add Another Item Button -->
        <button
          type="button"
          data-action="add-item"
          class="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-[#A7DCD7] bg-[#EFF8F6] hover:bg-[#E2F3EF] text-[#087E78] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>إضافة صنف آخر</span>
        </button>
      </div>

      <!-- Left Column: Order Summary -->
      <div class="lg:col-span-4" id="summary-slot">
        ${renderSummaryPanel(state)}
      </div>
    </div>
  `;
}

  window.Wared.StepOrder = { renderProfitPill, renderSummaryPanel, renderStepOrder };
})();
