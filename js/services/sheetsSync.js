(function() {
  'use strict';
  window.Wared = window.Wared || {};

/* ==========================================================================
   Isolated Google Sheets Sync Service (Sales & Inventory Logs)
   ========================================================================== */

const SHEETS_CONFIG = {
  spreadsheetName: 'سيستم البوفيه — سجل العمليات',
  salesSheetTab: 'Sales_Log',
  inventorySheetTab: 'Buffet_Inventory_Log'
};

/**
 * Formats and queues rows for Google Sheets sync.
 * Replace the return with your Apps Script / Sheets API endpoint when deploying live.
 */
async function syncSalesToGoogleSheets({ serverTimestamp, employeeName, customerCode, items }) {
  const rows = items.map((it) => ({
    timestamp: serverTimestamp,
    employeeName,
    customerCode,
    department: it.departmentLabel,
    category: it.itemName,
    quantity: it.qty,
    totalPrice: it.lineTotal
  }));

  await new Promise((resolve) => setTimeout(resolve, 250));
  return { ok: true, syncedRows: rows.length, rows };
}

async function syncInventoryToGoogleSheets({ serverDate, periodLabel, shift, team, validItems, damagedItems, submittedAt }) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    ok: true,
    serverDate,
    periodLabel,
    shift,
    team,
    validCount: validItems.length,
    damagedCount: damagedItems.length,
    submittedAt
  };
}

  window.Wared.SheetsSync = { SHEETS_CONFIG, syncSalesToGoogleSheets, syncInventoryToGoogleSheets };
})();
