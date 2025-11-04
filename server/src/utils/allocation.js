export function allocateQuantities({ mode, config, accounts, masterQty, capitalsById }) {
  const result = new Map(); // accountId -> qty

  if (mode === 'SAME_QTY') {
    accounts.forEach(a => result.set(String(a._id), Number(config.sameQty || 0)));
    return result;
  }

  if (mode === 'CUSTOM_PER_ACCOUNT') {
    for (const a of accounts) {
      const q = (config.perAccountQty?.[String(a._id)]) ?? 0;
      result.set(String(a._id), Number(q));
    }
    return result;
  }

  if (mode === 'PCT_OF_MASTER') {
    const pct = Number(config.percent || 0);
    const each = Math.floor((masterQty * pct) / 100);
    accounts.forEach(a => result.set(String(a._id), each));
    return result;
  }

  if (mode === 'PROPORTIONAL') {
    const basis = capitalsById || {};
    const total = accounts.reduce((s,a)=> s + (basis[String(a._id)] || a.capital || 0), 0);
    accounts.forEach(a => {
      const cap = (basis[String(a._id)] || a.capital || 0);
      const q = total > 0 ? Math.floor(masterQty * (cap / total)) : 0;
      result.set(String(a._id), q);
    });
    return result;
  }

  throw new Error('Unknown allocation mode');
}
