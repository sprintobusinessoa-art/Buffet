(function() {
  'use strict';
  window.Wared = window.Wared || {};

/* ==========================================================================
   Pure Business & Math Calculations (Profit, Expiry Status, Order Summary)
   ========================================================================== */

function calcUnitCost(cartonBuyPrice, piecesPerCarton) {
  const buy = Number(cartonBuyPrice) || 0;
  const pieces = Number(piecesPerCarton) || 0;
  if (pieces <= 0 || buy < 0) return 0;
  return Number((buy / pieces).toFixed(2));
}

function calcItemTotal(item) {
  const buy = Number(item?.cartonBuyPrice) || 0;
  const qty = Number(item?.cartonQty) || 0;
  if (buy < 0 || qty < 0) return 0;
  return Number((buy * qty).toFixed(2));
}

/**
 * Calculates profit per unit, profit per carton, margin %, and loss flag.
 */
function calcProfitMetrics(item) {
  const unitCost = calcUnitCost(item?.cartonBuyPrice, item?.piecesPerCarton);
  const unitSell = Number(item?.unitSellPrice) || 0;
  const cartonBuy = Number(item?.cartonBuyPrice) || 0;
  const cartonSell = Number(item?.cartonSellPrice) || 0;

  const unitProfit = Number((unitSell - unitCost).toFixed(2));
  const cartonProfit = Number((cartonSell - cartonBuy).toFixed(2));
  const marginPct = unitCost > 0 ? Number(((unitProfit / unitCost) * 100).toFixed(1)) : 0;
  const isLoss = (unitSell > 0 && unitProfit < 0) || (cartonSell > 0 && cartonProfit < 0);

  return { unitCost, unitProfit, cartonProfit, marginPct, isLoss };
}

/**
 * Returns { status: 'valid' | 'expiring-soon' | 'expired', daysLeft: number | null }
 */
function getExpiryStatus(expiryDate) {
  if (!expiryDate || typeof expiryDate !== 'string') {
    return { status: 'valid', daysLeft: null };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiryDate.trim());
  if (!match) return { status: 'valid', daysLeft: null };

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  const daysLeft = Math.ceil((expDate - todayMidnight) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return { status: 'expired', daysLeft };
  if (daysLeft <= 30) return { status: 'expiring-soon', daysLeft };
  return { status: 'valid', daysLeft };
}

function isItemExpired(expiryDate) {
  return getExpiryStatus(expiryDate).status === 'expired';
}

function calcOrderSummary(items = [], invoiceAmount = 0) {
  const itemCount = items.length;
  const totalCartons = items.reduce((sum, item) => sum + (Number(item.cartonQty) || 0), 0);
  const itemsTotal = items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const expiredCount = items.filter((item) => getExpiryStatus(item.expiryDate).status === 'expired').length;
  const expiringSoonCount = items.filter((item) => getExpiryStatus(item.expiryDate).status === 'expiring-soon').length;
  const targetAmount = Number(invoiceAmount) || 0;
  const diff = Number((itemsTotal - targetAmount).toFixed(2));
  const isMatched = itemCount > 0 && targetAmount > 0 && Math.abs(diff) < 0.01;

  return {
    itemCount,
    totalCartons,
    itemsTotal: Number(itemsTotal.toFixed(2)),
    expiredCount,
    expiringSoonCount,
    targetAmount,
    diff,
    isMatched
  };
}

  window.Wared.Calculations = { calcUnitCost, calcItemTotal, calcProfitMetrics, getExpiryStatus, isItemExpired, calcOrderSummary };
})();
