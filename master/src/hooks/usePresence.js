import { useEffect, useMemo, useState } from "react";
import { AccountsAPI } from "../api";


export function usePresence(intervalMs = 4000) {
const [online, setOnline] = useState([]);
const [all, setAll] = useState([]);


useEffect(() => {
let on = true;
const run = async () => {
try { const a = await AccountsAPI.listAll(); if (on) setAll(a); } catch {}
try { const o = await AccountsAPI.listOnline(); if (on) setOnline(o); } catch {}
};
run();
const t = setInterval(run, intervalMs);
return () => { on = false; clearInterval(t); };
}, [intervalMs]);


const onlineSet = useMemo(()=> new Set(online.map(a=>String(a._id))), [online]);
const selectable = useMemo(()=> all.filter(a=>onlineSet.has(String(a._id))), [all, onlineSet]);


return { all, online, onlineSet, selectable };
}