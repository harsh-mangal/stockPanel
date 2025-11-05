// src/accounts/accountsPresenceController.js
import mongoose from "mongoose";
import LinkedAccount from "../models/LinkedAccount.js";
import { presence } from "../realtime/presence.js";

const { isValidObjectId, Types } = mongoose;
const hex24 = (s) => (String(s || "").match(/[a-f0-9]{24}/i) || [])[0] || null;
const toObjectIdArray = (vals = []) =>
  vals.map(hex24).filter(Boolean).filter(isValidObjectId).map((v) => new Types.ObjectId(v));

export const listOnlineAccounts = async (_req, res, next) => {
  try {
    const raw = Array.from(presence.onlineSet());
    const valid = toObjectIdArray(raw);
    if (!valid.length) {
      res.set("Cache-Control", "no-store");
      return res.json([]);
    }
    const docs = await LinkedAccount.find({ _id: { $in: valid } })
      .select("_id displayName broker capital userId enabled")
      .lean();
    res.set("Cache-Control", "no-store");
    res.json(docs);
  } catch (e) { next(e); }
};

export const presenceDebug = async (_req, res) => {
  res.json({
    online: Array.from(presence.onlineSet()),
    sockets: Object.fromEntries(
      Array.from(presence._ONLINE.entries()).map(([id, set]) => [id, set.size])
    ),
  });
};
