/**
 * seed/random.ts — a deterministic, seedable random source + domain generators.
 *
 * WHY: generated apps used to ship ~6 hand-authored rows, so dashboards read as
 * fake ("$854 MRR, 6 subscribers"). The fix is to MOVE row generation out of the
 * agent and into a real engine: seed HUNDREDS of coherent rows with realistic
 * names/companies/amounts, backdated across months (see ./backdate) so headline
 * metrics, deltas and charts look like a real business.
 *
 * Deterministic: same seed → same data, so demo data is reproducible and a
 * re-seed is idempotent. No external dependency (faker etc.) — a curated
 * vocabulary keeps the starter lean and the output stable.
 */

const FIRST_NAMES = [
  'Sarah',
  'James',
  'Maria',
  'David',
  'Aisha',
  'Chen',
  'Diego',
  'Emma',
  'Omar',
  'Nina',
  'Liam',
  'Sofia',
  'Noah',
  'Priya',
  'Lucas',
  'Grace',
  'Mateo',
  'Zara',
  'Ethan',
  'Leah',
  'Amir',
  'Hannah',
  'Ivan',
  'Ruby',
  'Kai',
  'Elena',
  'Marcus',
  'Yuki',
  'Rosa',
  'Tomas',
];

const LAST_NAMES = [
  'Mitchell',
  'Chen',
  'Hernandez',
  'Patel',
  'Nguyen',
  'Johnson',
  'Kowalski',
  'Rossi',
  'Okafor',
  'Silva',
  'Andersen',
  'Kim',
  'Murphy',
  'Haddad',
  'Novak',
  'Reyes',
  'Fischer',
  'Costa',
  'Wallace',
  'Ibrahim',
  'Petrov',
  'Sato',
  'Lindqvist',
  'Bauer',
  'Dubois',
];

const COMPANY_HEADS = [
  'Summit',
  'Harbor',
  'Bright',
  'Ironwood',
  'Northwind',
  'Cedar',
  'Vertex',
  'Meridian',
  'Copper',
  'Lumen',
  'Granite',
  'Willow',
  'Atlas',
  'Sterling',
  'Pioneer',
  'Beacon',
];
const COMPANY_TAILS = [
  'Industries',
  'Logistics',
  'Group',
  'Partners',
  'Systems',
  'Labs',
  'Works',
  'Collective',
  'Solutions',
  'Trading',
  'Supply',
  'Holdings',
  'Consulting',
  'Studio',
  'Co',
];

const WORDS = [
  'quarterly',
  'onsite',
  'priority',
  'standard',
  'follow-up',
  'inspection',
  'install',
  'repair',
  'review',
  'renewal',
  'onboarding',
  'maintenance',
  'upgrade',
  'assessment',
  'consultation',
  'delivery',
  'setup',
  'audit',
  'planning',
  'kickoff',
  'handover',
];

const CITIES = [
  'Springfield',
  'Riverside',
  'Fairview',
  'Kingston',
  'Ashford',
  'Brookline',
  'Clayton',
  'Easton',
  'Fremont',
  'Gardner',
  'Hillcrest',
  'Lakewood',
  'Maplewood',
  'Oakdale',
];

/** mulberry32 — tiny, fast, well-distributed seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string seed to a 32-bit int so callers can seed by brand name. */
function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SeededRandom {
  private rng: () => number;

  constructor(seed: string | number = 'founding-demo') {
    this.rng = mulberry32(hashSeed(seed));
  }

  /** Float in [0, 1). */
  next(): number {
    return this.rng();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** Float in [min, max), rounded to `decimals`. */
  float(min: number, max: number, decimals = 2): number {
    const v = this.rng() * (max - min) + min;
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
  }

  /** True with probability `p` (default 0.5). */
  bool(p = 0.5): boolean {
    return this.rng() < p;
  }

  /** One element of `arr`. Throws on an empty array (a seed bug). */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('SeededRandom.pick: empty array');
    return arr[Math.floor(this.rng() * arr.length)] as T;
  }

  /** `n` DISTINCT elements of `arr` (or all of them if n exceeds the length). */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
  }

  /** Weighted pick: `[value, weight]` pairs. */
  weighted<T>(pairs: ReadonlyArray<readonly [T, number]>): T {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [value, w] of pairs) {
      r -= w;
      if (r <= 0) return value;
    }
    return pairs[pairs.length - 1]![0];
  }

  // ── Domain generators ─────────────────────────────────────────────────────
  firstName(): string {
    return this.pick(FIRST_NAMES);
  }

  lastName(): string {
    return this.pick(LAST_NAMES);
  }

  fullName(): string {
    return `${this.firstName()} ${this.lastName()}`;
  }

  company(): string {
    return `${this.pick(COMPANY_HEADS)} ${this.pick(COMPANY_TAILS)}`;
  }

  /** A deterministic email derived from a name so a row stays internally coherent. */
  email(name?: string): string {
    const base = (name ?? this.fullName())
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()
      .replace(/\s+/g, '.');
    const domain = this.pick(['example.com', 'mail.com', 'inbox.co', 'works.io']);
    return `${base}@${domain}`;
  }

  city(): string {
    return this.pick(CITIES);
  }

  /** A short human phrase, e.g. "quarterly inspection". */
  phrase(words = 2): string {
    return this.sample(WORDS, Math.max(1, words)).join(' ');
  }

  /** A US-shaped phone number string. */
  phone(): string {
    return `(${this.int(200, 989)}) ${this.int(200, 989)}-${String(this.int(0, 9999)).padStart(4, '0')}`;
  }

  /** A currency AMOUNT in whole cents-friendly dollars, e.g. 129.5. */
  amount(min: number, max: number): number {
    return this.float(min, max, 2);
  }

  /** A short opaque id (for in-memory / non-DB seeds). */
  id(prefix = 'seed'): string {
    return `${prefix}_${Math.floor(this.rng() * 1e9).toString(36)}`;
  }
}
