import User from '../models/User.js';

export const createUser = async (req, res, next) => {
  try {
    const { email, role = 'ADMIN', status = 'ACTIVE' } = req.body;
    const u = await User.create({ email, role, status });
    res.status(201).json(u);
  } catch (e) { next(e); }
};

export const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (e) { next(e); }
};
