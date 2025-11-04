import { Router } from 'express';
import { simulator } from './simulator.js';

const r = Router();

r.get('/ltp', (req, res) => {
  const { symbol } = req.query;
  const q = simulator.quote(symbol);
  if (!q) return res.status(404).json({ error: 'UNKNOWN_SYMBOL' });
  res.json(q);
});

r.post('/start', (_req, res) => { simulator.start(); res.json({ ok: true }); });
r.post('/pause', (_req, res) => { simulator.pause(); res.json({ ok: true }); });
r.post('/speed', (req, res) => { simulator.setSpeed(req.body.speed); res.json({ ok: true }); });

r.post('/symbols', (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  simulator.setSymbols(list);
  res.json({ ok: true });
});

export default r;
