const seen = new Set(); // for demo; replace with Redis later
export function once(key) {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
    