import { Router } from 'express';
import { listTrades, positionsView, pnlReport } from './reportsController.js';

const r = Router();
r.get('/trades', listTrades);
r.get('/positions', positionsView);
r.get('/pnl', pnlReport);

export default r;
