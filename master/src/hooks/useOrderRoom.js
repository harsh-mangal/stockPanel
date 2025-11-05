import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BASE_URL } from "../config";


export function useOrderRoom(masterId) {
const [feed, setFeed] = useState([]);
const sockRef = useRef(null);


useEffect(() => {
if (!masterId) return;
const socket = io(BASE_URL, { transports: ["websocket"] });
sockRef.current = socket;


const push = (type) => (payload) => setFeed((e) => [{ type, payload, ts: Date.now() }, ...e].slice(0, 500));


socket.on("connect", () => socket.emit("join", `order:${masterId}`));
socket.on("order.master.created", push("order.master.created"));
socket.on("order.master.summary", push("order.master.summary"));
socket.on("order.child.updated", push("order.child.updated"));
socket.on("trade.new", push("trade.new"));


return () => { socket.emit("leave", `order:${masterId}`); socket.disconnect(); };
}, [masterId]);


return feed;
}