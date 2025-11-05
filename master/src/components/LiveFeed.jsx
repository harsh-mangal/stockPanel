import React from "react";

export default function LiveFeed({ feed }) {
  if (!feed?.length) return null;
  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded p-3">
      <div className="font-semibold mb-2">Live Order Feed</div>
      <div className="text-xs max-h-64 overflow-auto">
        {feed.map((e, i) => (
          <div key={i} className="mb-1">
            <b>{e.type}</b> {new Date(e.ts).toLocaleTimeString()} —{" "}
            {JSON.stringify(e.payload)}
          </div>
        ))}
      </div>
    </div>
  );
}
