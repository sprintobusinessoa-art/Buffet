(function() {
  'use strict';
  window.Wared = window.Wared || {};

/* ==========================================================================
   Pure Formatting & Security Sanitization Utilities
   ========================================================================== */
function toArabicDigits(value) {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(value).replace(/\d/g, (d) => map[Number(d)]);
}

function formatCurrency(amount, decimals = 0) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '٠';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return toArabicDigits(formatted);
}

function formatNumber(value, maxDecimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '٠';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  });
  return toArabicDigits(formatted);
}

function formatTodayArabic() {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  } catch {
    return '٢٠ نوفمبر ٢٠٢٦';
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strictly allows safe raster image data URIs only (blocks SVG/XSS/javascript:).
 */
function sanitizeImageDataUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  const safeRasterRe = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  return safeRasterRe.test(trimmed) ? trimmed : '';
}

  window.Wared.Formatters = { toArabicDigits, formatCurrency, formatNumber, formatTodayArabic, escapeHtml, sanitizeImageDataUrl };
})();
