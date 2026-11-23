(function() {
  'use strict';
  window.Wared = window.Wared || {};
  const { escapeHtml } = window.Wared.Formatters;
/* ==========================================================================
   Step 1: Live Device Camera Capture & Image Upload Component
   ========================================================================== */

function renderSampleReceiptCard(compact = false) {
  return `
    <div class="bg-white rounded-xl shadow-md text-[#132E39] ${compact ? 'p-4 text-[11px]' : 'p-5 text-xs'} border border-[#DCE6E8]">
      <div class="text-center border-b border-[#EAEFF1] pb-2.5 mb-2.5">
        <div class="font-bold ${compact ? 'text-sm' : 'text-base'} text-[#132E39]">شركة الأمانة للتوريدات</div>
        <div class="text-[11px] text-[#637880] mt-0.5">فاتورة مبيعات • ١٠٢٤</div>
      </div>
      <div class="flex items-center justify-between pt-2 font-bold text-xs">
        <span>الإجمالي</span>
        <span class="text-[#132E39]">٦,٠٠٠ ج.م</span>
      </div>
    </div>
  `;
}

function renderStepCapture(state) {
  const isCamActive = state.cameraStatus === 'active';
  const isCamError = state.cameraStatus === 'error';

  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <!-- Right Column: Live Device Camera Viewfinder -->
      <div class="lg:col-span-7 card p-5 sm:p-6">
        <div class="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-bold text-[#132E39]">تصوير الفاتورة</h2>
            <p class="text-xs text-[#637880] mt-1">افتح كاميرا الجهاز وصوّر الفاتورة أو ارفعها من جهازك.</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            isCamActive ? 'bg-[#E6F4F1] text-[#087E78]' : 'bg-[#F1F5F7] text-[#637880]'
          }">
            ${isCamActive ? 'الكاميرا متصلة' : 'في انتظار الكاميرا'}
          </span>
        </div>

        <div class="viewfinder ${state.isScanning ? 'scanning' : ''} ${state.flashEnabled ? 'ring-2 ring-amber-300/60' : ''}">
          <!-- Viewfinder Top Controls -->
          <div class="flex items-center justify-between text-white/85 text-xs relative z-10">
            <span class="font-medium flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${isCamActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
              <span>معاينة الكاميرا الحية</span>
            </span>
            <button
              type="button"
              data-action="toggle-flash"
              title="إضاءة المعاينة"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                state.flashEnabled ? 'bg-amber-400 text-[#132E39]' : 'bg-white/10 text-white hover:bg-white/20'
              }"
            >
              <i data-lucide="zap" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Center Live Video Feed + Framing Brackets -->
          <div class="viewfinder-frame flex items-center justify-center min-h-[250px]">
            <span class="bracket bracket-tr z-10"></span>
            <span class="bracket bracket-tl z-10"></span>
            <span class="bracket bracket-br z-10"></span>
            <span class="bracket bracket-bl z-10"></span>
            <div class="scan-line z-10"></div>

            <video
              id="camera-video"
              autoplay
              playsinline
              muted
              class="w-full h-[240px] object-cover rounded-lg bg-[#0F2229] ${isCamActive ? 'block' : 'hidden'}"
            ></video>

            ${!isCamActive ? `
              <div class="w-full h-[240px] rounded-lg bg-[#0F2229]/90 border border-white/10 flex flex-col items-center justify-center text-center p-5">
                <div class="w-12 h-12 rounded-full bg-white/10 text-[#3BB2AC] flex items-center justify-center mb-3">
                  <i data-lucide="camera" class="w-6 h-6"></i>
                </div>
                <p class="text-xs text-white/90 font-semibold leading-relaxed max-w-[230px]">
                  ${isCamError ? escapeHtml(state.cameraError) : 'جاري تجهيز كاميرا الجهاز لتصوير الفاتورة...'}
                </p>
                <button
                  type="button"
                  data-action="open-camera"
                  class="mt-3 px-4 py-2 rounded-xl bg-[#087E78] hover:bg-[#066863] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  ${isCamError ? 'إعادة فتح الكاميرا' : 'فتح كاميرا الجهاز'}
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Bottom Camera Controls -->
          <div class="flex items-center justify-between pt-2 relative z-10">
            <div class="w-24"></div>
            <div class="flex flex-col items-center gap-1.5">
              <button
                type="button"
                data-action="capture-invoice"
                class="shutter-btn ${!isCamActive ? 'opacity-50 cursor-not-allowed' : ''}"
                aria-label="التقاط صورة الفاتورة"
              >
                <i data-lucide="camera" class="w-6 h-6"></i>
              </button>
              <span class="text-[11px] text-white/85 font-medium">
                ${state.isScanning ? 'جاري التجهيز...' : 'التقاط'}
              </span>
            </div>
            <label class="w-24 flex items-center justify-end gap-1.5 text-xs text-white/90 hover:text-white cursor-pointer">
              <span>رفع صورة</span>
              <i data-lucide="upload" class="w-4 h-4"></i>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" capture="environment" class="hidden" data-action="upload-invoice" />
            </label>
          </div>
        </div>
      </div>

      <!-- Left Column: Guidance & Direct Upload -->
      <div class="lg:col-span-5 space-y-4">
        <div class="card p-6 text-center">
          <div class="w-11 h-11 rounded-xl bg-[#E6F4F1] text-[#087E78] flex items-center justify-center mx-auto mb-3.5">
            <i data-lucide="file-text" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-[#132E39]">فاتورتك هي البداية</h3>
          <p class="text-xs text-[#637880] leading-relaxed mt-1.5 max-w-xs mx-auto">
            صوّر الفاتورة بكاميرا الجهاز أو ارفع صورتها، وهنجهز لك اسم المورد والمبلغ عشان تراجعهم.
          </p>

          <ul class="mt-5 space-y-3 text-right text-xs text-[#132E39] border-t border-[#EAEFF1] pt-4">
            <li class="flex items-center gap-2.5">
              <i data-lucide="check" class="w-4 h-4 text-[#087E78] shrink-0"></i>
              <span>خلّي الفاتورة كاملة داخل الإطار</span>
            </li>
            <li class="flex items-center gap-2.5">
              <i data-lucide="check" class="w-4 h-4 text-[#087E78] shrink-0"></i>
              <span>استخدم إضاءة واضحة من غير انعكاس</span>
            </li>
            <li class="flex items-center gap-2.5">
              <i data-lucide="check" class="w-4 h-4 text-[#087E78] shrink-0"></i>
              <span>ثبّت الكاميرا وقت التصوير</span>
            </li>
          </ul>
        </div>

        <!-- Upload Mint Card -->
        <div class="rounded-2xl bg-[#E6F4F1] border border-[#C3E7E2] p-5 flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-bold text-[#087E78]">الفاتورة عندك صورة؟</div>
            <div class="text-xs text-[#3C6E6B] mt-0.5">ارفعها مباشرة من جهازك</div>
          </div>
          <label class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#087E78] border border-[#A7DCD7] text-xs font-bold hover:bg-[#F5FBF9] transition-colors cursor-pointer shrink-0">
            <i data-lucide="upload" class="w-4 h-4"></i>
            <span>اختيار صورة</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" data-action="upload-invoice" />
          </label>
        </div>
      </div>
    </div>
  `;
}

  window.Wared.StepCapture = { renderSampleReceiptCard, renderStepCapture };
})();
