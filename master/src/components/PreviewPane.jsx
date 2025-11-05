import React from "react";

export default function PreviewPane({ data }) {
  if (!data) return null;
  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded p-3">
      <div className="font-semibold mb-2">Preview</div>
      <div className="text-xs overflow-auto max-h-64">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
