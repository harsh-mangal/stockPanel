import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage.jsx";
import LinkedPage from "./pages/LinkedPage.jsx";
import MastersListPage from "./pages/MastersListPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import MasterOrdersPage from "./pages/MasterOrdersPage.jsx";

function NotFound() {
  return (
    <div className="text-sm text-slate-300">
      Page not found. Try one of the tabs above.
    </div>
  );
}

export default function App() {
  const linkCls = ({ isActive }) =>
    `px-3 py-1 rounded transition-colors ${
      isActive ? "bg-sky-600 text-white" : "bg-white/5 hover:bg-white/10"
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 sticky top-0 z-30 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold">CopyTrade Master Panel</h1>
          <nav className="flex gap-2 text-sm">
            <NavLink className={linkCls} to="/">
              Admin
            </NavLink>
            <NavLink className={linkCls} to="/masters">
              Masters
            </NavLink>
            <NavLink className={linkCls} to="/orders">
              Orders
            </NavLink>
            <NavLink className={linkCls} to="/accounts">
              Accounts
            </NavLink>
            <NavLink className={linkCls} to="/linked">
              Linked
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route index element={<AdminPage />} />
          <Route path="/masters" element={<MastersListPage />} />
          <Route path="/orders" element={<MasterOrdersPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/linked" element={<LinkedPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
