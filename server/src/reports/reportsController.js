import Trade from '../models/Trade.js';
import LinkedAccount from '../models/LinkedAccount.js';
import { simulator } from '../sim/simulator.js';
import mongoose from 'mongoose';

const toDate = (v, def) => (v ? new Date(v) : def);

// GET /reports/trades?userId=&accountId=&symbol=&from=&to=&limit=50&skip=0
export const listTrades = async (req, res, next) => {
  try {
    const { userId, accountId, symbol, from, to, limit = 50, skip = 0 } = req.query;
    const q = {};
    if (userId) q.userId = new mongoose.Types.ObjectId(userId);
    if (accountId) q.accountId = new mongoose.Types.ObjectId(accountId);
    if (symbol) q.symbol = symbol.toUpperCase();
    const fromDt = toDate(from, new Date(Date.now() - 7*24*60*60*1000));
    const toDt   = toDate(to,   new Date());
    q.filledAt = { $gte: fromDt, $lte: toDt };

    const docs = await Trade.find(q)
      .sort({ filledAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await Trade.countDocuments(q);
    res.json({ total, items: docs });
  } catch (e) { next(e); }
};

// GET /reports/positions?userId=&accountId=
export const positionsView = async (req, res, next) => {
  try {
    const { userId, accountId } = req.query;
    const match = {};
    if (userId) match.userId = new mongoose.Types.ObjectId(userId);
    if (accountId) match.accountId = new mongoose.Types.ObjectId(accountId);

    // net positions by symbol & side aggregation
    const agg = await Trade.aggregate([
      { $match: match },
      { $group: {
          _id: { symbol: '$symbol', side: '$side', accountId: '$accountId' },
          qty: { $sum: '$qty' },
          value: { $sum: { $multiply: ['$qty', '$price'] } }
      }},
      // convert BUY/SELL into signed qty (BUY +, SELL -)
      { $project: {
          symbol: '$_id.symbol',
          accountId: '$_id.accountId',
          netQty: { $cond: [{ $eq: ['$_id.side','BUY'] }, '$qty', { $multiply: ['$qty', -1] }] },
          cost:  { $cond: [{ $eq: ['$_id.side','BUY'] }, '$value', { $multiply: ['$value', -1] }] }
      }},
      { $group: {
          _id: { symbol: '$symbol', accountId: '$accountId' },
          netQty: { $sum: '$netQty' },
          cost:   { $sum: '$cost' }
      }},
      { $project: {
          _id: 0,
          symbol: '$_id.symbol',
          accountId: '$_id.accountId',
          netQty: 1,
          avgCost: { $cond: [{ $ne: ['$netQty', 0] }, { $divide: ['$cost', '$netQty'] }, 0] }
      }},
      { $sort: { symbol: 1 } }
    ]);

    // Mark-to-market using simulator LTP
    const out = agg.map(p => {
      const q = simulator.quote(p.symbol) || { ltp: p.avgCost };
      const mtm = (q.ltp - p.avgCost) * p.netQty;
      return { ...p, ltp: q.ltp, mtm: +mtm.toFixed(2) };
    });

    res.json(out);
  } catch (e) { next(e); }
};

// GET /reports/pnl?userId=&accountId=&from=&to=&groupBy=symbol|day
export const pnlReport = async (req, res, next) => {
  try {
    const { userId, accountId, from, to, groupBy = 'symbol' } = req.query;
    const match = {};
    if (userId) match.userId = new mongoose.Types.ObjectId(userId);
    if (accountId) match.accountId = new mongoose.Types.ObjectId(accountId);
    const fromDt = toDate(from, new Date(Date.now() - 7*24*60*60*1000));
    const toDt   = toDate(to,   new Date());
    match.filledAt = { $gte: fromDt, $lte: toDt };

    // Signed cashflow: BUY = -qty*price (cash out), SELL = +qty*price (cash in)
    const base = await Trade.aggregate([
      { $match: match },
      { $project: {
          symbol: '$symbol',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$filledAt' } },
          cash: {
            $cond: [
              { $eq: ['$side','BUY'] },
              { $multiply: [{ $multiply: ['$qty', '$price'] }, -1] },
              { $multiply: ['$qty', '$price'] }
            ]
          },
          qtyBuy:  { $cond: [{ $eq: ['$side','BUY'] }, '$qty', 0] },
          qtySell: { $cond: [{ $eq: ['$side','SELL'] }, '$qty', 0] }
      }},
      { $group: {
          _id: groupBy === 'day' ? '$day' : '$symbol',
          cash: { $sum: '$cash' },
          buyQty: { $sum: '$qtyBuy' },
          sellQty:{ $sum: '$qtySell' }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json(base.map(r => ({
      group: r._id,
      cashPnL: +r.cash.toFixed(2),
      buyQty: r.buyQty,
      sellQty: r.sellQty
    })));
  } catch (e) { next(e); }
};
