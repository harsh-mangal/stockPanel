import React, { useMemo, useState } from "react";
import { OrdersAPI } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useOrderRoom } from "../hooks/useOrderRoom";
import AccountsPicker from "../components/AccountsPicker.jsx";
import OrderForm from "../components/OrderForm.jsx";
import PreviewPane from "../components/PreviewPane.jsx";
import LiveFeed from "../components/LiveFeed.jsx";

export default function AdminPage() {
  const { selectable } = usePresence();
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState({
    symbol: "INFY",
    side: "BUY",
    orderType: "LIMIT",
    price: 1500,
    sameQty: 10,
    productType: "MIS",
  });
  const [preview, setPreview] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [masterId, setMasterId] = useState("");

  const feed = useOrderRoom(masterId);
  const canPlace =
    selectedIds.length > 0 &&
    (form.orderType === "MARKET" || Number(form.price) > 0) &&
    Number(form.sameQty) > 0;
  const toggle = (id) =>
    setSelectedIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );

  const onPreview = async () => {
    setPreview(null);
    try {
      const body = {
        symbol: form.symbol,
        side: form.side,
        orderType: form.orderType,
        price: Number(form.price),
        productType: form.productType,
        allocationMode: "SAME_QTY",
        allocationConfig: { sameQty: Number(form.sameQty) },
        targets: { accountIds: selectedIds },
      };
      const resp = await OrdersAPI.preview(body);
      setPreview(resp);
    } catch (e) {
      setPreview({ error: e?.response?.data || e.message });
    }
  };

  const onPlace = async () => {
    if (!canPlace) return;
    setPlacing(true);
    setMasterId("");
    try {
      const body = {
        symbol: form.symbol,
        side: form.side,
        orderType: form.orderType,
        price: Number(form.price),
        productType: form.productType,
        allocationMode: "SAME_QTY",
        allocationConfig: { sameQty: Number(form.sameQty) },
        targets: { accountIds: selectedIds },
      };
      const resp = await OrdersAPI.create(body);
      setMasterId(String(resp.masterOrderId));
    } catch (e) {
      alert("Order failed: " + (e?.response?.data?.error || e.message));
    } finally {
      setPlacing(false);
    }
  };
}
