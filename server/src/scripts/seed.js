import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectMongo } from '../src/db/mongo.js';
import LinkedAccount from '../src/models/LinkedAccount.js';

(async () => {
  await connectMongo();
  await LinkedAccount.deleteMany({});
  const make = (name, capital) => ({ broker: 'PAPER', displayName: name, enabled: true, capital });
  await LinkedAccount.insertMany([
    make('ACC Alpha', 200000),
    make('ACC Bravo', 150000),
    make('ACC Charlie', 50000),
    make('ACC Delta', 100000),
    make('ACC Echo', 80000)
  ]);
  console.log('Seeded linked accounts');
  await mongoose.disconnect();
})();
