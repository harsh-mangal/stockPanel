import { Router } from 'express';
import { createAndDispatchMaster, getMaster, listMasters } from './orderController.js';
import { previewMaster } from './orderPreviewController.js';

const r = Router();

r.post('/master', createAndDispatchMaster);
r.get('/master', listMasters);
r.get('/master/:id', getMaster);
r.post('/master/preview', previewMaster);

export default r;
