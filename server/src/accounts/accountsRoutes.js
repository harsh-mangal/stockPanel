// src/accounts/accountsRoutes.js
import { Router } from 'express';
import { createAccount, listAccounts, updateAccount, bulkCreateAccounts } from './accountsController.js';
import { listOnlineAccounts, presenceDebug } from './accountsPresenceController.js';

const r = Router();

// ORDER of routes matters only if you also have GET '/:id' (you don't), but this is fine.
r.post('/', createAccount);
r.get('/', listAccounts);

// ✅ add this line
r.get('/online', listOnlineAccounts);

r.post('/bulk', bulkCreateAccounts);
r.get('/presence/debug', presenceDebug);

r.patch('/:id', updateAccount);

export default r;
