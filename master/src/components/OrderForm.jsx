import React from "react";

export default function OrderForm({
  value,
  onChange,
  onPreview,
  onPlace,
  canPlace,
  placing,
}) {
  const v = value;
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-slate-400">Symbol</label>
        <select
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.symbol}
          onChange={set("symbol")}
        >
          <option>INFY</option>
          <option>RELIANCE</option>
          <option>HDFCBANK</option>
          <option>SBIN</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400">Side</label>
        <select
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.side}
          onChange={set("side")}
        >
          <option>BUY</option>
          <option>SELL</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400">Order Type</label>
        <select
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.orderType}
          onChange={set("orderType")}
        >
          <option>LIMIT</option>
          <option>MARKET</option>
          <option>SL</option>
          <option>SL-M</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400">Price</label>
        <input
          type="number"
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.price}
          onChange={set("price")}
          placeholder="e.g. 1510.5"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400">Product</label>
        <select
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.productType}
          onChange={set("productType")}
        >
          <option>MIS</option>
          <option>NRML</option>
          <option>CNC</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400">Qty / account</label>
        <input
          type="number"
          className="w-full mt-1 bg-white/5 border border-white/10 rounded p-2"
          value={v.sameQty}
          onChange={set("sameQty")}
        />
      </div>

      <div className="sm:col-span-2 flex gap-2">
        <button
          onClick={onPreview}
          className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10"
        >
          Preview Margins
        </button>
        <button
          onClick={onPlace}
          disabled={!canPlace || placing}
          className={`px-3 py-2 rounded ${
            placing ? "bg-slate-600" : "bg-sky-600 hover:bg-sky-500"
          } text-white`}
        >
          {placing ? "Placing…" : "Place Order"}
        </button>
      </div>
    </div>
  );
}
