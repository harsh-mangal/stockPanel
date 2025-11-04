import LinkedAccount from '../models/LinkedAccount.js';
import { presence } from '../realtime/presence.js';

export const listOnlineAccounts = async (_req, res, next) => {
  try {
    const onlineIds = Array.from(presence.onlineSet());
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
