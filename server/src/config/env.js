import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT || 3044,
  MONGO_URI: process.env.MONGO_URI,
  MARKET_MODE: process.env.MARKET_MODE ?? 'dummy',
  BROKER_MODE: process.env.BROKER_MODE ?? 'paper',
  SIM_SYMBOLS: (process.env.SIM_SYMBOLS ?? 'INFY,RELIANCE').split(',').map(s => s.trim()),
  SIM_SPEED: Number(process.env.SIM_SPEED ?? 1),
  SIM_MODE: process.env.SIM_MODE ?? 'randomWalk',
  PAPER_LIQUIDITY: Number(process.env.PAPER_LIQUIDITY ?? 0.8),
  PAPER_MAX_SLIPPAGE_PCT: Number(process.env.PAPER_MAX_SLIPPAGE_PCT ?? 0.25)
};
