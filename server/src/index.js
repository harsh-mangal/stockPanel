import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import simRoutes from './sim/simRoutes.js';
import orderRoutes from './orders/orderRoutes.js';
import accountsRoutes from './accounts/accountsRoutes.js'; // if not already
import usersRoutes from './users/usersRoutes.js';         // if not already
import reportsRoutes from './reports/reportsRoutes.js';   // if not already
import { attachIO } from './realtime/io.js';
import { wireSimulatorBroadcast } from './sim/sim-broadcast.js'; // new (below)

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: { market: config.MARKET_MODE, broker: config.BROKER_MODE } });
});

app.use('/sim', simRoutes);
app.use('/orders', orderRoutes);
app.use('/accounts', accountsRoutes);
app.use('/users', usersRoutes);
app.use('/reports', reportsRoutes);

const start = async () => {
  await connectMongo();

  const server = http.createServer(app);
  const io = attachIO(server);     // <-- Socket.IO attached

  // Broadcast ticks periodically from the simulator (rooms: symbol:<SYMBOL>)
  wireSimulatorBroadcast(io);

  server.listen(config.PORT, () => {
    console.log(`API up on http://localhost:${config.PORT}`);
  });
};
start();
