import { simulator } from './simulator.js';
import { config } from '../config/env.js';

export function wireSimulatorBroadcast(io) {
  // lightweight loop pushing quotes ~4x/sec
  setInterval(() => {
    for (const sym of Object.keys(simulator.symbols)) {
      const q = simulator.quote(sym);
      if (!q) continue;
      // room per symbol
      io.to(`symbol:${sym}`).emit('tick', q);
    }
  }, Math.max(1000 / 4, 250) / (config.SIM_SPEED || 1));
}
