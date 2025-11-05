import React, { useEffect, useState } from "react";
import { OrdersAPI } from "../api";

export default function MastersListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const list = await OrdersAPI.listMasters();
        if (on) setRows(list);
      } finally {
        if (on) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Recent Masters</h2>
      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/10">
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Symbol</th>
              <th className="text-left p-2">Side</th>
              <th className="text-left p-2">OrderType</th>
              <th className="text-left p-2">Requested</th>
              <th className="text-left p-2">Dispatched</th>
              <th className="text-left p-2">Filled</th>
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
                    {new Date(
                      r.createdAt || r.auditTrail?.[0]?.at
                    ).toLocaleTimeString()}
                  </td>
                  <td className="p-2">{r.symbol}</td>
                  <td className="p-2">{r.side}</td>
                  <td className="p-2">{r.orderType}</td>
                  <td className="p-2">{r.summary?.requestedQty}</td>
                  <td className="p-2">{r.summary?.dispatchedQty}</td>
                  <td className="p-2">{r.summary?.filledQty}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
