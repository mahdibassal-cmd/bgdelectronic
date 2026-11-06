export const MAX_WINNERS = 3;
export const CAMPAIGN = 'sorteio-semanal-2';

export function normHandle(value) {
  return String(value ?? '').trim().replace(/^@+/, '').toLowerCase();
}

export function displayHandle(value) {
  const h = normHandle(value);
  return h ? '@' + h : '';
}

export function uniformBelow(max, nextUint32) {
  if (!Number.isInteger(max) || max <= 0 || max > 0x100000000) {
    throw new Error('intervalo inválido');
  }
  const limit = Math.floor(0x100000000 / max) * max;
  let guard = 0;
  let x;
  do {
    if (++guard > 1000) throw new Error('fonte aleatória esgotada');
    x = nextUint32() >>> 0;
  } while (x >= limit);
  return x % max;
}

export function cryptoRandomBelow(max) {
  const buf = new Uint32Array(1);
  return uniformBelow(max, () => {
    crypto.getRandomValues(buf);
    return buf[0];
  });
}

export function eligiblePool(participants, exclude) {
  const skip = new Set();
  if (exclude) for (const item of exclude) skip.add(normHandle(item));
  const map = new Map();
  for (const p of participants || []) {
    const h = normHandle(p?.handle);
    const n = p?.entries;
    if (!h || !Number.isInteger(n) || n <= 0 || skip.has(h)) continue;
    map.set(h, (map.get(h) || 0) + n);
  }
  return [...map.entries()].map(([handle, entries]) => ({ handle, entries }));
}

export function pickWeighted(participants, exclude, randomInt) {
  const pool = eligiblePool(participants, exclude);
  const total = pool.reduce((s, p) => s + p.entries, 0);
  if (total <= 0) return null;
  const r = randomInt(total);
  if (!Number.isInteger(r) || r < 0 || r >= total) {
    throw new Error('sorteio: número fora do intervalo');
  }
  let left = r;
  for (const p of pool) {
    if (left < p.entries) return p;
    left -= p.entries;
  }
  return null;
}

export function restoreState(raw, participants, prizes) {
  if (!Array.isArray(prizes) || prizes.length < MAX_WINNERS) return { ok: false, winners: [] };
  if (raw == null) return { ok: true, winners: [] };
  if (typeof raw !== 'object' || !Array.isArray(raw.winners) || raw.winners.length > MAX_WINNERS) {
    return { ok: false, winners: [] };
  }
  const known = new Set(eligiblePool(participants, []).map((p) => p.handle));
  const winners = [];
  const seen = new Set();
  for (const w of raw.winners) {
    const h = normHandle(w?.handle);
    const place = winners.length + 1;
    if (!h || !known.has(h) || seen.has(h) || w.place !== place || w.prize !== prizes[place - 1]) {
      return { ok: false, winners: [] };
    }
    seen.add(h);
    winners.push({ handle: displayHandle(h), place, prize: prizes[place - 1] });
  }
  return { ok: true, winners };
}

export function drawNext(state, participants, randomInt, prizes) {
  const restored = restoreState({ winners: state?.winners ?? [] }, participants, prizes);
  if (!restored.ok) throw new Error('estado do sorteio inválido');
  if (restored.winners.length >= MAX_WINNERS) return { winners: restored.winners };
  const picked = pickWeighted(participants, restored.winners.map((w) => w.handle), randomInt);
  if (!picked) return { winners: restored.winners };
  const place = restored.winners.length + 1;
  return {
    winners: restored.winners.concat([{
      handle: displayHandle(picked.handle),
      place,
      prize: prizes[place - 1],
    }]),
  };
}

export function serializeState(winners) {
  return JSON.stringify({ v: 1, campaign: CAMPAIGN, winners });
}
