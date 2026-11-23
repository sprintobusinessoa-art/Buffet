(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { SUPPLIERS } = window.Wared.Catalog;
  const { escapeHtml, sanitizeImageDataUrl } = window.Wared.Formatters;
  const { renderSampleReceiptCard } = window.Wared.StepCapture;
  const { getCurrentEmployee } = window.Wared.Auth;
/* ==========================================================================
   Step 2: Review Extracted Invoice Data (With Employee Name + Custom Supplier)
   ========================================================================== */



function renderStepReview(state) {
  const { draft } = state;
  const isCustomSupplier = draft.customSupplierMode || !SUPPLIERS.includes(draft.supplierName);
  const safeImageUrl = sanitizeImageDataUrl(draft.capturedImageUrl);

  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <!-- Right Column: Extracted Data Form -->
      <div class="lg:col-span-7 card p-6 sm:p-7">
        <div class="text-center mb-6">
          <div class="w-11 h-11 rounded-full bg-[#E6F4F1] text-[#087E78] flex items-center justify-center mx-auto mb-3">
            <i data-lucide="check" class="w-5 h-5"></i>
          </div>
          <h2 class="text-xl font-bold text-[#132E39]">تم تصوير الفاتورة بنجاح</h2>
          <p class="text-xs text-[#637880] mt-1">راجع البيانات واكتب اسم الموظف المسؤول قبل تسجيل الطلبية.</p>
        </div>

        <div class="space-y-4">
          <!-- Active Employee Auto-Stamped -->
          <div class="rounded-xl bg-[#E6F4F1] border border-[#C3E7E2] px-4 py-2.5 flex items-center justify-between text-xs">
            <span class="text-[#3C6E6B] font-semibold">الموظف المسؤول عن العملية</span>
            <span class="font-bold text-[#087E78]">${escapeHtml(getCurrentEmployee() || draft.employeeName || 'غير مسجل')}</span>
          </div>

          <!-- Supplier Select + Custom Input -->
          <div>
            <label class="block text-xs font-semibold text-[#637880] mb-1.5">اسم المورد</label>
            <select
              class="wared-input cursor-pointer"
              data-action="draft-supplier-select"
            >
              ${SUPPLIERS.map((s) => `
                <option value="${escapeHtml(s)}" ${!isCustomSupplier && draft.supplierName === s ? 'selected' : ''}>${escapeHtml(s)}</option>
              `).join('')}
              <option value="__custom__" ${isCustomSupplier ? 'selected' : ''}>+ إضافة مورد جديد (كتابة يدوية)...</option>
            </select>

            ${isCustomSupplier ? `
              <input
                type="text"
                placeholder="اكتب اسم المورد الجديد هنا..."
                class="wared-input mt-2.5 font-semibold border-[#087E78]"
                value="${escapeHtml(draft.supplierName)}"
                data-action="draft-input"
                data-field="supplierName"
              />
            ` : ''}
          </div>

          <!-- Total Invoice Amount -->
          <div>
            <label class="block text-xs font-semibold text-[#637880] mb-1.5">إجمالي مبلغ الفاتورة</label>
            <div class="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                class="wared-input text-lg font-bold pl-14"
                value="${Number(draft.invoiceAmount) || 0}"
                data-action="draft-input"
                data-field="invoiceAmount"
              />
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#637880]">ج.م</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#8FA1A8] mt-2">
              <span>${escapeHtml(draft.invoiceDate)}</span>
              <span>رقم الفاتورة: ${escapeHtml(draft.invoiceNumber)}</span>
            </div>
          </div>

          <div class="rounded-xl bg-[#F1F5F7] border border-[#DCE6E8] p-3.5 flex items-center gap-2.5 text-xs text-[#637880]">
            <i data-lucide="info" class="w-4 h-4 text-[#087E78] shrink-0"></i>
            <span>تقدر تعدل اسم المورد أو تكتب مورد جديد، أو تعدل مبلغ الفاتورة.</span>
          </div>
        </div>

        <div class="mt-6 pt-5 border-t border-[#EAEFF1] flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            data-action="confirm-review"
            class="btn-primary w-full sm:flex-1 py-3 px-5 text-sm"
          >
            <span>تأكيد البيانات وتسجيل الطلبية</span>
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
          </button>
          <button
            type="button"
            data-action="go-step"
            data-step="1"
            class="btn-secondary w-full sm:w-auto py-3 px-5 text-sm"
          >
            رجوع للتصوير
          </button>
        </div>
      </div>

      <!-- Left Column: Original Invoice Preview -->
      <div class="lg:col-span-5 card p-5 sm:p-6">
        <div class="flex items-center justify-between mb-3.5">
          <h3 class="text-sm font-bold text-[#132E39]">الفاتورة الأصلية</h3>
          ${safeImageUrl ? `
            <button type="button" data-action="open-image-modal" class="text-xs text-[#087E78] font-semibold hover:underline cursor-pointer">
              تكبير الصورة
            </button>
          ` : ''}
        </div>

        <div class="bg-[#F5F7F8] border border-[#EAEFF1] rounded-xl p-4 flex items-center justify-center">
          ${safeImageUrl
            ? `<img src="${safeImageUrl}" alt="صورة الفاتورة الأصلية" class="max-h-64 w-auto rounded-lg object-contain shadow-sm cursor-pointer" data-action="open-image-modal" />`
            : `<div class="w-full max-w-[260px]">${renderSampleReceiptCard(true)}</div>`
          }
        </div>

        <button
          type="button"
          data-action="go-step"
          data-step="1"
          class="btn-secondary w-full py-2.5 px-4 text-xs mt-4"
        >
          <i data-lucide="camera" class="w-4 h-4 text-[#087E78]"></i>
          <span>إعادة التصوير</span>
        </button>

        <div class="mt-4 rounded-xl bg-[#E6F4F1] border border-[#C3E7E2] p-3.5 flex items-start gap-2.5">
          <i data-lucide="check" class="w-4 h-4 text-[#087E78] shrink-0 mt-0.5"></i>
          <div>
            <div class="text-xs font-bold text-[#087E78]">اسم المورد والمبلغ جاهزين</div>
            <div class="text-[11px] text-[#3C6E6B] mt-0.5">الخطوة الجاية: إضافة الأصناف والأسعار</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

  window.Wared.StepReview = { renderStepReview };
})();
