// Simple, configurable margin model for dummy mode
const PRODUCT_MARGINS = {
  MIS: 0.2,   // 20% of notional
  NRML: 0.5,  // 50% of notional
  CNC: 1.0    // 100% of notional (delivery cash)
};

export function computeRequiredMargin({ productType = 'MIS', price, qty, lot = 1 }) {
  const pct = PRODUCT_MARGINS[productType] ?? 0.2;
  const notional = (Number(price) || 0) * (Number(qty) || 0) * (Number(lot) || 1);
  return +(notional * pct).toFixed(2);
}

export function basicRiskCheck({
  price,
  qty,
  maxOrderValue = 2_00_000,
  requirePrice = true
}) {
  if (!qty || qty <= 0) return { ok: false, reason: 'INVALID_QTY' };
  if (requirePrice && (!price || price <= 0)) return { ok: false, reason: 'INVALID_PRICE' };
  if (price && price * qty > maxOrderValue) return { ok: false, reason: 'MAX_ORDER_VALUE_EXCEEDED' };
  return { ok: true };
}

// Optional: guardrails for limit prices around current quote
export function priceBandCheck({ side, orderType, price, quote, maxAwayPct = 5 }) {
  if (!price || !quote) return { ok: true };
  if (orderType === 'MARKET' || orderType === 'SL-M') return { ok: true };

  // Compare against best side
  const ref = side === 'BUY' ? quote.ask : quote.bid;
  const awayPct = Math.abs((price - ref) / ref) * 100;
  if (awayPct > maxAwayPct) {
    return { ok: false, reason: 'PRICE_AWAY_TOO_MUCH', awayPct: +awayPct.toFixed(2), maxAwayPct };
  }
  return { ok: true };
}
