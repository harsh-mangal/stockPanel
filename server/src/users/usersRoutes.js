import { Router } from 'express';
import { createUser, listUsers } from './usersController.js';
const r = Router();
r.post('/', createUser);
r.get('/', listUsers);
export default r;
