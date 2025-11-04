import LinkedAccount from '../models/LinkedAccount.js';

export const createAccount = async (req, res, next) => {
  try {
    const { displayName, broker = 'PAPER', enabled = true, capital = 0, tags = [] } = req.body;
    const acc = await LinkedAccount.create({ displayName, broker, enabled, capital, tags });
    res.status(201).json(acc);
  } catch (e) { next(e); }
};

export const listAccounts = async (req, res, next) => {
  try {
    const { enabled, tag, broker } = req.query;
    const q = {};
    if (enabled !== undefined) q.enabled = enabled === 'true';
    if (broker) q.broker = broker.toUpperCase();
    if (tag) q.tags = tag; // single tag filter; extend as needed
    const list = await LinkedAccount.find(q).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (e) { next(e); }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const upd = await LinkedAccount.findByIdAndUpdate(id, req.body, { new: true });
    if (!upd) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(upd);
  } catch (e) { next(e); }
};
export const bulkCreateAccounts = async (req, res, next) => {
  try {
    const { userId, accounts } = req.body;
    if (!userId) return res.status(400).json({ error: 'USER_ID_REQUIRED' });
    if (!Array.isArray(accounts) || !accounts.length) {
      return res.status(400).json({ error: 'NO_ACCOUNTS' });
    }
    const docs = accounts.map(a => ({
      userId,
      broker: (a.broker || 'PAPER').toUpperCase(),
      displayName: a.displayName,
      enabled: a.enabled ?? true,
      capital: a.capital ?? 0,
      tags: a.tags ?? []
    }));
    const inserted = await LinkedAccount.insertMany(docs);
    res.status(201).json({ count: inserted.length, accounts: inserted });
  } catch (e) { next(e); }
};
