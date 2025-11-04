import { nanoid } from "nanoid";
import MasterOrder from "../models/MasterOrder.js";
import ChildOrder from "../models/ChildOrder.js";
import LinkedAccount from "../models/LinkedAccount.js";
import { allocateQuantities } from "../utils/allocation.js";
import { once } from "../utils/idempotency.js";
import { getBrokerAdapter } from "../broker/brokerRegistry.js";
import { simulator } from "../sim/simulator.js";
import { getIO } from "../realtime/io.js"; // 👈 realtime
import {
  computeRequiredMargin,
  priceBandCheck,
  basicRiskCheck,
} from "../utils/risk.js";
import { presence } from "../realtime/presence.js";

export const createAndDispatchMaster = async (req, res, next) => {
  try {
    const {
      symbol,
      side,
      orderType = "MARKET",
      price, // <- your selected price (optional for MARKET/SL-M)
      triggerPrice,
      productType = "MIS",
      validity = "DAY",

      allocationMode,
      allocationConfig = {},
      masterQty = 0,

      // targeting
      targets = { userId: null, accountIds: [], tags: [], brokers: [] },

      // NEW knobs
      allowPartial = true, // if false: fail the whole order when any account lacks margin
      lot = 1, // lot size if you use it in margin calc
      maxAwayPct = 5, // price-band sanity guard vs best bid/ask
    } = req.body;

    // --- Quotes & base validations
    const q = simulator.quote(symbol);
    if (!q) return res.status(400).json({ error: "UNKNOWN_SYMBOL" });

    // Enforce price presence for LIMIT/SL; SL/SL-M needs trigger
    if (
      (orderType === "LIMIT" || orderType === "SL") &&
      (price == null || price <= 0)
    ) {
      return res.status(400).json({
        error: "INVALID_PRICE",
        note: "LIMIT/SL require positive price",
      });
    }
    if (
      (orderType === "SL" || orderType === "SL-M") &&
      (triggerPrice == null || triggerPrice <= 0)
    ) {
      return res.status(400).json({
        error: "INVALID_TRIGGER",
        note: "SL/SL-M require positive triggerPrice",
      });
    }

    // Effective price:
    // - LIMIT/SL: use provided price
    // - MARKET/SL-M: if you provided a price, we respect it; else use best side from quote
    const sideBest = side === "BUY" ? q.ask : q.bid;
    const effectivePrice =
      orderType === "MARKET" || orderType === "SL-M"
        ? price && price > 0
          ? price
          : sideBest
        : price;

    // Risk & price band checks
    const requirePrice = !(orderType === "MARKET" || orderType === "SL-M");
    const risk = basicRiskCheck({
      price: effectivePrice,
      qty: Math.max(masterQty, allocationConfig.sameQty || 0, 1),
      requirePrice,
    });
    if (!risk.ok)
      return res.status(400).json({ error: "RISK_BLOCK", reason: risk.reason });

    const band = priceBandCheck({
      side,
      orderType,
      price: effectivePrice,
      quote: q,
      maxAwayPct,
    });
    if (!band.ok) {
      return res
        .status(400)
        .json({ error: "PRICE_BAND", awayPct: band.awayPct, maxAwayPct });
    }

    // --- Select target accounts
    const aq = { enabled: true };
    if (targets.userId) aq.userId = targets.userId;
    if (Array.isArray(targets.accountIds) && targets.accountIds.length)
      aq._id = { $in: targets.accountIds };
    if (Array.isArray(targets.tags) && targets.tags.length)
      aq.tags = { $in: targets.tags };
    if (Array.isArray(targets.brokers) && targets.brokers.length)
      aq.broker = { $in: targets.brokers.map((b) => b.toUpperCase()) };

    let accounts = await LinkedAccount.find(aq).lean();
    if (!accounts.length)
      return res.status(400).json({ error: "NO_MATCHING_ACCOUNTS" });
    const onlineSet = presence.onlineSet();
    accounts = accounts.filter((a) => onlineSet.has(String(a._id)));
    if (!accounts.length) {
      return res
        .status(400)
        .json({
          error: "NO_ONLINE_ACCOUNTS",
          note: "All matching accounts are offline",
        });
    }
    // --- Allocation (requested per-account qty)
    const capitals = Object.fromEntries(
      accounts.map((a) => [String(a._id), a.capital || 0])
    );
    const dist = allocateQuantities({
      mode: allocationMode,
      config: allocationConfig,
      accounts,
      masterQty,
      capitalsById: capitals,
    });

    const requestedQty = Array.from(dist.values()).reduce(
      (s, n) => s + Number(n || 0),
      0
    );
    if (!requestedQty) {
      return res.status(400).json({
        error: "ZERO_ALLOCATION",
        note: "Allocated quantity is zero for all targets",
      });
    }

    // --- Create master (early)
    const master = await MasterOrder.create({
      createdBy: targets.userId ?? null,
      symbol,
      side,
      orderType,
      price: effectivePrice,
      triggerPrice,
      productType,
      validity,
      allocationMode,
      allocationConfig,
      status: "DISPATCHING",
      summary: { requestedQty, dispatchedQty: 0, filledQty: 0, avgPrice: 0 },
      auditTrail: [
        {
          at: new Date(),
          by: "system",
          action: "CREATE",
          note: "Master order created",
        },
      ],
    });

    // Realtime: notify creation
    const io = getIO();
    if (targets.userId)
      io.to(`user:${targets.userId}`).emit("order.master.created", {
        masterOrderId: String(master._id),
        symbol,
        side,
        orderType,
        allocationMode,
        requestedQty,
      });
    io.to(`order:${master._id}`).emit("order.master.created", {
      masterOrderId: String(master._id),
      symbol,
      side,
      orderType,
      allocationMode,
      requestedQty,
    });

    // --- Margin checks per-account; build children only when margin OK
    const children = [];
    const dispatchPlan = [];
    const failures = []; // accounts skipped due to margin or qty=0
    let dispatchedQty = 0;

    for (const a of accounts) {
      const qty = Number(dist.get(String(a._id)) || 0);
      if (qty <= 0) continue;

      const requiredMargin = computeRequiredMargin({
        productType,
        price: effectivePrice,
        qty,
        lot,
      });
      const capital = a.capital || 0;
      const marginOk = capital >= requiredMargin;

      if (!marginOk) {
        failures.push({
          accountId: String(a._id),
          displayName: a.displayName,
          reason: "MARGIN_INSUFFICIENT",
          requiredMargin,
          capital,
        });
        if (!allowPartial) {
          await MasterOrder.findByIdAndUpdate(master._id, { status: "FAILED" });
          io.to(`order:${master._id}`).emit("order.master.summary", {
            masterOrderId: String(master._id),
            filledQty: 0,
            avgPrice: 0,
            statuses: [],
          });
          return res.status(400).json({
            error: "MARGIN_FAIL",
            note: "One or more accounts lack margin",
            failingAccount: failures[failures.length - 1],
          });
        }
        // skip this account and continue
        continue;
      }

      const child = await ChildOrder.create({
        masterOrderId: master._id,
        accountId: a._id,
        broker: (a.broker || "PAPER").toUpperCase(),
        clientOrderId: `CL-${nanoid(6)}`,
        symbol,
        side,
        qty,
        orderType,
        price: effectivePrice, // <- persist selected/effective price
        triggerPrice,
        status: "QUEUED",
        timestamps: { createdAt: new Date() },
        // (optional) persist margin for audit: requiredMargin
      });

      children.push(child);
      dispatchedQty += qty;
      dispatchPlan.push({
        accountId: String(a._id),
        displayName: a.displayName,
        broker: (a.broker || "PAPER").toUpperCase(),
        qty,
        requiredMargin,
      });
    }

    if (!children.length) {
      await MasterOrder.findByIdAndUpdate(master._id, { status: "FAILED" });
      io.to(`order:${master._id}`).emit("order.master.summary", {
        masterOrderId: String(master._id),
        filledQty: 0,
        avgPrice: 0,
        statuses: [],
      });
      return res.status(400).json({
        error: "NO_DISPATCHABLE_CHILDREN",
        note: failures.length
          ? "All targets failed margin"
          : "All allocations were zero",
      });
    }

    master.summary.dispatchedQty = dispatchedQty;
    await master.save();

    // Realtime: initial summary with plan
    io.to(`order:${master._id}`).emit("order.master.summary", {
      masterOrderId: String(master._id),
      requestedQty,
      dispatchedQty,
      children: dispatchPlan,
    });

    // --- Async dispatch (per-account adapter) with idempotency
    for (const child of children) {
      const key = `dispatch:${master._id}:${child.accountId}`;
      if (!once(key)) continue;

      const brokerName = (child.broker || "PAPER").toUpperCase();
      const adapter = getBrokerAdapter(brokerName);

      adapter
        .placeOrder({
          childId: child._id,
          symbol,
          side,
          qty: child.qty,
          orderType,
          price: effectivePrice, // pass selected/effective price
          triggerPrice,
        })
        .catch((err) => {
          console.error("placeOrder error", {
            childId: String(child._id),
            err: err?.message,
          });
        });
    }

    // --- Response
    res.status(201).json({
      masterOrderId: master._id,
      symbol,
      side,
      orderType,
      effectivePrice, // <- echoed for UI
      requestedQty,
      dispatchedChildren: children.length,
      dispatchedQty,
      dispatchPlan, // [{accountId, displayName, broker, qty, requiredMargin}]
      failures, // [{accountId, displayName, reason, requiredMargin, capital}]
    });
  } catch (e) {
    next(e);
  }
};

export const getMaster = async (req, res, next) => {
  try {
    const m = await MasterOrder.findById(req.params.id).lean();
    if (!m) return res.status(404).json({ error: "NOT_FOUND" });
    const children = await ChildOrder.find({ masterOrderId: m._id }).lean();
    const totalFilled = children.reduce((s, c) => s + (c.filledQty || 0), 0);
    const avg =
      children.reduce((s, c) => s + c.avgPrice * (c.filledQty || 0), 0) /
      (totalFilled || 1);
    m.summary.filledQty = totalFilled;
    m.summary.avgPrice = +avg.toFixed(2);
    res.json({ ...m, children });
  } catch (e) {
    next(e);
  }
};

export const listMasters = async (_req, res, next) => {
  try {
    const list = await MasterOrder.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(list);
  } catch (e) {
    next(e);
  }
};
