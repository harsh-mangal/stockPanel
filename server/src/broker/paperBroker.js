import { nanoid } from 'nanoid';
import { simulator } from '../sim/simulator.js';
import ChildOrder from '../models/ChildOrder.js';
import { config } from '../config/env.js';
import LinkedAccount from '../models/LinkedAccount.js';
import MasterOrder from '../models/MasterOrder.js';
import Trade from '../models/Trade.js';
import { getIO } from '../realtime/io.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function emitChild(child) {
  const io = getIO();
  const payload = {
    childOrderId: String(child._id),
    masterOrderId: String(child.masterOrderId),
    accountId: String(child.accountId),
    status: child.status,
    filledQty: child.filledQty,
    avgPrice: child.avgPrice,
    error: child.error || null,
    ts: Date.now(),
  };
  io.to(`order:${child.masterOrderId}`).emit('order.child.updated', payload);
  io.to(`account:${child.accountId}`).emit('order.child.updated', payload);
}

async function emitMasterSummary(masterId) {
  const io = getIO();
  const kids = await ChildOrder.find({ masterOrderId: masterId }).lean();
  const filledQty = kids.reduce((s, c) => s + (c.filledQty || 0), 0);
  const notional = kids.reduce((s, c) => s + (c.avgPrice * (c.filledQty || 0)), 0);
  const avg = filledQty ? notional / filledQty : 0;
  io.to(`order:${masterId}`).emit('order.master.summary', {
    masterOrderId: String(masterId),
    filledQty,
    avgPrice: +avg.toFixed(2),
    statuses: kids.map((k) => ({
      id: String(k._id),
      status: k.status,
      filledQty: k.filledQty,
    })),
  });
}

async function emitTrade(tradeDoc) {
  const io = getIO();
  const payload = {
    _id: String(tradeDoc._id),
    masterOrderId: String(tradeDoc.masterOrderId),
    childOrderId: String(tradeDoc.childOrderId),
    accountId: String(tradeDoc.accountId),
    userId: tradeDoc.userId ? String(tradeDoc.userId) : null,
    symbol: tradeDoc.symbol,
    side: tradeDoc.side,
    qty: tradeDoc.qty,
    price: tradeDoc.price,
    filledAt: tradeDoc.filledAt,
    broker: tradeDoc.broker,
  };
  io.to(`order:${payload.masterOrderId}`).emit('trade.new', payload);
  io.to(`account:${payload.accountId}`).emit('trade.new', payload);
  if (payload.userId) io.to(`user:${payload.userId}`).emit('trade.new', payload);
}

export const paperBroker = {
  name: 'PAPER',

  async placeOrder(input) {
    // input: { childId, symbol, side, qty, orderType, price, triggerPrice }
    const child = await ChildOrder.findById(input.childId);
    if (!child) throw new Error('CHILD_NOT_FOUND');

    const coid = `PB-${nanoid(8)}`;
    child.clientOrderId = coid;
    child.status = 'PLACED';
    child.timestamps = {
      ...(child.timestamps || {}),
      dispatchedAt: new Date(),
      updatedAt: new Date(),
    };
    await child.save();
    emitChild(child); // notify UI that it’s placed

    // Simulate async fills
    fillChild(child, input).catch(console.error);

    return { brokerOrderId: coid };
  },

  async cancelOrder(/* brokerOrderId */) {
    // TODO: implement cancel flag check inside fill loop if needed
  },
};

async function fillChild(child, input) {
  // small placement latency
  await sleep(80 + Math.random() * 120);

  // trigger logic for SL/SL-M
  if (input.orderType === 'SL' || input.orderType === 'SL-M') {
    const triggered = await waitForTrigger(input);
    if (!triggered) {
      await markRejected(child, 'TRIGGER_TIMEOUT', 'Stop not reached');
      return;
    }
  }

  const q0 = simulator.quote(child.symbol);
  if (!q0) return markRejected(child, 'UNKNOWN_SYMBOL', 'No quote');

  const liquidity = config.PAPER_LIQUIDITY; // 0..1
  const maxSlipPct = config.PAPER_MAX_SLIPPAGE_PCT; // e.g., 0.25

  let slices = Math.max(1, Math.min(5, Math.ceil(child.qty / 1000)));
  let remaining = child.qty;

  // cache for trade userId
  const acc = await LinkedAccount.findById(child.accountId).lean().catch(() => null);

  while (remaining > 0 && slices-- > 0) {
    // always re-read latest quote for each slice
    const q = simulator.quote(child.symbol);
    if (!q) {
      await markRejected(child, 'NO_QUOTE', 'Quote unavailable during fill');
      return;
    }

    const sliceQty = Math.max(
      1,
      Math.floor((remaining / (slices + 1)) * (0.7 + Math.random() * 0.6))
    );

    const execPrice = fillPrice(input.orderType, input.side, input.price, q, maxSlipPct);
    if (execPrice == null) {
      await markRejected(child, 'PRICE_CONDITION', 'Limit not satisfiable within slippage');
      return;
    }

    // probabilistic liquidity
    const filled = Math.random() < liquidity ? sliceQty : Math.floor(sliceQty * Math.random());
    if (filled <= 0) {
      await sleep(60);
      continue;
    }

    remaining -= filled;

    // apply the fill
    const newFilledQty = (child.filledQty || 0) + filled;
    const newAvg =
      ((child.avgPrice || 0) * (child.filledQty || 0) + execPrice * filled) / newFilledQty;

    child.filledQty = newFilledQty;
    child.avgPrice = +newAvg.toFixed(2);
    child.status = remaining > 0 ? 'PARTIAL' : 'FILLED';
    child.timestamps = {
      ...(child.timestamps || {}),
      updatedAt: new Date(),
      ...(remaining === 0 ? { filledAt: new Date() } : {}),
    };
    await child.save();
    emitChild(child);
    await emitMasterSummary(child.masterOrderId);

    // persist a Trade for this slice and emit
    const t = await Trade.create({
      masterOrderId: child.masterOrderId,
      childOrderId: child._id,
      accountId: child.accountId,
      userId: acc?.userId || null,
      symbol: child.symbol,
      side: child.side,
      qty: filled,
      price: execPrice,
      filledAt: new Date(),
      broker: child.broker,
      brokerOrderId: child.clientOrderId,
    });
    await emitTrade(t);

    // pacing between slices
    await sleep(120 + Math.random() * 240);
  }
}

async function waitForTrigger(input) {
  const deadline = Date.now() + 10_000; // 10s trigger window for demo
  while (Date.now() < deadline) {
    const q = simulator.quote(input.symbol);
    if (!q) return false;
    if (input.side === 'BUY') {
      if (q.ltp >= (input.triggerPrice ?? Infinity)) return true;
    } else {
      if (q.ltp <= (input.triggerPrice ?? -Infinity)) return true;
    }
    await sleep(250);
  }
  return false;
}

function fillPrice(orderType, side, limit, q, maxSlipPct) {
  if (orderType === 'MARKET' || orderType === 'SL-M') {
    // price-protect market orders with a cap
    const raw = side === 'BUY' ? q.ask : q.bid;
    const cap = raw * (1 + maxSlipPct / 100);
    return Math.min(cap, raw);
  }
  if (orderType === 'LIMIT' || orderType === 'SL') {
    if (side === 'BUY') return q.ask <= (limit ?? 0) ? q.ask : null;
    return q.bid >= (limit ?? Infinity) ? q.bid : null;
  }
  return null;
}

async function markRejected(child, code, msg) {
  child.status = 'REJECTED';
  child.error = { code, msg };
  child.timestamps = { ...(child.timestamps || {}), updatedAt: new Date() };
  await child.save();
  emitChild(child);
  await emitMasterSummary(child.masterOrderId);
}
