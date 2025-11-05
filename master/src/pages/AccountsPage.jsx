import React, { useEffect, useMemo, useState } from "react";
import { AccountsAPI } from "../api";
import AccountForm from "./AccountForm";

export default function AccountsPage() {
  const [rows, setRows] = useState([]);
  const [online, setOnline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [bulkJson, setBulkJson] = useState(`[
  {"displayName":"ACC Alpha","broker":"PAPER","capital":200000,"tags":["VIP","EQ"]},
  {"displayName":"ACC Bravo","broker":"PAPER","capital":120000,"tags":["EQ"]}
]`);

  const refresh = async () => {
    setLoading(true);
    try {
      const [all, onl] = await Promise.all([
        AccountsAPI.listAll(),
        AccountsAPI.listOnline(),
      ]);
      setRows(all);
      setOnline(onl);
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
    () => new Set(online.map((a) => String(a._id))),
    [online]
  );

  const createOne = async (body) => {
    await AccountsAPI.create(body);
    setEditRow(null);
    refresh();
  };

  const updateOne = async (id, body) => {
    await AccountsAPI.update(id, body);
    setEditRow(null);
    refresh();
  };

  const bulkCreate = async () => {
    try {
      const parsed = JSON.parse(bulkJson);
      await AccountsAPI.bulkCreate({ accounts: parsed });
      refresh();
    } catch (e) {
      alert("Invalid JSON: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Accounts</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded p-4">
          <h3 className="font-semibold mb-3">Create Account</h3>
          <AccountForm onSubmit={createOne} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded p-4">
          <h3 className="font-semibold mb-3">Bulk Create (JSON)</h3>
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
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-2" colSpan={7}>
                    Loading…
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
                      ></span>
                    </td>
                    <td className="p-2">{r.displayName || r._id}</td>
                    <td className="p-2">{r.broker}</td>
                    <td className="p-2">₹{r.capital}</td>
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
    </div>
  );
}
