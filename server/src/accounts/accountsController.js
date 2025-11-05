// controllers/accounts.js
import mongoose from 'mongoose';
import LinkedAccount from '../models/LinkedAccount.js';
import { presence } from '../realtime/presence.js';

const { isValidObjectId, Types } = mongoose;

const toObjectIdArray = (vals = []) =>
  vals
    .map(String)
    .map(v => v.trim())
    .filter(isValidObjectId)
    .map(v => new Types.ObjectId(v));

export const listOnlineAccounts = async (_req, res, next) => {
  try {
    const onlineIdsRaw = Array.from(presence.onlineSet()); // strings (maybe mixed)
    const onlineIds = toObjectIdArray(onlineIdsRaw);
    if (onlineIds.length === 0) return res.json([]);

    const docs = await LinkedAccount.find({ _id: { $in: onlineIds } })
      .select('_id displayName broker capital userId enabled')
      .lean();

    res.json(docs);
  } catch (e) { next(e); }
};

// (Optional) raw roster for debugging
export const presenceDebug = async (_req, res) => {
  res.json({ online: Array.from(presence.onlineSet()) });
};

export const createAccount = async (req, res, next) => {
  try {
    const { displayName, broker = 'PAPER', enabled = true, capital = 0, tags = [] } = req.body;
    const acc = await LinkedAccount.create({
      displayName,
      broker: broker.toUpperCase(),
      enabled,
      capital,
      tags
    });
    res.status(201).json(acc);
  } catch (e) { next(e); }
};

export const listAccounts = async (req, res, next) => {
  try {
    const { enabled, tag, broker } = req.query;
    const q = {};
    if (enabled !== undefined) q.enabled = enabled === 'true';
    if (broker) q.broker = String(broker).toUpperCase();
    if (tag) q.tags = String(tag); // exact match on a single tag
    const list = await LinkedAccount.find(q).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (e) { next(e); }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }
    const upd = await LinkedAccount.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    if (!upd) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(upd);
  } catch (e) { next(e); }
};

export const bulkCreateAccounts = async (req, res, next) => {
  try {
    const { userId, accounts } = req.body;
    if (!userId) return res.status(400).json({ error: 'USER_ID_REQUIRED' });
    if (!isValidObjectId(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });
    if (!Array.isArray(accounts) || !accounts.length) {
      return res.status(400).json({ error: 'NO_ACCOUNTS' });
    }

    const docs = accounts.map(a => ({
      userId: new Types.ObjectId(userId),
      broker: (a.broker || 'PAPER').toUpperCase(),
      displayName: a.displayName,
      enabled: a.enabled ?? true,
      capital: a.capital ?? 0,
      tags: Array.isArray(a.tags) ? a.tags : []
    }));

    const inserted = await LinkedAccount.insertMany(docs, { ordered: true });
    res.status(201).json({ count: inserted.length, accounts: inserted });
  } catch (e) { next(e); }
};
