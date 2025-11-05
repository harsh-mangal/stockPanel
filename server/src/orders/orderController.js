// src/orders/createAndDispatchMasterController.js (or wherever you export from)
import { nanoid } from "nanoid";
import MasterOrder from "../models/MasterOrder.js";
import ChildOrder from "../models/ChildOrder.js";
import LinkedAccount from "../models/LinkedAccount.js";
import { allocateQuantities } from "../utils/allocation.js";
import { once } from "../utils/idempotency.js";
import { getBrokerAdapter } from "../broker/brokerRegistry.js";
import { simulator } from "../sim/simulator.js";
import { getIO } from "../realtime/io.js";
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
      price,
      triggerPrice,
      productType = "MIS",
      validity = "DAY",

      allocationMode,
      allocationConfig = {},
      masterQty = 0,

      // targeting
      targets = { userId: null, accountIds: [], tags: [], brokers: [] },

      // knobs
      allowPartial = true,
      lot = 1,
      maxAwayPct = 5,
    } = req.body;

    // --- Quote & base validations
    const q = simulator.quote(symbol);
    if (!q) return res.status(400).json({ error: "UNKNOWN_SYMBOL" });

    if ((orderType === "LIMIT" || orderType === "SL") && (!price || price <= 0)) {
      return res.status(400).json({ error: "INVALID_PRICE", note: "LIMIT/SL require positive price" });
    }
    if ((orderType === "SL" || orderType === "SL-M") && (!triggerPrice || triggerPrice <= 0)) {
      return res.status(400).json({ error: "INVALID_TRIGGER", note: "SL/SL-M require positive triggerPrice" });
    }

    const sideBest = side === "BUY" ? q.ask : q.bid;
    const effectivePrice =
      orderType === "MARKET" || orderType === "SL-M"
        ? (price && price > 0 ? price : sideBest)
        : price;

    const requirePrice = !(orderType === "MARKET" || orderType === "SL-M");
    const risk = basicRiskCheck({
      price: effectivePrice,
      qty: Math.max(masterQty, allocationConfig.sameQty || 0, 1),
      requirePrice,
    });
    if (!risk.ok) return res.status(400).json({ error: "RISK_BLOCK", reason: risk.reason });

    const band = priceBandCheck({
      side,
      orderType,
      price: effectivePrice,
      quote: q,
      maxAwayPct,
    });
    if (!band.ok) {
      return res.status(400).json({ error: "PRICE_BAND", awayPct: band.awayPct, maxAwayPct });
    }

    // --- Target account selection (then filter to online)
    const aq = { enabled: true };
    if (targets.userId) aq.userId = targets.userId;
    if (Array.isArray(targets.accountIds) && targets.accountIds.length) aq._id = { $in: targets.accountIds };
    if (Array.isArray(targets.tags) && targets.tags.length) aq.tags = { $in: targets.tags };
    if (Array.isArray(targets.brokers) && targets.brokers.length) aq.broker = { $in: targets.brokers.map((b) => b.toUpperCase()) };

    let accounts = await LinkedAccount.find(aq).lean();
    if (!accounts.length) return res.status(400).json({ error: "NO_MATCHING_ACCOUNTS" });

    const onlineSet = presence.onlineSet();
    accounts = accounts.filter((a) => onlineSet.has(String(a._id)));
    if (!accounts.length) {
      return res.status(400).json({ error: "NO_ONLINE_ACCOUNTS", note: "All matching accounts are offline" });
    }

    // --- Allocation
    const capitals = Object.fromEntries(accounts.map((a) => [String(a._id), a.capital || 0]));
    const dist = allocateQuantities({
      mode: allocationMode,
      config: allocationConfig,
      accounts,
      masterQty,
      capitalsById: capitals,
    });

    const requestedQty = Array.from(dist.values()).reduce((s, n) => s + Number(n || 0), 0);
    if (!requestedQty) {
      return res.status(400).json({ error: "ZERO_ALLOCATION", note: "Allocated quantity is zero for all targets" });
    }

    // --- Create master upfront
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
      auditTrail: [{ at: new Date(), by: "system", action: "CREATE", note: "Master order created" }],
    });

    const io = getIO();

    // Global emits (as you already had)
    if (targets.userId) {
      io.to(`user:${targets.userId}`).emit("order.master.created", {
        masterOrderId: String(master._id),
        symbol,
        side,
        orderType,
        allocationMode,
        requestedQty,
      });
    }
    io.to(`order:${master._id}`).emit("order.master.created", {
      masterOrderId: String(master._id),
      symbol,
      side,
      orderType,
      allocationMode,
      requestedQty,
    });

    // --- Build children & dispatch plan with margin checks
    const children = [];
    const dispatchPlan = [];
    const failures = [];
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
        price: effectivePrice,
        triggerPrice,
        status: "QUEUED",
        timestamps: { createdAt: new Date() },
      });

      children.push(child);
      dispatchedQty += qty;
      const plan = {
        accountId: String(a._id),
        displayName: a.displayName,
        broker: (a.broker || "PAPER").toUpperCase(),
        qty,
        requiredMargin,
      };
      dispatchPlan.push(plan);

      // 🔊 NEW: notify this account immediately about its child
      io.to(`account:${plan.accountId}`).emit("order.child.created", {
        childId: String(child._id),
        masterOrderId: String(master._id),
        accountId: plan.accountId,
        broker: child.broker,
        symbol,
        side,
        qty,
        orderType,
        price: effectivePrice,
        triggerPrice,
        status: "QUEUED",
        at: Date.now(),
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
        note: failures.length ? "All targets failed margin" : "All allocations were zero",
      });
    }

    // Update master dispatched qty
    master.summary.dispatchedQty = dispatchedQty;
    await master.save();

    // Global summary (existing)
    io.to(`order:${master._id}`).emit("order.master.summary", {
      masterOrderId: String(master._id),
      requestedQty,
      dispatchedQty,
      children: dispatchPlan,
      at: Date.now(),
    });

    // 🔊 NEW: per-account compact summary
    for (const plan of dispatchPlan) {
      io.to(`account:${plan.accountId}`).emit("order.master.created", {
        masterOrderId: String(master._id),
        symbol,
        side,
        orderType,
        allocationMode,
        requestedQty,
        myPlannedQty: plan.qty,
        requiredMargin: plan.requiredMargin,
        displayName: plan.displayName,
        at: Date.now(),
      });

      io.to(`account:${plan.accountId}`).emit("order.master.summary", {
        masterOrderId: String(master._id),
        symbol,
        side,
        orderType,
        requestedQty,
        dispatchedQty,
        myPlannedQty: plan.qty,
        at: Date.now(),
      });
    }

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
          price: effectivePrice,
          triggerPrice,
        })
        .catch((err) => {
          console.error("placeOrder error", {
            childId: String(child._id),
            err: err?.message,
          });
          // optional: notify account about reject/error
          const accountId = String(child.accountId);
          io.to(`account:${accountId}`).emit("order.child.update", {
            childId: String(child._id),
            status: "REJECTED",
            reason: err?.message || "placeOrder failed",
            at: Date.now(),
          });
        });
    }

    // --- HTTP response
    res.status(201).json({
      masterOrderId: master._id,
      symbol,
      side,
      orderType,
      effectivePrice,
      requestedQty,
      dispatchedChildren: children.length,
      dispatchedQty,
      dispatchPlan,
      failures,
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
      children.reduce((s, c) => s + (c.avgPrice * (c.filledQty || 0)), 0) /
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
    const list = await MasterOrder.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  } catch (e) {
    next(e);
  }
};
