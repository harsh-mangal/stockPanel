// src/pages/MasterOrdersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { OrdersAPI, AccountsAPI } from "../api";
import OrderForm from "../components/OrderForm";
import AccountPicker from "../components/AccountsPicker";
import { useOrdersRealtime } from "../hooks/useOrdersRealtime";

const DEFAULT_FORM = {
  symbol: "INFY",
  side: "BUY",
  orderType: "MARKET",
  price: "",
  triggerPrice: "",
  productType: "MIS",
  sameQty: 1,
  allocationMode: "SAME_QTY", // SAME_QTY | MASTER_FIXED | CAPITAL_WEIGHTED
  allocationConfig: { sameQty: 1 },
  masterQty: 0,
  targets: { userId: null, accountIds: [], tags: [], brokers: [] },
  allowPartial: true,
  lot: 1,
  maxAwayPct: 5,
};

export default function MasterOrdersPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [placing, setPlacing] = useState(false);
  const [canPlace, setCanPlace] = useState(true);
  const [preview, setPreview] = useState(null);
  const [masters, setMasters] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [online, setOnline] = useState([]);
  const [activeMasterId, setActiveMasterId] = useState(null);
  const [targetingMode, setTargetingMode] = useState("ALL_ENABLED"); // ALL_ENABLED | ALL_ONLINE | CUSTOM

  useOrdersRealtime({
    masterRoomId: activeMasterId,
    onCreated: (p) => console.log("RT created", p),
    onSummary: (p) => {
      if (p.masterOrderId === activeMasterId) {
        setPreview((prev) => ({ ...(prev || {}), liveSummary: p }));
      }
    },
  });

  const refreshMasters = async () => setMasters(await OrdersAPI.listMasters());
  const refreshAccounts = async () => {
    const [all, onl] = await Promise.all([
      AccountsAPI.listAll(),
      AccountsAPI.listOnline(),
    ]);
    setAccounts(all);
    setOnline(onl);
  };

  useEffect(() => {
    refreshMasters();
    refreshAccounts();
    const t = setInterval(() => {
      refreshMasters();
      refreshAccounts();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const onlineSet = useMemo(
    () => new Set(online.map((a) => String(a._id))),
    [online]
  );

  const candidates = useMemo(() => {
    let list = accounts.filter((a) => a.enabled);
    if (form.targets.tags?.length) {
      list = list.filter((a) =>
        (a.tags || []).some((t) => form.targets.tags.includes(t))
      );
    }
    if (form.targets.brokers?.length) {
      list = list.filter((a) =>
        form.targets.brokers.includes((a.broker || "PAPER").toUpperCase())
      );
    }
    if (targetingMode === "ALL_ONLINE") {
      list = list.filter((a) => onlineSet.has(String(a._id)));
    }
    if (targetingMode === "CUSTOM") {
      const set = new Set((form.targets.accountIds || []).map(String));
      list = list.filter((a) => set.has(String(a._id)));
    }
    return list;
  }, [
    accounts,
    form.targets.tags,
    form.targets.brokers,
    form.targets.accountIds,
    targetingMode,
    onlineSet,
  ]);

  const onPreview = () => {
    const dist = (() => {
      if (form.allocationMode === "SAME_QTY") {
        const q = Number(form.allocationConfig.sameQty || 0);
        return Object.fromEntries(candidates.map((a) => [a._id, q]));
      }
      if (form.allocationMode === "MASTER_FIXED") {
        const total = Number(form.masterQty || 0);
        const each = Math.floor(total / Math.max(candidates.length, 1));
        return Object.fromEntries(candidates.map((a) => [a._id, each]));
      }
      if (form.allocationMode === "CAPITAL_WEIGHTED") {
        const sum = candidates.reduce((s, a) => s + (a.capital || 0), 0) || 1;
        const total = Number(form.masterQty || 0);
        return Object.fromEntries(
          candidates.map((a) => [
            a._id,
            Math.floor(((a.capital || 0) / sum) * total),
          ])
        );
      }
      return Object.fromEntries(candidates.map((a) => [a._id, 0]));
    })();

    const rows = candidates.map((a) => {
      const qty = Number(dist[a._id] || 0);
      const price =
        form.orderType === "MARKET" || form.orderType === "SL-M"
          ? Number(form.price || 0) || 100
          : Number(form.price || 0);
      const reqMargin = Math.max(0, price) * qty * Number(form.lot || 1) * 0.2;
      return {
        accountId: String(a._id),
        displayName: a.displayName || a._id,
        broker: (a.broker || "PAPER").toUpperCase(),
        qty,
        requiredMargin: Math.round(reqMargin),
        capital: a.capital || 0,
        online: onlineSet.has(String(a._id)),
      };
    });

    setPreview({
      allocationMode: form.allocationMode,
      rows,
      totalQty: rows.reduce((s, r) => s + (r.qty || 0), 0),
    });
  };

  const onPlace = async () => {
    setPlacing(true);
    try {
      const payload = {
        symbol: form.symbol,
        side: form.side,
        orderType: form.orderType,
        price: form.price ? Number(form.price) : undefined,
        triggerPrice: form.triggerPrice ? Number(form.triggerPrice) : undefined,
        productType: form.productType,
        validity: "DAY",
        allocationMode: form.allocationMode,
        allocationConfig: form.allocationConfig,
        masterQty: Number(form.masterQty || 0),
        targets: {
          userId: form.targets.userId ?? null,
          accountIds: targetingMode === "CUSTOM" ? form.targets.accountIds : [],
          tags: form.targets.tags || [],
          brokers: form.targets.brokers || [],
        },
        allowPartial: form.allowPartial,
        lot: Number(form.lot || 1),
        maxAwayPct: Number(form.maxAwayPct || 5),
      };

      const res = await OrdersAPI.createMaster(payload);
      setActiveMasterId(String(res.masterOrderId));
      setPreview((p) => ({
        ...(p || {}),
        serverPlan: {
          requestedQty: res.requestedQty,
          dispatchedQty: res.dispatchedQty,
          dispatchedChildren: res.dispatchedChildren,
          dispatchPlan: res.dispatchPlan,
          failures: res.failures,
          effectivePrice: res.effectivePrice,
        },
      }));
      await refreshMasters();
    } catch (e) {
      alert(e.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  useEffect(() => {
    const needsPrice = form.orderType === "LIMIT" || form.orderType === "SL";
    const needsTrig = form.orderType === "SL" || form.orderType === "SL-M";
    const baseOk =
      form.symbol &&
      form.side &&
      form.orderType &&
      (!needsPrice || Number(form.price) > 0) &&
      (!needsTrig || Number(form.triggerPrice) > 0);
    const anyCandidate = candidates.length > 0;
    setCanPlace(!!(baseOk && anyCandidate));
  }, [form, candidates]);

  const toggleTargetTag = (tag) => {
    setForm((f) => {
      const set = new Set(f.targets.tags || []);
      set.has(tag) ? set.delete(tag) : set.add(tag);
      return { ...f, targets: { ...f.targets, tags: [...set] } };
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Master Orders</h2>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: form + allocation */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded p-4">
          <h3 className="font-semibold mb-3">Create Master Order</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <OrderForm
              value={form}
              onChange={(v) => {
                const next =
                  v.allocationMode === "SAME_QTY"
                    ? {
                        ...v,
                        allocationConfig: { sameQty: Number(v.sameQty || 0) },
                      }
                    : v;
                setForm(next);
              }}
              onPreview={onPreview}
              onPlace={onPlace}
              canPlace={canPlace}
              placing={placing}
            />

            {/* Allocation & knobs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400">
                  Allocation Mode
                </label>
                <select
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
                  value={form.allocationMode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allocationMode: e.target.value }))
                  }
                >
                  <option value="SAME_QTY">Same Qty / Account</option>
                  <option value="MASTER_FIXED">Master Fixed Qty (split)</option>
                  <option value="CAPITAL_WEIGHTED">Capital Weighted</option>
                </select>
              </div>

              {form.allocationMode === "MASTER_FIXED" && (
                <div>
                  <label className="block text-xs text-slate-400">
                    Master Qty
                  </label>
                  <input
                    type="number"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
                    value={form.masterQty}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        masterQty: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="allowPartial"
                  type="checkbox"
                  checked={!!form.allowPartial}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allowPartial: e.target.checked }))
                  }
                />
                <label htmlFor="allowPartial" className="text-sm">
                  Allow partial (skip low-margin accounts)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400">Lot</label>
                  <input
                    type="number"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
                    value={form.lot}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lot: Number(e.target.value || 1),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400">
                    Max Away %
                  </label>
                  <input
                    type="number"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
                    value={form.maxAwayPct}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxAwayPct: Number(e.target.value || 5),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Optional quick tags */}
              <div>
                <label className="block text-xs text-slate-400">
                  Target by Tag
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["VIP", "EQ", "FNO"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTargetTag(t)}
                      className={`px-2 py-1 rounded text-xs border ${
                        form.targets.tags?.includes(t)
                          ? "bg-sky-600 border-sky-500"
                          : "bg-white/10 border-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Targets + Preview */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <h3 className="font-semibold mb-3">Targets</h3>
            <AccountPicker
              accounts={accounts}
              onlineSet={onlineSet}
              mode={targetingMode}
              onModeChange={setTargetingMode}
              selectedIds={(form.targets.accountIds || []).map(String)}
              onChangeSelected={(ids) =>
                setForm((f) => ({
                  ...f,
                  targets: { ...f.targets, accountIds: ids.map(String) },
                }))
              }
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded p-4">
            <h3 className="font-semibold mb-3">Preview / Live</h3>

            {!preview && (
              <div className="text-sm text-slate-400">
                Click “Preview Margins”.
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                {preview.serverPlan && (
                  <div className="text-xs p-2 bg-white/5 rounded border border-white/10">
                    <div>
                      Effective Price: {preview.serverPlan.effectivePrice}
                    </div>
                    <div>Requested Qty: {preview.serverPlan.requestedQty}</div>
                    <div>
                      Dispatched Qty: {preview.serverPlan.dispatchedQty}
                    </div>
                    <div>Children: {preview.serverPlan.dispatchedChildren}</div>
                    {!!preview.serverPlan.failures?.length && (
                      <div className="mt-2 text-red-300">
                        Failures:{" "}
                        {preview.serverPlan.failures
                          .map((f) => f.displayName)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}

                {preview.liveSummary && (
                  <div className="text-xs p-2 bg-white/5 rounded border border-white/10">
                    <div className="font-semibold mb-1">Live Summary (RT)</div>
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(preview.liveSummary, null, 2)}
                    </pre>
                  </div>
                )}

                {preview.rows && (
                  <div className="max-h-72 overflow-auto border border-white/10 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-white/10">
                        <tr>
                          <th className="p-2 text-left">Status</th>
                          <th className="p-2 text-left">Account</th>
                          <th className="p-2 text-left">Broker</th>
                          <th className="p-2 text-left">Qty</th>
                          <th className="p-2 text-left">Req. Margin</th>
                          <th className="p-2 text-left">Capital</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r) => (
                          <tr
                            key={r.accountId}
                            className="border-b border-white/10"
                          >
                            <td className="p-2">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${
                                  r.online ? "bg-green-500" : "bg-red-500"
                                }`}
                              />
                            </td>
                            <td className="p-2">{r.displayName}</td>
                            <td className="p-2">{r.broker}</td>
                            <td className="p-2">{r.qty}</td>
                            <td className="p-2">₹{r.requiredMargin}</td>
                            <td className="p-2">₹{r.capital}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent masters */}
      <div className="bg-white/5 border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Master Orders</h3>
          <button
            onClick={refreshMasters}
            className="px-2 py-1 text-xs rounded bg-white/10"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white/10">
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-left">Side</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Price</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Requested</th>
                <th className="p-2 text-left">Dispatched</th>
                <th className="p-2 text-left">Filled</th>
              </tr>
            </thead>
            <tbody>
              {masters.map((m) => (
                <tr key={m._id} className="border-b border-white/10">
                  <td className="p-2">
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td className="p-2">{m.symbol}</td>
                  <td className="p-2">{m.side}</td>
                  <td className="p-2">{m.orderType}</td>
                  <td className="p-2">{m.price ?? "-"}</td>
                  <td className="p-2">{m.status}</td>
                  <td className="p-2">{m.summary?.requestedQty ?? "-"}</td>
                  <td className="p-2">{m.summary?.dispatchedQty ?? "-"}</td>
                  <td className="p-2">
                    {m.summary?.filledQty ?? 0} @ {m.summary?.avgPrice ?? 0}
                  </td>
                </tr>
              ))}
              {!masters.length && (
                <tr>
                  <td className="p-2" colSpan={9}>
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
