// src/accounts/accountsRoutes.js
import { Router } from 'express';
import {
  createAccount,
  listAccounts,
  updateAccount,
  bulkCreateAccounts,
} from './accountsController.js';
import {
  listOnlineAccounts,
  presenceDebug,
} from './accountsPresenceController.js';

const r = Router();

/* -------------------------------------------------------------------------- */
/* 🧾 CRUD ROUTES                                                             */
/* -------------------------------------------------------------------------- */
r.post('/', createAccount);          // Create one account
r.get('/', listAccounts);            // List all accounts
r.patch('/:id', updateAccount);      // Update by ID

/* -------------------------------------------------------------------------- */
/* 👥 PRESENCE ROUTES                                                         */
/* -------------------------------------------------------------------------- */
r.get('/online', listOnlineAccounts);    // List currently online accounts
r.get('/presence/debug', presenceDebug); // Debug presence roster

/* -------------------------------------------------------------------------- */
/* 📦 BULK OPS                                                                */
/* -------------------------------------------------------------------------- */
r.post('/bulk', bulkCreateAccounts);     // Bulk create accounts

export default r;
