import React, { useEffect, useState } from "react";

// Small helper to read API base (CRA env or fallback)
const API_URL =
  process.env.REACT_APP_API_URL ||
  window.BASE_URL ||
  "http://localhost:4000";

const isHex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s || "").trim());

export default function Login({ onSubmit }) {
  const [accountId, setAccountId] = useState("");
  const [userId, setUserId] = useState("");
  const [authKey, setAuthKey] = useState("");

  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // restore last session if stored
    const saved = localStorage.getItem("linked.session");
    if (saved) {
      try {
        const { accountId, userId, authKey } = JSON.parse(saved);
        setAccountId(accountId || "");
        setUserId(userId || "");
        setAuthKey(authKey || "");
      } catch {}
    }
  }, []);

  const validateOnServer = async (id) => {
    // Prefer a dedicated GET /accounts/:id endpoint
    const res = await fetch(`${API_URL}/accounts/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 404) throw new Error("Account not found");
    if (!res.ok) throw new Error(`Validation failed (${res.status})`);

    const doc = await res.json();
    if (!doc || !doc._id) throw new Error("Invalid account response");
    if (String(doc._id) !== String(id))
      throw new Error("Account ID mismatch from server");
    if (doc.enabled === false) throw new Error("Account is disabled");
    return doc;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const raw = String(accountId || "").trim();
    if (!raw) {
      setError("Please enter your Linked Account ID");
      return;
    }

    // accept hex even if pasted with surrounding text: extract first 24-hex
    const m = raw.match(/[a-f0-9]{24}/i);
    const id = m ? m[0] : raw;

    if (!isHex24(id)) {
      setError("Invalid Account ID format (must be 24-character hex ObjectId)");
      return;
    }

    try {
      setValidating(true);
      const acc = await validateOnServer(id);

      // success → persist + proceed
      const payload = {
        accountId: String(acc._id),
        userId: String(userId || "").trim() || null,
        authKey: String(authKey || "").trim() || null,
      };
      localStorage.setItem("linked.session", JSON.stringify(payload));
      onSubmit(payload);
    } catch (err) {
      setError(err?.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white/5 border border-white/10 rounded-2xl">
      <h2 className="text-xl font-bold mb-4">Linked Account Login</h2>

      {error ? (
        <div className="mb-3 text-sm text-red-300 bg-red-900/20 border border-red-700/40 rounded p-2">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-300">
            Linked Account ID *
          </label>
          <input
            className="w-full mt-1 bg-black/30 border border-white/10 rounded p-2"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="e.g. 65fd2b... (Mongo _id)"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-300">User ID (optional)</label>
          <input
            className="w-full mt-1 bg-black/30 border border-white/10 rounded p-2"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User scope (join user:&lt;id&gt;)"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-300">Auth Key (optional)</label>
          <input
            className="w-full mt-1 bg-black/30 border border-white/10 rounded p-2"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder="If server expects a shared key"
            autoComplete="off"
          />
        </div>

        <button
          className={`w-full px-3 py-2 rounded ${
            validating ? "bg-slate-600" : "bg-sky-600 hover:bg-sky-500"
          } font-medium`}
          type="submit"
          disabled={validating}
        >
          {validating ? "Validating…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
