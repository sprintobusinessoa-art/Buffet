(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { toArabicDigits } = window.Wared.Formatters;
/* ==========================================================================
   3-Step Horizontal Stepper Component (With Sequential Lock Indicators)
   ========================================================================== */

const STEPS = [
  { num: 1, label: 'تصوير الفاتورة' },
  { num: 2, label: 'مراجعة البيانات' },
  { num: 3, label: 'تسجيل الطلبية' }
];

function renderStepper(draft) {
  const currentStep = draft.step;

  return `
    <div class="stepper-grid mb-6" role="tablist" aria-label="خطوات تسجيل الفاتورة">
      ${STEPS.map((s) => {
        const isLocked =
          (s.num === 2 && !draft.invoiceCaptured) ||
          (s.num === 3 && (!draft.invoiceCaptured || !draft.reviewConfirmed));
        const isCompleted =
          (s.num === 1 && draft.invoiceCaptured && currentStep > 1) ||
          (s.num === 2 && draft.reviewConfirmed && currentStep > 2);
        const status = s.num === currentStep ? 'active' : isCompleted ? 'completed' : 'pending';

        return `
          <div
            class="step-pill ${status} ${isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}"
            data-action="go-step"
            data-step="${s.num}"
            role="button"
            tabindex="0"
          >
            <span class="step-badge">
              ${status === 'completed'
                ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>'
                : toArabicDigits(s.num)}
            </span>
            <span class="step-label flex-1 text-sm font-semibold ${
              status === 'active'
                ? 'text-[#087E78]'
                : status === 'completed'
                ? 'text-[#132E39]'
                : 'text-[#637880]'
            }">${s.label}</span>
            ${isLocked ? '<i data-lucide="lock" class="w-3.5 h-3.5 text-[#8FA1A8] shrink-0 hidden sm:inline-block"></i>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

  window.Wared.Stepper = { renderStepper };
})();
