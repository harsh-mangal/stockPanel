// src/components/Dashboard.jsx
import React from "react";

export default function Dashboard({ session, connected, masters, children, events, onLogout }) {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Linked Dashboard</h2>
          <div className="text-sm text-slate-300">
            Account: <span className="font-mono">{session.accountId}</span>
            {session.userId ? (
              <span className="ml-2">| User: <span className="font-mono">{session.userId}</span></span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 text-sm ${connected ? "text-green-400" : "text-red-400"}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}></span>
            {connected ? "Connected" : "Disconnected"}
          </span>
          <button
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Master summaries */}
      <section className="bg-white/5 border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Master Events</h3>
        </div>
        <div className="overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Payload</th>
              </tr>
            </thead>
            <tbody>
              {masters.map((m, i) => (
                <tr key={i} className="border-b border-white/10">
                  <td className="p-2">{new Date().toLocaleTimeString()}</td>
                  <td className="p-2">{m?.type || m?.event || "master"}</td>
                  <td className="p-2">
                    <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(m, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {!masters.length && (
                <tr><td className="p-2 text-slate-400" colSpan={3}>No master events yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Child orders for this account */}
      <section className="bg-white/5 border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">My Child Orders</h3>
        </div>
        <div className="overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Event</th>
                <th className="p-2 text-left">Child</th>
                <th className="p-2 text-left">Symbol</th>
                <th className="p-2 text-left">Side</th>
                <th className="p-2 text-left">Qty</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c, i) => (
                <tr key={i} className="border-b border-white/10">
                  <td className="p-2">{new Date().toLocaleTimeString()}</td>
                  <td className="p-2">{c.type || c.event || "-"}</td>
                  <td className="p-2">{String(c.childId || c._id || "-")}</td>
                  <td className="p-2">{c.symbol || "-"}</td>
                  <td className="p-2">{c.side || "-"}</td>
                  <td className="p-2">{c.qty ?? c.quantity ?? "-"}</td>
                  <td className="p-2">{c.status || "-"}</td>
                </tr>
              ))}
              {!children.length && (
                <tr><td className="p-2 text-slate-400" colSpan={7}>No child orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Raw event log */}
      <section className="bg-white/5 border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Event Log</h3>
          <span className="text-xs text-slate-400">{events.length} events</span>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {events.map((e, i) => (
            <div key={i} className="p-2 bg-black/30 rounded border border-white/10">
              <div className="text-xs text-slate-400">
                {new Date(e.at).toLocaleTimeString()} — <span className="font-mono">{e.type}</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(e.payload, null, 2)}</pre>
            </div>
          ))}
          {!events.length && <div className="text-sm text-slate-400">No events yet.</div>}
        </div>
      </section>
    </div>
  );
}
