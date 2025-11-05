import React, { useState } from "react";

export default function AccountForm({ onSubmit, initial }) {
  const [displayName, setDisplayName] = useState(initial?.displayName || "");
  const [broker, setBroker] = useState(initial?.broker || "PAPER");
  const [capital, setCapital] = useState(initial?.capital ?? 100000);
  const [tags, setTags] = useState((initial?.tags || []).join(","));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      displayName,
      broker,
      capital: Number(capital),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      enabled,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400">Display Name</label>
        <input
          className="w-full bg-white/5 border border-white/10 rounded p-2"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400">Broker</label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded p-2"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
          >
            <option>PAPER</option>
            <option>ZERODHA</option>
            <option>ANGEL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400">Capital (₹)</label>
          <input
            type="number"
            className="w-full bg-white/5 border border-white/10 rounded p-2"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="block text-xs text-slate-400">Enabled</label>
          <input
            type="checkbox"
            className="ml-2 scale-125"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-400">
          Tags (comma separated)
        </label>
        <input
          className="w-full bg-white/5 border border-white/10 rounded p-2"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="VIP, EQ"
        />
      </div>
      <button type="submit" className="px-3 py-2 rounded bg-sky-600">
        {initial ? "Update" : "Create"} Account
      </button>
    </form>
  );
}
