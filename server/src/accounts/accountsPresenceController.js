import mongoose from "mongoose";
import LinkedAccount from "../models/LinkedAccount.js";
import { presence } from "../realtime/presence.js";

const { isValidObjectId, Types } = mongoose;

// ✅ helper function
const toObjectIdArray = (vals = []) =>
  vals
    .map(String)
    .map((v) => v.trim())
    .filter(isValidObjectId)
    .map((v) => new Types.ObjectId(v));

export const listOnlineAccounts = async (_req, res, next) => {
  try {
    const raw = Array.from(presence.onlineSet());
    const valid = toObjectIdArray(raw);

    if (!valid.length) {
      if (raw.length)
        console.warn("[presence] onlineSet has no LinkedAccount _ids:", raw);
      res.set("Cache-Control", "no-store");
      return res.json([]);
    }

    const docs = await LinkedAccount.find({ _id: { $in: valid } })
      .select("_id displayName broker capital userId enabled")
      .lean();

    res.set("Cache-Control", "no-store");
    res.json(docs);
  } catch (e) {
    next(e);
  }
};

// (Optional) for debugging
export const presenceDebug = async (_req, res) => {
  res.json({ online: Array.from(presence.onlineSet()) });
};
