import { config } from '../config/env.js';

class Simulator {
  constructor() {
    this.speed = config.SIM_SPEED;
    this.mode = config.SIM_MODE;
    this.symbols = {};
    const start = Date.now();
    for (const sym of config.SIM_SYMBOLS) {
      this.symbols[sym] = {
        symbol: sym,
        mid: 1000 + Math.random() * 2000,
        spread: 0.3,
        tickSize: 0.05,
        lot: 1,
        ts: start
      };
    }
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(()=> this._step(), 250 / this.speed);
  }
  pause() {
    clearInterval(this._timer);
    this._timer = null;
  }
  setSpeed(n) { this.speed = Math.max(0.1, Number(n)||1); }
  setSymbols(list) {
    const map = {};
    for (const s of list) map[s.symbol] = { ...s, ts: Date.now() };
    this.symbols = map;
  }

  _step() {
    const now = Date.now();
    for (const k of Object.keys(this.symbols)) {
      const s = this.symbols[k];
      const vol = 0.8;
      const drift = (Math.random() - 0.5) * vol;
      s.mid = Math.max(5, s.mid + drift);
      s.ts = now;
    }
  }

  quote(symbol) {
    const s = this.symbols[symbol];
    if (!s) return null;
    const bid = +(s.mid - s.spread / 2).toFixed(2);
    const ask = +(s.mid + s.spread / 2).toFixed(2);
    return { symbol, bid, ask, ltp: +s.mid.toFixed(2), ts: s.ts };
  }
}

export const simulator = new Simulator();
simulator.start();
