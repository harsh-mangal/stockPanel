// src/components/AccountPicker.jsx
import React, { useMemo, useState } from "react";

export default function AccountPicker({
  accounts = [],
  onlineSet = new Set(),
  mode,
  onModeChange,
  selectedIds = [],
  onChangeSelected,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((a) =>
      (a.displayName || String(a._id)).toLowerCase().includes(needle)
    );
  }, [q, accounts]);

  const toggle = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    onChangeSelected([...s]);
  };

  const allVisibleIds = filtered.map((a) => String(a._id));
  const allSelectedOnScreen = allVisibleIds.every((id) =>
    selectedIds.includes(id)
  );

  return (
    <div className="space-y-3">
      {/* Targeting mode */}
      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="targetMode"
            checked={mode === "ALL_ENABLED"}
            onChange={() => onModeChange("ALL_ENABLED")}
          />
          <span>All enabled accounts</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="targetMode"
            checked={mode === "ALL_ONLINE"}
            onChange={() => onModeChange("ALL_ONLINE")}
          />
          <span>
            All enabled <span className="text-green-400">online</span> accounts
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="targetMode"
            checked={mode === "CUSTOM"}
            onChange={() => onModeChange("CUSTOM")}
          />
          <span>Choose accounts individually</span>
        </label>
      </div>

      {/* Custom list */}
      {mode === "CUSTOM" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search account…"
              className="w-full bg-white/5 border border-white/10 rounded p-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-white/10"
              onClick={() => onChangeSelected([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-white/10"
              onClick={() =>
                onChangeSelected(
                  allSelectedOnScreen
                    ? selectedIds.filter((id) => !allVisibleIds.includes(id))
                    : Array.from(new Set([...selectedIds, ...allVisibleIds]))
                )
              }
            >
              {allSelectedOnScreen ? "Unselect Page" : "Select Page"}
            </button>
          </div>

          <div className="max-h-56 overflow-auto border border-white/10 rounded">
            <table className="w-full text-sm">
              <thead className="bg-white/10">
                <tr>
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Account</th>
                  <th className="p-2 text-left">Broker</th>
                  <th className="p-2 text-left">Tags</th>
                  <th className="p-2 text-right">Capital</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const id = String(a._id);
                  const online = onlineSet.has(id);
                  const checked = selectedIds.includes(id);
                  return (
                    <tr key={id} className="border-b border-white/10">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                        />
                      </td>
                      <td className="p-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            online ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                      </td>
                      <td className="p-2">{a.displayName || id}</td>
                      <td className="p-2">
                        {(a.broker || "PAPER").toUpperCase()}
                      </td>
                      <td className="p-2">{(a.tags || []).join(", ")}</td>
                      <td className="p-2 text-right">₹{a.capital || 0}</td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td className="p-2 text-slate-400" colSpan={6}>
                      No accounts match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
