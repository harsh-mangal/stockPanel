import LinkedAccount from '../models/LinkedAccount.js';
import { allocateQuantities } from '../utils/allocation.js';
import { basicRiskCheck, computeRequiredMargin, priceBandCheck } from '../utils/risk.js';
import { simulator } from '../sim/simulator.js';

export const previewMaster = async (req, res, next) => {
  try {
    const {
      symbol, side, orderType = 'LIMIT',
      price, triggerPrice,
      productType = 'MIS',
      allocationMode, allocationConfig = {}, masterQty = 0,
      targets = { userId: null, accountIds: [], tags: [], brokers: [] },
      lot = 1,
      maxAwayPct = 5
    } = req.body;

    // Quote + sanity
    const q = simulator.quote(symbol);
    if (!q) return res.status(400).json({ error: 'UNKNOWN_SYMBOL' });

    // Choose effective price for checks:
    // - LIMIT/SL: use provided price
    // - MARKET/SL-M: if price supplied, we respect it; else use side’s best
    const sideBest = side === 'BUY' ? q.ask : q.bid;
    const effectivePrice =
      (orderType === 'MARKET' || orderType === 'SL-M')
        ? (price && price > 0 ? price : sideBest)
        : price;

    // Type-specific validation
    const requirePrice = !(orderType === 'MARKET' || orderType === 'SL-M');
    const risk = basicRiskCheck({
      price: effectivePrice,
      qty: Math.max(masterQty, allocationConfig.sameQty || 0),
      requirePrice
    });
    if (!risk.ok) return res.status(400).json({ error: 'RISK_BLOCK', reason: risk.reason });

    const band = priceBandCheck({ side, orderType, price: effectivePrice, quote: q, maxAwayPct });
    if (!band.ok) return res.status(400).json({ error: 'PRICE_BAND', ...band });

    // Targets → accounts
    const aq = { enabled: true };
    if (targets.userId) aq.userId = targets.userId;
    if (targets.accountIds?.length) aq._id = { $in: targets.accountIds };
    if (targets.tags?.length) aq.tags = { $in: targets.tags };
    if (targets.brokers?.length) aq.broker = { $in: targets.brokers.map(b => b.toUpperCase()) };
    const accounts = await LinkedAccount.find(aq).lean();
    if (!accounts.length) return res.status(400).json({ error: 'NO_MATCHING_ACCOUNTS' });

    // Allocation
    const capitals = Object.fromEntries(accounts.map(a => [String(a._id), a.capital || 0]));
    const dist = allocateQuantities({ mode: allocationMode, config: allocationConfig, accounts, masterQty, capitalsById: capitals });

    const rows = [];
    let totalReqQty = 0, totalPassQty = 0, totalMargin = 0;

    for (const a of accounts) {
      const qty = Number(dist.get(String(a._id)) || 0);
      if (qty <= 0) continue;

      const reqMargin = computeRequiredMargin({ productType, price: effectivePrice, qty, lot });
      const pass = (a.capital || 0) >= reqMargin;
      rows.push({
        accountId: String(a._id),
        displayName: a.displayName,
        broker: a.broker,
        capital: a.capital || 0,
        qty,
        price: effectivePrice,
        requiredMargin: reqMargin,
        marginOk: pass
      });

      totalReqQty += qty;
      if (pass) {
        totalPassQty += qty;
        totalMargin += reqMargin;
      }
    }

    res.json({
      symbol, side, orderType, productType,
      effectivePrice,
      requestedQty: totalReqQty,
      passQty: totalPassQty,
      totalRequiredMargin: +totalMargin.toFixed(2),
      accounts: rows
    });
  } catch (e) { next(e); }
};
