import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'os'; // ✅ Use import for ESM

import { config } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import simRoutes from './sim/simRoutes.js';
import orderRoutes from './orders/orderRoutes.js';
import accountsRoutes from './accounts/accountsRoutes.js';
import usersRoutes from './users/usersRoutes.js';
import reportsRoutes from './reports/reportsRoutes.js';
import { attachIO } from './realtime/io.js';
import { wireSimulatorBroadcast } from './sim/sim-broadcast.js';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: { market: config.MARKET_MODE, broker: config.BROKER_MODE },
  });
});

app.use('/sim', simRoutes);
app.use('/orders', orderRoutes);
app.use('/accounts', accountsRoutes);
app.use('/users', usersRoutes);
app.use('/reports', reportsRoutes);

const start = async () => {
  await connectMongo();

  const server = http.createServer(app);
  const io = attachIO(server);

  wireSimulatorBroadcast(io);

  const HOST = '0.0.0.0';
  const PORT = config.PORT || 3000;

  // ✅ Auto-detect your local LAN IP (for Wi-Fi or Ethernet)
  const getLocalIp = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  };

  const localIp = getLocalIp();

  server.listen(PORT, HOST, () => {
    console.log(`✅ API up on:
  - Local:   http://localhost:${PORT}
  - Network: http://${localIp}:${PORT}`);
  });
};

start();
