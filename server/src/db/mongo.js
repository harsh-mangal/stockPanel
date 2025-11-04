import mongoose from 'mongoose';
import { config } from '../config/env.js';

export const connectMongo = async () => {
  if (!config.MONGO_URI) throw new Error('MONGO_URI missing');
  await mongoose.connect(config.MONGO_URI, { autoIndex: true });
  console.log('Mongo connected');
};
