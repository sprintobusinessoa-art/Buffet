(function() {
  'use strict';
  window.Wared = window.Wared || {};

/* ==========================================================================
   Unified Catalog: Purchases, POS Supply, Buffet Inventory & Sales Departments
   ========================================================================== */
const STORES = [
  { id: 'noor', name: 'متجر النور', role: 'إدارة المشتريات والمخزون' },
  { id: 'alex', name: 'فرع الإسكندرية', role: 'إدارة المشتريات والمخزون' }
];

const SUPPLIERS = [
  'شركة الأمانة للتوريدات',
  'مؤسسة النيل التجارية',
  'شركة الفتح للمواد الغذائية',
  'توريدات الدلتا السريعة'
];

const PRODUCT_PRESETS = [
  { name: 'زيت عباد الشمس ١ لتر', cartonBuyPrice: 240, piecesPerCarton: 24, cartonSellPrice: 300, unitSellPrice: 12.5, expiryDate: '2027-11-20' },
  { name: 'سكر أبيض ١ كجم', cartonBuyPrice: 180, piecesPerCarton: 20, cartonSellPrice: 210, unitSellPrice: 11, expiryDate: '2028-05-15' },
  { name: 'أرز مصري فاخر ١ كجم', cartonBuyPrice: 320, piecesPerCarton: 10, cartonSellPrice: 360, unitSellPrice: 38, expiryDate: '2027-09-01' },
  { name: 'مكرونة قلم ٤٠٠ جم', cartonBuyPrice: 160, piecesPerCarton: 20, cartonSellPrice: 190, unitSellPrice: 10, expiryDate: '2027-12-30' },
  { name: 'شاي ناعم ٢٥٠ جم', cartonBuyPrice: 480, piecesPerCarton: 24, cartonSellPrice: 540, unitSellPrice: 23, expiryDate: '2028-03-10' }
];

const BUFFET_INVENTORY_CATEGORIES = [
  {
    id: 'hot_drinks',
    label: 'مشروبات ساخنة',
    items: [
      { id: 'inv-tea', name: 'شاي فتلة / ناعم' },
      { id: 'inv-coffee', name: 'قهوة تركي' },
      { id: 'inv-nescafe', name: 'نسكافيه كلاسيك' }
    ]
  },
  {
    id: 'cold_drinks',
    label: 'مشروبات باردة',
    items: [
      { id: 'inv-cola', name: 'مشروب غازي كانز' },
      { id: 'inv-juice', name: 'عصير معلب ٢٥٠ مل' }
    ]
  },
  {
    id: 'water',
    label: 'مياه',
    items: [
      { id: 'inv-water-s', name: 'مياه معدنية صغيرة' },
      { id: 'inv-water-l', name: 'مياه معدنية كبيرة' }
    ]
  },
  {
    id: 'bakery',
    label: 'مخبوزات',
    items: [
      { id: 'inv-croissant', name: 'كرواسون طازج' },
      { id: 'inv-pate', name: 'باتيه بالجبنة' }
    ]
  },
  {
    id: 'sweets',
    label: 'حلويات',
    items: [
      { id: 'inv-cake', name: 'كيك مغلف' },
      { id: 'inv-biscuit', name: 'بسكويت شوكولاتة' }
    ]
  },
  {
    id: 'sandwiches',
    label: 'سندوتشات',
    items: [
      { id: 'inv-cheese-sand', name: 'سندوتش جبنة رومي' },
      { id: 'inv-chicken-sand', name: 'سندوتش فراخ بانيه' }
    ]
  }
];

const SALES_DEPARTMENTS = [
  {
    id: 'store',
    label: 'ستور',
    items: [
      { id: 'st-usb', name: 'فلاشة USB 32GB', price: 180 },
      { id: 'st-cable', name: 'كابل شاحن سريع Type-C', price: 95 },
      { id: 'st-mouse', name: 'ماوس لاسلكي', price: 250 },
      { id: 'st-earphone', name: 'سماعة أذن سلكية', price: 120 }
    ]
  },
  {
    id: 'libraries',
    label: 'مكتبات',
    items: [
      { id: 'lib-pen', name: 'قلم جاف أزرق', price: 10 },
      { id: 'lib-notebook', name: 'كشكول سلك ١٠٠ ورقة', price: 45 },
      { id: 'lib-a4', name: 'رزمة ورق طباعة A4', price: 165 },
      { id: 'lib-marker', name: 'قلم ماركر سبورة', price: 25 },
      { id: 'lib-folder', name: 'حافظة مستندات بلاستيك', price: 15 }
    ]
  },
  {
    id: 'buffet',
    label: 'بوفيه',
    items: [
      { id: 'buf-tea', name: 'كوب شاي', price: 15 },
      { id: 'buf-coffee', name: 'فنجان قهوة تركي', price: 25 },
      { id: 'buf-nescafe', name: 'كوب نسكافيه', price: 30 },
      { id: 'buf-water', name: 'زجاجة مياه معدنية', price: 10 },
      { id: 'buf-cola', name: 'مشروب غازي كانز', price: 20 },
      { id: 'buf-croissant', name: 'كرواسون بالجبنة', price: 35 },
      { id: 'buf-sand', name: 'سندوتش فراخ بانيه', price: 55 }
    ]
  }
];

function createDefaultDraft() {
  return {
    id: 'inv-1024',
    step: 1,
    employeeName: '',
    supplierName: 'شركة الأمانة للتوريدات',
    invoiceAmount: 6000,
    invoiceDate: '٢٣ نوفمبر ٢٠٢٦',
    invoiceNumber: '١٠٢٤',
    capturedImageUrl: null,
    items: [
      {
        id: 'item-1',
        name: 'زيت عباد الشمس ١ لتر',
        cartonBuyPrice: 240,
        piecesPerCarton: 24,
        cartonQty: 1,
        cartonSellPrice: 300,
        unitSellPrice: 12.5,
        expiryDate: '2027-11-20',
        expanded: true
      }
    ]
  };
}

  window.Wared.Catalog = { STORES, SUPPLIERS, PRODUCT_PRESETS, BUFFET_INVENTORY_CATEGORIES, SALES_DEPARTMENTS, createDefaultDraft };
})();
