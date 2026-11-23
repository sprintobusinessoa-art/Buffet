(function() {
  'use strict';
  window.Wared = window.Wared || {};

  const AUTH_KEY = 'wared_active_employee_v1';

  function getCurrentEmployee() {
    try {
      return (localStorage.getItem(AUTH_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function loginEmployee(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    try {
      localStorage.setItem(AUTH_KEY, clean);
    } catch {
      // Ignore storage errors
    }
    return true;
  }

  function logoutEmployee() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function renderLogoutButton() {
    return `
      <button
        type="button"
        data-action="global-logout"
        title="تسجيل خروج"
        aria-label="تسجيل خروج"
        class="w-9 h-9 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
      >
        <i data-lucide="log-out" class="w-4 h-4"></i>
      </button>
    `;
  }

  function confirmLogout(onConfirmed) {
    const existing = document.getElementById('wared-logout-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'wared-logout-modal';
    modal.className = 'fixed inset-0 bg-[#132E39]/65 backdrop-blur-xs z-[70] flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#DCE6E8]">
        <div class="flex items-start gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <i data-lucide="log-out" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-[#132E39]">تأكيد تسجيل الخروج</h3>
            <p class="text-xs text-[#637880] mt-1 leading-relaxed">
              هل أنت متأكد أنك تريد تسجيل الخروج؟ عند الخروج سيحتاج الموظف التالي لتسجيل اسمه من جديد.
            </p>
          </div>
        </div>
        <div class="flex gap-2.5 mt-5">
          <button type="button" id="wared-logout-yes" class="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer">
            نعم، تسجيل الخروج
          </button>
          <button type="button" id="wared-logout-no" class="btn-secondary flex-1 py-2.5 px-4 text-xs">
            تراجع
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    document.getElementById('wared-logout-no')?.addEventListener('click', close);
    document.getElementById('wared-logout-yes')?.addEventListener('click', () => {
      logoutEmployee();
      close();
      if (typeof onConfirmed === 'function') onConfirmed();
    });
  }

  function renderLoginScreen(titleText = 'تسجيل دخول الموظف') {
    const { escapeHtml } = window.Wared.Formatters;
    return `
      <div class="max-w-md mx-auto mt-10 card p-6 sm:p-8 text-center">
        <div class="w-12 h-12 rounded-2xl bg-[#E6F4F1] text-[#087E78] flex items-center justify-center mx-auto mb-4">
          <i data-lucide="user-check" class="w-6 h-6"></i>
        </div>
        <h2 class="text-xl font-bold text-[#132E39]">${escapeHtml(titleText)}</h2>
        <p class="text-xs text-[#637880] mt-1.5 mb-6 leading-relaxed">
          سجّل دخولك باسمك مرة واحدة، وأي عملية هتقوم بيها على السيستم هتتسجل باسمك تلقائياً.
        </p>

        <div class="text-right space-y-4">
          <div>
            <label class="block text-xs font-semibold text-[#637880] mb-1.5">اسم الموظف <span class="text-red-500">*</span></label>
            <input
              type="text"
              id="global-login-input"
              placeholder="اكتب اسمك الكامل..."
              class="wared-input font-semibold"
              data-action="global-login-input"
            />
          </div>
          <button type="button" data-action="global-login-submit" class="btn-primary w-full py-3 text-sm">
            <span>دخول للنظام</span>
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }

  window.Wared.Auth = {
    getCurrentEmployee,
    loginEmployee,
    logoutEmployee,
    renderLogoutButton,
    confirmLogout,
    renderLoginScreen
  };
})();
