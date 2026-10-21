import * as D from './data.js?v=2';

/* ───────────── State ───────────── */

const STORE_KEY = 'lagora-admin-sr-v1';
const EXPORT_REQ = 'Izvoz mojih podataka';
const DELETE_REQ = 'Brisanje naloga';
const RES_STATUS = { confirmed: 'potvrđeno', pending: 'čeka potvrdu', cancelled: 'otkazano' };
const CAMPAIGN_STATUS = { Sent: 'Poslato', Running: 'U toku', Scheduled: 'Zakazano', Draft: 'Nacrt' };

function freshState() {
  const rules = structuredClone(D.defaultRules);
  const { guests, transactions } = D.buildGuests(rules);
  return {
    rules,
    guests,
    transactions,
    reservations: D.buildReservations(guests),
    campaigns: structuredClone(D.campaigns),
    automations: structuredClone(D.automations),
    feedback: D.buildFeedback(guests),
    complaints: D.buildComplaints(guests),
    partners: structuredClone(D.partners),
    content: structuredClone(D.content),
    audit: structuredClone(D.seedAudit),
    dataRequests: [
      { id: 'dr1', guestId: guests[24].id, kind: EXPORT_REQ, at: '2026-10-19T10:12:00', done: false },
      { id: 'dr2', guestId: guests[31].id, kind: DELETE_REQ, at: '2026-10-17T16:40:00', done: false },
    ],
    role: 'management',
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
let state = load() || freshState();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private window: demo still works, just doesn't persist */ }
}

// View state that is not worth persisting.
const ui = {
  period: 3,
  guestFilter: { q: '', tier: 'all', segment: 'all' },
  ledger: { outlet: 'all', q: '', limit: 60 },
  resDay: '2026-10-21',
  drawerGuest: null,
  pos: { guestId: null, tokenState: null, outlet: 'restaurant', lines: [], receiptNo: null, result: null },
};

// Personalised offers the POS applies on top of (or instead of) the tier discount.
const OFFERS = [{ campaign: 'c2', item: 'Lupo 2024', pct: 20, label: 'Za ljubitelje Grašca: −20% na Lupo' }];

/* ───────────── Helpers ───────────── */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n0 = (n) => Math.round(n).toLocaleString('sr-RS');
const rsd = (n) => `${n0(n)} RSD`;
const mrsd = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('sr-RS', { maximumFractionDigits: 1 })} M RSD` : rsd(n));
const pct = (x, d = 0) => `${(x * 100).toLocaleString('sr-RS', { maximumFractionDigits: d })}%`;
const fmtDate = (iso, time = false) =>
  new Date(iso).toLocaleString('sr-Latn-RS', time ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
const cat = (id) => D.CATEGORIES.find((c) => c.id === id);
const guestById = (id) => state.guests.find((g) => g.id === id);
const fullName = (g) => `${g.first} ${g.last}`;
const initials = (g) => `${g.first[0]}${g.last[0]}`;
// Serbian plural: 1 gost, 2–4 gosta, 5+ gostiju (11–14 take the last form).
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const tierBadge = (t) => `<span class="tier ${t}">${t}</span>`;
const vipBadge = (g) => (g.vip ? `<span class="vip"><ion-icon name="star"></ion-icon>VIP</span>` : '');
const tierRule = (t) => state.rules.tiers.find((x) => x.id === t);
const discountFor = (g) => tierRule(g.tier).discount;
const tierForPoints = (p) => [...state.rules.tiers].reverse().find((t) => p >= t.minPoints).id;
const TIER_ORDER = D.TIERS;
const TIER_SEQ = { classic: '#E6D3A0', silver: '#CDAA52', gold: '#9A7420', platinum: '#5E4512' };
const now = () => new Date().toISOString();
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

function stars(r) {
  return `<span class="stars" aria-label="${r} od 5">${'★'.repeat(r)}<span class="off">${'★'.repeat(5 - r)}</span></span>`;
}

function guestStats(g) {
  const tx = state.transactions.filter((t) => t.guestId === g.id);
  const byCat = Object.fromEntries(D.CATEGORIES.map((c) => [c.id, 0]));
  tx.forEach((t) => (byCat[t.category] += t.amount));
  const spend = tx.reduce((a, t) => a + t.amount, 0);
  const last = tx[0]?.date ?? g.joined;
  const visits90 = tx.filter((t) => daysBetween(t.date, D.TODAY) <= 90).length;
  const visitsPrev90 = tx.filter((t) => { const d = daysBetween(t.date, D.TODAY); return d > 90 && d <= 180; }).length;
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  return { tx, byCat, spend, visits: tx.length, last, visits90, visitsPrev90, top: top[1] ? top[0] : null, avg: tx.length ? spend / tx.length : 0 };
}

const PEOPLE = {
  management: { name: 'Milena Đurić', first: 'Milena' },
  reception: { name: 'Recepcija', first: 'tim' },
  restaurant: { name: 'Marina Kovač', first: 'Marina' },
  retail: { name: 'Jovan Ilić', first: 'Jovan' },
  marketing: { name: 'Teodora Simić', first: 'Teodora' },
};
const me = () => PEOPLE[state.role];

function log(what, target) {
  state.audit.unshift({ at: now(), who: me().name, what, target });
}

function toast(msg, icon = 'checkmark-circle') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<ion-icon name="${icon}"></ion-icon>${msg}`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportRows(kind, name, header, rows) {
  if (kind === 'pdf') return window.print();
  if (kind === 'csv') {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return download(`${name}.csv`, '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }
  // Excel opens an HTML table saved as .xls, keeping columns and UTF-8 names intact.
  const tr = (r, tag) => `<tr>${r.map((v) => `<${tag}>${esc(v)}</${tag}>`).join('')}</tr>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${tr(header, 'th')}${rows.map((r) => tr(r, 'td')).join('')}</table></body></html>`;
  download(`${name}.xls`, html, 'application/vnd.ms-excel');
}
const exportButtons = (id) => `
  <div class="row no-print">
    <button class="btn quiet sm" data-action="export" data-id="${id}" data-kind="xls"><ion-icon name="grid-outline"></ion-icon>Excel</button>
    <button class="btn quiet sm" data-action="export" data-id="${id}" data-kind="csv"><ion-icon name="document-text-outline"></ion-icon>CSV</button>
    <button class="btn quiet sm" data-action="export" data-id="${id}" data-kind="pdf"><ion-icon name="print-outline"></ion-icon>PDF</button>
  </div>`;

const toggle = (attrs, on) => `<label class="toggle"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><span></span></label>`;

/* ───────────── Charts ───────────── */

function roundedTop(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * p >= v) * p;
}
function barChart(points, { height = 210, color = '#C9A63A', faded = () => false, fmt = n0, unit = '' } = {}) {
  const W = 640, H = height, L = 40, B = 24, T = 10;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const step = (W - L) / points.length;
  const bw = Math.min(30, step * 0.56);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => max * f);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line class="grid-line" x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-label" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${points.map((p, i) => {
      const x = L + step * i + (step - bw) / 2;
      return `<rect class="hit" x="${L + step * i}" y="${T}" width="${step}" height="${H - T - B}" fill="transparent" data-tip="<b>${esc(p.label)}</b><br>${esc(fmt(p.value))}${unit}"/>
        <path class="bar-mark" d="${roundedTop(x, y(p.value), bw, H - B - y(p.value))}" fill="${color}" opacity="${faded(i) ? 0.3 : 1}" pointer-events="none"/>
        <text class="axis-label" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`;
    }).join('')}
  </svg>`;
}

function hbars(rows, { fmt = rsd, labelW, max = Math.max(...rows.map((r) => r.value), 1) } = {}) {
  return rows.map((r) => `
    <div class="hbar" ${labelW ? `style="grid-template-columns:${labelW}px 1fr 110px"` : ''} data-tip="<b>${esc(r.label)}</b><br>${esc(fmt(r.value))}${r.extra ? `<br><span class='t-dim'>${esc(r.extra)}</span>` : ''}">
      <span class="row small" style="gap:8px">${r.color ? `<span class="cat-dot" style="background:${r.color}"></span>` : ''}${esc(r.label)}</span>
      <div class="bar"><div style="width:${(r.value / max) * 100}%;background:${r.color || 'var(--gold-deep)'}"></div></div>
      <span class="small num right" style="text-align:right">${esc(fmt(r.value))}</span>
    </div>`).join('');
}

/* ───────────── Navigation ───────────── */

const NAV = [
  { group: 'Pregled' },
  { id: 'overview', label: 'Pregled', icon: 'analytics-outline' },
  { group: 'Prijem gostiju' },
  { id: 'checkout', label: 'Kasa · POS', icon: 'qr-code-outline' },
  { id: 'reservations', label: 'Rezervacije', icon: 'calendar-outline', count: () => state.reservations.filter((r) => r.status === 'pending').length },
  { id: 'guests', label: 'Gosti · CRM', icon: 'people-outline' },
  { group: 'Marketing' },
  { id: 'campaigns', label: 'Kampanje', icon: 'megaphone-outline' },
  { id: 'feedback', label: 'Utisci gostiju', icon: 'chatbubble-ellipses-outline', count: () => state.complaints.filter((c) => c.status === 'open').length },
  { id: 'content', label: 'Sadržaj aplikacije', icon: 'images-outline' },
  { group: 'Program' },
  { id: 'discounts', label: 'Evidencija popusta', icon: 'receipt-outline' },
  { id: 'rules', label: 'Pravila kluba', icon: 'options-outline' },
  { id: 'partners', label: 'Partneri · Faza 2', icon: 'git-network-outline' },
  { id: 'security', label: 'Tim i podaci', icon: 'shield-checkmark-outline' },
];

function route() {
  const id = location.hash.replace('#/', '') || '';
  const allowed = D.ROLES[state.role].pages;
  return id && NAV.some((n) => n.id === id) ? id : allowed[0];
}

function renderNav() {
  const allowed = D.ROLES[state.role].pages;
  const current = route();
  const items = [];
  NAV.forEach((n, i) => {
    if (n.group) {
      const hasAny = NAV.slice(i + 1).find((m) => m.group) ;
      const section = NAV.slice(i + 1, hasAny ? NAV.indexOf(hasAny) : undefined);
      if (section.some((m) => allowed.includes(m.id))) items.push(`<div class="nav-group caption dim">${n.group}</div>`);
      return;
    }
    if (!allowed.includes(n.id)) return;
    const c = n.count?.();
    items.push(`<a class="nav-item ${current === n.id ? 'active' : ''}" href="#/${n.id}"><ion-icon name="${n.icon}"></ion-icon>${n.label}${c ? `<span class="count">${c}</span>` : ''}</a>`);
  });
  $('#nav').innerHTML = items.join('');
  $('#me').innerHTML = `<div class="who"><div>${esc(me().name)}</div><div>${D.ROLES[state.role].label}</div></div><span class="avatar">${me().name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>`;
  $('#role').innerHTML = Object.entries(D.ROLES).map(([id, r]) => `<option value="${id}" ${id === state.role ? 'selected' : ''}>${r.label}</option>`).join('');
}

function pageHead(title, sub, reqs = [], right = '') {
  const id = route();
  const i = NAV.findIndex((n) => n.id === id);
  const group = NAV.slice(0, i).reverse().find((n) => n.group)?.group;
  return `<div class="page-head"><div>${group ? `<span class="caption eyebrow">${group}</span>` : ''}<h1 class="h1">${title}</h1>${sub ? `<p>${sub}</p>` : ''}${reqs.length ? `<div class="req">${reqs.map((r) => `<span>${r}</span>`).join('')}</div>` : ''}</div>${right}</div>`;
}

/* ───────────── Overview ───────────── */

function pageOverview() {
  const n = ui.period;
  const cur = D.monthly.slice(-n);
  const prev = D.monthly.slice(-2 * n, -n);
  const sum = (arr, f) => arr.reduce((a, m) => a + f(m), 0);
  const delta = (f) => {
    if (prev.length !== n) return '';
    const a = sum(cur, f), b = sum(prev, f);
    const d = (a - b) / b;
    return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span> u odnosu na ${n === 1 ? 'prethodni mesec' : `prethodna ${n} meseca`}`;
  };
  const spend = sum(cur, (m) => m.total);
  const disc = sum(cur, (m) => m.discounts);
  const visits = sum(cur, (m) => m.visits);
  const newM = sum(cur, (m) => m.newMembers);
  const active = cur[cur.length - 1].activeMembers;
  const byCat = D.CATEGORIES.map((c) => ({ label: c.label, color: c.color, value: sum(cur, (m) => m.spend[c.id]) }));
  const earned = sum(cur, (m) => m.pointsEarned), redeemed = sum(cur, (m) => m.pointsRedeemed), expired = sum(cur, (m) => m.pointsExpired);
  const tierTotal = Object.values(D.programme.tierCounts).reduce((a, b) => a + b, 0);

  const top = state.guests.map((g) => ({ g, s: guestStats(g) })).sort((a, b) => b.s.spend - a.s.spend).slice(0, 8);
  const inactive = 247;

  return `
  ${pageHead(`${new Date().getHours() < 12 ? 'Dobro jutro' : new Date().getHours() < 18 ? 'Dobar dan' : 'Dobro veče'}, ${me().first}`, 'Kako La Gora Club posluje u restoranu, vinoteci, apartmanima, na degustacijama i događajima.', ['§10 Analitika i izveštaji'],
    `<div class="row wrap"><div class="seg">${[[1, '30 dana'], [3, '90 dana'], [12, '12 meseci']].map(([v, l]) => `<button data-action="period" data-v="${v}" class="${ui.period === v ? 'on' : ''}">${l}</button>`).join('')}</div>${exportButtons('overview')}</div>`)}

  <div class="grid g4">
    <div class="card kpi hero-tile">
      <img src="logo.svg" class="watermark" alt="">
      <div class="caption dim">Registrovani članovi</div>
      <div class="value num">${n0(D.programme.members)}</div>
      <div class="delta"><span class="up">+${n0(newM)}</span> novih u poslednjih ${n === 1 ? '30 dana' : n === 3 ? '90 dana' : '12 meseci'}</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Aktivni članovi</div>
      <div class="value num">${n0(active)}<small>${pct(active / D.programme.members)} baze</small></div>
      <div class="delta">Bar jedna poseta u poslednjih 30 dana</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Posete članova</div>
      <div class="value num">${n0(visits)}</div>
      <div class="delta">${delta((m) => m.visits) || '64% su povratni gosti'}</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Potrošnja članova</div>
      <div class="value num">${mrsd(spend)}</div>
      <div class="delta">${delta((m) => m.total) || `${rsd(spend / visits)} po poseti`}</div>
    </div>
  </div>

  <div class="grid g4 mt">
    <div class="card kpi">
      <div class="caption dim">Odobreni popusti</div>
      <div class="value num">${mrsd(disc)}</div>
      <div class="delta">${pct(disc / spend, 1)} potrošnje članova · <a href="#/discounts" class="antique">evidencija</a></div>
    </div>
    <div class="card kpi span2">
      <div class="caption dim">Bodovi</div>
      <div class="row points-row" style="gap:18px;margin-top:8px">${[['Osvojeno', earned, 'var(--gold-deep)'], ['Iskorišćeno', redeemed, 'var(--gold-antique)'], ['Isteklo', expired, '#D8CDB8']].map(([l, v, c]) => `<div style="flex:1"><div class="num points-value">${n0(v)}</div><div class="small muted row" style="gap:6px"><span class="cat-dot" style="background:${c}"></span>${l}</div></div>`).join('')}</div>
      <div class="stacked" style="height:8px;margin-top:14px">${[[earned - redeemed - expired, 'var(--gold-deep)', 'Još na računima'], [redeemed, 'var(--gold-antique)', 'Iskorišćeno'], [expired, '#D8CDB8', 'Isteklo']].map(([v, c, l]) => `<div style="flex:${v};background:${c}" data-tip="<b>${l}</b><br>${n0(v)} bodova"></div>`).join('')}</div>
      <div class="delta">${pct(redeemed / earned)} iskorišćenosti</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Ponovne posete</div>
      <div class="value num">3.6<small>poseta / član / godišnje</small></div>
      <div class="delta">Nečlanovi: 1,3 · <span class="up">2,8×</span></div>
    </div>
  </div>

  <div class="grid g2 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">Novi članovi po mesecima</h2><span class="small muted">nov 2025 – okt 2026</span></div>
      ${barChart(D.monthly.map((m) => ({ label: m.month, value: m.newMembers })), { faded: (i) => i < 12 - n, unit: ' novih članova' })}
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Potrošnja po kategorijama</h2><span class="small muted">${n === 12 ? 'Poslednjih 12 meseci' : `Poslednjih ${n === 1 ? '30' : '90'} dana`}</span></div>
      ${hbars(byCat.map((r) => ({ ...r, extra: pct(r.value / spend) + ' potrošnje članova' })), { fmt: mrsd })}
      <p class="small muted" style="margin:14px 0 0">Privatni i korporativni događaji se naplaćuju bez članskog popusta i nisu uključeni.</p>
    </div>
  </div>

  <div class="grid g3 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">Članovi po nivoima</h2></div>
      <div class="stacked">${TIER_ORDER.map((t) => `<div style="flex:${D.programme.tierCounts[t]};background:${TIER_SEQ[t]}" data-tip="<b>${t}</b><br>${n0(D.programme.tierCounts[t])} članova"></div>`).join('')}</div>
      <div class="list mt">${TIER_ORDER.map((t) => `<div class="list-item"><span class="cat-dot" style="background:${TIER_SEQ[t]}"></span>${tierBadge(t)}<span class="small muted">${tierRule(t).discount}% · od ${n0(tierRule(t).minPoints)} bod.</span><span class="num" style="margin-left:auto">${n0(D.programme.tierCounts[t])}</span><span class="small dim num" style="width:42px;text-align:right">${pct(D.programme.tierCounts[t] / tierTotal)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Članovi i nečlanovi</h2></div>
      <div class="caption dim">Prosečan račun</div>
      ${hbars([{ label: 'Članovi', value: D.programme.member.avgCheck, color: '#9A7420' }, { label: 'Nečlanovi', value: D.programme.nonMember.avgCheck, color: '#D8CDB8' }], { labelW: 116 })}
      <div class="caption dim mt">Poseta godišnje</div>
      ${hbars([{ label: 'Članovi', value: D.programme.member.visitsPerYear, color: '#9A7420' }, { label: 'Nečlanovi', value: D.programme.nonMember.visitsPerYear, color: '#D8CDB8' }], { fmt: (v) => v.toLocaleString('sr-RS'), labelW: 116 })}
      <p class="small muted" style="margin:14px 0 0">Podaci za nečlanove dolaze iz POS računa zatvorenih bez skeniranja kartice.</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Zadržavanje</h2><span class="small muted">Vratili se u mesecu</span></div>
      <div class="heat" style="grid-template-columns: 74px repeat(6, 1fr)">
        <div></div>${[1, 2, 3, 4, 5, 6].map((i) => `<div class="small dim" style="text-align:center">+${i}</div>`).join('')}
        ${D.cohorts.map((c) => `<div class="small muted" style="align-self:center">${c.label.replace(' 2026', '')}<span class="dim"> · ${c.size}</span></div>${[0, 1, 2, 3, 4, 5].map((i) => {
          const v = c.ret[i];
          if (v == null) return '<div></div>';
          const a = 0.12 + (v - 0.25) * 2.4;
          return `<div class="cell" style="background:rgba(154,116,32,${a.toFixed(2)});color:${a > 0.62 ? '#fff' : 'var(--text)'};font-weight:${a > 0.62 ? 600 : 500}" data-tip="<b>Generacija ${c.label}</b><br>${pct(v)} se vratilo u mesecu +${i + 1}">${Math.round(v * 100)}</div>`;
        }).join('')}`).join('')}
      </div>
      <p class="small muted" style="margin:14px 0 0">Svaka novija generacija se češće vraća: povratak u prvom mesecu porastao je sa 46% na 57%.</p>
    </div>
  </div>

  <div class="grid g3 mt">
    <div class="card flush span2">
      <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Najvredniji gosti</h2><a class="small antique" href="#/guests">Svi gosti</a></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Gost</th><th>Nivo</th><th class="right">Posete</th><th class="right">Potrošnja</th><th>Najčešće</th><th>Učestalost</th></tr></thead>
        <tbody>${top.map(({ g, s }) => {
          const trend = s.visits90 - s.visitsPrev90;
          return `<tr class="click" data-action="open-guest" data-id="${g.id}">
            <td><div class="row"><span class="avatar">${initials(g)}</span><div><div>${esc(fullName(g))} ${vipBadge(g)}</div><div class="small dim mono">${g.memberNo}</div></div></div></td>
            <td>${tierBadge(g.tier)}</td><td class="right num">${s.visits}</td><td class="right num">${rsd(s.spend)}</td>
            <td>${s.top ? `<span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(s.top).color}"></span>${cat(s.top).label}</span>` : ''}</td>
            <td class="small">${trend > 0 ? `<span class="success">▲ češće</span>` : trend < 0 ? `<span class="danger">▼ ređe</span>` : '<span class="dim">isto</span>'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <div class="card" style="background:var(--surface-alt)">
      <ion-icon name="moon-outline" style="font-size:26px;color:var(--gold-antique)"></ion-icon>
      <h2 class="h2" style="margin-top:8px">${inactive} članova nije dolazilo 120 dana</h2>
      <p class="muted small">Većina se učlanila tokom leta i došla jednom na degustaciju. Ponuda „čaša vina je na nama” vratila je 21% slične grupe na proleće.</p>
      <button class="btn mt" data-action="new-campaign" data-preset="inactive"><ion-icon name="megaphone-outline"></ion-icon>Pokreni kampanju za povratak</button>
      <div class="caption dim mt-lg">Rođendani ove nedelje</div>
      <div class="list mt">${state.guests.slice(3, 6).map((g, i) => `<div class="list-item small"><span class="avatar" style="width:28px;height:28px;font-size:12px">${initials(g)}</span>${esc(fullName(g))}<span class="dim" style="margin-left:auto">${['čet', 'sub', 'ned'][i]}</span></div>`).join('')}</div>
    </div>
  </div>`;
}

/* ───────────── Checkout / POS ───────────── */

function posTotals() {
  const p = ui.pos;
  const g = p.guestId && guestById(p.guestId);
  const tierPct = g ? discountFor(g) : 0;
  const discountable = state.rules.discountOn[p.outlet];
  const lines = p.lines.map((l) => {
    const gross = l.price * l.qty;
    let linePct = 0, why = '';
    if (!g) why = '';
    else if (l.excluded) why = l.excluded;
    else if (!discountable) why = `${cat(p.outlet).label}: bez članskog popusta`;
    else {
      linePct = tierPct;
      const offer = OFFERS.find((o) => o.item === l.name && g.id === 'mem_0001');
      if (offer) {
        linePct = state.rules.stacking === 'best' ? Math.max(tierPct, offer.pct) : Math.min(tierPct + offer.pct, state.rules.maxDiscount);
        why = state.rules.stacking === 'best' ? `Ponuda ${offer.pct}% je bolja od nivoa ${tierPct}%` : `Nivo ${tierPct}% + ponuda ${offer.pct}%${tierPct + offer.pct > state.rules.maxDiscount ? `, ograničeno na ${state.rules.maxDiscount}%` : ''}`;
      }
    }
    return { ...l, gross, pct: linePct, discount: Math.round((gross * linePct) / 100), why };
  });
  const subtotal = lines.reduce((a, l) => a + l.gross, 0);
  const discount = lines.reduce((a, l) => a + l.discount, 0);
  const total = subtotal - discount;
  const rate = state.rules.earn[p.outlet];
  const multiplier = state.rules.bonuses.find((b) => b.multiplier && b.active)?.multiplier ?? 1;
  const pointBase = lines.filter((l) => !l.excluded).reduce((a, l) => a + l.gross - l.discount, 0);
  const points = g ? Math.floor((pointBase / 100) * rate * multiplier) : 0;
  return { g, lines, subtotal, discount, total, points, rate, multiplier, tierPct };
}

function nextReceiptNo() {
  const max = Math.max(...state.transactions.map((t) => +t.receiptNo.split('-').pop()).filter(Number.isFinite));
  return `4RPVBTRZ-Dt1Ov1o0-${max + 1}`;
}

function pageCheckout() {
  const p = ui.pos;
  p.receiptNo ??= nextReceiptNo();
  const t = posTotals();
  const g = t.g;
  const demo = [state.guests[0], state.guests.find((x) => x.tier === 'classic'), state.guests.find((x) => x.tier === 'platinum')].filter(Boolean);
  const s = g && guestStats(g);
  const nextTier = g && state.rules.tiers.find((x) => x.minPoints > g.points);

  const scanCol = `
    <div class="card">
      <div class="card-head"><h2 class="h2">1 · Skeniranje kartice</h2></div>
      ${!g ? `
        <div class="scan-box">
          <div class="qr-frame"><ion-icon name="qr-code-outline"></ion-icon><div class="laser"></div></div>
          <div class="small muted">Usmerite skener na QR kod gosta u La Gora aplikaciji ili Apple Wallet-u</div>
        </div>
        <form class="row mt" data-form="scan"><input class="input" style="flex:1" name="code" placeholder="ili unesite broj kartice LG-00417" autocomplete="off"><button class="btn sm">Pronađi</button></form>
        ${p.tokenState === 'expired' ? `<div class="notice bad mt"><ion-icon name="close-circle"></ion-icon><div><b>Kod je istekao pre 4 min.</b> Ovo je verovatno snimak ekrana. Zamolite gosta da otvori aplikaciju: QR kod se menja na 30 sekundi, pa kopirani kod ne može ponovo da se iskoristi.</div></div>` : ''}
        ${p.tokenState === 'unknown' ? `<div class="notice bad mt"><ion-icon name="close-circle"></ion-icon><div>Nema člana sa tim brojem kartice.</div></div>` : ''}
        <div class="caption dim mt-lg">Demo kartice</div>
        <div class="list mt">${demo.map((d) => `<button class="list-item" style="background:none;border:0;width:100%;cursor:pointer;text-align:left" data-action="pos-scan" data-id="${d.id}"><span class="avatar">${initials(d)}</span><div style="flex:1"><div>${esc(fullName(d))}</div><div class="small dim mono">${d.memberNo}</div></div>${tierBadge(d.tier)}</button>`).join('')}</div>
        <button class="btn ghost sm mt" data-action="pos-expired"><ion-icon name="image-outline"></ion-icon>Probaj snimak ekrana starog QR koda</button>
      ` : `
        <div class="member-card ${g.tier}">
          <img src="logo.svg" class="mc-logo" alt="">
          <div class="caption" style="opacity:.75">La Gora Club · ${g.tier}</div>
          <div style="font:300 24px/30px var(--display);margin-top:18px">${esc(fullName(g))}</div>
          <div class="row between" style="margin-top:10px"><span class="mono">${g.memberNo}</span><span class="small">${n0(g.points)} pts</span></div>
        </div>
        <div class="notice ok mt"><ion-icon name="shield-checkmark"></ion-icon><div>Kod potpisan za ${g.memberNo}, izdat pre 12 s. Proveren.</div></div>
        <dl class="kv mt">
          <dt>Članski popust</dt><dd><b>${t.tierPct}%</b> ${tierBadge(g.tier)} ${vipBadge(g)}</dd>
          <dt>Bodovi</dt><dd class="num">${n0(g.points)}${nextTier ? ` <span class="dim small">· još ${n0(nextTier.minPoints - g.points)} do ${nextTier.id}</span>` : ''}</dd>
          <dt>Posete</dt><dd>${s.visits} · poslednja ${fmtDate(s.last)}</dd>
          ${g.allergens.length ? `<dt>Alergeni</dt><dd>${g.allergens.map((a) => `<span class="allergen"><ion-icon name="warning"></ion-icon>${esc(a)}</span>`).join(' ')}</dd>` : ''}
          ${g.notes ? `<dt>Napomena</dt><dd class="small">${esc(g.notes)}</dd>` : ''}
          ${g.id === 'mem_0001' ? `<dt>Aktivna ponuda</dt><dd class="small"><span class="pill gold">${OFFERS[0].label}</span></dd>` : ''}
        </dl>
        <div class="row mt"><button class="btn quiet sm" data-action="open-guest" data-id="${g.id}">Otvori profil</button><button class="btn ghost sm" data-action="pos-clear">Sledeći gost</button></div>
      `}
    </div>`;

  const outlets = D.CATEGORIES.map((c) => `<button data-action="pos-outlet" data-v="${c.id}" class="${p.outlet === c.id ? 'on' : ''}">${c.label}</button>`).join('');
  const billCol = `
    <div class="card">
      <div class="card-head"><h2 class="h2">2 · Račun</h2><span class="small muted">U produkciji ga šalje POS</span></div>
      <div class="seg" style="flex-wrap:wrap">${outlets}</div>
      <div class="catalog mt">${D.CATALOG[p.outlet].map((it, i) => `<button data-action="pos-add" data-i="${i}"><div class="small" style="color:var(--text);font-weight:500">${esc(it.name)}</div><div class="small num">${rsd(it.price)}</div>${it.excluded ? `<div class="small danger">Bez popusta</div>` : ''}</button>`).join('')}</div>
      <div class="caption dim mt-lg">Na računu</div>
      <div class="mt">${t.lines.length ? t.lines.map((l, i) => `
        <div class="bill-line">
          <div><div>${esc(l.name)}</div>${l.why ? `<div class="small ${l.pct ? 'antique' : 'dim'}">${esc(l.why)}</div>` : ''}</div>
          <span class="qty"><button data-action="pos-qty" data-i="${i}" data-d="-1">−</button><span class="num">${l.qty}</span><button data-action="pos-qty" data-i="${i}" data-d="1">+</button></span>
          <div style="text-align:right;min-width:110px"><div class="num">${rsd(l.gross)}</div>${l.discount ? `<div class="small antique num">−${rsd(l.discount)} · ${l.pct}%</div>` : ''}</div>
        </div>`).join('') : `<div class="empty small">Dodirnite stavke iznad da napravite račun</div>`}</div>
    </div>`;

  const r = p.result;
  const receiptCol = `
    <div class="card">
      <div class="card-head"><h2 class="h2">3 · Zatvaranje</h2></div>
      <div class="receipt">
        <label class="field"><span>Broj fiskalnog računa</span><input class="input mono" data-bind-pos="receiptNo" value="${esc(p.receiptNo)}"></label>
        <div class="line mt"><span class="muted">Međuzbir</span><span class="num">${rsd(t.subtotal)}</span></div>
        <div class="line"><span class="muted">Članski popust</span><span class="num antique">${t.discount ? '−' + rsd(t.discount) : '—'}</span></div>
        <div class="line total"><span>Ukupno</span><span class="num">${rsd(t.total)}</span></div>
        <div class="line"><span class="muted">Bodovi za dodelu</span><span class="num"><b>+${n0(t.points)}</b> <span class="small dim">${t.rate} / 100 RSD${t.multiplier > 1 ? ` ×${t.multiplier}` : ''}</span></span></div>
      </div>
      ${!g && t.lines.length ? `<div class="notice info mt"><ion-icon name="information-circle"></ion-icon><div>Kartica nije skenirana: račun se beleži kao poseta nečlana za izveštaj članovi i nečlanovi.</div></div>` : ''}
      <button class="btn metal mt" style="width:100%" data-action="pos-close" ${!t.lines.length ? 'disabled' : ''}>${g ? 'Zatvori račun i dodeli bodove' : 'Zatvori račun'}</button>
      ${r?.error ? `<div class="notice bad mt"><ion-icon name="copy-outline"></ion-icon><div>${r.error}</div></div>` : ''}
      ${r?.ok ? `
        <div class="notice ok mt"><ion-icon name="checkmark-circle"></ion-icon><div><b>Zabeležen ${esc(r.receiptNo)}</b> · ${esc(r.name)}</div></div>
        <div class="list small mt">
          ${[['person-circle-outline', `Prepoznat ${esc(r.memberNo)}`], ['ribbon-outline', `Nivo proveren: ${r.tier}, ${r.tierPct}%`], ['pricetag-outline', `Popust primenjen na ${r.discLines} od ${r.lines} ${plural(r.lines, 'stavke', 'stavke', 'stavki')}: −${rsd(r.discount)}`], ['receipt-outline', 'Transakcija i popust upisani u evidenciju'], ['sparkles-outline', `Dodeljeno +${n0(r.points)} bodova`], ['person-outline', `Profil i istorija potrošnje ažurirani · sada ${n0(r.newPoints)} bod.`]]
            .map(([i, txt]) => `<div class="list-item"><ion-icon name="${i}" class="antique" style="font-size:18px"></ion-icon>${txt}</div>`).join('')}
          ${r.upgraded ? `<div class="list-item"><ion-icon name="trophy" style="font-size:18px;color:var(--gold-deep)"></ion-icon><b>Prelazak na nivo ${r.upgraded}</b>, poslato push obaveštenje</div>` : ''}
        </div>` : ''}
    </div>`;

  return `
  ${pageHead('Kasa', 'Skenirajte karticu gosta na kasi. Panel prepoznaje člana, primenjuje odgovarajući popust samo na stavke koje ga imaju, beleži račun i dodeljuje bodove. Ništa se ne unosi ručno.', ['§5 Integracija sa POS-om', '§3 Popusti i izuzeci', '§4 Zaštita od zloupotrebe'])}
  <div class="pos">${scanCol}${billCol}${receiptCol}</div>
  <div class="card mt-lg">
    <div class="card-head"><h2 class="h2">Kako se povezuje sa vašim POS-om</h2><span class="pill gold">Potvrđujemo kad vidimo vaš POS</span></div>
    <div class="grid g3">
      ${[['flash-outline', 'Direktan API ili dodatak', 'Ako proizvođač POS-a nudi API, skeniranje se radi na samom POS ekranu i popust se dodaje na račun pre fiskalizacije. Najbolje iskustvo, bez dodatnog uređaja.'],
        ['swap-horizontal-outline', 'Uparivanje računa', 'POS radi kao i danas. Mali servis čita svaki fiskalni račun (ESIR podatke) i uparuje ga sa karticom skeniranom na tabletu pored kase. Popust osoblje unosi kao POS akciju.'],
        ['tablet-portrait-outline', 'Tablet pored kase', 'Ovaj ekran na tabletu pored POS-a: osoblje skenira, vidi popust i unosi broj računa. Radi sa svakim POS-om od prvog dana, ali osoblju dodaje jedan korak.']]
        .map(([i, h, txt]) => `<div><ion-icon name="${i}" style="font-size:22px;color:var(--gold-antique)"></ion-icon><div class="h3" style="margin-top:6px">${h}</div><p class="small muted" style="margin:4px 0 0">${txt}</p></div>`).join('')}
    </div>
  </div>`;
}

function posClose() {
  const p = ui.pos;
  const t = posTotals();
  const receiptNo = p.receiptNo.trim();
  const dup = state.transactions.find((x) => x.receiptNo === receiptNo);
  if (dup) {
    p.result = { error: `<b>Račun ${esc(receiptNo)} je već zabeležen</b> ${fmtDate(dup.date, true)}. Bodovi se za isti račun nikad ne dodeljuju dva puta.` };
    log('Blokiran dupli račun', receiptNo);
    save();
    return render();
  }
  const g = t.g;
  if (!g) {
    log('Zatvoren račun nečlana', `${receiptNo} · ${rsd(t.total)}`);
    p.result = null;
    p.lines = [];
    p.receiptNo = null;
    toast(`Račun nečlana ${receiptNo} je zabeležen`);
    save();
    return render();
  }
  const before = g.tier;
  state.transactions.unshift({
    id: `tx_${Date.now()}`, guestId: g.id, date: now(), category: p.outlet,
    title: t.lines.map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(', '),
    amount: t.subtotal, discountPct: t.subtotal ? Math.round((t.discount / t.subtotal) * 1000) / 10 : 0, discount: t.discount, points: t.points, receiptNo,
    staff: { management: 'Milena Đurić', reception: 'Recepcija', restaurant: 'Marina (restoran)', retail: 'Jovan (vinoteka)', marketing: 'Teodora Simić' }[state.role],
  });
  g.points += t.points;
  const after = tierForPoints(g.points);
  const upgraded = TIER_ORDER.indexOf(after) > TIER_ORDER.indexOf(before) ? after : null;
  if (upgraded) g.tier = after;
  log('Zatvoren račun', `${receiptNo} · ${g.memberNo} · −${rsd(t.discount)} · +${t.points} bod.`);
  if (upgraded) log('Automatski prelazak na viši nivo', `${g.memberNo} ${before} → ${after}`);
  p.result = {
    ok: true, receiptNo, name: fullName(g), memberNo: g.memberNo, tier: before, tierPct: t.tierPct, discount: t.discount, points: t.points,
    lines: t.lines.length, discLines: t.lines.filter((l) => l.discount).length, newPoints: g.points, upgraded,
  };
  p.lines = [];
  p.receiptNo = null;
  save();
  render();
  if (upgraded) toast(`${esc(fullName(g))}: novi nivo ${upgraded}`, 'trophy');
}

/* ───────────── Guests ───────────── */

const SEGMENTS = {
  all: ['Svi gosti', () => true],
  birthday: ['Rođendan ovog meseca', (g) => g.birthday && +g.birthday.slice(5, 7) === D.TODAY.getMonth() + 1],
  allergens: ['Imaju alergene', (g) => g.allergens.length > 0],
  inactive: ['Bez posete 120+ dana', (g, s) => daysBetween(s.last, D.TODAY) > 120],
  red: ['Vole crna vina', (g) => g.wines.some((w) => ['Furia', 'Avia', 'Gora Crveno'].includes(w))],
  stays: ['Bili u apartmanima', (g, s) => s.byCat.stay > 0],
  noconsent: ['Bez marketinške saglasnosti', (g) => !g.consents.email && !g.consents.push],
};

function filteredGuests() {
  const f = ui.guestFilter;
  const q = f.q.trim().toLowerCase();
  return state.guests
    .map((g) => ({ g, s: guestStats(g) }))
    .filter(({ g, s }) => (f.tier === 'all' || (f.tier === 'vip' ? g.vip : g.tier === f.tier)) && SEGMENTS[f.segment][1](g, s) &&
      (!q || `${fullName(g)} ${g.memberNo} ${g.email} ${g.phone}`.toLowerCase().includes(q)))
    .sort((a, b) => b.s.spend - a.s.spend);
}

function pageGuests() {
  const rows = filteredGuests();
  const f = ui.guestFilter;
  const consentIcons = (c) => [['push', 'notifications'], ['email', 'mail'], ['sms', 'chatbox']].map(([k, i]) => `<ion-icon name="${i}${c[k] ? '' : '-outline'}" title="${k}" style="color:${c[k] ? 'var(--gold-antique)' : '#ddd3c2'};font-size:15px"></ion-icon>`).join(' ');
  return `
  ${pageHead('Gosti', `${n0(D.programme.members)} članova u klubu. Prikazano je ${state.guests.length} sa punim demo profilima.`, ['§1 Profili', '§6 CRM'], exportButtons('guests'))}
  <div class="card" style="padding:14px 16px">
    <div class="row wrap">
      <input class="input" style="flex:1;min-width:200px" placeholder="Pretraga po imenu, broju kartice, emailu, telefonu" data-bind-ui="guestFilter.q" value="${esc(f.q)}">
      <div class="seg">${['all', ...TIER_ORDER, 'vip'].map((t) => `<button data-action="guest-tier" data-v="${t}" class="${f.tier === t ? 'on' : ''}">${t === 'all' ? 'Svi' : t === 'vip' ? 'VIP' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <select class="input" data-bind-ui="guestFilter.segment">${Object.entries(SEGMENTS).map(([k, [l]]) => `<option value="${k}" ${f.segment === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Gost</th><th>Nivo</th><th class="right">Bodovi</th><th class="right">Posete</th><th class="right">Ukupna potrošnja</th><th>Najčešće</th><th>Poslednja poseta</th><th>Saglasnosti</th></tr></thead>
      <tbody>${rows.map(({ g, s }) => `
        <tr class="click" data-action="open-guest" data-id="${g.id}">
          <td><div class="row"><span class="avatar">${initials(g)}</span><div><div>${esc(fullName(g))} ${vipBadge(g)} ${g.allergens.length ? `<ion-icon name="warning" class="danger" title="Alergeni"></ion-icon>` : ''}</div><div class="small dim mono">${g.memberNo} · ${esc(g.email)}</div></div></div></td>
          <td>${tierBadge(g.tier)}</td>
          <td class="right num">${n0(g.points)}</td>
          <td class="right num">${s.visits}</td>
          <td class="right num">${rsd(s.spend)}</td>
          <td>${s.top ? `<span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(s.top).color}"></span>${cat(s.top).label}</span>` : ''}</td>
          <td class="small ${daysBetween(s.last, D.TODAY) > 120 ? 'danger' : 'muted'}">${fmtDate(s.last)}</td>
          <td>${consentIcons(g.consents)}</td>
        </tr>`).join('') || `<tr><td colspan="8" class="empty">Nijedan gost ne odgovara filterima</td></tr>`}</tbody>
    </table></div>
  </div>`;
}

function renderDrawer() {
  const g = ui.drawerGuest && guestById(ui.drawerGuest);
  const el = $('#drawer');
  if (!g) {
    el.classList.remove('open');
    $('#scrim').classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    return;
  }
  const s = guestStats(g);
  const res = state.reservations.filter((r) => r.guestId === g.id);
  const fb = state.feedback.filter((f) => f.guestId === g.id);
  const next = state.rules.tiers.find((t) => t.minPoints > g.points);
  const cur = tierRule(g.tier);
  const prog = next ? (g.points - cur.minPoints) / (next.minPoints - cur.minPoints) : 1;
  const age = (d) => d && `${fmtDate(d).replace(/ \d{4}$/, '')}`;
  const canEdit = ['management', 'reception'].includes(state.role);
  const pending = state.dataRequests.find((r) => r.guestId === g.id && !r.done);

  el.innerHTML = `
    <div class="drawer-head">
      <div class="row between"><span class="caption dim">Profil gosta</span><button class="icon-btn" data-action="close-drawer" aria-label="Zatvori"><ion-icon name="close"></ion-icon></button></div>
      <div class="row mt"><span class="avatar lg">${initials(g)}</span><div>
        <div class="h1" style="font-size:26px;line-height:32px">${esc(fullName(g))}</div>
        <div class="row" style="gap:8px;margin-top:4px">${tierBadge(g.tier)} ${vipBadge(g)} <span class="small dim mono">${g.memberNo}</span></div>
      </div></div>
    </div>
    <div class="drawer-body">
      <div class="grid g3" style="gap:10px">
        ${[['Bodovi', n0(g.points)], ['Posete', s.visits], ['Potrošnja', mrsd(s.spend)]].map(([l, v]) => `<div class="card" style="padding:14px"><div class="caption dim">${l}</div><div style="font:300 24px/30px var(--display);margin-top:4px" class="num">${v}</div></div>`).join('')}
      </div>
      <div class="card">
        <div class="row between small"><span>${cur.discount}% članski popust</span><span class="muted">${next ? `još ${n0(next.minPoints - g.points)} bod. do ${next.id}` : 'Najviši nivo'}</span></div>
        <div class="track mt" style="margin-top:8px"><div style="width:${Math.min(100, prog * 100)}%"></div></div>
        <div class="caption dim mt">Potrošnja po segmentima</div>
        <div class="mt">${hbars(D.CATEGORIES.map((c) => ({ label: c.label, color: c.color, value: s.byCat[c.id] })), { labelW: 120 })}</div>
      </div>
      <div class="card">
        <div class="caption dim">Kontakt i profil</div>
        <dl class="kv mt">
          <dt>Email</dt><dd>${esc(g.email)}</dd>
          <dt>Telefon</dt><dd>${esc(g.phone)}</dd>
          <dt>Član od</dt><dd>${fmtDate(g.joined)} · preko: ${g.source}</dd>
          <dt>Jezik</dt><dd>${g.language === 'sr' ? 'srpski' : 'engleski'}</dd>
          <dt>Rođendan</dt><dd>${age(g.birthday) || '<span class="dim">nije podeljen</span>'}</dd>
          <dt>Godišnjica</dt><dd>${age(g.anniversary) || '<span class="dim">nije podeljena</span>'}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="caption dim">Sklonosti</div>
        <dl class="kv mt">
          <dt>Omiljena vina</dt><dd>${g.wines.map((w) => `<span class="pill burgundy">${esc(w)}</span>`).join(' ')}</dd>
          <dt>Omiljena jela</dt><dd>${g.dishes.map((w) => `<span class="pill">${esc(w)}</span>`).join(' ')}</dd>
          <dt>Ishrana</dt><dd>${g.diet.length ? g.diet.map(esc).join(', ') : '<span class="dim">bez ograničenja</span>'}</dd>
          <dt>Alergeni</dt><dd>${g.allergens.length ? g.allergens.map((a) => `<span class="allergen"><ion-icon name="warning"></ion-icon>${esc(a)}</span>`).join(' ') : '<span class="dim">nema</span>'}</dd>
          <dt>Apartman</dt><dd>${g.apartment ? esc(g.apartment) : '<span class="dim">bez preferencije</span>'}</dd>
          <dt>Napomena osoblja</dt><dd>${g.notes ? esc(g.notes) : '<span class="dim">—</span>'}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="caption dim">Rezervacije i boravci</div>
        <div class="list mt">${res.length ? res.map((r) => `<div class="list-item small"><span class="cat-dot" style="background:${cat(r.kind === 'restaurant' ? 'restaurant' : r.kind).color}"></span>${r.kind === 'stay' ? `${esc(r.apartment)} · ${r.nights} ${plural(r.nights, 'noć', 'noći', 'noći')}` : r.kind === 'tasting' ? esc(r.experience) : `Restoran · ${r.guests} ${plural(r.guests, 'gost', 'gosta', 'gostiju')}`}<span class="muted" style="margin-left:auto">${fmtDate(r.date)} ${r.kind !== 'stay' ? r.time : ''}</span><span class="pill ${r.status === 'confirmed' ? 'green' : r.status === 'pending' ? 'gold' : ''}">${RES_STATUS[r.status]}</span></div>`).join('') : '<div class="small dim">Nema predstojećih</div>'}
        ${s.tx.filter((t) => t.category === 'stay').slice(0, 3).map((t) => `<div class="list-item small"><span class="cat-dot" style="background:${cat('stay').color}"></span>${esc(t.title)}<span class="muted" style="margin-left:auto">${fmtDate(t.date)}</span><span class="pill">raniji boravak</span></div>`).join('')}</div>
      </div>
      <div class="card">
        <div class="caption dim">Transakcije i bodovi</div>
        <div class="list mt">${s.tx.slice(0, 8).map((t) => `<div class="list-item small"><span class="cat-dot" style="background:${cat(t.category).color}"></span><div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div><div class="dim">${fmtDate(t.date, true)} · ${esc(t.receiptNo)}</div></div><div style="text-align:right"><div class="num">${rsd(t.amount)}</div><div class="antique num">${t.points ? `+${t.points} bod.` : ''}${t.discount ? ` · −${rsd(t.discount)}` : ''}</div></div></div>`).join('') || '<div class="small dim">Još nema kupovina</div>'}</div>
      </div>
      <div class="card">
        <div class="caption dim">Utisci i komunikacija</div>
        <div class="list mt">${fb.slice(0, 4).map((f) => `<div class="list-item small" style="align-items:flex-start"><div style="flex:1">${stars(f.rating)} <span class="dim">${cat(f.category).label} · ${fmtDate(f.date)}</span><div>${esc(f.comment) || '<span class="dim">Bez komentara</span>'}</div></div></div>`).join('') || '<div class="small dim">Još nije popunio anketu</div>'}
          <div class="list-item small"><ion-icon name="mail-open-outline" class="antique"></ion-icon>Otvorio 6 od poslednjih 8 kampanja</div>
        </div>
      </div>
      <div class="card">
        <div class="caption dim">Saglasnosti</div>
        <div class="list mt">${[['push', 'Push obaveštenja'], ['email', 'Email novosti i ponude'], ['sms', 'SMS'], ['personalized', 'Personalizovane ponude na osnovu kupovina']].map(([k, l]) => `<div class="list-item small">${l}<span style="margin-left:auto" class="pill ${g.consents[k] ? 'green' : ''}">${g.consents[k] ? 'Data' : 'Nije data'}</span></div>`).join('')}</div>
        <p class="small dim" style="margin:10px 0 0">Gosti ih sami menjaju u aplikaciji. Svaka promena se beleži sa vremenom, zbog GDPR-a.</p>
      </div>
      ${canEdit ? `
      <div class="card">
        <div class="caption dim">Ručne izmene</div>
        <form class="row wrap mt" data-form="award" data-id="${g.id}">
          <input class="input num-in" name="points" type="number" value="250" step="50">
          <input class="input" style="flex:1;min-width:140px" name="reason" placeholder="Razlog (obavezno)" required>
          <button class="btn sm">Dodeli bodove</button>
        </form>
        <div class="row between mt"><span class="small">VIP status</span>${toggle(`data-action="toggle-vip" data-id="${g.id}"`, g.vip)}</div>
        <div class="row between mt"><span class="small">Ručna promena nivoa</span><select class="input" data-action-change="set-tier" data-id="${g.id}">${TIER_ORDER.map((t) => `<option ${g.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="row wrap mt">
          <button class="btn quiet sm" data-action="gdpr-export" data-id="${g.id}"><ion-icon name="download-outline"></ion-icon>Izvezi podatke gosta</button>
          <button class="btn danger sm" data-action="gdpr-erase" data-id="${g.id}" ${pending?.kind === DELETE_REQ ? 'disabled' : ''}><ion-icon name="trash-outline"></ion-icon>${pending?.kind === DELETE_REQ ? 'Brisanje zatraženo' : 'Obriši na zahtev'}</button>
        </div>
        <p class="small dim" style="margin:10px 0 0">Svaka ručna izmena se upisuje u dnevnik izmena sa vašim imenom.</p>
      </div>` : ''}
    </div>`;
  el.classList.add('open');
  $('#scrim').classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}

/* ───────────── Reservations ───────────── */

function pageReservations() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date('2026-10-21T12:00:00'); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
  const dayRes = state.reservations.filter((r) => r.kind === 'restaurant' && r.date === ui.resDay && r.status !== 'cancelled');
  const pending = state.reservations.filter((r) => r.status === 'pending');
  const covers = dayRes.reduce((a, r) => a + r.guests, 0);
  const CAP = 16; // covers per half-hour seating
  const label = (d) => new Date(d + 'T12:00:00').toLocaleDateString('sr-Latn-RS', { weekday: 'short', day: 'numeric' });
  const closed = [1, 2].includes(new Date(ui.resDay + 'T12:00:00').getDay());
  const bookingChip = (r) => {
    const g = guestById(r.guestId);
    return `<button class="booking ${r.status}" data-action="edit-res" data-id="${r.id}"><span class="covers">${r.guests}</span>${esc(fullName(g))} ${tierBadge(g.tier)}${g.allergens.length ? `<ion-icon name="warning" class="danger" title="${esc(g.allergens.join(', '))}"></ion-icon>` : ''}${r.note ? `<span class="small dim">${esc(r.note)}</span>` : ''}${r.status === 'pending' ? '<span class="pill gold">čeka</span>' : ''}</button>`;
  };
  return `
  ${pageHead('Rezervacije', 'Stolovi u restoranu se potvrđuju odmah. Degustacije, smeštaj i velike grupe stižu kao zahtevi koje tim odobrava. Svaka rezervacija je vezana za profil gosta u klubu.', ['§7 Rezervacije', 'Modularno: restoran · degustacije · smeštaj'],
    `<button class="btn" data-action="new-res"><ion-icon name="add"></ion-icon>Nova rezervacija</button>`)}
  <div class="grid g3">
    <div class="card span2">
      <div class="row between wrap">
        <div class="seg">${days.map((d) => `<button data-action="res-day" data-v="${d}" class="${ui.resDay === d ? 'on' : ''}">${d === '2026-10-21' ? 'Danas' : label(d)}</button>`).join('')}</div>
        <span class="small muted">${closed ? 'Restoran ne radi' : `${covers} ${plural(covers, 'gost', 'gosta', 'gostiju')} · ${dayRes.length} ${plural(dayRes.length, 'sto', 'stola', 'stolova')}`}</span>
      </div>
      ${closed ? `<div class="empty">Restoran radi od srede do nedelje, 12:00 – 23:00.</div>` : `
      <div class="slots mt">${['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((slot) => {
        const here = dayRes.filter((r) => r.time === slot);
        const c = here.reduce((a, r) => a + r.guests, 0);
        return `<div class="slot-time">${slot}</div><div class="slot-row">${here.map(bookingChip).join('')}<div class="cap" title="${c} / ${CAP} gostiju"><div style="width:${Math.min(100, (c / CAP) * 100)}%"></div></div></div>`;
      }).join('')}</div>`}
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><h2 class="h2">Zahtevi</h2><span class="pill gold">${pending.length} na čekanju</span></div>
        <div class="list">${pending.map((r) => {
          const g = guestById(r.guestId);
          return `<div class="list-item" style="align-items:flex-start;flex-direction:column;gap:8px">
            <div class="row" style="width:100%"><span class="cat-dot" style="background:${cat(r.kind).color}"></span><div style="flex:1"><div class="h3">${r.kind === 'stay' ? esc(r.apartment) : r.kind === 'tasting' ? esc(r.experience) : `Sto za ${r.guests}`}</div>
              <div class="small muted">${fmtDate(r.date)}${r.kind === 'stay' ? ` · ${r.nights} ${plural(r.nights, 'noć', 'noći', 'noći')}` : ` · ${r.time}`} · ${r.guests} ${plural(r.guests, 'gost', 'gosta', 'gostiju')}</div></div></div>
            <div class="row small" style="gap:6px"><a href="#" data-action="open-guest" data-id="${g.id}" class="antique">${esc(fullName(g))}</a>${tierBadge(g.tier)}</div>
            ${r.note ? `<div class="small muted">“${esc(r.note)}”</div>` : ''}
            <div class="row"><button class="btn sm" data-action="res-approve" data-id="${r.id}">Potvrdi</button><button class="btn ghost sm" data-action="res-decline" data-id="${r.id}">Odbij</button></div>
          </div>`;
        }).join('') || '<div class="empty small">Svi zahtevi su obrađeni</div>'}</div>
      </div>
      <div class="card">
        <div class="caption dim">Automatski podsetnici</div>
        <div class="list mt small">
          <div class="list-item"><ion-icon name="notifications-outline" class="antique"></ion-icon>Push 24 h pre rezervacije stola</div>
          <div class="list-item"><ion-icon name="mail-outline" class="antique"></ion-icon>Email 3 dana pre dolaska</div>
          <div class="list-item"><ion-icon name="star-outline" class="antique"></ion-icon>Anketa sledećeg jutra</div>
        </div>
      </div>
    </div>
  </div>`;
}

function resModal(r) {
  const isNew = !r;
  r ??= { kind: 'restaurant', date: ui.resDay, time: '19:00', guests: 2, guestId: state.guests[0].id, note: '' };
  openModal(`
    <form data-form="res" data-id="${isNew ? '' : r.id}">
      <div class="row between"><h2 class="h2">${isNew ? 'Nova rezervacija' : 'Rezervacija'}</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <div class="grid g2 mt">
        <label class="field span2"><span>Gost</span><select class="input" name="guestId">${state.guests.map((g) => `<option value="${g.id}" ${g.id === r.guestId ? 'selected' : ''}>${esc(fullName(g))} · ${g.memberNo}</option>`).join('')}</select></label>
        <label class="field"><span>Datum</span><input class="input" type="date" name="date" value="${r.date}"></label>
        <label class="field"><span>Vreme</span><select class="input" name="time">${['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((t) => `<option ${t === r.time ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Broj gostiju</span><input class="input" type="number" min="1" max="20" name="guests" value="${r.guests}"></label>
        <label class="field"><span>Status</span><select class="input" name="status">${['confirmed', 'pending'].map((s) => `<option value="${s}" ${s === (r.status || 'confirmed') ? 'selected' : ''}>${RES_STATUS[s]}</option>`).join('')}</select></label>
        <label class="field span2"><span>Posebni zahtevi</span><input class="input" name="note" value="${esc(r.note)}" placeholder="Sto uz prozor, stolica za bebu, proslava…"></label>
      </div>
      <div class="row between mt-lg">
        ${isNew ? '<span></span>' : `<button type="button" class="btn danger sm" data-action="res-cancel" data-id="${r.id}">Otkaži rezervaciju</button>`}
        <button class="btn">${isNew ? 'Rezerviši' : 'Sačuvaj izmene'}</button>
      </div>
    </form>`);
}

/* ───────────── Campaigns ───────────── */

function audienceEstimate(f) {
  const tierShare = TIER_ORDER.filter((t) => f.tiers.includes(t)).reduce((a, t) => a + D.programme.tierCounts[t], 0);
  let n = tierShare;
  if (f.inactive) n *= 0.19;
  if (f.interest === 'red') n *= 0.46;
  if (f.interest === 'white') n *= 0.52;
  if (f.interest === 'stays') n *= 0.31;
  if (f.birthday) n *= 0.085;
  const reach = Math.max(...f.channels.map((c) => D.programme.consents[c] ?? 0), 0);
  return { total: Math.round(n), reachable: Math.round(n * reach) };
}

function pageCampaigns() {
  const sent = state.campaigns.filter((c) => c.opened != null);
  const avgOpen = sent.reduce((a, c) => a + c.opened, 0) / sent.length;
  const revenue = sent.reduce((a, c) => a + (c.revenue || 0), 0);
  const chan = { push: 'notifications-outline', email: 'mail-outline', sms: 'chatbox-outline' };
  const statusPill = { Sent: '', Running: 'green', Scheduled: 'gold', Draft: 'outline' };
  return `
  ${pageHead('Kampanje', 'Push, email i SMS članovima koji su dali saglasnost. Izaberite segment, zakažite slanje i pratite rezultate.', ['§8 Komunikacija i promocije', '§12 Povratak gostiju · rani pristup'],
    `<button class="btn" data-action="new-campaign"><ion-icon name="add"></ion-icon>Nova kampanja</button>`)}
  <div class="grid g4">
    <div class="card kpi"><div class="caption dim">Dostupni putem push-a</div><div class="value num">${pct(D.programme.consents.push)}</div><div class="delta">${n0(D.programme.members * D.programme.consents.push)} članova</div></div>
    <div class="card kpi"><div class="caption dim">Email saglasnost</div><div class="value num">${pct(D.programme.consents.email)}</div><div class="delta">SMS ${pct(D.programme.consents.sms)}</div></div>
    <div class="card kpi"><div class="caption dim">Prosečna stopa otvaranja</div><div class="value num">${pct(avgOpen)}</div><div class="delta">Poslednjih ${sent.length} kampanja</div></div>
    <div class="card kpi"><div class="caption dim">Prihod od kampanja</div><div class="value num">${mrsd(revenue)}</div><div class="delta">Računi na kojima je ponuda iskorišćena</div></div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Kampanja</th><th>Kanali</th><th>Segment</th><th class="right">Publika</th><th>Kada</th><th class="right">Otvoreno</th><th class="right">Konverzija</th><th class="right">Prihod</th><th>Status</th></tr></thead>
      <tbody>${state.campaigns.map((c) => `
        <tr><td><div>${esc(c.name)}</div><div class="small dim">${esc(c.kind)}${c.note ? ` · ${esc(c.note)}` : ''}</div></td>
        <td>${c.channels.map((x) => `<ion-icon name="${chan[x]}" title="${x}" style="color:var(--gold-antique);font-size:16px"></ion-icon>`).join(' ')}</td>
        <td class="small muted">${esc(c.segment)}</td>
        <td class="right num">${n0(c.audience)}</td>
        <td class="small">${fmtDate(c.date, true)}</td>
        <td class="right num">${c.opened != null ? pct(c.opened) : '—'}</td>
        <td class="right num">${c.converted != null ? pct(c.converted) : '—'}</td>
        <td class="right num">${c.revenue ? mrsd(c.revenue) : '—'}</td>
        <td><span class="pill ${statusPill[c.status]}">${CAMPAIGN_STATUS[c.status]}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Automatske poruke</h2><span class="small muted">Šalju se same kada su uključene</span></div>
    <div class="list">${state.automations.map((a) => `
      <div class="list-item">
        <div style="flex:1"><div class="h3">${esc(a.name)}</div><div class="small muted">${esc(a.trigger)} · ${a.channels.map((x) => `<ion-icon name="${chan[x]}" style="vertical-align:-2px"></ion-icon>`).join(' ')}</div></div>
        <span class="small dim num" style="width:120px;text-align:right">${a.active ? `${n0(a.sent30)} poslato za 30 dana` : 'Isključeno'}</span>
        ${toggle(`data-action="toggle-auto" data-id="${a.id}"`, a.active)}
      </div>`).join('')}</div>
  </div>`;
}

function campaignModal(preset) {
  const f = {
    name: preset === 'inactive' ? 'Nedostajete nam: čaša vina je na nama' : '',
    channels: preset === 'inactive' ? ['email', 'push'] : ['push'],
    tiers: [...TIER_ORDER],
    inactive: preset === 'inactive',
    interest: 'any',
    birthday: false,
    title: preset === 'inactive' ? 'Dugo se nismo videli' : '',
    body: preset === 'inactive' ? 'Čaša vina po izboru je na nama uz sledeću večeru. Važi do 30. novembra.' : '',
    date: '2026-10-28T10:00',
  };
  ui.campaignDraft = f;
  drawCampaignModal();
}
function drawCampaignModal() {
  const f = ui.campaignDraft;
  const est = audienceEstimate(f);
  openModal(`
    <form data-form="campaign">
      <div class="row between"><h2 class="h2">Nova kampanja</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <label class="field mt"><span>Naziv</span><input class="input" name="name" value="${esc(f.name)}" placeholder="Pozivnica za jesenju večeru" required data-camp="name"></label>
      <div class="field mt"><span>Kanali</span><div class="row wrap">${['push', 'email', 'sms'].map((c) => `<label class="check"><input type="checkbox" data-camp-list="channels" value="${c}" ${f.channels.includes(c) ? 'checked' : ''}>${c === 'sms' ? 'SMS' : c[0].toUpperCase() + c.slice(1)}</label>`).join('')}</div></div>
      <div class="field mt"><span>Kome</span><div class="row wrap">${TIER_ORDER.map((t) => `<label class="check"><input type="checkbox" data-camp-list="tiers" value="${t}" ${f.tiers.includes(t) ? 'checked' : ''}>${t[0].toUpperCase() + t.slice(1)}</label>`).join('')}</div></div>
      <div class="grid g2 mt">
        <label class="field"><span>Interesovanje</span><select class="input" data-camp="interest">${[['any', 'Bilo koje'], ['red', 'Vole crna vina'], ['white', 'Vole bela vina'], ['stays', 'Već su odsedali kod nas']].map(([v, l]) => `<option value="${v}" ${f.interest === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Vreme slanja</span><input class="input" type="datetime-local" data-camp="date" value="${f.date}"></label>
      </div>
      <div class="row wrap mt"><label class="check"><input type="checkbox" data-camp-bool="inactive" ${f.inactive ? 'checked' : ''}>Bez posete 120+ dana</label><label class="check"><input type="checkbox" data-camp-bool="birthday" ${f.birthday ? 'checked' : ''}>Rođendan ovog meseca</label></div>
      <div class="notice info mt"><ion-icon name="people"></ion-icon><div><b class="num">${n0(est.reachable)}</b> članova će je primiti <span class="dim">(odgovara ${n0(est.total)}, ostali nisu dali saglasnost za ove kanale)</span></div></div>
      <div class="grid g2 mt">
        <label class="field"><span>Naslov · SR</span><input class="input" data-camp="title" value="${esc(f.title)}"></label>
        <label class="field"><span>Naslov · EN</span><input class="input" placeholder="Popunjava se iz SR, može se menjati" value="${f.title ? 'We haven’t seen you in a while' : ''}"></label>
      </div>
      <label class="field mt"><span>Poruka</span><textarea class="input" rows="2" data-camp="body">${esc(f.body)}</textarea></label>
      <div class="row between mt-lg"><button type="button" class="btn ghost" data-action="save-campaign" data-status="Draft">Sačuvaj nacrt</button><button class="btn">Zakaži</button></div>
    </form>`);
}

/* ───────────── Feedback ───────────── */

function pageFeedback() {
  const fb = state.feedback;
  const byCat = D.CATEGORIES.map((c) => {
    const items = fb.filter((f) => f.category === c.id);
    return { label: c.label, color: c.color, value: items.length ? items.reduce((a, f) => a + f.rating, 0) / items.length : 0, n: items.length };
  });
  const areas = {};
  fb.forEach((f) => f.improve.forEach((a) => (areas[a] = (areas[a] || 0) + 1)));
  const avg = fb.reduce((a, f) => a + f.rating, 0) / fb.length;
  const low = fb.filter((f) => f.rating <= 3);
  const clicks = fb.filter((f) => f.clickedPublic).length;
  const cols = [['open', 'Otvoreno'], ['progress', 'U radu'], ['resolved', 'Rešeno']];
  return `
  ${pageHead('Utisci gostiju', 'Kratke ankete stižu automatski ujutru posle posete. Zatim pozivamo svakog gosta da oceni La Goru na Google-u ili Tripadvisor-u, bez obzira na ocenu koju je dao nama.', ['§9 Ocene i utisci', '§12 Upravljanje reklamacijama'])}
  <div class="grid g4">
    <div class="card kpi hero-tile"><img src="logo.svg" class="watermark" alt=""><div class="caption dim">Prosečna ocena</div><div class="value num">${avg.toLocaleString('sr-RS', { maximumFractionDigits: 2 })}<small>/ 5</small></div><div class="delta">${fb.length} anketa za 60 dana</div></div>
    <div class="card kpi"><div class="caption dim">Stopa odgovora</div><div class="value num">38%</div><div class="delta">+50 bodova za odgovor</div></div>
    <div class="card kpi"><div class="caption dim">Poziv za javnu recenziju</div><div class="value num">100%</div><div class="delta">Uključujući svih ${low.length} gostiju sa ocenom 1–3★</div></div>
    <div class="card kpi"><div class="caption dim">Ostavili recenziju</div><div class="value num">${pct(clicks / fb.length)}</div><div class="delta">Google & Tripadvisor</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="card-head"><h2 class="h2">Ocena po uslugama</h2></div>${hbars(byCat.map((r) => ({ ...r, extra: `${r.n} anketa` })), { fmt: (v) => `${v.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★`, max: 5 })}</div>
    <div class="card"><div class="card-head"><h2 class="h2">Šta poboljšati</h2><span class="small muted">Izbor gostiju</span></div>${hbars(Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), { fmt: (v) => `${v} ${plural(v, 'pominjanje', 'pominjanja', 'pominjanja')}`, labelW: 150 })}</div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Reklamacije</h2><span class="small muted">Kliknite na tiket da ga pomerite dalje</span></div>
    <div class="kanban">${cols.map(([id, l]) => `<div class="col"><div class="caption dim">${l} · ${state.complaints.filter((c) => c.status === id).length}</div>${state.complaints.filter((c) => c.status === id).map((c) => {
      const g = guestById(c.guestId);
      return `<div class="ticket"><div class="row" style="gap:6px"><span class="cat-dot" style="background:${cat(c.category).color}"></span><b style="font-weight:600">${esc(c.title)}</b></div>
        <div class="small muted" style="margin-top:4px">${esc(fullName(g))} · ${fmtDate(c.opened)} · ${esc(c.owner)}</div>
        ${id !== 'resolved' ? `<button class="btn quiet sm mt" style="margin-top:8px" data-action="complaint-next" data-id="${c.id}">${id === 'open' ? 'Preuzmi' : 'Reši'}</button>` : ''}</div>`;
    }).join('')}</div>`).join('')}</div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Najnoviji odgovori</h2></div>
    <div class="table-wrap"><table><thead><tr><th>Gost</th><th>Usluga</th><th>Ocena</th><th>Komentar</th><th>Poboljšati</th><th>Javna recenzija</th></tr></thead>
    <tbody>${fb.slice(0, 14).map((f) => { const g = guestById(f.guestId); return `<tr class="click" data-action="open-guest" data-id="${g.id}"><td class="small">${esc(fullName(g))}<div class="dim">${fmtDate(f.date)}</div></td><td><span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(f.category).color}"></span>${cat(f.category).label}</span></td><td>${stars(f.rating)}</td><td class="small">${esc(f.comment) || '<span class="dim">—</span>'}</td><td class="small muted">${f.improve.join(', ') || '—'}</td><td class="small">${f.clickedPublic ? `<span class="pill green">${f.clickedPublic}</span>` : '<span class="dim">pozvan</span>'}</td></tr>`; }).join('')}</tbody></table></div>
  </div>`;
}

/* ───────────── Discount ledger ───────────── */

function ledgerRows() {
  const l = ui.ledger;
  const q = l.q.trim().toLowerCase();
  return state.transactions
    .filter((t) => t.discount > 0 && (l.outlet === 'all' || t.category === l.outlet))
    .map((t) => ({ t, g: guestById(t.guestId) }))
    .filter(({ t, g }) => !q || `${fullName(g)} ${g.memberNo} ${t.receiptNo} ${t.title}`.toLowerCase().includes(q));
}
function pageDiscounts() {
  const rows = ledgerRows();
  const l = ui.ledger;
  const totalDisc = rows.reduce((a, r) => a + r.t.discount, 0);
  const totalAmt = rows.reduce((a, r) => a + r.t.amount, 0);
  return `
  ${pageHead('Evidencija popusta', 'Svaki odobreni popust, stavku po stavku: kada, kome, na kom računu i koliko. Upisuje se automatski pri zatvaranju računa.', ['§10 Kontrola popusta'], exportButtons('ledger'))}
  <div class="grid g3">
    <div class="card kpi"><div class="caption dim">Prikazani popusti</div><div class="value num">${rsd(totalDisc)}</div><div class="delta">${rows.length} ${plural(rows.length, 'račun', 'računa', 'računa')}</div></div>
    <div class="card kpi"><div class="caption dim">Na računima vrednim</div><div class="value num">${mrsd(totalAmt)}</div><div class="delta">Efektivna stopa ${pct(totalDisc / (totalAmt || 1), 1)}</div></div>
    <div class="card kpi"><div class="caption dim">Blokirani duplikati</div><div class="value num">${state.audit.filter((a) => a.what === 'Blokiran dupli račun').length + 3}</div><div class="delta">Isti račun skeniran dva puta ove godine</div></div>
  </div>
  <div class="card mt" style="padding:14px 16px">
    <div class="row wrap">
      <input class="input" style="flex:1;min-width:200px" placeholder="Pretraga po gostu, broju kartice, računu, stavci" data-bind-ui="ledger.q" value="${esc(l.q)}">
      <div class="seg" style="flex-wrap:wrap"><button data-action="ledger-outlet" data-v="all" class="${l.outlet === 'all' ? 'on' : ''}">Sve</button>${D.CATEGORIES.map((c) => `<button data-action="ledger-outlet" data-v="${c.id}" class="${l.outlet === c.id ? 'on' : ''}">${c.label}</button>`).join('')}</div>
    </div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Datum</th><th>Vreme</th><th>Gost</th><th>Račun</th><th>Mesto</th><th>Proizvod / usluga</th><th class="right">Iznos</th><th class="right">%</th><th class="right">Popust</th><th>Osoblje</th></tr></thead>
      <tbody>${rows.slice(0, l.limit).map(({ t, g }) => `
        <tr><td class="small num">${new Date(t.date).toLocaleDateString('sr-Latn-RS')}</td><td class="small num">${fmtTime(t.date)}</td>
        <td class="small"><a href="#" data-action="open-guest" data-id="${g.id}" class="antique">${esc(fullName(g))}</a><div class="dim mono">${g.memberNo}</div></td>
        <td class="mono small">${esc(t.receiptNo)}</td>
        <td><span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(t.category).color}"></span>${cat(t.category).label}</span></td>
        <td class="small">${esc(t.title)}</td>
        <td class="right num small">${rsd(t.amount)}</td><td class="right num small">${t.discountPct}%</td><td class="right num"><b>${rsd(t.discount)}</b></td>
        <td class="small muted">${esc(t.staff)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6">${rows.length} ${plural(rows.length, 'račun', 'računa', 'računa')}</td><td class="right num">${rsd(totalAmt)}</td><td></td><td class="right num">${rsd(totalDisc)}</td><td></td></tr></tfoot>
    </table></div>
    ${rows.length > l.limit ? `<div style="padding:14px;text-align:center" class="no-print"><button class="btn quiet sm" data-action="ledger-more">Prikaži još ${Math.min(60, rows.length - l.limit)}</button></div>` : ''}
  </div>`;
}

/* ───────────── Loyalty rules ───────────── */

function pageRules() {
  const r = state.rules;
  const ex = (() => {
    const amount = 20000, g = r.tiers.find((t) => t.id === 'gold');
    const d = r.discountOn.restaurant ? Math.round((amount * g.discount) / 100) : 0;
    return { amount, d, pts: Math.floor(((amount - d) / 100) * r.earn.restaurant) };
  })();
  const input = (path, val, attrs = '') => `<input class="input num-in" type="number" data-rule="${path}" value="${val}" ${attrs}>`;
  return `
  ${pageHead('Pravila kluba', 'Ovde se podešava sve o bodovima, nivoima, popustima i isteku. Izmene važe od sledećeg zatvorenog računa, bez programera.', ['§3 Popusti', '§4 Bodovi i nivoi', '§14 Samostalno upravljanje'],
    `<div class="notice ok" style="max-width:360px"><ion-icon name="calculator-outline"></ion-icon><div class="small">Večera od ${rsd(ex.amount)} za Gold člana: <b>−${rsd(ex.d)}</b> i <b>+${n0(ex.pts)} bodova</b></div></div>`)}
  <div class="grid g2">
    <div class="card">
      <div class="card-head"><h2 class="h2">Nivoi članstva</h2></div>
      <table><thead><tr><th style="padding-left:0">Nivo</th><th class="right">Od bodova</th><th class="right">Popust</th><th class="right">Članova</th></tr></thead>
      <tbody>${r.tiers.map((t, i) => `<tr><td style="padding-left:0">${tierBadge(t.id)}</td><td class="right">${input(`tiers.${i}.minPoints`, t.minPoints, i === 0 ? 'disabled' : 'step="500"')}</td><td class="right">${input(`tiers.${i}.discount`, t.discount, 'step="1" min="0" max="30"')} %</td><td class="right num">${n0(D.programme.tierCounts[t.id])}</td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="margin:12px 0 0">Članovi prelaze na viši nivo automatski čim pređu prag. Dobrodošlica: svaki novi član dobija ${input('welcomeDiscount', r.welcomeDiscount, 'style="width:60px"')} % i ${input('welcomePoints', r.welcomePoints, 'style="width:80px" step="50"')} bodova.</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Sticanje bodova i gde važi popust</h2></div>
      <table><thead><tr><th style="padding-left:0">Mesto</th><th class="right">Bodova / 100 RSD</th><th class="right">Članski popust</th></tr></thead>
      <tbody>${D.CATEGORIES.map((c) => `<tr><td style="padding-left:0"><span class="row small" style="gap:8px"><span class="cat-dot" style="background:${c.color}"></span>${c.label}</span></td><td class="right">${input(`earn.${c.id}`, r.earn[c.id], 'step="0.5" min="0"')}</td><td class="right"><span style="display:inline-flex">${toggle(`data-rule-bool="discountOn.${c.id}"`, r.discountOn[c.id])}</span></td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="margin:12px 0 0">Događaji se naplaćuju kroz ulaznice: bodovi da, članski popust ne. Privatni i korporativni događaji su uvek izuzeti (ispod).</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Bonus bodovi</h2></div>
      <div class="list">${r.bonuses.map((b, i) => `<div class="list-item"><div style="flex:1" class="small">${esc(b.name)}</div>${b.multiplier ? `<span class="pill gold">×${b.multiplier}</span>` : `${input(`bonuses.${i}.points`, b.points, 'step="50"')}<span class="small dim">bod.</span>`}${toggle(`data-rule-bool="bonuses.${i}.active"`, b.active)}</div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Istek i kombinovanje</h2></div>
      <div class="list">
        <div class="list-item small"><div style="flex:1">Bodovi važe</div>${input('validityMonths', r.validityMonths, 'step="6" min="6"')}<span class="dim">meseci</span></div>
        <div class="list-item small"><div style="flex:1">Podsetnik članu pre isteka</div>${input('expiryNoticeDays', r.expiryNoticeDays, 'step="5" min="0"')}<span class="dim">dana</span></div>
        <div class="list-item small" style="flex-wrap:wrap"><div style="flex:1;min-width:180px">Kada član ima i posebnu ponudu</div><div class="seg"><button data-action="stacking" data-v="best" class="${r.stacking === 'best' ? 'on' : ''}">Važi bolji popust</button><button data-action="stacking" data-v="add" class="${r.stacking === 'add' ? 'on' : ''}">Sabiraju se</button></div></div>
        ${r.stacking === 'add' ? `<div class="list-item small"><div style="flex:1">Najviše</div>${input('maxDiscount', r.maxDiscount, 'step="1"')}<span class="dim">% po stavci</span></div>` : ''}
      </div>
      <div class="caption dim mt-lg">Bez popusta na</div>
      <div class="row wrap mt" style="gap:8px">${r.exclusions.map((e, i) => `<span class="chip">${esc(e)}<button data-action="del-exclusion" data-i="${i}" aria-label="Ukloni"><ion-icon name="close"></ion-icon></button></span>`).join('')}</div>
      <form class="row mt" data-form="exclusion"><input class="input" style="flex:1" name="ex" placeholder="Dodajte izuzetak, npr. Magnum boce"><button class="btn quiet sm">Dodaj</button></form>
    </div>
  </div>
  <div class="notice info mt"><ion-icon name="shield-checkmark-outline"></ion-icon><div class="small">Zaštita od zloupotrebe je uvek uključena: QR kodovi se menjaju na 30 sekundi i potpisani su za svakog člana; jedan račun donosi bodove samo jednom; ručna dodela preko 1.000 bodova traži odobrenje menadžera; svaka izmena na ovoj strani je u dnevniku izmena.</div></div>`;
}

/* ───────────── Content ───────────── */

function pageContent() {
  const c = state.content;
  const img = (f) => `media/${f}`;
  return `
  ${pageHead('Sadržaj aplikacije', 'Šta gosti vide u aplikaciji: događaji, vina i ponude. Izmene su odmah vidljive u aplikaciji, na srpskom i engleskom.', ['§2 Sadržaj', '§12 Digitalna vinska karta · rani pristup'])}
  <div class="card flush">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Događaji</h2><button class="btn quiet sm" data-action="soon"><ion-icon name="add"></ion-icon>Novi događaj</button></div>
    <div class="table-wrap"><table><thead><tr><th>Događaj</th><th>Kada</th><th>Popunjeno</th><th>Jezici</th><th>Samo za članove</th><th>Objavljeno</th></tr></thead>
    <tbody>${c.events.map((e, i) => `<tr><td><div class="row"><img class="thumb" src="${img(e.img)}" alt=""><span>${esc(e.title)}</span></div></td><td class="small">${e.when}</td><td class="small num">${e.booked ?? '<span class="dim">slobodan ulaz</span>'}</td>
      <td><span class="pill ${e.sr ? 'green' : 'red'}">SR</span> <span class="pill ${e.en ? 'green' : 'red'}">EN</span></td>
      <td>${toggle(`data-content="events.${i}.membersOnly"`, e.membersOnly)}</td><td>${toggle(`data-content="events.${i}.published"`, e.published)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Vinska karta</h2><span class="small muted">Zalihe iz POS-a vinoteke</span></div>
    <div class="table-wrap"><table><thead><tr><th>Vino</th><th class="right">Cena</th><th class="right">Zaliha</th><th>Oznaka</th><th>Objavljeno</th></tr></thead>
    <tbody>${c.wines.map((w, i) => `<tr><td><div class="row"><img class="thumb tall" src="${img(w.img)}" alt=""><div><div>${esc(w.name)}</div><div class="small dim">${esc(w.variety)}</div></div></div></td><td class="right num">${rsd(w.price)}</td>
      <td class="right num ${w.stock < 60 ? 'danger' : ''}">${w.stock}</td>
      <td>${w.limited ? '<span class="pill gold">Rani pristup: Gold+</span>' : ''}${w.award ? `<span class="pill">${esc(w.award)}</span>` : ''}</td>
      <td>${toggle(`data-content="wines.${i}.published"`, w.published)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

/* ───────────── Partners · Phase 2 ───────────── */

function pagePartners() {
  const markOf = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `
  ${pageHead('Partneri i Faza 2', 'Planirano za drugu fazu. Prikazano ovde da bi vlasnici videli kuda platforma ide dalje; model podataka to već podržava.', ['§11 Partnerski program', '§12 Dodatne funkcije'],
    `<button class="btn" data-action="add-partner"><ion-icon name="add"></ion-icon>Dodaj partnera</button>`)}
  <div class="grid g2">${state.partners.map((p) => `
    <div class="card">
      <div class="row"><span class="partner-mark">${esc(markOf(p.name))}</span><div style="flex:1"><div class="caption dim">${esc(p.kind)}</div><div class="h2" style="margin-top:2px">${esc(p.name)}</div></div><span class="pill gold">${esc(p.status)}</span></div>
      <p style="margin:16px 0">${esc(p.benefit)}</p>
      <div class="grid g3" style="gap:10px">
        ${[['Povezanih članova', p.members], ['Iskorišćenih pogodnosti', p.uses], ['Zajedničkih kampanja', 0]].map(([l, v]) => `<div style="background:var(--bg-warm);border-radius:12px;padding:10px 12px"><div class="caption dim" style="letter-spacing:1.4px">${l}</div><div style="font:300 22px/28px var(--display)" class="num">${v}</div></div>`).join('')}
      </div>
      <div class="row small muted mt"><ion-icon name="qr-code-outline" class="antique"></ion-icon>Članovi se identifikuju La Gora karticom na kasi partnera</div>
    </div>`).join('')}</div>
  <h2 class="h2 mt-lg">Dodatni moduli</h2>
  <div class="grid g4 mt">${[
    ['people-outline', 'Program preporuka', 'Član poziva prijatelja; oboje dobijaju bodove kada prijatelj obavi prvu kupovinu. Bonus pravilo već postoji u Pravilima kluba.', 'Faza 1'],
    ['gift-outline', 'Vaučeri i poklon kartice', 'Kupovina, slanje i iskorišćavanje digitalnih vaučera putem QR koda. Podrazumevano bez popusta.', 'Faza 1'],
    ['star-outline', 'VIP klub i rani pristup', 'Događaji samo za članove i limitirane serije prvo dostupni Gold i Platinum članovima.', 'Faza 1'],
    ['wallet-outline', 'Apple i Google Wallet', 'Članska kartica u novčaniku telefona, sa bodovima i nivoom koji se ažuriraju uživo. Apple Wallet već radi u aplikaciji.', 'Faza 1'],
    ['wine-outline', 'Wine Club', 'Tromesečna pretplata sa klupskim cenama i bocama samo za članove.', 'Faza 2'],
    ['cart-outline', 'Onlajn prodavnica', 'Poručivanje vina u aplikaciji, uz preuzimanje u vinariji ili dostavu. Bodovi i popusti važe.', 'Faza 2'],
    ['bed-outline', 'HotelSync PMS sinhronizacija', 'Boravci i potrošnja u sobi automatski stižu u profil gosta.', 'Faza 2'],
    ['sparkles-outline', 'Preporuke', 'Vina i doživljaji predloženi na osnovu istorije svakog gosta.', 'Faza 2'],
  ].map(([i, h, t, ph]) => `<div class="card module"><div class="row between"><ion-icon class="lead" name="${i}"></ion-icon><span class="pill ${ph === 'Faza 1' ? 'green' : ''}">${ph}</span></div><div class="h3" style="margin-top:12px">${h}</div><p class="small muted" style="margin:4px 0 0">${t}</p></div>`).join('')}</div>`;
}

/* ───────────── Team & data ───────────── */

function pageSecurity() {
  const pages = NAV.filter((n) => n.id);
  return `
  ${pageHead('Tim i podaci', 'Ko šta vidi, sve što je ko promenio i kako su podaci gostiju zaštićeni prema Zakonu o zaštiti podataka o ličnosti i GDPR-u.', ['§12 Korisničke uloge', '§13 Bezbednost i zaštita podataka'], `<button class="btn quiet" data-action="export-db"><ion-icon name="download-outline"></ion-icon>Izvezi celu bazu</button>`)}
  <div class="card flush">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Uloge</h2><span class="small muted">Promenite ulogu u bočnom meniju da vidite panel njihovim očima</span></div>
    <div class="table-wrap"><table class="matrix"><thead><tr><th>Oblast</th>${Object.values(D.ROLES).map((r) => `<th>${r.label}</th>`).join('')}</tr></thead>
    <tbody>${pages.map((p) => `<tr><td class="small">${p.label}</td>${Object.values(D.ROLES).map((r) => `<td>${r.pages.includes(p.id) ? '<ion-icon name="checkmark-circle"></ion-icon>' : '<span class="no">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>
  <div class="grid g2 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">Tim</h2></div>
      <div class="list">${D.staff.map((s) => `<div class="list-item small"><span class="avatar" style="width:30px;height:30px;font-size:12px">${s.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span><div style="flex:1">${esc(s.name)}<div class="dim">${D.ROLES[s.role].label}</div></div><span class="dim">${fmtDate(s.lastSeen, true)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Zaštita podataka</h2></div>
      <div class="list small">
        <div class="list-item"><ion-icon name="lock-closed-outline" class="antique"></ion-icon>Šifrovano u prenosu (TLS 1.3) i u skladištu (AES-256)</div>
        <div class="list-item"><ion-icon name="cloud-done-outline" class="antique"></ion-icon>Noćna rezervna kopija u 03:00, čuva se 30 dana, data centar u EU<span class="pill green" style="margin-left:auto">Danas ✓</span></div>
        <div class="list-item"><ion-icon name="refresh-outline" class="antique"></ion-icon>Vraćanje se testira mesečno; oporavak za najviše 4 sata</div>
        <div class="list-item"><ion-icon name="document-text-outline" class="antique"></ion-icon>Pravila kluba v1.2 · obaveštenje o privatnosti v1.1, prihvaćeni pri učlanjenju</div>
        <div class="list-item"><ion-icon name="key-outline" class="antique"></ion-icon>Podaci pripadaju La Gori i mogu se izvesti u svakom trenutku (CSV / Excel)</div>
      </div>
      <div class="caption dim mt-lg">Marketinška saglasnost</div>
      <div class="mt">${hbars([['Push', 'push'], ['Email', 'email'], ['Personalizovane ponude', 'personalized'], ['SMS', 'sms']].map(([label, k]) => ({ label, value: D.programme.consents[k] })), { fmt: (v) => pct(v), labelW: 140 })}</div>
    </div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Zahtevi u vezi sa podacima</h2><span class="small muted">Odgovor u roku od 30 dana</span></div>
    <div class="list">${state.dataRequests.map((r) => { const g = guestById(r.guestId); return `<div class="list-item small"><ion-icon name="${r.kind === DELETE_REQ ? 'trash-outline' : 'download-outline'}" class="antique"></ion-icon><div style="flex:1"><b style="font-weight:600">${esc(r.kind)}</b> · ${esc(fullName(g))} <span class="dim mono">${g.memberNo}</span><div class="dim">Primljeno ${fmtDate(r.at, true)}</div></div>${r.done ? '<span class="pill green">Rešeno</span>' : `<button class="btn quiet sm" data-action="dr-done" data-id="${r.id}">${r.kind === DELETE_REQ ? 'Anonimizuj' : 'Pošalji izvoz'}</button>`}</div>`; }).join('')}</div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Dnevnik izmena</h2>${exportButtons('audit')}</div>
    <div class="table-wrap"><table><thead><tr><th>Kada</th><th>Ko</th><th>Šta</th><th>Detalji</th></tr></thead>
    <tbody>${state.audit.slice(0, 40).map((a) => `<tr><td class="small num">${fmtDate(a.at, true)}</td><td class="small">${esc(a.who)}</td><td class="small">${esc(a.what)}</td><td class="small muted">${esc(a.target)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

/* ───────────── Render ───────────── */

let lastRoute = null;
const PAGES = { overview: pageOverview, checkout: pageCheckout, guests: pageGuests, reservations: pageReservations, campaigns: pageCampaigns, feedback: pageFeedback, discounts: pageDiscounts, rules: pageRules, content: pageContent, partners: pagePartners, security: pageSecurity };

function render() {
  const id = route();
  renderNav();
  const allowed = D.ROLES[state.role].pages.includes(id);
  const main = $('#main');
  // Keep focus and caret in a search box that re-renders the page on input.
  const active = document.activeElement;
  const bind = active?.dataset?.bindUi;
  const caret = bind ? active.selectionStart : null;
  main.classList.toggle('enter', lastRoute !== id);
  lastRoute = id;
  main.innerHTML = allowed
    ? PAGES[id]()
    : `<div class="locked"><ion-icon name="lock-closed-outline"></ion-icon><h1 class="h1" style="margin-top:12px">Nije dostupno za ulogu ${D.ROLES[state.role].label}</h1><p class="muted">Ova uloga može da otvori: ${D.ROLES[state.role].pages.map((p) => NAV.find((n) => n.id === p).label).join(', ')}.</p></div>`;
  if (bind) {
    const el = main.querySelector(`[data-bind-ui="${bind}"]`);
    if (el) { el.focus(); el.setSelectionRange?.(caret, caret); }
  }
  renderDrawer();
}

function openModal(html) {
  closeModal();
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.id = 'modal';
  scrim.innerHTML = `<div class="modal">${html}</div>`;
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) closeModal(); });
  document.body.appendChild(scrim);
  scrim.querySelector('input:not([type=checkbox]), select')?.focus();
}
function closeModal() { $('#modal')?.remove(); }

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
function getPath(obj, path) { return path.split('.').reduce((o, k) => o[k], obj); }

/* ───────────── Events ───────────── */

const actions = {
  'period': (el) => { ui.period = +el.dataset.v; render(); },
  'toggle-menu': () => $('#sidebar').classList.toggle('open'),
  'reset-demo': () => { if (confirm('Vratiti sve demo podatke na početno stanje?')) { state = freshState(); ui.pos = { guestId: null, tokenState: null, outlet: 'restaurant', lines: [], receiptNo: null, result: null }; save(); render(); toast('Demo podaci su vraćeni'); } },
  'open-guest': (el, e) => { e.preventDefault(); ui.drawerGuest = el.dataset.id; log('Otvoren profil gosta', `${guestById(el.dataset.id).memberNo} ${fullName(guestById(el.dataset.id))}`); save(); renderDrawer(); },
  'close-drawer': () => { ui.drawerGuest = null; renderDrawer(); },
  'close-modal': () => closeModal(),
  'export': (el) => exportFor(el.dataset.id, el.dataset.kind),
  'soon': () => toast('Uređivač se ovde otvara u punoj verziji', 'construct-outline'),

  'pos-scan': (el) => { ui.pos.guestId = el.dataset.id; ui.pos.tokenState = 'ok'; ui.pos.result = null; render(); },
  'pos-expired': () => { ui.pos.tokenState = 'expired'; log('Odbijen istekao QR kod', 'Verovatno snimak ekrana'); save(); render(); },
  'pos-clear': () => { Object.assign(ui.pos, { guestId: null, tokenState: null, lines: [], result: null }); render(); },
  'pos-outlet': (el) => { if (ui.pos.outlet !== el.dataset.v) { ui.pos.outlet = el.dataset.v; ui.pos.lines = []; } render(); },
  'pos-add': (el) => {
    const it = D.CATALOG[ui.pos.outlet][+el.dataset.i];
    const line = ui.pos.lines.find((l) => l.name === it.name);
    if (line) line.qty++; else ui.pos.lines.push({ ...it, qty: 1 });
    ui.pos.result = null;
    render();
  },
  'pos-qty': (el) => {
    const l = ui.pos.lines[+el.dataset.i];
    l.qty += +el.dataset.d;
    if (l.qty <= 0) ui.pos.lines.splice(+el.dataset.i, 1);
    render();
  },
  'pos-close': () => posClose(),

  'guest-tier': (el) => { ui.guestFilter.tier = el.dataset.v; render(); },
  'toggle-vip': (el) => { const g = guestById(el.dataset.id); g.vip = el.checked; log(g.vip ? 'Dodeljen VIP status' : 'Uklonjen VIP status', g.memberNo); save(); render(); toast(g.vip ? `${esc(g.first)} je sada VIP` : 'VIP status uklonjen', 'star'); },
  'gdpr-export': (el) => {
    const g = guestById(el.dataset.id);
    const data = { profile: g, transactions: guestStats(g).tx, reservations: state.reservations.filter((r) => r.guestId === g.id), feedback: state.feedback.filter((f) => f.guestId === g.id) };
    download(`${g.memberNo}-data.json`, JSON.stringify(data, null, 2), 'application/json');
    log('Izvezeni podaci gosta (GDPR)', g.memberNo);
    save();
  },
  'gdpr-erase': (el) => {
    const g = guestById(el.dataset.id);
    if (!confirm(`Zakazati brisanje za ${fullName(g)}? Transakcije ostaju anonimizovane zbog knjigovodstva.`)) return;
    state.dataRequests.unshift({ id: `dr${Date.now()}`, guestId: g.id, kind: DELETE_REQ, at: now(), done: false });
    log('Zakazano brisanje (GDPR)', g.memberNo);
    save();
    render();
  },

  'res-day': (el) => { ui.resDay = el.dataset.v; render(); },
  'new-res': () => resModal(null),
  'edit-res': (el) => resModal(state.reservations.find((r) => r.id === el.dataset.id)),
  'res-approve': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'confirmed'; log('Potvrđena rezervacija', `${r.kind} · ${guestById(r.guestId).memberNo} · ${r.date}`); save(); render(); toast('Potvrđeno, gost dobija push obaveštenje'); },
  'res-decline': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'cancelled'; log('Odbijena rezervacija', `${r.kind} · ${guestById(r.guestId).memberNo}`); save(); render(); toast('Odbijeno, gost je obavešten i ponuđeni su mu drugi termini', 'close-circle'); },
  'res-cancel': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'cancelled'; log('Otkazana rezervacija', `${guestById(r.guestId).memberNo} · ${r.date} ${r.time}`); save(); closeModal(); render(); toast('Rezervacija je otkazana'); },

  'new-campaign': (el) => { if (!D.ROLES[state.role].pages.includes('campaigns')) return toast('Kampanje su za marketing i upravu', 'lock-closed-outline'); campaignModal(el.dataset.preset); },
  'save-campaign': (el) => saveCampaign(el.dataset.status),
  'toggle-auto': (el) => { const a = state.automations.find((x) => x.id === el.dataset.id); a.active = el.checked; log(a.active ? 'Uključena automatska poruka' : 'Isključena automatska poruka', a.name); save(); render(); },

  'complaint-next': (el) => { const c = state.complaints.find((x) => x.id === el.dataset.id); c.status = c.status === 'open' ? 'progress' : 'resolved'; log(c.status === 'resolved' ? 'Rešena reklamacija' : 'Preuzeta reklamacija', c.title); save(); render(); },

  'ledger-outlet': (el) => { ui.ledger.outlet = el.dataset.v; ui.ledger.limit = 60; render(); },
  'ledger-more': () => { ui.ledger.limit += 60; render(); },

  'stacking': (el) => { state.rules.stacking = el.dataset.v; log('Promenjeno kombinovanje ponuda', el.dataset.v === 'best' ? 'Važi bolji popust' : 'Sabiraju se'); save(); render(); },
  'del-exclusion': (el) => { const [x] = state.rules.exclusions.splice(+el.dataset.i, 1); log('Uklonjen izuzetak od popusta', x); save(); render(); },

  'add-partner': () => openModal(`
    <form data-form="partner">
      <div class="row between"><h2 class="h2">Novi partner</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <label class="field mt"><span>Kompanija</span><input class="input" name="name" required></label>
      <label class="field mt"><span>Vrsta</span><input class="input" name="kind" placeholder="Banka, hotelska grupa, auto brend…"></label>
      <label class="field mt"><span>Pogodnost za članove</span><textarea class="input" name="benefit" rows="2" required></textarea></label>
      <div class="row mt-lg" style="justify-content:flex-end"><button class="btn">Dodaj partnera</button></div>
    </form>`),

  'dr-done': (el) => { const r = state.dataRequests.find((x) => x.id === el.dataset.id); r.done = true; log(r.kind === DELETE_REQ ? 'Član anonimizovan (GDPR)' : 'Poslat izvoz podataka (GDPR)', guestById(r.guestId).memberNo); save(); render(); },
  'export-db': () => { exportFor('guests', 'csv'); log('Izvezena cela baza', `${state.guests.length} profila`); save(); },
};

function exportFor(id, kind) {
  if (id === 'overview') {
    return exportRows(kind, 'lagora-club-mesecno', ['Mesec', 'Novi članovi', 'Aktivni članovi', 'Posete', ...D.CATEGORIES.map((c) => `${c.label} (RSD)`), 'Ukupna potrošnja (RSD)', 'Popusti (RSD)', 'Osvojeni bodovi', 'Iskorišćeni bodovi', 'Istekli bodovi'],
      D.monthly.map((m) => [m.month, m.newMembers, m.activeMembers, m.visits, ...D.CATEGORIES.map((c) => m.spend[c.id]), m.total, m.discounts, m.pointsEarned, m.pointsRedeemed, m.pointsExpired]));
  }
  if (id === 'guests') {
    return exportRows(kind, 'lagora-gosti', ['Broj kartice', 'Ime', 'Prezime', 'Email', 'Telefon', 'Nivo', 'VIP', 'Bodovi', 'Posete', 'Ukupna potrošnja (RSD)', 'Član od', 'Rođendan', 'Alergeni', 'Omiljena vina', 'Email saglasnost', 'Push saglasnost', 'SMS saglasnost'],
      filteredGuests().map(({ g, s }) => [g.memberNo, g.first, g.last, g.email, g.phone, g.tier, g.vip ? 'da' : '', g.points, s.visits, s.spend, g.joined, g.birthday || '', g.allergens.join('; '), g.wines.join('; '), g.consents.email ? 'da' : 'ne', g.consents.push ? 'da' : 'ne', g.consents.sms ? 'da' : 'ne']));
  }
  if (id === 'ledger') {
    return exportRows(kind, 'lagora-evidencija-popusta', ['Datum', 'Vreme', 'Broj kartice', 'Gost', 'Broj računa', 'Mesto', 'Proizvod / usluga', 'Iznos (RSD)', 'Popust %', 'Popust (RSD)', 'Osoblje'],
      ledgerRows().map(({ t, g }) => [new Date(t.date).toLocaleDateString('sr-Latn-RS'), fmtTime(t.date), g.memberNo, fullName(g), t.receiptNo, cat(t.category).label, t.title, t.amount, t.discountPct, t.discount, t.staff]));
  }
  if (id === 'audit') {
    return exportRows(kind, 'lagora-dnevnik-izmena', ['Kada', 'Ko', 'Šta', 'Detalji'], state.audit.map((a) => [new Date(a.at).toLocaleString('sr-Latn-RS'), a.who, a.what, a.target]));
  }
}

function saveCampaign(status) {
  const f = ui.campaignDraft;
  if (!f.name.trim()) return toast('Dajte kampanji naziv', 'alert-circle');
  const est = audienceEstimate(f);
  const seg = [f.tiers.length === 4 ? 'Svi nivoi' : f.tiers.map((t) => t[0].toUpperCase() + t.slice(1)).join(' + '), f.inactive && 'bez posete 120+ dana', f.birthday && 'rođendan ovog meseca', f.interest !== 'any' && { red: 'vole crna vina', white: 'vole bela vina', stays: 'već odsedali' }[f.interest]].filter(Boolean).join(' · ');
  state.campaigns.unshift({ id: `c${Date.now()}`, name: f.name, kind: f.inactive ? 'Ponovno aktiviranje' : 'Kampanja', channels: f.channels, segment: seg, audience: est.reachable, status, date: f.date, opened: null, converted: null, revenue: null });
  log(status === 'Draft' ? 'Sačuvan nacrt kampanje' : 'Zakazana kampanja', f.name);
  save();
  closeModal();
  if (route() !== 'campaigns') location.hash = '#/campaigns'; else render();
  toast(status === 'Draft' ? 'Nacrt je sačuvan' : `Zakazano za ${fmtDate(f.date, true)} · ${n0(est.reachable)} članova`);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // handled on change
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-action]')) return actions[el.dataset.action]?.(el, e);
  if (el.dataset.actionChange === 'set-tier') {
    const g = guestById(el.dataset.id);
    log('Ručno promenjen nivo', `${g.memberNo} ${g.tier} → ${el.value}`);
    g.tier = el.value;
    save();
    render();
    return toast(`${esc(g.first)}: novi nivo ${el.value}`);
  }
  if (el.id === 'role') {
    state.role = el.value;
    ui.drawerGuest = null;
    save();
    const allowed = D.ROLES[state.role].pages;
    if (!allowed.includes(route())) location.hash = `#/${allowed[0]}`;
    render();
    return toast(`Prikaz za ulogu: ${D.ROLES[state.role].label}`, 'person-circle-outline');
  }
  if (el.dataset.ruleBool) {
    setPath(state.rules, el.dataset.ruleBool, el.checked);
    log('Promenjeno pravilo kluba', `${el.dataset.ruleBool} → ${el.checked ? 'uključeno' : 'isključeno'}`);
    save();
    render();
    return toast('Sačuvano · važi od sledećeg računa');
  }
  if (el.dataset.rule) {
    const v = parseFloat(el.value);
    if (!Number.isFinite(v) || v < 0) { el.value = getPath(state.rules, el.dataset.rule); return; }
    const old = getPath(state.rules, el.dataset.rule);
    if (old === v) return;
    setPath(state.rules, el.dataset.rule, v);
    log('Promenjeno pravilo kluba', `${el.dataset.rule}: ${old} → ${v}`);
    save();
    render();
    return toast('Sačuvano · važi od sledećeg računa');
  }
  if (el.dataset.content) {
    setPath(state.content, el.dataset.content, el.checked);
    log('Izmenjen sadržaj aplikacije', el.dataset.content);
    save();
    return toast(el.checked ? 'Vidljivo u aplikaciji' : 'Sakriveno iz aplikacije');
  }
  if (el.dataset.campList) {
    const f = ui.campaignDraft;
    f[el.dataset.campList] = [...el.closest('.row').querySelectorAll('input:checked')].map((i) => i.value);
    return drawCampaignModal();
  }
  if (el.dataset.campBool) { ui.campaignDraft[el.dataset.campBool] = el.checked; return drawCampaignModal(); }
  if (el.dataset.camp === 'interest' || el.dataset.camp === 'date') { ui.campaignDraft[el.dataset.camp] = el.value; return drawCampaignModal(); }
  if (el.dataset.bindUi === 'guestFilter.segment') { ui.guestFilter.segment = el.value; render(); }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.bindUi && el.tagName === 'INPUT') { setPath(ui, el.dataset.bindUi, el.value); render(); }
  if (el.dataset.bindPos) { ui.pos[el.dataset.bindPos] = el.value; }
  if (el.dataset.camp === 'name' || el.dataset.camp === 'title' || el.dataset.camp === 'body') ui.campaignDraft[el.dataset.camp] = el.value;
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  const kind = form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (kind === 'scan') {
    const code = data.code.trim().toUpperCase();
    const g = state.guests.find((x) => x.memberNo === code || x.memberNo === `LG-${code.replace(/\D/g, '').padStart(5, '0')}`);
    Object.assign(ui.pos, g ? { guestId: g.id, tokenState: 'ok', result: null } : { tokenState: 'unknown' });
    return render();
  }
  if (kind === 'award') {
    const g = guestById(form.dataset.id);
    const pts = Math.round(+data.points);
    if (!pts || !data.reason.trim()) return;
    if (Math.abs(pts) > 1000 && state.role !== 'management') return toast('Preko 1.000 bodova mora da odobri menadžer', 'lock-closed-outline');
    g.points = Math.max(0, g.points + pts);
    const t = tierForPoints(g.points);
    if (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(g.tier)) { log('Automatski prelazak na viši nivo', `${g.memberNo} ${g.tier} → ${t}`); g.tier = t; }
    state.transactions.unshift({ id: `tx_${Date.now()}`, guestId: g.id, date: now(), category: 'event', title: `Ručno: ${data.reason}`, amount: 0, discountPct: 0, discount: 0, points: pts, receiptNo: `MANUAL-${Date.now() % 100000}`, staff: 'Admin' });
    log(`Dodeljeno ${n0(pts)} bodova`, `${g.memberNo} · ${data.reason}`);
    save();
    render();
    return toast(`+${n0(pts)} bodova za: ${esc(g.first)}`, 'sparkles');
  }
  if (kind === 'res') {
    const id = form.dataset.id;
    const r = id ? state.reservations.find((x) => x.id === id) : { id: `r${Date.now()}`, kind: 'restaurant' };
    Object.assign(r, { guestId: data.guestId, date: data.date, time: data.time, guests: +data.guests, status: data.status, note: data.note });
    if (!id) state.reservations.push(r);
    log(id ? 'Izmenjena rezervacija' : 'Napravljena rezervacija', `${guestById(r.guestId).memberNo} · ${r.date} ${r.time} · ${r.guests}`);
    ui.resDay = r.date;
    save();
    closeModal();
    render();
    return toast(id ? 'Rezervacija izmenjena, gost je obavešten' : 'Rezervisano, gostu je poslata potvrda');
  }
  if (kind === 'campaign') return saveCampaign('Scheduled');
  if (kind === 'exclusion') {
    const v = data.ex.trim();
    if (!v) return;
    state.rules.exclusions.push(v);
    log('Dodat izuzetak od popusta', v);
    save();
    render();
    return toast('Izuzetak je dodat');
  }
  if (kind === 'partner') {
    state.partners.push({ id: `p${Date.now()}`, name: data.name, kind: data.kind || 'Partner', status: 'Nacrt', benefit: data.benefit, members: 0, uses: 0 });
    log('Dodat partner', data.name);
    save();
    closeModal();
    render();
  }
});

// Tooltips for anything with data-tip.
const tip = $('#tooltip');
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) return tip.classList.remove('show');
  tip.innerHTML = el.dataset.tip;
  tip.classList.add('show');
});
document.addEventListener('mousemove', (e) => {
  if (!tip.classList.contains('show')) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.min(window.innerWidth - w - 8, e.clientX + 14)}px`;
  tip.style.top = `${Math.max(8, e.clientY - h - 12)}px`;
});

// Global guest search in the top bar.
const search = $('#global-search');
const results = $('#search-results');
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  if (q.length < 2) return results.classList.remove('open');
  const hits = state.guests.filter((g) => `${fullName(g)} ${g.memberNo} ${g.email} ${g.phone}`.toLowerCase().includes(q)).slice(0, 6);
  results.innerHTML = hits.length
    ? hits.map((g) => `<button data-action="open-guest" data-id="${g.id}"><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(g)}</span><div style="flex:1"><div>${esc(fullName(g))}</div><div class="small dim mono">${g.memberNo}</div></div>${tierBadge(g.tier)}</button>`).join('')
    : '<div class="empty small">Gost nije pronađen</div>';
  results.classList.add('open');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) results.classList.remove('open');
  else if (e.target.closest('[data-action="open-guest"]')) { results.classList.remove('open'); search.value = ''; }
  if (e.target.closest('.nav-item')) $('#sidebar').classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); ui.drawerGuest = null; renderDrawer(); results.classList.remove('open'); }
});

$('#today').textContent = D.TODAY.toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
render();
