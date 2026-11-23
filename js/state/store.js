(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { PRODUCT_PRESETS, createDefaultDraft } = window.Wared.Catalog;
  const { formatTodayArabic, toArabicDigits } = window.Wared.Formatters;
  const { calcOrderSummary } = window.Wared.Calculations;
  const { queueInvoiceToDrive, DRIVE_CONFIG } = window.Wared.DriveSync;
  const { getCurrentEmployee } = window.Wared.Auth;
/* ==========================================================================
   Centralized Reactive Store — Auto-Save Recovery & Custom Inputs
   ========================================================================== */




const STORAGE_KEY = 'wared_sequential_orders_v1';
const DRAFT_RECOVERY_KEY = 'wared_active_draft_v1';

function loadPersistedOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.orders) ? parsed.orders : [];
  } catch {
    return [];
  }
}

function savePersistedOrders(orders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders }));
  } catch {
    // Ignore storage errors
  }
}

function saveDraftForRecovery(draft) {
  try {
    if (!draft.invoiceCaptured || draft.isSubmitted) {
      localStorage.removeItem(DRAFT_RECOVERY_KEY);
      return;
    }
    localStorage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(draft));
  } catch {
    // If image data URL exceeds quota, retry saving draft without image data
    try {
      const lite = { ...draft, capturedImageUrl: null };
      localStorage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(lite));
    } catch {
      // Ignore
    }
  }
}

function loadRecoveredDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.invoiceCaptured && !parsed.isSubmitted && Array.isArray(parsed.items)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearRecoveredDraft() {
  try {
    localStorage.removeItem(DRAFT_RECOVERY_KEY);
  } catch {
    // Ignore
  }
}

function createCleanSequentialDraft() {
  const base = createDefaultDraft();
  return {
    ...base,
    step: 1,
    invoiceCaptured: false,
    reviewConfirmed: false,
    isSubmitted: false,
    customSupplierMode: false,
    driveStatus: 'idle',
    driveFileName: '',
    driveFolderName: DRIVE_CONFIG.folderName
  };
}

const recovered = loadRecoveredDraft();

let state = {
  helpModalOpen: false,
  imagePreviewModalOpen: false,
  confirmNewDraftModalOpen: false,
  flashEnabled: false,
  isScanning: false,
  cameraStatus: 'idle',
  cameraError: '',
  wasRecovered: Boolean(recovered),
  draft: recovered || createCleanSequentialDraft(),
  orders: loadPersistedOrders(),
  toasts: []
};

const listeners = new Set();

function getState() {
  return state;
}

function hasUnsentWork(currentState = state) {
  const { draft } = currentState;
  return Boolean(draft.invoiceCaptured && !draft.isSubmitted);
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(persistDraft = true) {
  if (persistDraft) {
    saveDraftForRecovery(state.draft);
  }
  listeners.forEach((fn) => fn(state));
}

const actions = {
  toggleHelpModal(open) {
    state = { ...state, helpModalOpen: open };
    notify(false);
  },

  toggleImagePreviewModal(open) {
    state = { ...state, imagePreviewModalOpen: open };
    notify(false);
  },

  toggleConfirmNewDraftModal(open) {
    state = { ...state, confirmNewDraftModalOpen: open };
    notify(false);
  },

  toggleFlash() {
    state = { ...state, flashEnabled: !state.flashEnabled };
    notify(false);
  },

  setCameraState(cameraStatus, cameraError = '') {
    state = { ...state, cameraStatus, cameraError };
    notify(false);
  },

  setStep(targetStep) {
    const { draft } = state;
    if (targetStep >= 2 && !draft.invoiceCaptured) {
      actions.showToast('لازم تصوّر الفاتورة أو ترفعها الأول قبل مراجعة البيانات');
      return;
    }
    if (targetStep === 3 && !draft.reviewConfirmed) {
      actions.showToast('لازم تأكد اسم المورد والمبلغ في الخطوة الثانية الأول');
      return;
    }
    state = { ...state, draft: { ...draft, step: targetStep } };
    notify();
  },

  async completeCapture(capturedDataUrl) {
    if (state.isScanning || !capturedDataUrl) return;
    state = {
      ...state,
      isScanning: true,
      draft: {
        ...state.draft,
        driveStatus: 'uploading'
      }
    };
    notify(false);

    const driveRes = await queueInvoiceToDrive({
      imageDataUrl: capturedDataUrl,
      invoiceNumber: state.draft.invoiceNumber,
      supplierName: state.draft.supplierName
    });

    state = {
      ...state,
      isScanning: false,
      draft: {
        ...state.draft,
        capturedImageUrl: capturedDataUrl,
        invoiceCaptured: true,
        isSubmitted: false,
        driveStatus: driveRes.ok ? 'synced' : 'idle',
        driveFileName: driveRes.driveFileName,
        step: 2
      }
    };
    notify();
    actions.showToast('تم تصوير الفاتورة بنجاح');
  },

  confirmReviewAndProceed() {
    const { draft } = state;
    if (!draft.invoiceCaptured) {
      actions.showToast('لازم تصوّر الفاتورة الأول');
      return;
    }
    const activeEmp = getCurrentEmployee() || draft.employeeName;
    if (!String(activeEmp || '').trim()) {
      actions.showToast('يرجى تسجيل دخول الموظف أولاً');
      return;
    }
    draft.employeeName = activeEmp;
    if (!draft.supplierName.trim()) {
      actions.showToast('يرجى اختيار أو كتابة اسم المورد أولاً');
      return;
    }
    if ((Number(draft.invoiceAmount) || 0) <= 0) {
      actions.showToast('يرجى إدخال مبلغ فاتورة صحيح أكبر من صفر');
      return;
    }
    state = {
      ...state,
      draft: {
        ...draft,
        reviewConfirmed: true,
        step: 3
      }
    };
    notify();
  },

  updateDraftField(field, value) {
    state = {
      ...state,
      draft: { ...state.draft, [field]: value, isSubmitted: false }
    };
    saveDraftForRecovery(state.draft);
  },

  updateDraftFieldAndRender(field, value, extra = {}) {
    state = {
      ...state,
      draft: { ...state.draft, [field]: value, isSubmitted: false, ...extra }
    };
    notify();
  },

  requestNewDraft() {
    if (hasUnsentWork(state)) {
      actions.toggleConfirmNewDraftModal(true);
      return;
    }
    actions.forceNewDraft();
  },

  forceNewDraft() {
    clearRecoveredDraft();
    const nextNum = 1024 + state.orders.length;
    const fresh = createCleanSequentialDraft();
    fresh.id = 'inv-' + Date.now();
    fresh.invoiceNumber = toArabicDigits(nextNum);
    fresh.invoiceDate = formatTodayArabic();
    state = {
      ...state,
      confirmNewDraftModalOpen: false,
      cameraStatus: 'idle',
      cameraError: '',
      wasRecovered: false,
      draft: fresh
    };
    notify(false);
    actions.showToast('تم فتح فاتورة جديدة — ابدأ بتصوير الفاتورة');
  },

  toggleItemExpanded(itemId) {
    const items = state.draft.items.map((item) =>
      item.id === itemId ? { ...item, expanded: !item.expanded } : item
    );
    state = { ...state, draft: { ...state.draft, items } };
    notify();
  },

  updateItemField(itemId, field, value) {
    const items = state.draft.items.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    state = { ...state, draft: { ...state.draft, items, isSubmitted: false } };
    saveDraftForRecovery(state.draft);
  },

  enableCustomItemName(itemId) {
    const items = state.draft.items.map((item) =>
      item.id === itemId ? { ...item, isCustomName: true, name: '' } : item
    );
    state = { ...state, draft: { ...state.draft, items, isSubmitted: false } };
    notify();
  },

  applyItemPreset(itemId, presetName) {
    const preset = PRODUCT_PRESETS.find((p) => p.name === presetName);
    const items = state.draft.items.map((item) => {
      if (item.id !== itemId) return item;
      if (!preset) return { ...item, name: presetName, isCustomName: false };
      return {
        ...item,
        name: preset.name,
        isCustomName: false,
        cartonBuyPrice: preset.cartonBuyPrice,
        piecesPerCarton: preset.piecesPerCarton,
        cartonSellPrice: preset.cartonSellPrice,
        unitSellPrice: preset.unitSellPrice,
        expiryDate: preset.expiryDate || ''
      };
    });
    state = { ...state, draft: { ...state.draft, items, isSubmitted: false } };
    notify();
  },

  addItem() {
    const newId = 'item-' + Date.now();
    const defaultPreset = PRODUCT_PRESETS[2];
    const collapsedExisting = state.draft.items.map((it) => ({ ...it, expanded: false }));
    const newItem = {
      id: newId,
      name: defaultPreset.name,
      isCustomName: false,
      cartonBuyPrice: defaultPreset.cartonBuyPrice,
      piecesPerCarton: defaultPreset.piecesPerCarton,
      cartonQty: 1,
      cartonSellPrice: defaultPreset.cartonSellPrice,
      unitSellPrice: defaultPreset.unitSellPrice,
      expiryDate: defaultPreset.expiryDate || '',
      expanded: true
    };
    state = {
      ...state,
      draft: {
        ...state.draft,
        isSubmitted: false,
        items: [...collapsedExisting, newItem]
      }
    };
    notify();
  },

  removeItem(itemId) {
    if (state.draft.items.length <= 1) {
      actions.showToast('يجب أن تحتوي الطلبية على صنف واحد على الأقل');
      return;
    }
    const items = state.draft.items.filter((it) => it.id !== itemId);
    if (!items.some((it) => it.expanded)) {
      items[0] = { ...items[0], expanded: true };
    }
    state = { ...state, draft: { ...state.draft, isSubmitted: false, items } };
    notify();
  },

  saveOrder(status = 'saved') {
    const summary = calcOrderSummary(state.draft.items, state.draft.invoiceAmount);
    if (status === 'saved' && !summary.isMatched) {
      actions.showToast('لا يمكن إرسال الطلبية قبل تطابق إجمالي الأصناف مع مبلغ الفاتورة');
      return;
    }
    if (status === 'saved' && state.draft.items.some((it) => !String(it.name || '').trim())) {
      actions.showToast('يرجى كتابة اسم كل صنف قبل الإرسال');
      return;
    }

    const orderRecord = {
      id: state.draft.id,
      invoiceNumber: state.draft.invoiceNumber,
      employeeName: String(state.draft.employeeName || '').trim(),
      supplierName: state.draft.supplierName,
      invoiceDate: state.draft.invoiceDate,
      invoiceAmount: Number(state.draft.invoiceAmount) || 0,
      driveFileName: state.draft.driveFileName,
      status,
      items: state.draft.items.map(({ expanded, isCustomName, ...rest }) => rest)
    };
    const existingIdx = state.orders.findIndex((o) => o.id === orderRecord.id);
    const nextOrders =
      existingIdx >= 0
        ? state.orders.map((o, idx) => (idx === existingIdx ? orderRecord : o))
        : [orderRecord, ...state.orders];

    savePersistedOrders(nextOrders);
    if (status === 'saved') {
      clearRecoveredDraft();
    }
    state = {
      ...state,
      orders: nextOrders,
      draft: {
        ...state.draft,
        isSubmitted: status === 'saved'
      }
    };
    notify(status !== 'saved');
    actions.showToast(
      status === 'saved'
        ? 'تم إرسال وحفظ الطلبية بنجاح'
        : 'تم حفظ الفاتورة كمسودة'
    );
  },

  showToast(message) {
    const id = 'toast-' + Date.now() + Math.random().toString(16).slice(2);
    state = { ...state, toasts: [...state.toasts, { id, message }] };
    notify(false);
    setTimeout(() => {
      state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
      notify(false);
    }, 3400);
  }
};

  window.Wared.Store = { getState, hasUnsentWork, subscribe, actions };
})();
