(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { getState, subscribe, actions, hasUnsentWork } = window.Wared.Store;
  const { renderStepper } = window.Wared.Stepper;
  const { renderStepCapture } = window.Wared.StepCapture;
  const { renderStepReview } = window.Wared.StepReview;
  const { renderStepOrder, renderSummaryPanel, renderProfitPill } = window.Wared.StepOrder;
  const { calcUnitCost, calcItemTotal } = window.Wared.Calculations;
  const { formatCurrency, formatNumber, escapeHtml, sanitizeImageDataUrl } = window.Wared.Formatters;
  const { startDeviceCamera, captureFrameFromVideo, stopDeviceCamera } = window.Wared.CameraService;
/* ==========================================================================
   Wared App Bootstrap — Header: "صادر من المورد"
   ========================================================================== */








let lastRenderedStep = null;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BRAND_LOGO_PATH = 'logo.png';

function renderModals(state) {
  let html = '';

  if (state.confirmNewDraftModalOpen) {
    html += `
      <div class="fixed inset-0 bg-[#132E39]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-confirm-draft">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE6E8]">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-[#132E39]">تنبيه: الفاتورة لم تُرسل بعد</h3>
              <p class="text-xs text-[#637880] mt-1 leading-relaxed">
                الفاتورة الحالية لم يتم إرسالها وحفظها نهائياً. لو فتحت مسودة جديدة دلوقتي، البيانات الحالية هتروح. هل تريد المتابعة؟
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row items-center gap-2.5 mt-5">
            <button
              type="button"
              data-action="confirm-new-draft"
              class="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              نعم، افتح مسودة جديدة
            </button>
            <button
              type="button"
              data-action="close-confirm-draft"
              class="btn-secondary w-full sm:flex-1 py-2.5 px-4 text-xs"
            >
              تراجع وإكمال الفاتورة
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.helpModalOpen) {
    html += `
      <div class="fixed inset-0 bg-[#132E39]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-help">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-bold text-[#132E39]">خطوات تسجيل الفاتورة</h3>
            <button type="button" data-action="close-help" class="text-[#8FA1A8] hover:text-[#132E39] cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <ol class="space-y-2.5 text-xs text-[#637880] list-decimal pr-4 leading-relaxed">
            <li><strong class="text-[#132E39]">تصوير الفاتورة (إجباري):</strong> افتح كاميرا الجهاز وصوّر الفاتورة أو ارفع صورتها من جهازك.</li>
            <li><strong class="text-[#132E39]">مراجعة البيانات:</strong> راجع اسم المورد ومبلغ الفاتورة أو أضف مورداً جديداً يدوياً.</li>
            <li><strong class="text-[#132E39]">تسجيل الطلبية:</strong> أدخل الأصناف وتاريخ الانتهاء وتابع هامش الربح، ولن يتم الإرسال إلا عند تطابق الإجمالي.</li>
          </ol>
          <button type="button" data-action="close-help" class="btn-primary w-full py-2.5 text-xs mt-5">فهمت، ابدأ الآن</button>
        </div>
      </div>
    `;
  }

  const safeModalImg = sanitizeImageDataUrl(state.draft.capturedImageUrl);
  if (state.imagePreviewModalOpen && safeModalImg) {
    html += `
      <div class="fixed inset-0 bg-[#132E39]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4" data-backdrop="close-image-modal">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-bold text-[#132E39]">معاينة الفاتورة الأصلية</span>
            <button type="button" data-action="close-image-modal" class="text-[#8FA1A8] hover:text-[#132E39] cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <img src="${safeModalImg}" alt="معاينة الفاتورة" class="max-h-[75vh] w-full object-contain rounded-xl bg-[#F5F7F8]" />
        </div>
      </div>
    `;
  }

  return html;
}

async function initCameraIfStepOne(state) {
  if (state.draft.step === 1) {
    const videoEl = document.getElementById('camera-video');
    if (videoEl && state.cameraStatus === 'idle') {
      const res = await startDeviceCamera(videoEl);
      if (res.ok) {
        actions.setCameraState('active', '');
      } else {
        actions.setCameraState('error', res.error);
      }
    }
  } else {
    stopDeviceCamera();
  }
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

function renderApp(state) {
  const root = document.getElementById('app-root');
  if (!root) return;

  const { draft } = state;
  let stepBody = '';
  if (draft.step === 1) stepBody = renderStepCapture(state);
  else if (draft.step === 2) stepBody = renderStepReview(state);
  else stepBody = renderStepOrder(state);

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
                alt="شعار صادر من المورد"
                class="h-9 sm:h-10 w-auto max-w-[150px] object-contain brand-logo-animated"
              />
              <div
                id="brand-logo-fallback"
                class="hidden h-9 px-3 rounded-xl border border-dashed border-[#A7DCD7] bg-[#EFF8F6] text-[#087E78] items-center justify-center text-xs font-bold whitespace-nowrap flex"
              >
                LOGO (logo.png)
              </div>
            </div>
            <div class="text-base sm:text-lg font-extrabold text-[#132E39] leading-none">صادر من المورد</div>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              data-action="start-new-draft"
              class="px-3.5 py-1.5 rounded-full border border-[#DCE6E8] bg-[#F8FAFB] hover:bg-[#EFF8F6] hover:border-[#99D5CF] text-xs font-semibold text-[#132E39] transition-colors cursor-pointer"
            >
              مسودة جديدة
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
        <div class="mb-5">
          <h1 class="text-2xl sm:text-[28px] font-extrabold text-[#132E39] tracking-tight">فاتورة مشتريات جديدة</h1>
          <p class="text-xs sm:text-sm text-[#637880] mt-1">من صورة الفاتورة لطلبية منظمة، في ٣ خطوات متتالية.</p>
        </div>

        ${renderStepper(draft)}
        ${stepBody}
      </main>
    </div>

    ${renderModals(state)}

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

  if (draft.step === 1 && state.cameraStatus === 'active') {
    const videoEl = document.getElementById('camera-video');
    if (videoEl && !videoEl.srcObject) {
      startDeviceCamera(videoEl);
    }
  }

  if (lastRenderedStep !== draft.step) {
    lastRenderedStep = draft.step;
    initCameraIfStepOne(state);
  }
}

function syncItemDerivedDom(itemId) {
  const state = getState();
  const item = state.draft.items.find((it) => it.id === itemId);
  if (!item) return;

  const unitCostEl = document.querySelector(`[data-unit-cost="${itemId}"]`);
  if (unitCostEl) {
    unitCostEl.value = formatNumber(calcUnitCost(item.cartonBuyPrice, item.piecesPerCarton));
  }

  const itemTotalEl = document.querySelector(`[data-item-total="${itemId}"]`);
  if (itemTotalEl) {
    itemTotalEl.textContent = formatCurrency(calcItemTotal(item));
  }

  const profitSlot = document.querySelector(`[data-profit-slot="${itemId}"]`);
  if (profitSlot) {
    profitSlot.innerHTML = renderProfitPill(item);
  }

  const summarySlot = document.getElementById('summary-slot');
  if (summarySlot) {
    summarySlot.innerHTML = renderSummaryPanel(state);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function setupEventDelegation() {
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsentWork(getState())) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.dataset?.backdrop === 'close-help') {
      actions.toggleHelpModal(false);
      return;
    }
    if (e.target.dataset?.backdrop === 'close-image-modal') {
      actions.toggleImagePreviewModal(false);
      return;
    }
    if (e.target.dataset?.backdrop === 'close-confirm-draft') {
      actions.toggleConfirmNewDraftModal(false);
      return;
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
      case 'open-help':
        actions.toggleHelpModal(true);
        break;
      case 'close-help':
        actions.toggleHelpModal(false);
        break;
      case 'open-image-modal':
        actions.toggleImagePreviewModal(true);
        break;
      case 'close-image-modal':
        actions.toggleImagePreviewModal(false);
        break;
      case 'close-confirm-draft':
        actions.toggleConfirmNewDraftModal(false);
        break;
      case 'confirm-new-draft':
        actions.forceNewDraft();
        break;
      case 'toggle-flash':
        actions.toggleFlash();
        break;
      case 'open-camera': {
        const videoEl = document.getElementById('camera-video');
        const res = await startDeviceCamera(videoEl);
        if (res.ok) actions.setCameraState('active', '');
        else actions.setCameraState('error', res.error);
        break;
      }
      case 'capture-invoice': {
        const videoEl = document.getElementById('camera-video');
        const frameUrl = captureFrameFromVideo(videoEl);
        if (!frameUrl) {
          actions.showToast('افتح كاميرا الجهاز أولاً أو ارفع صورة الفاتورة من جهازك');
          return;
        }
        stopDeviceCamera();
        actions.setCameraState('idle', '');
        await actions.completeCapture(frameUrl);
        break;
      }
      case 'go-step':
        actions.setStep(Number(target.dataset.step));
        break;
      case 'confirm-review':
        actions.confirmReviewAndProceed();
        break;
      case 'start-new-draft':
        actions.requestNewDraft();
        break;
      case 'toggle-item':
        actions.toggleItemExpanded(target.dataset.itemId);
        break;
      case 'add-item':
        actions.addItem();
        break;
      case 'remove-item':
        actions.removeItem(target.dataset.itemId);
        break;
      case 'save-order':
        actions.saveOrder('saved');
        break;
      case 'save-draft':
        actions.saveOrder('draft');
        break;
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target;
    const action = target.dataset?.action;
    if (!action) return;

    if (action === 'upload-invoice' && target.files && target.files[0]) {
      const file = target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        actions.showToast('صيغة الملف غير مدعومة — يرجى اختيار صورة PNG أو JPG أو WebP');
        target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        actions.showToast('حجم الصورة كبير جداً (الحد الأقصى ١٠ ميجابايت)');
        target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const safeUrl = sanitizeImageDataUrl(ev.target?.result);
        if (!safeUrl) {
          actions.showToast('تعذر التحقق من أمان الصورة المرفوعة');
          return;
        }
        stopDeviceCamera();
        actions.setCameraState('idle', '');
        await actions.completeCapture(safeUrl);
      };
      reader.readAsDataURL(file);
    } else if (action === 'draft-supplier-select') {
      if (target.value === '__custom__') {
        actions.updateDraftFieldAndRender('supplierName', '', { customSupplierMode: true });
      } else {
        actions.updateDraftFieldAndRender('supplierName', target.value, { customSupplierMode: false });
      }
    } else if (action === 'select-preset') {
      if (target.value === '__custom__') {
        actions.enableCustomItemName(target.dataset.itemId);
      } else {
        actions.applyItemPreset(target.dataset.itemId, target.value);
      }
    } else if (action === 'item-date-input') {
      actions.updateItemField(target.dataset.itemId, target.dataset.field, target.value);
      renderApp(getState());
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset?.action;
    if (!action) return;

    if (action === 'draft-input') {
      const field = target.dataset.field;
      const num = Number(target.value);
      const val = target.type === 'number' ? (Number.isFinite(num) ? Math.max(0, num) : 0) : target.value;
      actions.updateDraftField(field, val);
    } else if (action === 'item-text-input') {
      actions.updateItemField(target.dataset.itemId, target.dataset.field, target.value);
    } else if (action === 'item-input') {
      const itemId = target.dataset.itemId;
      const field = target.dataset.field;
      const num = Number(target.value);
      const val = Number.isFinite(num) ? Math.max(field === 'piecesPerCarton' ? 1 : 0, num) : 0;
      actions.updateItemField(itemId, field, val);
      syncItemDerivedDom(itemId);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  subscribe(renderApp);
  setupEventDelegation();
  const initialState = getState();
  renderApp(initialState);
  if (initialState.wasRecovered) {
    actions.showToast('تم استعادة الفاتورة غير المكتملة تلقائياً');
  }
});


})();
