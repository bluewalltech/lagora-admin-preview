// Demo data for the admin panel. Catalogue, tiers, earning rates and the demo member (Ana) match the app's
// src/data/mock.ts; everything else is generated from a fixed seed so the numbers are stable between reloads.

const TODAY = new Date('2026-10-21T10:00:00');

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(417);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.round(a + rand() * (b - a));
const daysAgo = (n, h = 12) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); d.setHours(h, between(0, 59), 0, 0); return d.toISOString(); };

export const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurant', color: '#8E2E22' },
  { id: 'stay', label: 'Apartments', color: '#2A6F9E' },
  { id: 'shop', label: 'Wine shop', color: '#9A7420' },
  { id: 'tasting', label: 'Tastings & tours', color: '#6B4C9A' },
  { id: 'event', label: 'Events', color: '#3F8A5A' },
];

export const TIERS = ['classic', 'silver', 'gold', 'platinum'];

export const defaultRules = {
  welcomeDiscount: 5,
  welcomePoints: 200,
  tiers: [
    { id: 'classic', minPoints: 0, discount: 5 },
    { id: 'silver', minPoints: 2000, discount: 7 },
    { id: 'gold', minPoints: 6000, discount: 10 },
    { id: 'platinum', minPoints: 15000, discount: 12 },
  ],
  // Points per 100 RSD spent.
  earn: { restaurant: 1, stay: 1.5, shop: 1, tasting: 1.5, event: 0.5 },
  // Where the member discount applies (requirement 3).
  discountOn: { restaurant: true, stay: true, shop: true, tasting: true, event: false },
  bonuses: [
    { id: 'b1', name: 'Post-visit survey answered', points: 50, active: true },
    { id: 'b2', name: 'Birthday gift', points: 500, active: true },
    { id: 'b3', name: 'Third visit within 90 days', points: 150, active: true },
    { id: 'b4', name: 'Referral: friend makes first purchase', points: 300, active: true },
    { id: 'b5', name: 'Harvest weekend (Sep 1 – Oct 15) ×2 points', points: 0, multiplier: 2, active: false },
  ],
  validityMonths: 24,
  expiryNoticeDays: 30,
  stacking: 'best', // best | add
  maxDiscount: 20,
  exclusions: ['Private & corporate events', 'Gift vouchers & gift cards', 'Wine Club subscription', 'Bottles already on promotion', 'Tourist tax'],
};

// Bill items the checkout can add, by outlet. Names and prices from the app's catalogue.
export const CATALOG = {
  restaurant: [
    { name: 'Degustacioni meni', price: 9200 },
    { name: 'Tartar od junetine', price: 1900 },
    { name: 'Pastrmka sa Rtnja', price: 1800 },
    { name: 'Jagnjeći but, 12 sati', price: 3400 },
    { name: 'Pačja prsa', price: 3100 },
    { name: 'Rižoto od vrganja', price: 2400 },
    { name: 'Tart od grožđa', price: 950 },
    { name: 'Vinsko uparivanje', price: 9800 },
    { name: 'Furia (boca, restoran)', price: 6300 },
  ],
  shop: [
    { name: 'Furia', price: 4200 }, { name: 'Avia', price: 4600 }, { name: 'Chardonnay', price: 3400 },
    { name: 'Sauvignon Blanc', price: 3400 }, { name: 'Lupo 2024', price: 2600 }, { name: 'Bello 2024', price: 2200 },
    { name: 'Aria 2025', price: 1900 }, { name: 'Gora Crveno 2024', price: 1500 }, { name: 'Gora Belo 2025', price: 1300 },
    { name: 'Poklon vaučer 10.000', price: 10000, excluded: 'Gift vouchers & gift cards' },
  ],
  stay: [
    { name: 'Apartman 1 spavaća soba · noć', price: 16451 },
    { name: 'Apartman 2 spavaće sobe · noć', price: 19976 },
    { name: 'KONZUL Grand Suite · noć', price: 58753 },
    { name: 'REGENT Predsednički · noć', price: 82255 },
    { name: 'Boravišna taksa', price: 110, excluded: 'Tourist tax' },
  ],
  tasting: [
    { name: 'Klasična degustacija', price: 3500 },
    { name: 'Obilazak podruma + degustacija', price: 4500 },
    { name: 'Monosortna vina', price: 6000 },
  ],
  event: [
    { name: 'Jesenja večera · Furia', price: 9800 },
    { name: 'Jazz u podrumu', price: 2500 },
    { name: 'Korporativni događaj · zakup', price: 240000, excluded: 'Private & corporate events' },
  ],
};

const FIRST = ['Ana', 'Marko', 'Jelena', 'Nikola', 'Milica', 'Stefan', 'Ivana', 'Luka', 'Teodora', 'Aleksandar', 'Sara', 'Nemanja', 'Katarina', 'Filip', 'Jovana', 'Dušan', 'Marija', 'Vuk', 'Tamara', 'Miloš', 'Anja', 'Petar', 'Nina', 'Uroš', 'Dragana', 'Bojan', 'Sofija', 'Igor', 'Maja', 'Vladimir', 'Lena', 'Đorđe', 'Hana', 'Ognjen', 'Mina', 'Thomas', 'Julia', 'Lukas', 'Emma', 'Andrej'];
const LAST = ['Petrović', 'Jovanović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Stanković', 'Pavlović', 'Milošević', 'Popović', 'Kovačević', 'Todorović', 'Simić', 'Lazić', 'Ristić', 'Vasić', 'Tomić', 'Kostić', 'Obradović', 'Šarić', 'Babić', 'Radović', 'Živković', 'Mitrović', 'Lukić', 'Savić', 'Filipović', 'Božić', 'Gajić', 'Vuković', 'Perić', 'Janković', 'Bogdanović', 'Krstić', 'Weber', 'Hofmann', 'Müller', 'Schneider', 'Stević'];
const WINES = ['Furia', 'Avia', 'Chardonnay', 'Sauvignon Blanc', 'Lupo', 'Bello', 'Aria', 'Gora Crveno', 'Gora Belo', 'Gora Aromatično'];
const DISHES = ['Jagnjeći but', 'Pačja prsa', 'Rižoto od vrganja', 'Tartar od junetine', 'Pastrmka sa Rtnja', 'Tart od grožđa', 'Degustacioni meni'];
const ALLERGENS = ['shellfish', 'gluten', 'lactose', 'nuts', 'eggs'];
const DIETS = ['vegetarian', 'pescatarian', 'no pork', 'low sugar'];
const APTS = ['One-bedroom apartment', 'Two-bedroom apartment', 'KONZUL Grand Suite', 'REGENT Presidential'];
const SOURCES = ['Apple', 'Google', 'Email', 'Phone'];
const tierFor = (points) => (points >= 15000 ? 'platinum' : points >= 6000 ? 'gold' : points >= 2000 ? 'silver' : 'classic');

const TITLES = {
  restaurant: ['Večera · 2 osobe', 'Ručak · 4 osobe', 'Degustacioni meni · 2 osobe', 'Večera · 6 osoba', 'Ručak · 2 osobe'],
  shop: ['Furia × 2', 'Chardonnay × 6', 'Lupo × 3', 'Avia × 1', 'Mešani paket × 6', 'Aria × 4'],
  stay: ['Apartman 1 spavaća soba · 2 noći', 'Apartman 2 spavaće sobe · 3 noći', 'KONZUL · 1 noć', 'Apartman 1 spavaća soba · 1 noć'],
  tasting: ['Klasična degustacija · 2', 'Obilazak podruma + degustacija · 4', 'Monosortna vina · 2'],
  event: ['Jesenja večera · 2', 'Jazz u podrumu · 2', 'Večer monosortnih vina · 2'],
};
const AMOUNT = { restaurant: [6000, 32000], shop: [1900, 26000], stay: [16451, 82255], tasting: [3500, 24000], event: [5000, 19600] };

let receiptSeq = 2310;
const receipt = () => `4RPVBTRZ-Dt1Ov1o0-${receiptSeq++}`;

function makeTransactions(guest, count, rules, maxDays) {
  const tx = [];
  const weights = ['restaurant', 'restaurant', 'restaurant', 'shop', 'shop', 'stay', 'tasting', 'event'];
  for (let i = 0; i < count; i++) {
    const cat = pick(weights);
    const [lo, hi] = AMOUNT[cat];
    const amount = Math.round(between(lo, hi) / 100) * 100;
    const pct = rules.discountOn[cat] ? guest.discount : 0;
    tx.push({
      id: `tx_${guest.id}_${i}`,
      guestId: guest.id,
      date: daysAgo(between(1, maxDays), between(12, 22)),
      category: cat,
      title: pick(TITLES[cat]),
      amount,
      discountPct: pct,
      discount: Math.round((amount * pct) / 100),
      points: Math.floor((amount / 100) * rules.earn[cat]),
      receiptNo: receipt(),
      staff: pick(['Marina (restaurant)', 'Jovan (shop)', 'Recepcija', 'Ivana (tastings)']),
    });
  }
  return tx.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildGuests(rules) {
  const ana = {
    id: 'mem_0001', memberNo: 'LG-00417', first: 'Ana', last: 'Petrović', email: 'ana.petrovic@example.com', phone: '+381 64 123 4567',
    tier: 'gold', points: 7420, vip: false, joined: '2025-03-14', birthday: '1988-07-22', anniversary: '2014-09-06', language: 'sr', source: 'Apple',
    wines: ['Furia', 'Avia', 'Lupo'], dishes: ['Degustacioni meni', 'Pačja prsa'], diet: [], allergens: ['shellfish'],
    apartment: 'One-bedroom apartment', consents: { email: true, sms: false, push: true, personalized: true },
    notes: 'Prefers a window table. Celebrates anniversary in early September.', discount: 10,
  };
  const ANA_TX = [
    ['2026-10-11T20:45:00', 'restaurant', 'Degustacioni meni · 2 osobe', 18400, 10, 184, '4RPVBTRZ-Dt1Ov1o0-2211'],
    ['2026-10-11T18:10:00', 'shop', 'Furia × 3', 12600, 10, 126, '4RPVBTRZ-Dt1Ov1o0-2198'],
    ['2026-09-27T15:00:00', 'tasting', 'Degustacija monosortnih vina', 6000, 10, 90, '4RPVBTRZ-Dt1Ov1o0-2140'],
    ['2026-09-06T12:00:00', 'stay', 'Apartman Vinograd · 2 noći', 36000, 10, 540, '4RPVBTRZ-Dt1Ov1o0-2077'],
    ['2026-08-15T21:30:00', 'restaurant', 'Večera · 4 osobe', 24600, 7, 246, '4RPVBTRZ-Dt1Ov1o0-1950'],
    ['2026-06-30T17:20:00', 'shop', 'Chardonnay 2023 × 6', 13800, 7, 138, '4RPVBTRZ-Dt1Ov1o0-1802'],
    ['2026-05-10T14:00:00', 'tasting', 'Obilazak podruma + degustacija', 4500, 7, 68, '4RPVBTRZ-Dt1Ov1o0-1655'],
  ].map(([date, category, title, amount, pct, points, receiptNo], i) => ({
    id: `tx_ana_${i}`, guestId: ana.id, date, category, title, amount, discountPct: pct, discount: Math.round((amount * pct) / 100), points, receiptNo,
    staff: category === 'shop' ? 'Jovan (shop)' : category === 'stay' ? 'Recepcija' : 'Marina (restaurant)',
  }));

  const guests = [ana];
  const transactions = [...ANA_TX];
  const used = new Set(['Ana Petrović']);
  for (let i = 0; i < 47; i++) {
    let first, last;
    do { first = pick(FIRST); last = pick(LAST); } while (used.has(`${first} ${last}`));
    used.add(`${first} ${last}`);
    const foreign = ['Thomas', 'Julia', 'Lukas', 'Emma'].includes(first) || ['Weber', 'Hofmann', 'Müller', 'Schneider'].includes(last);
    const points = Math.round((rand() ** 2.2) * 21000) + 200;
    const tier = tierFor(points);
    const joinedDays = between(10, 560);
    const g = {
      id: `mem_${String(i + 2).padStart(4, '0')}`,
      memberNo: `LG-${String(between(100, 1299)).padStart(5, '0')}`,
      first, last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace('đ', 'dj'),
      phone: `+381 6${between(0, 6)} ${between(100, 999)} ${between(1000, 9999)}`,
      tier, points, vip: points > 16000 && rand() > 0.4,
      joined: daysAgo(joinedDays).slice(0, 10),
      birthday: `${between(1955, 2001)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
      anniversary: rand() > 0.7 ? `${between(1990, 2022)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}` : null,
      language: foreign ? 'en' : 'sr',
      source: pick(SOURCES),
      wines: [pick(WINES), pick(WINES)].filter((w, j, a) => a.indexOf(w) === j),
      dishes: [pick(DISHES)],
      diet: rand() > 0.8 ? [pick(DIETS)] : [],
      allergens: rand() > 0.75 ? [pick(ALLERGENS)] : [],
      apartment: rand() > 0.5 ? pick(APTS) : null,
      consents: { email: rand() > 0.15, sms: rand() > 0.6, push: rand() > 0.25, personalized: rand() > 0.3 },
      notes: '',
      discount: rules.tiers.find((t) => t.id === tier).discount,
    };
    guests.push(g);
    const count = Math.max(1, Math.round(points / 900) + between(0, 3));
    transactions.push(...makeTransactions(g, Math.min(count, 22, Math.ceil(joinedDays / 12)), rules, Math.min(360, joinedDays)));
  }
  transactions.sort((a, b) => b.date.localeCompare(a.date));
  return { guests, transactions };
}

// Programme-wide monthly series (Nov 2025 – Oct 2026) for the whole member base, not just the named guests above.
export const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const monthly = MONTHS.map((m, i) => {
  const season = [0.8, 1.15, 0.55, 0.6, 0.8, 0.95, 1.1, 1.2, 1.3, 1.35, 1.4, 1.25][i];
  const growth = 0.7 + i * 0.05;
  const newMembers = Math.round(78 * season * growth + between(-6, 6));
  const visits = Math.round(910 * season * growth);
  const spend = {
    restaurant: Math.round(6.1e6 * season * growth),
    stay: Math.round(4.4e6 * season * growth * (i >= 6 && i <= 9 ? 1.25 : 1)),
    shop: Math.round(2.3e6 * season * growth * (i === 1 ? 1.6 : 1)),
    tasting: Math.round(1.1e6 * season * growth),
    event: Math.round(0.7e6 * season * growth),
  };
  const total = Object.values(spend).reduce((a, b) => a + b, 0);
  return {
    month: m, newMembers, visits, spend, total,
    discounts: Math.round(total * 0.071),
    pointsEarned: Math.round(total / 100 * 1.12),
    pointsRedeemed: Math.round(total / 100 * 0.41),
    pointsExpired: i === 2 ? 18400 : Math.round(between(800, 2400)),
    activeMembers: Math.round(420 * growth * (0.75 + season * 0.25)),
  };
});

export const programme = {
  members: 1284,
  tierCounts: { classic: 812, silver: 301, gold: 139, platinum: 32 },
  nonMember: { avgCheck: 7900, visitsPerYear: 1.3 },
  member: { avgCheck: 11400, visitsPerYear: 3.6 },
  consents: { email: 0.84, push: 0.77, sms: 0.38, personalized: 0.69 },
};

// Share of each joining cohort that came back in month +1..+6.
export const cohorts = [
  { label: 'Apr 2026', size: 96, ret: [0.46, 0.38, 0.34, 0.31, 0.29, 0.28] },
  { label: 'May 2026', size: 112, ret: [0.49, 0.4, 0.35, 0.33, 0.31] },
  { label: 'Jun 2026', size: 128, ret: [0.51, 0.43, 0.37, 0.34] },
  { label: 'Jul 2026', size: 141, ret: [0.53, 0.44, 0.39] },
  { label: 'Aug 2026', size: 150, ret: [0.55, 0.46] },
  { label: 'Sep 2026', size: 158, ret: [0.57] },
];

export function buildReservations(guests) {
  const g = (i) => guests[i].id;
  const today = '2026-10-21';
  const tomorrow = '2026-10-22';
  return [
    { id: 'r1', kind: 'restaurant', date: '2026-10-24', time: '19:30', guests: 2, guestId: g(0), status: 'confirmed', note: 'Sto uz prozor ako je moguće' },
    { id: 'r2', kind: 'restaurant', date: today, time: '12:30', guests: 4, guestId: g(3), status: 'confirmed', note: '' },
    { id: 'r3', kind: 'restaurant', date: today, time: '13:00', guests: 2, guestId: g(7), status: 'confirmed', note: 'Anniversary, dessert with a candle' },
    { id: 'r4', kind: 'restaurant', date: today, time: '19:00', guests: 6, guestId: g(12), status: 'confirmed', note: 'High chair' },
    { id: 'r5', kind: 'restaurant', date: today, time: '19:30', guests: 2, guestId: g(5), status: 'confirmed', note: '' },
    { id: 'r6', kind: 'restaurant', date: today, time: '20:00', guests: 3, guestId: g(18), status: 'confirmed', note: 'Vegetarian ×1' },
    { id: 'r7', kind: 'restaurant', date: today, time: '20:00', guests: 8, guestId: g(22), status: 'pending', note: 'Group of 8, asks for set menu' },
    { id: 'r8', kind: 'restaurant', date: tomorrow, time: '19:00', guests: 2, guestId: g(9), status: 'confirmed', note: '' },
    { id: 'r9', kind: 'restaurant', date: tomorrow, time: '20:30', guests: 4, guestId: g(14), status: 'confirmed', note: '' },
    { id: 'r10', kind: 'tasting', date: '2026-10-25', time: '15:00', guests: 4, guestId: g(4), status: 'pending', note: 'Monosortna vina', experience: 'Single-varietal wines' },
    { id: 'r11', kind: 'tasting', date: '2026-10-26', time: '11:00', guests: 2, guestId: g(16), status: 'pending', note: '', experience: 'Cellar tour + tasting' },
    { id: 'r12', kind: 'stay', date: '2026-10-30', time: '14:00', nights: 2, guests: 2, guestId: g(2), status: 'pending', note: 'Late check-out if possible', apartment: 'KONZUL Grand Suite' },
    { id: 'r13', kind: 'stay', date: '2026-11-06', time: '14:00', nights: 3, guests: 5, guestId: g(11), status: 'pending', note: 'Travelling with a dog', apartment: 'Two-bedroom apartment' },
    { id: 'r14', kind: 'stay', date: '2026-10-23', time: '14:00', nights: 1, guests: 2, guestId: g(8), status: 'confirmed', note: '', apartment: 'One-bedroom apartment' },
  ];
}

export const campaigns = [
  { id: 'c1', name: 'Invitation: first pouring of Avia', kind: 'VIP invitation', channels: ['push', 'email'], segment: 'Gold + Platinum', audience: 171, status: 'Sent', date: '2026-10-10T12:00', opened: 0.82, converted: 0.07, revenue: 0, note: '12 of 12 seats booked' },
  { id: 'c2', name: 'For Grašac lovers: 20% off Lupo', kind: 'Personalised offer', channels: ['push'], segment: 'Bought Grašac in last 12 months', audience: 214, status: 'Running', date: '2026-10-08T09:00', opened: 0.71, converted: 0.18, revenue: 412000 },
  { id: 'c3', name: '320 points expire on 31 December', kind: 'Points expiry', channels: ['push', 'email'], segment: 'Points expiring ≤ 90 days', audience: 388, status: 'Sent', date: '2026-10-01T09:00', opened: 0.64, converted: 0.21, revenue: 655000 },
  { id: 'c4', name: 'New vintage: Aria 2025', kind: 'New wine', channels: ['push', 'email'], segment: 'All members with consent', audience: 1078, status: 'Sent', date: '2026-09-20T09:00', opened: 0.58, converted: 0.09, revenue: 1210000 },
  { id: 'c5', name: 'Autumn dinner paired with Furia', kind: 'Event', channels: ['push', 'email', 'sms'], segment: 'Likes red · visited restaurant', audience: 426, status: 'Sent', date: '2026-09-15T09:00', opened: 0.67, converted: 0.05, revenue: 980000 },
  { id: 'c6', name: 'We miss you: a glass on us', kind: 'Re-engagement', channels: ['email', 'sms'], segment: 'No visit in 120+ days', audience: 247, status: 'Scheduled', date: '2026-10-28T10:00', opened: null, converted: null, revenue: null },
  { id: 'c7', name: 'Jazz in the cellar · early access', kind: 'Early access', channels: ['push'], segment: 'Silver and above', audience: 472, status: 'Draft', date: '2026-11-12T10:00', opened: null, converted: null, revenue: null },
];

export const automations = [
  { id: 'a1', name: 'Birthday greeting + 500 points', trigger: 'On the member’s birthday, 08:00', channels: ['push', 'email'], active: true, sent30: 104 },
  { id: 'a2', name: 'Points expiring reminder', trigger: '30 days before points expire', channels: ['push', 'email'], active: true, sent30: 388 },
  { id: 'a3', name: 'Post-visit survey', trigger: 'Morning after a bill is closed', channels: ['push'], active: true, sent30: 742 },
  { id: 'a4', name: 'Welcome series (3 messages)', trigger: 'Day 0, 7 and 21 after joining', channels: ['push', 'email'], active: true, sent30: 312 },
  { id: 'a5', name: 'Tier upgrade congratulations', trigger: 'When a member reaches a new tier', channels: ['push'], active: true, sent30: 37 },
  { id: 'a6', name: 'Inactive guest re-engagement', trigger: 'No visit for 120 days', channels: ['email', 'sms'], active: false, sent30: 0 },
  { id: 'a7', name: 'Anniversary message', trigger: '7 days before a shared anniversary', channels: ['email'], active: true, sent30: 19 },
];

const COMMENTS = {
  restaurant: ['The lamb was outstanding, service a little slow between courses.', 'Perfect pairing, the sommelier knew every bottle.', 'Lovely evening, but the terrace was cold.', 'Best tasting menu in Srem.', 'We waited 25 minutes for the bill.'],
  stay: ['The view from the suite is unforgettable.', 'Spa was busy, would love a booking system for it.', 'Breakfast could have more local cheese.', 'Spotless apartment, very quiet.'],
  tasting: ['Winemaker was charming and very knowledgeable.', 'Would have liked more time in the cellar.', 'Great value, we bought six bottles after.'],
  shop: ['Staff recommended exactly what we needed.', 'Gift wrapping took a while.', 'Would love online ordering.'],
  event: ['Jazz night was magical.', 'Too crowded near the bar.', 'Corporate event ran smoothly, thank you.'],
};
const AREAS = ['Speed of service', 'Food', 'Wine selection', 'Staff friendliness', 'Cleanliness', 'Value for money', 'Ambience', 'Booking process'];

export function buildFeedback(guests) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const cat = pick(['restaurant', 'restaurant', 'restaurant', 'stay', 'stay', 'tasting', 'shop', 'event']);
    const roll = rand();
    const rating = roll < 0.58 ? 5 : roll < 0.86 ? 4 : roll < 0.95 ? 3 : 2;
    out.push({
      id: `f${i}`, guestId: pick(guests).id, category: cat, rating, date: daysAgo(between(0, 60), between(9, 20)),
      comment: rand() > 0.3 ? pick(COMMENTS[cat]) : '',
      improve: rating < 5 ? [pick(AREAS)] : [],
      publicPromptShown: true,
      clickedPublic: rand() > 0.55 ? pick(['Google', 'Tripadvisor']) : null,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildComplaints(guests) {
  return [
    { id: 'k1', guestId: guests[6].id, opened: daysAgo(1), category: 'restaurant', title: 'Waited 25 minutes for the bill', owner: 'Marina', status: 'open' },
    { id: 'k2', guestId: guests[13].id, opened: daysAgo(3), category: 'stay', title: 'Spa was full on Saturday afternoon', owner: 'Recepcija', status: 'progress' },
    { id: 'k3', guestId: guests[20].id, opened: daysAgo(4), category: 'shop', title: 'Charged twice for the same bottle', owner: 'Jovan', status: 'progress' },
    { id: 'k4', guestId: guests[2].id, opened: daysAgo(9), category: 'restaurant', title: 'Shellfish allergy not passed to the kitchen', owner: 'Head chef', status: 'resolved' },
    { id: 'k5', guestId: guests[17].id, opened: daysAgo(12), category: 'event', title: 'Too crowded near the bar at jazz night', owner: 'Events', status: 'resolved' },
  ];
}

export const partners = [
  { id: 'p1', name: 'Atlas Group', kind: 'Hospitality group', status: 'In talks', benefit: '10% off stays for Atlas loyalty members; La Gora members get Atlas partner rate', members: 0, uses: 0 },
  { id: 'p2', name: 'Alta Bank', kind: 'Bank', status: 'In talks', benefit: 'Alta premium cardholders: Silver status on joining + 2× points when paying with an Alta card', members: 0, uses: 0 },
];

export const staff = [
  { name: 'Milena Đurić', role: 'management', lastSeen: daysAgo(0, 9) },
  { name: 'Recepcija (shared iPad)', role: 'reception', lastSeen: daysAgo(0, 9) },
  { name: 'Marina Kovač', role: 'restaurant', lastSeen: daysAgo(1, 22) },
  { name: 'Jovan Ilić', role: 'retail', lastSeen: daysAgo(0, 8) },
  { name: 'Teodora Simić', role: 'marketing', lastSeen: daysAgo(0, 9) },
];

export const ROLES = {
  management: { label: 'Management', pages: ['overview', 'checkout', 'guests', 'reservations', 'campaigns', 'feedback', 'discounts', 'rules', 'content', 'partners', 'security'] },
  reception: { label: 'Reception', pages: ['checkout', 'guests', 'reservations', 'feedback'] },
  restaurant: { label: 'Restaurant', pages: ['checkout', 'reservations', 'guests'] },
  retail: { label: 'Wine shop', pages: ['checkout', 'guests'] },
  marketing: { label: 'Marketing', pages: ['overview', 'guests', 'campaigns', 'feedback', 'content'] },
};

export const seedAudit = [
  { at: daysAgo(0, 9), who: 'Milena Đurić', what: 'Signed in', target: 'Admin panel' },
  { at: daysAgo(1, 17), who: 'Teodora Simić', what: 'Scheduled campaign', target: 'We miss you: a glass on us' },
  { at: daysAgo(1, 16), who: 'Milena Đurić', what: 'Changed earning rate', target: 'Apartments: 1 → 1.5 pts / 100 RSD' },
  { at: daysAgo(2, 11), who: 'Recepcija', what: 'Viewed guest profile', target: 'LG-00417 Ana Petrović' },
  { at: daysAgo(3, 14), who: 'Milena Đurić', what: 'Awarded 1,000 points', target: 'LG-00213 · goodwill, complaint k4' },
  { at: daysAgo(5, 10), who: 'System', what: 'Nightly backup completed', target: '1,284 members · 18,903 transactions' },
];

export const content = {
  events: [
    { id: 'e5', title: 'Vladimir Veličković u Galeriji La Gora', when: '16 Oct – 30 Nov', img: 'event-e5.jpg', published: true, membersOnly: false, sr: true, en: true, booked: null },
    { id: 'e1', title: 'Jesenja večera uparena sa Furijom', when: '24 Oct · 19:30', img: 'event-e1.jpg', published: true, membersOnly: false, sr: true, en: true, booked: '34 / 40' },
    { id: 'e2', title: 'Prvo otvaranje vina Avia', when: '7 Nov · 18:00', img: 'event-e2.jpg', published: true, membersOnly: true, sr: true, en: true, booked: '12 / 12' },
    { id: 'e3', title: 'Večer monosortnih vina', when: '15 Nov · 16:00', img: 'event-e3.jpg', published: true, membersOnly: false, sr: true, en: true, booked: '10 / 30' },
    { id: 'e4', title: 'Jazz u podrumu', when: '12 Dec · 20:00', img: 'event-e4.jpg', published: false, membersOnly: false, sr: true, en: false, booked: '0 / 40' },
  ],
  wines: [
    { id: 'w1', name: 'Furia', variety: 'Syrah · Cabernet Sauvignon · Merlot', price: 4200, stock: 312, img: 'wine-w1.jpg', published: true },
    { id: 'w5', name: 'Avia', variety: 'Syrah', price: 4600, stock: 48, img: 'wine-w5.jpg', published: true, limited: true },
    { id: 'w2', name: 'Chardonnay', variety: 'Chardonnay', price: 3400, stock: 205, img: 'wine-w2.jpg', published: true },
    { id: 'w7', name: 'Sauvignon Blanc', variety: 'Sauvignon Blanc', price: 3400, stock: 190, img: 'wine-w7.jpg', published: true },
    { id: 'w4', name: 'Lupo 2024', variety: 'Grašac', price: 2600, stock: 260, img: 'wine-w4-thumb.jpg', published: true, award: 'Decanter 2025 · Silver' },
    { id: 'w6', name: 'Bello 2024', variety: 'Grašac · Sauvignon Blanc · Chardonnay', price: 2200, stock: 330, img: 'wine-w6-thumb.jpg', published: true },
    { id: 'w3', name: 'Aria 2025', variety: 'Sauvignon Blanc', price: 1900, stock: 540, img: 'wine-w3.jpg', published: true },
    { id: 'w9', name: 'Gora Crveno 2024', variety: 'Merlot · Cabernet Sauvignon', price: 1500, stock: 880, img: 'wine-w9.jpg', published: true },
  ],
};

export { TODAY, tierFor };
