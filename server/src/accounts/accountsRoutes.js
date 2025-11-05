// src/accounts/accountsRoutes.js
import { Router } from "express";
import {
  createAccount, listAccounts, updateAccount, bulkCreateAccounts, getAccountById,
} from "./accountsController.js";
import { listOnlineAccounts, presenceDebug } from "./accountsPresenceController.js";

const r = Router();

// specific first
r.get("/online", listOnlineAccounts);
r.get("/presence/debug", presenceDebug);

// CRUD
r.post("/", createAccount);
r.get("/", listAccounts);
r.get("/:id([a-fA-F0-9]{24})", getAccountById);
r.patch("/:id([a-fA-F0-9]{24})", updateAccount);

// bulk
r.post("/bulk", bulkCreateAccounts);

export default r;
