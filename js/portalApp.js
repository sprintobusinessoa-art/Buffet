(function() {
  'use strict';
  window.Wared = window.Wared || {};

  const { escapeHtml } = window.Wared.Formatters;
  const { getCurrentEmployee, loginEmployee, logoutEmployee, renderLogoutButton, confirmLogout, renderLoginScreen } = window.Wared.Auth;
  const BRAND_LOGO_PATH = 'logo.png';

  const MODULES = [
    {
      id: 'inventory',
      href: 'inventory.html',
      title: 'جرد البوفيه',
      desc: 'تسجيل الجرد الصباحي ونص اليوم والختامي مع التوالف وفريق الشيفت والقفل التام.',
      icon: 'clipboard-check',
      badge: '٣ فترات متتالية'
    },
    {
      id: 'sales',
      href: 'sales.html',
      title: 'تسجيل المبيعات والسحب',
      desc: 'سحب العملاء عبر الأقسام الثلاثة (ستور، مكتبات، بوفيه) باسم الموظف والترحيل للشيت.',
      icon: 'shopping-bag',
      badge: 'ستور • مكتبات • بوفيه'
    },
    {
      id: 'supply',
      href: 'supply-pos.html',
      title: 'توريد من المخزن إلى نقطة البيع',
      desc: 'توريد الأصناف بالقطعة مع تسجيل اسم الموظف وإصدار ورقة إجمالي المورد كصورة PNG.',
      icon: 'package-check',
      badge: 'توريد بالقطعة'
    },
    {
      id: 'purchase',
      href: 'purchase.html',
      title: 'صادر من المورد (طلبية جديدة)',
      desc: 'تصوير الفاتورة بالكاميرا، مراجعة المورد والمبلغ، وتسجيل الأصناف والصلاحية والمطابقة.',
      icon: 'receipt',
      badge: '٣ خطوات متتالية'
    }
  ];

  function attachLogoFallback() {
    const logoImg = document.getElementById('brand-logo-img');
    const logoFallback = document.getElementById('brand-logo-fallback');
    if (!logoImg || !logoFallback) return;
    logoImg.addEventListener('error', () => { logoImg.classList.add('hidden'); logoFallback.classList.remove('hidden'); }, { once: true });
    logoImg.addEventListener('load', () => { logoImg.classList.remove('hidden'); logoFallback.classList.add('hidden'); }, { once: true });
  }

  function renderPortal() {
    const root = document.getElementById('portal-root');
    if (!root) return;

    const empName = getCurrentEmployee();

    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="flex items-center gap-3">
              <div class="flex items-center">
                <img id="brand-logo-img" src="${BRAND_LOGO_PATH}" alt="شعار سيستم البوفيه" class="h-9 sm:h-10 w-auto max-w-[150px] object-contain" />
                <div id="brand-logo-fallback" class="hidden h-9 px-3 rounded-xl border border-dashed border-[#A7DCD7] bg-[#EFF8F6] text-[#087E78] items-center justify-center text-xs font-bold whitespace-nowrap flex">LOGO (logo.png)</div>
              </div>
              <div class="text-base sm:text-lg font-extrabold text-[#132E39] leading-none">سيستم البوفيه</div>
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
            <div class="mb-7">
              <h1 class="text-2xl sm:text-[30px] font-extrabold text-[#132E39] tracking-tight">أهلاً ${escapeHtml(empName)} — اختر الوحدة المطلوبة</h1>
              <p class="text-xs sm:text-sm text-[#637880] mt-1">كل العمليات اللي هتقوم بيها هتتسجل باسمك تلقائياً.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              ${MODULES.map((m) => `
                <a
                  href="${m.href}"
                  class="card p-6 hover:border-[#087E78] hover:shadow-md transition-all flex flex-col justify-between group no-underline"
                >
                  <div>
                    <div class="flex items-center justify-between mb-4">
                      <div class="w-12 h-12 rounded-2xl bg-[#E6F4F1] text-[#087E78] group-hover:bg-[#087E78] group-hover:text-white flex items-center justify-center transition-colors">
                        <i data-lucide="${m.icon}" class="w-6 h-6"></i>
                      </div>
                      <span class="px-3 py-1 rounded-full bg-[#F5F7F8] text-[#637880] text-[11px] font-bold border border-[#EAEFF1]">
                        ${m.badge}
                      </span>
                    </div>
                    <h2 class="text-lg font-extrabold text-[#132E39] group-hover:text-[#087E78] transition-colors">${m.title}</h2>
                    <p class="text-xs text-[#637880] leading-relaxed mt-2">${m.desc}</p>
                  </div>

                  <div class="mt-5 pt-4 border-t border-[#EAEFF1] flex items-center justify-between text-xs font-bold text-[#087E78]">
                    <span>دخول إلى الوحدة</span>
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                  </div>
                </a>
              `).join('')}
            </div>
          ` : renderLoginScreen('تسجيل دخول الموظف — سيستم البوفيه')}
        </main>
      </div>
    `;

    attachLogoFallback();
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'global-login-submit') {
      const inp = document.getElementById('global-login-input');
      if (inp && loginEmployee(inp.value)) {
        renderPortal();
      }
    } else if (target.dataset.action === 'global-logout') {
      confirmLogout(() => renderPortal());
    }
  });

  document.addEventListener('DOMContentLoaded', renderPortal);
})();
