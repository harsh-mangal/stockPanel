// src/App.js
import React, { useMemo, useState } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { useLinkedSocket } from "./hooks/useLinkedSocket";

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("linked.session")) || null;
    } catch {
      return null;
    }
  });

  const { connected, events, children, masters } = useLinkedSocket({
    accountId: session?.accountId,
    userId: session?.userId,
    authKey: session?.authKey,
  });

  const onLogin = (payload) => setSession(payload);
  const onLogout = () => {
    localStorage.removeItem("linked.session");
    setSession(null);
    // full reload ensures clean socket teardown
    window.location.reload();
  };

  const hasSession = useMemo(() => !!session?.accountId, [session]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 sticky top-0 z-20 bg-slatebg/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold">Linked Account Panel</h1>
          {hasSession && (
            <div className={`text-sm ${connected ? "text-green-400" : "text-red-400"}`}>
              {connected ? "Online" : "Offline"}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-6">
        {!hasSession ? (
          <Login onSubmit={onLogin} />
        ) : (
          <Dashboard
            session={session}
            connected={connected}
            masters={masters}
            children={children}
            events={events}
            onLogout={onLogout}
          />
        )}
      </main>
    </div>
  );
}
