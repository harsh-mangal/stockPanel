// src/pages/AccountsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { AccountsAPI } from "../api";
import { OrdersAPI } from "../api";
import AccountForm from "./AccountForm";

export default function AccountsPage() {
  const [rows, setRows] = useState([]);
  const [online, setOnline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [editRow, setEditRow] = useState(null);

  // Bulk create needs userId (your backend validates this)
  const [bulkUserId, setBulkUserId] = useState("");
  const [bulkJson, setBulkJson] = useState(`[
  {"displayName":"ACC Alpha","broker":"PAPER","capital":200000,"tags":["VIP","EQ"]},
  {"displayName":"ACC Bravo","broker":"PAPER","capital":120000,"tags":["EQ"]}
]`);

  // Presence debug drawer
  const [presenceRaw, setPresenceRaw] = useState(null);
  const [presenceOpen, setPresenceOpen] = useState(false);

  // Trades modal state
  const [tradesOpen, setTradesOpen] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesErr, setTradesErr] = useState(null);
  const [tradesRows, setTradesRows] = useState([]);
  const [tradesFor, setTradesFor] = useState(null); // { _id, displayName }

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [all, onl] = await Promise.all([
        AccountsAPI.listAll(),
        AccountsAPI.listOnline(), // expects /accounts/online
      ]);
      setRows(all || []);
      setOnline(onl || []);
    } catch (e) {
      setErr(e?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  const onlineSet = useMemo(
    () => new Set((online || []).map((a) => String(a._id))),
    [online]
  );

  const createOne = async (body) => {
    try {
      await AccountsAPI.create(body);
      setEditRow(null);
      refresh();
    } catch (e) {
      alert(e.message || "Failed to create");
    }
  };

  const updateOne = async (id, body) => {
    try {
      await AccountsAPI.update(id, body);
      setEditRow(null);
      refresh();
    } catch (e) {
      alert(e.message || "Failed to update");
    }
  };

  const bulkCreate = async () => {
    try {
      const parsed = JSON.parse(bulkJson);
      if (!bulkUserId.trim()) {
        alert("Bulk create requires a userId (Mongo _id) — backend enforces this.");
        return;
      }
      await AccountsAPI.bulkCreate({
        userId: bulkUserId.trim(),
        accounts: parsed,
      });
      setBulkJson("[]");
      refresh();
    } catch (e) {
      alert("Bulk create failed: " + (e.message || "Invalid JSON / API error"));
    }
  };

  const fmtINR = (n) =>
    typeof n === "number"
      ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
      : n ?? "-";

  const loadPresenceDebug = async () => {
    try {
      const base =
        (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
        process.env.REACT_APP_API_URL ||
        window.BASE_URL ||
        "";
      const url = base
        ? `${base}/accounts/presence/debug`
        : `/accounts/presence/debug`;
      const res = await fetch(url);
      const json = await res.json();
      setPresenceRaw(json);
      setPresenceOpen(true);
    } catch (e) {
      setPresenceRaw({ error: e?.message || "Failed to fetch presence debug" });
      setPresenceOpen(true);
    }
  };

  // === NEW: Load trades for account (scans recent masters) ===
  const showTradesForAccount = async (account) => {
    if (!account?._id) return;
    setTradesFor({ _id: account._id, displayName: account.displayName || account._id });
    setTradesRows([]);
    setTradesErr(null);
    setTradesOpen(true);
    setTradesLoading(true);

    try {
      const masters = await OrdersAPI.listMasters(); // recent masters
      const MASTERS_TO_SCAN = 20; // tweak as needed
      const subset = (masters || []).slice(0, MASTERS_TO_SCAN);

      // fetch detail for each master, then filter children for this account
      const details = await Promise.all(
        subset.map((m) =>
          OrdersAPI.getMaster(m._id).catch(() => null)
        )
      );

      const rows = [];
      for (const det of details) {
        if (!det?.children?.length) continue;
        const hits = det.children.filter(
          (c) => String(c.accountId) === String(account._id)
        );
        for (const c of hits) {
          rows.push({
            at: c.timestamps?.createdAt || det.createdAt,
            masterId: String(det._id),
            childId: String(c._id),
            symbol: c.symbol,
            side: c.side,
            qty: c.qty,
            orderType: c.orderType,
            price: c.price,
            status: c.status,
            avgPrice: c.avgPrice,
            filledQty: c.filledQty,
          });
        }
      }

      // newest first
      rows.sort((a, b) => new Date(b.at) - new Date(a.at));
      setTradesRows(rows);
    } catch (e) {
      setTradesErr(e?.message || "Failed to load trades");
    } finally {
      setTradesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Accounts</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Online:{" "}
            <span className="text-green-400 font-semibold">
              {online.length}
            </span>{" "}
            / {rows.length}
          </span>
          <button
            onClick={refresh}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={loadPresenceDebug}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm"
            title="Show raw presence roster from /accounts/presence/debug"
          >
            Presence Debug
          </button>
        </div>
      </div>

      {err && (
        <div className="text-sm text-red-300 bg-red-900/20 border border-red-700/40 rounded p-2">
          {err}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded p-4">
          <h3 className="font-semibold mb-3">Create Account</h3>
          <AccountForm onSubmit={createOne} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded p-4">
          <h3 className="font-semibold mb-3">Bulk Create (JSON)</h3>

          <label className="block text-xs text-slate-400">
            User ID (required)
          </label>
          <input
            className="w-full bg-black/20 border border-white/10 rounded p-2 mb-3"
            value={bulkUserId}
            onChange={(e) => setBulkUserId(e.target.value)}
            placeholder="Mongo _id of the owning user"
          />

          <textarea
            className="w-full bg-black/20 border border-white/10 rounded p-2 h-40"
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={bulkCreate}
              className="px-3 py-2 rounded bg-sky-600"
            >
              Create in Bulk
            </button>
            <button onClick={refresh} className="px-3 py-2 rounded bg-white/10">
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">All Accounts</h3>
          <div className="text-xs text-slate-400">
            Green = Online (presence)
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white/10">
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Display</th>
                <th className="p-2 text-left">Broker</th>
                <th className="p-2 text-left">Capital</th>
                <th className="p-2 text-left">Tags</th>
                <th className="p-2 text-left">Enabled</th>
                <th className="p-2 text-left">Actions</th>
                {/* NEW */}
                <th className="p-2 text-left">Trades</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-2" colSpan={8}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-2 text-slate-400" colSpan={8}>
                    No accounts yet. Create one or bulk import.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r._id} className="border-b border-white/10">
                    <td className="p-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          onlineSet.has(String(r._id))
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="p-2">{r.displayName || r._id}</td>
                    <td className="p-2">{(r.broker || "").toUpperCase()}</td>
                    <td className="p-2">₹{fmtINR(r.capital)}</td>
                    <td className="p-2">{(r.tags || []).join(", ")}</td>
                    <td className="p-2">{r.enabled ? "Yes" : "No"}</td>
                    <td className="p-2">
                      <button
                        className="px-2 py-1 text-xs rounded bg-white/10"
                        onClick={() => setEditRow(r)}
                      >
                        Edit
                      </button>
                    </td>
                    {/* NEW Trades button */}
                    <td className="p-2">
                      <button
                        className="px-2 py-1 text-xs rounded bg-sky-600 hover:bg-sky-500"
                        onClick={() => showTradesForAccount(r)}
                        title="Show all trades for this account (recent masters)"
                      >
                        View Trades
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Edit Account</h3>
              <button
                onClick={() => setEditRow(null)}
                className="px-2 py-1 rounded bg-white/10"
              >
                Close
              </button>
            </div>
            <AccountForm
              initial={editRow}
              onSubmit={(body) => updateOne(editRow._id, body)}
            />
          </div>
        </div>
      )}

      {/* Presence Debug Drawer */}
      {presenceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-lg w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Presence Debug</h3>
              <button
                onClick={() => setPresenceOpen(false)}
                className="px-2 py-1 rounded bg-white/10"
              >
                Close
              </button>
            </div>
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(presenceRaw, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* NEW: Trades Modal */}
      {tradesOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-lg w-full max-w-5xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Trades — {tradesFor?.displayName} <span className="text-xs text-slate-400">({tradesFor?._id})</span>
              </h3>
              <button
                onClick={() => setTradesOpen(false)}
                className="px-2 py-1 rounded bg-white/10"
              >
                Close
              </button>
            </div>

            {tradesLoading && (
              <div className="text-sm text-slate-300">Loading trades…</div>
            )}
            {tradesErr && (
              <div className="text-sm text-red-300 bg-red-900/20 border border-red-700/40 rounded p-2">
                {tradesErr}
              </div>
            )}

            {!tradesLoading && !tradesErr && (
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-white/10 sticky top-0">
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Master</th>
                      <th className="p-2 text-left">Child</th>
                      <th className="p-2 text-left">Symbol</th>
                      <th className="p-2 text-left">Side</th>
                      <th className="p-2 text-left">OrderType</th>
                      <th className="p-2 text-left">Qty</th>
                      <th className="p-2 text-left">Price</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Filled</th>
                      <th className="p-2 text-left">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradesRows.length === 0 ? (
                      <tr>
                        <td className="p-2 text-slate-400" colSpan={11}>
                          No trades found in recent masters.
                        </td>
                      </tr>
                    ) : (
                      tradesRows.map((t) => (
                        <tr key={t.childId} className="border-b border-white/10">
                          <td className="p-2">
                            {t.at ? new Date(t.at).toLocaleString() : "-"}
                          </td>
                          <td className="p-2 font-mono text-xs">{t.masterId}</td>
                          <td className="p-2 font-mono text-xs">{t.childId}</td>
                          <td className="p-2">{t.symbol}</td>
                          <td className="p-2">{t.side}</td>
                          <td className="p-2">{t.orderType}</td>
                          <td className="p-2">{t.qty}</td>
                          <td className="p-2">{t.price ?? "-"}</td>
                          <td className="p-2">{t.status ?? "-"}</td>
                          <td className="p-2">{t.filledQty ?? "-"}</td>
                          <td className="p-2">{t.avgPrice ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
