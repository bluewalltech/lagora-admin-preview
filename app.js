import * as D from './data.js';

/* ───────────── State ───────────── */

const STORE_KEY = 'lagora-admin-v1';

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
      { id: 'dr1', guestId: guests[24].id, kind: 'Export my data', at: '2026-10-19T10:12:00', done: false },
      { id: 'dr2', guestId: guests[31].id, kind: 'Delete my account', at: '2026-10-17T16:40:00', done: false },
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
const OFFERS = [{ campaign: 'c2', item: 'Lupo 2024', pct: 20, label: 'For Grašac lovers: 20% off Lupo' }];

/* ───────────── Helpers ───────────── */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n0 = (n) => Math.round(n).toLocaleString('sr-RS');
const rsd = (n) => `${n0(n)} RSD`;
const mrsd = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('sr-RS', { maximumFractionDigits: 1 })} M RSD` : rsd(n));
const pct = (x, d = 0) => `${(x * 100).toLocaleString('sr-RS', { maximumFractionDigits: d })}%`;
const fmtDate = (iso, time = false) =>
  new Date(iso).toLocaleString('en-GB', time ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const cat = (id) => D.CATEGORIES.find((c) => c.id === id);
const guestById = (id) => state.guests.find((g) => g.id === id);
const fullName = (g) => `${g.first} ${g.last}`;
const initials = (g) => `${g.first[0]}${g.last[0]}`;
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
  return `<span class="stars" aria-label="${r} of 5">${'★'.repeat(r)}<span class="off">${'★'.repeat(5 - r)}</span></span>`;
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
  reception: { name: 'Recepcija', first: 'team' },
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
  { group: 'Insights' },
  { id: 'overview', label: 'Overview', icon: 'analytics-outline' },
  { group: 'Front of house' },
  { id: 'checkout', label: 'Checkout · POS', icon: 'qr-code-outline' },
  { id: 'reservations', label: 'Reservations', icon: 'calendar-outline', count: () => state.reservations.filter((r) => r.status === 'pending').length },
  { id: 'guests', label: 'Guests · CRM', icon: 'people-outline' },
  { group: 'Marketing' },
  { id: 'campaigns', label: 'Campaigns', icon: 'megaphone-outline' },
  { id: 'feedback', label: 'Feedback', icon: 'chatbubble-ellipses-outline', count: () => state.complaints.filter((c) => c.status === 'open').length },
  { id: 'content', label: 'App content', icon: 'images-outline' },
  { group: 'Programme' },
  { id: 'discounts', label: 'Discount ledger', icon: 'receipt-outline' },
  { id: 'rules', label: 'Loyalty rules', icon: 'options-outline' },
  { id: 'partners', label: 'Partners · Phase 2', icon: 'git-network-outline' },
  { id: 'security', label: 'Team & data', icon: 'shield-checkmark-outline' },
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
    return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span> vs previous ${n === 1 ? 'month' : `${n} months`}`;
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
  ${pageHead(`${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, ${me().first}`, 'How the La Gora Loyalty programme is performing across the restaurant, shop, apartments, tastings and events.', ['§10 Analytics & reporting'],
    `<div class="row wrap"><div class="seg">${[[1, '30 days'], [3, '90 days'], [12, '12 months']].map(([v, l]) => `<button data-action="period" data-v="${v}" class="${ui.period === v ? 'on' : ''}">${l}</button>`).join('')}</div>${exportButtons('overview')}</div>`)}

  <div class="grid g4">
    <div class="card kpi hero-tile">
      <img src="logo.svg" class="watermark" alt="">
      <div class="caption dim">Registered members</div>
      <div class="value num">${n0(D.programme.members)}</div>
      <div class="delta"><span class="up">+${n0(newM)}</span> new in the last ${n === 1 ? '30 days' : n === 3 ? '90 days' : '12 months'}</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Active members</div>
      <div class="value num">${n0(active)}<small>${pct(active / D.programme.members)} of base</small></div>
      <div class="delta">At least one visit in the last 30 days</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Member visits</div>
      <div class="value num">${n0(visits)}</div>
      <div class="delta">${delta((m) => m.visits) || '64% by returning members'}</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Member spend</div>
      <div class="value num">${mrsd(spend)}</div>
      <div class="delta">${delta((m) => m.total) || `${rsd(spend / visits)} per visit`}</div>
    </div>
  </div>

  <div class="grid g4 mt">
    <div class="card kpi">
      <div class="caption dim">Discounts granted</div>
      <div class="value num">${mrsd(disc)}</div>
      <div class="delta">${pct(disc / spend, 1)} of member spend · <a href="#/discounts" class="antique">ledger</a></div>
    </div>
    <div class="card kpi span2">
      <div class="caption dim">Points</div>
      <div class="row points-row" style="gap:18px;margin-top:8px">${[['Earned', earned, 'var(--gold-deep)'], ['Redeemed', redeemed, 'var(--gold-antique)'], ['Expired', expired, '#D8CDB8']].map(([l, v, c]) => `<div style="flex:1"><div class="num points-value">${n0(v)}</div><div class="small muted row" style="gap:6px"><span class="cat-dot" style="background:${c}"></span>${l}</div></div>`).join('')}</div>
      <div class="stacked" style="height:8px;margin-top:14px">${[[earned - redeemed - expired, 'var(--gold-deep)', 'Still on accounts'], [redeemed, 'var(--gold-antique)', 'Redeemed'], [expired, '#D8CDB8', 'Expired']].map(([v, c, l]) => `<div style="flex:${v};background:${c}" data-tip="<b>${l}</b><br>${n0(v)} points"></div>`).join('')}</div>
      <div class="delta">${pct(redeemed / earned)} redemption rate</div>
    </div>
    <div class="card kpi">
      <div class="caption dim">Repeat visits</div>
      <div class="value num">3.6<small>visits / member / year</small></div>
      <div class="delta">Non-members: 1.3 · <span class="up">2.8×</span></div>
    </div>
  </div>

  <div class="grid g2 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">New members by month</h2><span class="small muted">Nov 2025 – Oct 2026</span></div>
      ${barChart(D.monthly.map((m) => ({ label: m.month, value: m.newMembers })), { faded: (i) => i < 12 - n, unit: ' new members' })}
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Spending by category</h2><span class="small muted">${n === 12 ? 'Last 12 months' : `Last ${n === 1 ? '30' : '90'} days`}</span></div>
      ${hbars(byCat.map((r) => ({ ...r, extra: pct(r.value / spend) + ' of member spend' })), { fmt: mrsd })}
      <p class="small muted" style="margin:14px 0 0">Private and corporate events are billed outside the member discount and are not included.</p>
    </div>
  </div>

  <div class="grid g3 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">Members by tier</h2></div>
      <div class="stacked">${TIER_ORDER.map((t) => `<div style="flex:${D.programme.tierCounts[t]};background:${TIER_SEQ[t]}" data-tip="<b>${t}</b><br>${n0(D.programme.tierCounts[t])} members"></div>`).join('')}</div>
      <div class="list mt">${TIER_ORDER.map((t) => `<div class="list-item"><span class="cat-dot" style="background:${TIER_SEQ[t]}"></span>${tierBadge(t)}<span class="small muted">${tierRule(t).discount}% · from ${n0(tierRule(t).minPoints)} pts</span><span class="num" style="margin-left:auto">${n0(D.programme.tierCounts[t])}</span><span class="small dim num" style="width:42px;text-align:right">${pct(D.programme.tierCounts[t] / tierTotal)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Members vs non-members</h2></div>
      <div class="caption dim">Average bill</div>
      ${hbars([{ label: 'Members', value: D.programme.member.avgCheck, color: '#9A7420' }, { label: 'Non-members', value: D.programme.nonMember.avgCheck, color: '#D8CDB8' }], { labelW: 116 })}
      <div class="caption dim mt">Visits per year</div>
      ${hbars([{ label: 'Members', value: D.programme.member.visitsPerYear, color: '#9A7420' }, { label: 'Non-members', value: D.programme.nonMember.visitsPerYear, color: '#D8CDB8' }], { fmt: (v) => v.toLocaleString('sr-RS'), labelW: 116 })}
      <p class="small muted" style="margin:14px 0 0">Non-member figures come from POS bills closed without a card scan.</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Retention</h2><span class="small muted">Returned in month</span></div>
      <div class="heat" style="grid-template-columns: 74px repeat(6, 1fr)">
        <div></div>${[1, 2, 3, 4, 5, 6].map((i) => `<div class="small dim" style="text-align:center">+${i}</div>`).join('')}
        ${D.cohorts.map((c) => `<div class="small muted" style="align-self:center">${c.label.replace(' 2026', '')}<span class="dim"> · ${c.size}</span></div>${[0, 1, 2, 3, 4, 5].map((i) => {
          const v = c.ret[i];
          if (v == null) return '<div></div>';
          const a = 0.12 + (v - 0.25) * 2.4;
          return `<div class="cell" style="background:rgba(154,116,32,${a.toFixed(2)});color:${a > 0.62 ? '#fff' : 'var(--text)'};font-weight:${a > 0.62 ? 600 : 500}" data-tip="<b>${c.label} cohort</b><br>${pct(v)} came back in month +${i + 1}">${Math.round(v * 100)}</div>`;
        }).join('')}`).join('')}
      </div>
      <p class="small muted" style="margin:14px 0 0">Each newer cohort returns more often: month-one return rose from 46% to 57%.</p>
    </div>
  </div>

  <div class="grid g3 mt">
    <div class="card flush span2">
      <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Most valuable guests</h2><a class="small antique" href="#/guests">All guests</a></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Guest</th><th>Tier</th><th class="right">Visits</th><th class="right">Spend</th><th>Mostly</th><th>Frequency</th></tr></thead>
        <tbody>${top.map(({ g, s }) => {
          const trend = s.visits90 - s.visitsPrev90;
          return `<tr class="click" data-action="open-guest" data-id="${g.id}">
            <td><div class="row"><span class="avatar">${initials(g)}</span><div><div>${esc(fullName(g))} ${vipBadge(g)}</div><div class="small dim mono">${g.memberNo}</div></div></div></td>
            <td>${tierBadge(g.tier)}</td><td class="right num">${s.visits}</td><td class="right num">${rsd(s.spend)}</td>
            <td>${s.top ? `<span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(s.top).color}"></span>${cat(s.top).label}</span>` : ''}</td>
            <td class="small">${trend > 0 ? `<span class="success">▲ more often</span>` : trend < 0 ? `<span class="danger">▼ less often</span>` : '<span class="dim">steady</span>'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <div class="card" style="background:var(--surface-alt)">
      <ion-icon name="moon-outline" style="font-size:26px;color:var(--gold-antique)"></ion-icon>
      <h2 class="h2" style="margin-top:8px">${inactive} members haven't visited in 120 days</h2>
      <p class="muted small">Most of them joined during summer and came once for a tasting. A “glass on us” offer brought back 21% of a similar group in the spring.</p>
      <button class="btn mt" data-action="new-campaign" data-preset="inactive"><ion-icon name="megaphone-outline"></ion-icon>Create re-engagement campaign</button>
      <div class="caption dim mt-lg">Birthdays this week</div>
      <div class="list mt">${state.guests.slice(3, 6).map((g, i) => `<div class="list-item small"><span class="avatar" style="width:28px;height:28px;font-size:12px">${initials(g)}</span>${esc(fullName(g))}<span class="dim" style="margin-left:auto">${['Thu', 'Sat', 'Sun'][i]}</span></div>`).join('')}</div>
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
    else if (!discountable) why = `${cat(p.outlet).label}: no member discount`;
    else {
      linePct = tierPct;
      const offer = OFFERS.find((o) => o.item === l.name && g.id === 'mem_0001');
      if (offer) {
        linePct = state.rules.stacking === 'best' ? Math.max(tierPct, offer.pct) : Math.min(tierPct + offer.pct, state.rules.maxDiscount);
        why = state.rules.stacking === 'best' ? `Offer ${offer.pct}% beats tier ${tierPct}%` : `Tier ${tierPct}% + offer ${offer.pct}%${tierPct + offer.pct > state.rules.maxDiscount ? `, capped at ${state.rules.maxDiscount}%` : ''}`;
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
      <div class="card-head"><h2 class="h2">1 · Scan the card</h2></div>
      ${!g ? `
        <div class="scan-box">
          <div class="qr-frame"><ion-icon name="qr-code-outline"></ion-icon><div class="laser"></div></div>
          <div class="small muted">Point the scanner at the guest's QR in the La Gora app or Apple Wallet</div>
        </div>
        <form class="row mt" data-form="scan"><input class="input" style="flex:1" name="code" placeholder="or type card no. LG-00417" autocomplete="off"><button class="btn sm">Find</button></form>
        ${p.tokenState === 'expired' ? `<div class="notice bad mt"><ion-icon name="close-circle"></ion-icon><div><b>Code expired 4 min ago.</b> This looks like a screenshot. Ask the guest to open the app: the QR changes every 30 seconds, so a copied code can't be reused.</div></div>` : ''}
        ${p.tokenState === 'unknown' ? `<div class="notice bad mt"><ion-icon name="close-circle"></ion-icon><div>No member with that card number.</div></div>` : ''}
        <div class="caption dim mt-lg">Demo cards</div>
        <div class="list mt">${demo.map((d) => `<button class="list-item" style="background:none;border:0;width:100%;cursor:pointer;text-align:left" data-action="pos-scan" data-id="${d.id}"><span class="avatar">${initials(d)}</span><div style="flex:1"><div>${esc(fullName(d))}</div><div class="small dim mono">${d.memberNo}</div></div>${tierBadge(d.tier)}</button>`).join('')}</div>
        <button class="btn ghost sm mt" data-action="pos-expired"><ion-icon name="image-outline"></ion-icon>Try a screenshot of an old QR</button>
      ` : `
        <div class="member-card ${g.tier}">
          <img src="logo.svg" class="mc-logo" alt="">
          <div class="caption" style="opacity:.75">La Gora Club · ${g.tier}</div>
          <div style="font:300 24px/30px var(--display);margin-top:18px">${esc(fullName(g))}</div>
          <div class="row between" style="margin-top:10px"><span class="mono">${g.memberNo}</span><span class="small">${n0(g.points)} pts</span></div>
        </div>
        <div class="notice ok mt"><ion-icon name="shield-checkmark"></ion-icon><div>Code signed for ${g.memberNo}, issued 12 s ago. Verified.</div></div>
        <dl class="kv mt">
          <dt>Member discount</dt><dd><b>${t.tierPct}%</b> ${tierBadge(g.tier)} ${vipBadge(g)}</dd>
          <dt>Points</dt><dd class="num">${n0(g.points)}${nextTier ? ` <span class="dim small">· ${n0(nextTier.minPoints - g.points)} to ${nextTier.id}</span>` : ''}</dd>
          <dt>Visits</dt><dd>${s.visits} · last ${fmtDate(s.last)}</dd>
          ${g.allergens.length ? `<dt>Allergens</dt><dd>${g.allergens.map((a) => `<span class="allergen"><ion-icon name="warning"></ion-icon>${esc(a)}</span>`).join(' ')}</dd>` : ''}
          ${g.notes ? `<dt>Note</dt><dd class="small">${esc(g.notes)}</dd>` : ''}
          ${g.id === 'mem_0001' ? `<dt>Active offer</dt><dd class="small"><span class="pill gold">${OFFERS[0].label}</span></dd>` : ''}
        </dl>
        <div class="row mt"><button class="btn quiet sm" data-action="open-guest" data-id="${g.id}">Open profile</button><button class="btn ghost sm" data-action="pos-clear">Next guest</button></div>
      `}
    </div>`;

  const outlets = D.CATEGORIES.map((c) => `<button data-action="pos-outlet" data-v="${c.id}" class="${p.outlet === c.id ? 'on' : ''}">${c.label}</button>`).join('');
  const billCol = `
    <div class="card">
      <div class="card-head"><h2 class="h2">2 · The bill</h2><span class="small muted">Sent by the POS in production</span></div>
      <div class="seg" style="flex-wrap:wrap">${outlets}</div>
      <div class="catalog mt">${D.CATALOG[p.outlet].map((it, i) => `<button data-action="pos-add" data-i="${i}"><div class="small" style="color:var(--text);font-weight:500">${esc(it.name)}</div><div class="small num">${rsd(it.price)}</div>${it.excluded ? `<div class="small danger">No discount</div>` : ''}</button>`).join('')}</div>
      <div class="caption dim mt-lg">On the bill</div>
      <div class="mt">${t.lines.length ? t.lines.map((l, i) => `
        <div class="bill-line">
          <div><div>${esc(l.name)}</div>${l.why ? `<div class="small ${l.pct ? 'antique' : 'dim'}">${esc(l.why)}</div>` : ''}</div>
          <span class="qty"><button data-action="pos-qty" data-i="${i}" data-d="-1">−</button><span class="num">${l.qty}</span><button data-action="pos-qty" data-i="${i}" data-d="1">+</button></span>
          <div style="text-align:right;min-width:110px"><div class="num">${rsd(l.gross)}</div>${l.discount ? `<div class="small antique num">−${rsd(l.discount)} · ${l.pct}%</div>` : ''}</div>
        </div>`).join('') : `<div class="empty small">Tap items above to build a bill</div>`}</div>
    </div>`;

  const r = p.result;
  const receiptCol = `
    <div class="card">
      <div class="card-head"><h2 class="h2">3 · Close</h2></div>
      <div class="receipt">
        <label class="field"><span>Fiscal receipt no.</span><input class="input mono" data-bind-pos="receiptNo" value="${esc(p.receiptNo)}"></label>
        <div class="line mt"><span class="muted">Subtotal</span><span class="num">${rsd(t.subtotal)}</span></div>
        <div class="line"><span class="muted">Member discount</span><span class="num antique">${t.discount ? '−' + rsd(t.discount) : '—'}</span></div>
        <div class="line total"><span>Total</span><span class="num">${rsd(t.total)}</span></div>
        <div class="line"><span class="muted">Points to award</span><span class="num"><b>+${n0(t.points)}</b> <span class="small dim">${t.rate} / 100 RSD${t.multiplier > 1 ? ` ×${t.multiplier}` : ''}</span></span></div>
      </div>
      ${!g && t.lines.length ? `<div class="notice info mt"><ion-icon name="information-circle"></ion-icon><div>No card scanned: the bill is recorded as a non-member visit for the members vs non-members report.</div></div>` : ''}
      <button class="btn metal mt" style="width:100%" data-action="pos-close" ${!t.lines.length ? 'disabled' : ''}>${g ? 'Close bill & award points' : 'Close bill'}</button>
      ${r?.error ? `<div class="notice bad mt"><ion-icon name="copy-outline"></ion-icon><div>${r.error}</div></div>` : ''}
      ${r?.ok ? `
        <div class="notice ok mt"><ion-icon name="checkmark-circle"></ion-icon><div><b>Recorded ${esc(r.receiptNo)}</b> for ${esc(r.name)}</div></div>
        <div class="list small mt">
          ${[['person-circle-outline', `Identified ${esc(r.memberNo)}`], ['ribbon-outline', `Tier verified: ${r.tier}, ${r.tierPct}%`], ['pricetag-outline', `Discount applied to ${r.discLines} of ${r.lines} lines: −${rsd(r.discount)}`], ['receipt-outline', 'Transaction and discount recorded in the ledger'], ['sparkles-outline', `+${n0(r.points)} points awarded`], ['person-outline', `Profile and spending history updated · now ${n0(r.newPoints)} pts`]]
            .map(([i, txt]) => `<div class="list-item"><ion-icon name="${i}" class="antique" style="font-size:18px"></ion-icon>${txt}</div>`).join('')}
          ${r.upgraded ? `<div class="list-item"><ion-icon name="trophy" style="font-size:18px;color:var(--gold-deep)"></ion-icon><b>Upgraded to ${r.upgraded}</b>, push notification sent</div>` : ''}
        </div>` : ''}
    </div>`;

  return `
  ${pageHead('Checkout', 'Scan the guest’s card at the till. The panel identifies the member, applies the right discount only to eligible items, records the bill and awards points. Nothing is typed by hand.', ['§5 POS integration', '§3 Discounts & exceptions', '§4 Fraud prevention'])}
  <div class="pos">${scanCol}${billCol}${receiptCol}</div>
  <div class="card mt-lg">
    <div class="card-head"><h2 class="h2">How this connects to your POS</h2><span class="pill gold">Confirmed after we see your POS</span></div>
    <div class="grid g3">
      ${[['flash-outline', 'Direct API or plugin', 'If the POS vendor offers an API, the scan happens inside the POS screen and the discount line is added to the bill before it is fiscalised. Best experience, no second device.'],
        ['swap-horizontal-outline', 'Receipt matching', 'The POS keeps working as today. A small service reads each fiscal receipt (ESIR data) and matches it to the card scanned on a tablet at the till. Discount is keyed in by staff as a POS promotion.'],
        ['tablet-portrait-outline', 'Tablet at the till', 'This screen on a tablet next to the POS: staff scan, see the discount, enter the receipt number. Works with any POS from day one, but adds a step for staff.']]
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
    p.result = { error: `<b>Receipt ${esc(receiptNo)} was already recorded</b> on ${fmtDate(dup.date, true)}. Points are never awarded twice for the same receipt.` };
    log('Blocked duplicate receipt', receiptNo);
    save();
    return render();
  }
  const g = t.g;
  if (!g) {
    log('Closed non-member bill', `${receiptNo} · ${rsd(t.total)}`);
    p.result = null;
    p.lines = [];
    p.receiptNo = null;
    toast(`Non-member bill ${receiptNo} recorded`);
    save();
    return render();
  }
  const before = g.tier;
  state.transactions.unshift({
    id: `tx_${Date.now()}`, guestId: g.id, date: now(), category: p.outlet,
    title: t.lines.map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(', '),
    amount: t.subtotal, discountPct: t.subtotal ? Math.round((t.discount / t.subtotal) * 1000) / 10 : 0, discount: t.discount, points: t.points, receiptNo,
    staff: { management: 'Milena Đurić', reception: 'Recepcija', restaurant: 'Marina (restaurant)', retail: 'Jovan (shop)', marketing: 'Teodora Simić' }[state.role],
  });
  g.points += t.points;
  const after = tierForPoints(g.points);
  const upgraded = TIER_ORDER.indexOf(after) > TIER_ORDER.indexOf(before) ? after : null;
  if (upgraded) g.tier = after;
  log('Closed bill', `${receiptNo} · ${g.memberNo} · −${rsd(t.discount)} · +${t.points} pts`);
  if (upgraded) log('Automatic tier upgrade', `${g.memberNo} ${before} → ${after}`);
  p.result = {
    ok: true, receiptNo, name: fullName(g), memberNo: g.memberNo, tier: before, tierPct: t.tierPct, discount: t.discount, points: t.points,
    lines: t.lines.length, discLines: t.lines.filter((l) => l.discount).length, newPoints: g.points, upgraded,
  };
  p.lines = [];
  p.receiptNo = null;
  save();
  render();
  if (upgraded) toast(`${esc(g.first)} reached ${upgraded}`, 'trophy');
}

/* ───────────── Guests ───────────── */

const SEGMENTS = {
  all: ['All guests', () => true],
  birthday: ['Birthday this month', (g) => g.birthday && +g.birthday.slice(5, 7) === D.TODAY.getMonth() + 1],
  allergens: ['Allergens on file', (g) => g.allergens.length > 0],
  inactive: ['No visit in 120+ days', (g, s) => daysBetween(s.last, D.TODAY) > 120],
  red: ['Likes red wine', (g) => g.wines.some((w) => ['Furia', 'Avia', 'Gora Crveno'].includes(w))],
  stays: ['Stayed in the apartments', (g, s) => s.byCat.stay > 0],
  noconsent: ['No marketing consent', (g) => !g.consents.email && !g.consents.push],
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
  ${pageHead('Guests', `${n0(D.programme.members)} members in the programme. Showing the ${state.guests.length} with full demo profiles.`, ['§1 Profiles', '§6 CRM'], exportButtons('guests'))}
  <div class="card" style="padding:14px 16px">
    <div class="row wrap">
      <input class="input" style="flex:1;min-width:200px" placeholder="Search name, card no., email, phone" data-bind-ui="guestFilter.q" value="${esc(f.q)}">
      <div class="seg">${['all', ...TIER_ORDER, 'vip'].map((t) => `<button data-action="guest-tier" data-v="${t}" class="${f.tier === t ? 'on' : ''}">${t === 'all' ? 'All' : t === 'vip' ? 'VIP' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <select class="input" data-bind-ui="guestFilter.segment">${Object.entries(SEGMENTS).map(([k, [l]]) => `<option value="${k}" ${f.segment === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Guest</th><th>Tier</th><th class="right">Points</th><th class="right">Visits</th><th class="right">Total spend</th><th>Mostly</th><th>Last visit</th><th>Consents</th></tr></thead>
      <tbody>${rows.map(({ g, s }) => `
        <tr class="click" data-action="open-guest" data-id="${g.id}">
          <td><div class="row"><span class="avatar">${initials(g)}</span><div><div>${esc(fullName(g))} ${vipBadge(g)} ${g.allergens.length ? `<ion-icon name="warning" class="danger" title="Allergens"></ion-icon>` : ''}</div><div class="small dim mono">${g.memberNo} · ${esc(g.email)}</div></div></div></td>
          <td>${tierBadge(g.tier)}</td>
          <td class="right num">${n0(g.points)}</td>
          <td class="right num">${s.visits}</td>
          <td class="right num">${rsd(s.spend)}</td>
          <td>${s.top ? `<span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(s.top).color}"></span>${cat(s.top).label}</span>` : ''}</td>
          <td class="small ${daysBetween(s.last, D.TODAY) > 120 ? 'danger' : 'muted'}">${fmtDate(s.last)}</td>
          <td>${consentIcons(g.consents)}</td>
        </tr>`).join('') || `<tr><td colspan="8" class="empty">No guests match these filters</td></tr>`}</tbody>
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
      <div class="row between"><span class="caption dim">Guest profile</span><button class="icon-btn" data-action="close-drawer" aria-label="Close"><ion-icon name="close"></ion-icon></button></div>
      <div class="row mt"><span class="avatar lg">${initials(g)}</span><div>
        <div class="h1" style="font-size:26px;line-height:32px">${esc(fullName(g))}</div>
        <div class="row" style="gap:8px;margin-top:4px">${tierBadge(g.tier)} ${vipBadge(g)} <span class="small dim mono">${g.memberNo}</span></div>
      </div></div>
    </div>
    <div class="drawer-body">
      <div class="grid g3" style="gap:10px">
        ${[['Points', n0(g.points)], ['Visits', s.visits], ['Spend', mrsd(s.spend)]].map(([l, v]) => `<div class="card" style="padding:14px"><div class="caption dim">${l}</div><div style="font:300 24px/30px var(--display);margin-top:4px" class="num">${v}</div></div>`).join('')}
      </div>
      <div class="card">
        <div class="row between small"><span>${cur.discount}% member discount</span><span class="muted">${next ? `${n0(next.minPoints - g.points)} pts to ${next.id}` : 'Top tier'}</span></div>
        <div class="track mt" style="margin-top:8px"><div style="width:${Math.min(100, prog * 100)}%"></div></div>
        <div class="caption dim mt">Spend by segment</div>
        <div class="mt">${hbars(D.CATEGORIES.map((c) => ({ label: c.label, color: c.color, value: s.byCat[c.id] })), { labelW: 120 })}</div>
      </div>
      <div class="card">
        <div class="caption dim">Contact & profile</div>
        <dl class="kv mt">
          <dt>Email</dt><dd>${esc(g.email)}</dd>
          <dt>Phone</dt><dd>${esc(g.phone)}</dd>
          <dt>Joined</dt><dd>${fmtDate(g.joined)} · via ${g.source}</dd>
          <dt>Language</dt><dd>${g.language === 'sr' ? 'Srpski' : 'English'}</dd>
          <dt>Birthday</dt><dd>${age(g.birthday) || '<span class="dim">not shared</span>'}</dd>
          <dt>Anniversary</dt><dd>${age(g.anniversary) || '<span class="dim">not shared</span>'}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="caption dim">Preferences</div>
        <dl class="kv mt">
          <dt>Favourite wines</dt><dd>${g.wines.map((w) => `<span class="pill burgundy">${esc(w)}</span>`).join(' ')}</dd>
          <dt>Favourite dishes</dt><dd>${g.dishes.map((w) => `<span class="pill">${esc(w)}</span>`).join(' ')}</dd>
          <dt>Diet</dt><dd>${g.diet.length ? g.diet.map(esc).join(', ') : '<span class="dim">none</span>'}</dd>
          <dt>Allergens</dt><dd>${g.allergens.length ? g.allergens.map((a) => `<span class="allergen"><ion-icon name="warning"></ion-icon>${esc(a)}</span>`).join(' ') : '<span class="dim">none</span>'}</dd>
          <dt>Apartment</dt><dd>${g.apartment ? esc(g.apartment) : '<span class="dim">no preference</span>'}</dd>
          <dt>Staff note</dt><dd>${g.notes ? esc(g.notes) : '<span class="dim">—</span>'}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="caption dim">Reservations & stays</div>
        <div class="list mt">${res.length ? res.map((r) => `<div class="list-item small"><span class="cat-dot" style="background:${cat(r.kind === 'restaurant' ? 'restaurant' : r.kind).color}"></span>${r.kind === 'stay' ? `${esc(r.apartment)} · ${r.nights} nights` : r.kind === 'tasting' ? esc(r.experience) : `Restaurant · ${r.guests} guests`}<span class="muted" style="margin-left:auto">${fmtDate(r.date)} ${r.kind !== 'stay' ? r.time : ''}</span><span class="pill ${r.status === 'confirmed' ? 'green' : r.status === 'pending' ? 'gold' : ''}">${r.status}</span></div>`).join('') : '<div class="small dim">None upcoming</div>'}
        ${s.tx.filter((t) => t.category === 'stay').slice(0, 3).map((t) => `<div class="list-item small"><span class="cat-dot" style="background:${cat('stay').color}"></span>${esc(t.title)}<span class="muted" style="margin-left:auto">${fmtDate(t.date)}</span><span class="pill">past stay</span></div>`).join('')}</div>
      </div>
      <div class="card">
        <div class="caption dim">Transactions & points</div>
        <div class="list mt">${s.tx.slice(0, 8).map((t) => `<div class="list-item small"><span class="cat-dot" style="background:${cat(t.category).color}"></span><div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div><div class="dim">${fmtDate(t.date, true)} · ${esc(t.receiptNo)}</div></div><div style="text-align:right"><div class="num">${rsd(t.amount)}</div><div class="antique num">${t.points ? `+${t.points} pts` : ''}${t.discount ? ` · −${rsd(t.discount)}` : ''}</div></div></div>`).join('') || '<div class="small dim">No purchases yet</div>'}</div>
      </div>
      <div class="card">
        <div class="caption dim">Feedback & communication</div>
        <div class="list mt">${fb.slice(0, 4).map((f) => `<div class="list-item small" style="align-items:flex-start"><div style="flex:1">${stars(f.rating)} <span class="dim">${cat(f.category).label} · ${fmtDate(f.date)}</span><div>${esc(f.comment) || '<span class="dim">No comment</span>'}</div></div></div>`).join('') || '<div class="small dim">No surveys answered yet</div>'}
          <div class="list-item small"><ion-icon name="mail-open-outline" class="antique"></ion-icon>Opened 6 of last 8 campaigns</div>
        </div>
      </div>
      <div class="card">
        <div class="caption dim">Consents</div>
        <div class="list mt">${[['push', 'Push notifications'], ['email', 'Email newsletters & offers'], ['sms', 'SMS'], ['personalized', 'Personalised offers from purchase history']].map(([k, l]) => `<div class="list-item small">${l}<span style="margin-left:auto" class="pill ${g.consents[k] ? 'green' : ''}">${g.consents[k] ? 'Given' : 'Not given'}</span></div>`).join('')}</div>
        <p class="small dim" style="margin:10px 0 0">Guests change these themselves in the app. Every change is time-stamped for GDPR.</p>
      </div>
      ${canEdit ? `
      <div class="card">
        <div class="caption dim">Manual actions</div>
        <form class="row wrap mt" data-form="award" data-id="${g.id}">
          <input class="input num-in" name="points" type="number" value="250" step="50">
          <input class="input" style="flex:1;min-width:140px" name="reason" placeholder="Reason (required)" required>
          <button class="btn sm">Award points</button>
        </form>
        <div class="row between mt"><span class="small">VIP status</span>${toggle(`data-action="toggle-vip" data-id="${g.id}"`, g.vip)}</div>
        <div class="row between mt"><span class="small">Tier override</span><select class="input" data-action-change="set-tier" data-id="${g.id}">${TIER_ORDER.map((t) => `<option ${g.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="row wrap mt">
          <button class="btn quiet sm" data-action="gdpr-export" data-id="${g.id}"><ion-icon name="download-outline"></ion-icon>Export guest data</button>
          <button class="btn danger sm" data-action="gdpr-erase" data-id="${g.id}" ${pending?.kind === 'Delete my account' ? 'disabled' : ''}><ion-icon name="trash-outline"></ion-icon>${pending?.kind === 'Delete my account' ? 'Erasure requested' : 'Erase on request'}</button>
        </div>
        <p class="small dim" style="margin:10px 0 0">Every manual change is written to the audit log with your name.</p>
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
  const label = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  const closed = [1, 2].includes(new Date(ui.resDay + 'T12:00:00').getDay());
  const bookingChip = (r) => {
    const g = guestById(r.guestId);
    return `<button class="booking ${r.status}" data-action="edit-res" data-id="${r.id}"><span class="covers">${r.guests}</span>${esc(fullName(g))} ${tierBadge(g.tier)}${g.allergens.length ? `<ion-icon name="warning" class="danger" title="${esc(g.allergens.join(', '))}"></ion-icon>` : ''}${r.note ? `<span class="small dim">${esc(r.note)}</span>` : ''}${r.status === 'pending' ? '<span class="pill gold">awaiting</span>' : ''}</button>`;
  };
  return `
  ${pageHead('Reservations', 'Restaurant tables confirm instantly. Tastings, stays and large groups arrive as requests for the team to approve. Every booking is linked to the guest’s loyalty profile.', ['§7 Reservations', 'Modular: restaurant · tastings · stays'],
    `<button class="btn" data-action="new-res"><ion-icon name="add"></ion-icon>New reservation</button>`)}
  <div class="grid g3">
    <div class="card span2">
      <div class="row between wrap">
        <div class="seg">${days.map((d) => `<button data-action="res-day" data-v="${d}" class="${ui.resDay === d ? 'on' : ''}">${d === '2026-10-21' ? 'Today' : label(d)}</button>`).join('')}</div>
        <span class="small muted">${closed ? 'Restaurant closed' : `${covers} covers · ${dayRes.length} tables`}</span>
      </div>
      ${closed ? `<div class="empty">The restaurant is open Wednesday – Sunday, 12:00 – 23:00.</div>` : `
      <div class="slots mt">${['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((slot) => {
        const here = dayRes.filter((r) => r.time === slot);
        const c = here.reduce((a, r) => a + r.guests, 0);
        return `<div class="slot-time">${slot}</div><div class="slot-row">${here.map(bookingChip).join('')}<div class="cap" title="${c} / ${CAP} covers"><div style="width:${Math.min(100, (c / CAP) * 100)}%"></div></div></div>`;
      }).join('')}</div>`}
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><h2 class="h2">Requests</h2><span class="pill gold">${pending.length} waiting</span></div>
        <div class="list">${pending.map((r) => {
          const g = guestById(r.guestId);
          return `<div class="list-item" style="align-items:flex-start;flex-direction:column;gap:8px">
            <div class="row" style="width:100%"><span class="cat-dot" style="background:${cat(r.kind).color}"></span><div style="flex:1"><div class="h3">${r.kind === 'stay' ? esc(r.apartment) : r.kind === 'tasting' ? esc(r.experience) : `Table for ${r.guests}`}</div>
              <div class="small muted">${fmtDate(r.date)}${r.kind === 'stay' ? ` · ${r.nights} nights` : ` · ${r.time}`} · ${r.guests} guests</div></div></div>
            <div class="row small" style="gap:6px"><a href="#" data-action="open-guest" data-id="${g.id}" class="antique">${esc(fullName(g))}</a>${tierBadge(g.tier)}</div>
            ${r.note ? `<div class="small muted">“${esc(r.note)}”</div>` : ''}
            <div class="row"><button class="btn sm" data-action="res-approve" data-id="${r.id}">Confirm</button><button class="btn ghost sm" data-action="res-decline" data-id="${r.id}">Decline</button></div>
          </div>`;
        }).join('') || '<div class="empty small">All requests handled</div>'}</div>
      </div>
      <div class="card">
        <div class="caption dim">Automatic reminders</div>
        <div class="list mt small">
          <div class="list-item"><ion-icon name="notifications-outline" class="antique"></ion-icon>Push 24 h before a table</div>
          <div class="list-item"><ion-icon name="mail-outline" class="antique"></ion-icon>Email 3 days before check-in</div>
          <div class="list-item"><ion-icon name="star-outline" class="antique"></ion-icon>Survey the morning after</div>
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
      <div class="row between"><h2 class="h2">${isNew ? 'New reservation' : 'Reservation'}</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <div class="grid g2 mt">
        <label class="field span2"><span>Guest</span><select class="input" name="guestId">${state.guests.map((g) => `<option value="${g.id}" ${g.id === r.guestId ? 'selected' : ''}>${esc(fullName(g))} · ${g.memberNo}</option>`).join('')}</select></label>
        <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${r.date}"></label>
        <label class="field"><span>Time</span><select class="input" name="time">${['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((t) => `<option ${t === r.time ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Guests</span><input class="input" type="number" min="1" max="20" name="guests" value="${r.guests}"></label>
        <label class="field"><span>Status</span><select class="input" name="status">${['confirmed', 'pending'].map((s) => `<option ${s === (r.status || 'confirmed') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field span2"><span>Special requests</span><input class="input" name="note" value="${esc(r.note)}" placeholder="Window table, high chair, celebration…"></label>
      </div>
      <div class="row between mt-lg">
        ${isNew ? '<span></span>' : `<button type="button" class="btn danger sm" data-action="res-cancel" data-id="${r.id}">Cancel reservation</button>`}
        <button class="btn">${isNew ? 'Book' : 'Save changes'}</button>
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
  ${pageHead('Campaigns', 'Push, email and SMS to members who said yes. Pick a segment, schedule it, and see what it brought in.', ['§8 Communication & promotions', '§12 Re-engagement · early access'],
    `<button class="btn" data-action="new-campaign"><ion-icon name="add"></ion-icon>New campaign</button>`)}
  <div class="grid g4">
    <div class="card kpi"><div class="caption dim">Reachable by push</div><div class="value num">${pct(D.programme.consents.push)}</div><div class="delta">${n0(D.programme.members * D.programme.consents.push)} members</div></div>
    <div class="card kpi"><div class="caption dim">Email consent</div><div class="value num">${pct(D.programme.consents.email)}</div><div class="delta">SMS ${pct(D.programme.consents.sms)}</div></div>
    <div class="card kpi"><div class="caption dim">Average open rate</div><div class="value num">${pct(avgOpen)}</div><div class="delta">Last ${sent.length} campaigns</div></div>
    <div class="card kpi"><div class="caption dim">Revenue from campaigns</div><div class="value num">${mrsd(revenue)}</div><div class="delta">Bills with the offer applied</div></div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Campaign</th><th>Channels</th><th>Segment</th><th class="right">Audience</th><th>When</th><th class="right">Opened</th><th class="right">Converted</th><th class="right">Revenue</th><th>Status</th></tr></thead>
      <tbody>${state.campaigns.map((c) => `
        <tr><td><div>${esc(c.name)}</div><div class="small dim">${esc(c.kind)}${c.note ? ` · ${esc(c.note)}` : ''}</div></td>
        <td>${c.channels.map((x) => `<ion-icon name="${chan[x]}" title="${x}" style="color:var(--gold-antique);font-size:16px"></ion-icon>`).join(' ')}</td>
        <td class="small muted">${esc(c.segment)}</td>
        <td class="right num">${n0(c.audience)}</td>
        <td class="small">${fmtDate(c.date, true)}</td>
        <td class="right num">${c.opened != null ? pct(c.opened) : '—'}</td>
        <td class="right num">${c.converted != null ? pct(c.converted) : '—'}</td>
        <td class="right num">${c.revenue ? mrsd(c.revenue) : '—'}</td>
        <td><span class="pill ${statusPill[c.status]}">${c.status}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Automations</h2><span class="small muted">Run on their own once switched on</span></div>
    <div class="list">${state.automations.map((a) => `
      <div class="list-item">
        <div style="flex:1"><div class="h3">${esc(a.name)}</div><div class="small muted">${esc(a.trigger)} · ${a.channels.map((x) => `<ion-icon name="${chan[x]}" style="vertical-align:-2px"></ion-icon>`).join(' ')}</div></div>
        <span class="small dim num" style="width:120px;text-align:right">${a.active ? `${n0(a.sent30)} sent in 30 days` : 'Off'}</span>
        ${toggle(`data-action="toggle-auto" data-id="${a.id}"`, a.active)}
      </div>`).join('')}</div>
  </div>`;
}

function campaignModal(preset) {
  const f = {
    name: preset === 'inactive' ? 'We miss you: a glass on us' : '',
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
      <div class="row between"><h2 class="h2">New campaign</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <label class="field mt"><span>Name</span><input class="input" name="name" value="${esc(f.name)}" placeholder="Autumn dinner invitation" required data-camp="name"></label>
      <div class="field mt"><span>Channels</span><div class="row wrap">${['push', 'email', 'sms'].map((c) => `<label class="check"><input type="checkbox" data-camp-list="channels" value="${c}" ${f.channels.includes(c) ? 'checked' : ''}>${c === 'sms' ? 'SMS' : c[0].toUpperCase() + c.slice(1)}</label>`).join('')}</div></div>
      <div class="field mt"><span>Who</span><div class="row wrap">${TIER_ORDER.map((t) => `<label class="check"><input type="checkbox" data-camp-list="tiers" value="${t}" ${f.tiers.includes(t) ? 'checked' : ''}>${t[0].toUpperCase() + t.slice(1)}</label>`).join('')}</div></div>
      <div class="grid g2 mt">
        <label class="field"><span>Interest</span><select class="input" data-camp="interest">${[['any', 'Any'], ['red', 'Likes red wine'], ['white', 'Likes white wine'], ['stays', 'Has stayed with us']].map(([v, l]) => `<option value="${v}" ${f.interest === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Send at</span><input class="input" type="datetime-local" data-camp="date" value="${f.date}"></label>
      </div>
      <div class="row wrap mt"><label class="check"><input type="checkbox" data-camp-bool="inactive" ${f.inactive ? 'checked' : ''}>No visit in 120+ days</label><label class="check"><input type="checkbox" data-camp-bool="birthday" ${f.birthday ? 'checked' : ''}>Birthday this month</label></div>
      <div class="notice info mt"><ion-icon name="people"></ion-icon><div><b class="num">${n0(est.reachable)}</b> members will receive it <span class="dim">(${n0(est.total)} match, the rest haven't consented to these channels)</span></div></div>
      <div class="grid g2 mt">
        <label class="field"><span>Title · SR</span><input class="input" data-camp="title" value="${esc(f.title)}"></label>
        <label class="field"><span>Title · EN</span><input class="input" placeholder="Auto-filled from SR, editable" value="${f.title ? 'We haven’t seen you in a while' : ''}"></label>
      </div>
      <label class="field mt"><span>Message</span><textarea class="input" rows="2" data-camp="body">${esc(f.body)}</textarea></label>
      <div class="row between mt-lg"><button type="button" class="btn ghost" data-action="save-campaign" data-status="Draft">Save draft</button><button class="btn">Schedule</button></div>
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
  const cols = [['open', 'Open'], ['progress', 'In progress'], ['resolved', 'Resolved']];
  return `
  ${pageHead('Feedback', 'Short surveys go out automatically the morning after a visit. Every guest is then invited to review La Gora on Google or Tripadvisor, whatever score they gave us.', ['§9 Ratings & feedback', '§12 Complaint management'])}
  <div class="grid g4">
    <div class="card kpi hero-tile"><img src="logo.svg" class="watermark" alt=""><div class="caption dim">Average rating</div><div class="value num">${avg.toLocaleString('sr-RS', { maximumFractionDigits: 2 })}<small>/ 5</small></div><div class="delta">${fb.length} surveys in 60 days</div></div>
    <div class="card kpi"><div class="caption dim">Response rate</div><div class="value num">38%</div><div class="delta">+50 points for answering</div></div>
    <div class="card kpi"><div class="caption dim">Public review invite shown</div><div class="value num">100%</div><div class="delta">Incl. all ${low.length} guests who rated 1–3★</div></div>
    <div class="card kpi"><div class="caption dim">Went on to review</div><div class="value num">${pct(clicks / fb.length)}</div><div class="delta">Google & Tripadvisor</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="card-head"><h2 class="h2">Rating by service</h2></div>${hbars(byCat.map((r) => ({ ...r, extra: `${r.n} surveys` })), { fmt: (v) => `${v.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★`, max: 5 })}</div>
    <div class="card"><div class="card-head"><h2 class="h2">What to improve</h2><span class="small muted">Picked by guests</span></div>${hbars(Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), { fmt: (v) => `${v} mentions`, labelW: 150 })}</div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Complaints</h2><span class="small muted">Click a ticket to move it on</span></div>
    <div class="kanban">${cols.map(([id, l]) => `<div class="col"><div class="caption dim">${l} · ${state.complaints.filter((c) => c.status === id).length}</div>${state.complaints.filter((c) => c.status === id).map((c) => {
      const g = guestById(c.guestId);
      return `<div class="ticket"><div class="row" style="gap:6px"><span class="cat-dot" style="background:${cat(c.category).color}"></span><b style="font-weight:600">${esc(c.title)}</b></div>
        <div class="small muted" style="margin-top:4px">${esc(fullName(g))} · ${fmtDate(c.opened)} · ${esc(c.owner)}</div>
        ${id !== 'resolved' ? `<button class="btn quiet sm mt" style="margin-top:8px" data-action="complaint-next" data-id="${c.id}">${id === 'open' ? 'Start' : 'Resolve'}</button>` : ''}</div>`;
    }).join('')}</div>`).join('')}</div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Latest responses</h2></div>
    <div class="table-wrap"><table><thead><tr><th>Guest</th><th>Service</th><th>Rating</th><th>Comment</th><th>Improve</th><th>Public review</th></tr></thead>
    <tbody>${fb.slice(0, 14).map((f) => { const g = guestById(f.guestId); return `<tr class="click" data-action="open-guest" data-id="${g.id}"><td class="small">${esc(fullName(g))}<div class="dim">${fmtDate(f.date)}</div></td><td><span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(f.category).color}"></span>${cat(f.category).label}</span></td><td>${stars(f.rating)}</td><td class="small">${esc(f.comment) || '<span class="dim">—</span>'}</td><td class="small muted">${f.improve.join(', ') || '—'}</td><td class="small">${f.clickedPublic ? `<span class="pill green">${f.clickedPublic}</span>` : '<span class="dim">invited</span>'}</td></tr>`; }).join('')}</tbody></table></div>
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
  ${pageHead('Discount ledger', 'Every discount given, line by line: when, to whom, on which receipt and how much. Written automatically when a bill is closed.', ['§10 Discount control'], exportButtons('ledger'))}
  <div class="grid g3">
    <div class="card kpi"><div class="caption dim">Discounts in view</div><div class="value num">${rsd(totalDisc)}</div><div class="delta">${rows.length} receipts</div></div>
    <div class="card kpi"><div class="caption dim">On bills worth</div><div class="value num">${mrsd(totalAmt)}</div><div class="delta">Effective rate ${pct(totalDisc / (totalAmt || 1), 1)}</div></div>
    <div class="card kpi"><div class="caption dim">Blocked duplicates</div><div class="value num">${state.audit.filter((a) => a.what === 'Blocked duplicate receipt').length + 3}</div><div class="delta">Same receipt scanned twice this year</div></div>
  </div>
  <div class="card mt" style="padding:14px 16px">
    <div class="row wrap">
      <input class="input" style="flex:1;min-width:200px" placeholder="Search guest, card no., receipt, item" data-bind-ui="ledger.q" value="${esc(l.q)}">
      <div class="seg" style="flex-wrap:wrap"><button data-action="ledger-outlet" data-v="all" class="${l.outlet === 'all' ? 'on' : ''}">All</button>${D.CATEGORIES.map((c) => `<button data-action="ledger-outlet" data-v="${c.id}" class="${l.outlet === c.id ? 'on' : ''}">${c.label}</button>`).join('')}</div>
    </div>
  </div>
  <div class="card flush mt">
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Guest</th><th>Receipt</th><th>Outlet</th><th>Product / service</th><th class="right">Bill</th><th class="right">%</th><th class="right">Discount</th><th>Staff</th></tr></thead>
      <tbody>${rows.slice(0, l.limit).map(({ t, g }) => `
        <tr><td class="small num">${new Date(t.date).toLocaleDateString('en-GB')}</td><td class="small num">${fmtTime(t.date)}</td>
        <td class="small"><a href="#" data-action="open-guest" data-id="${g.id}" class="antique">${esc(fullName(g))}</a><div class="dim mono">${g.memberNo}</div></td>
        <td class="mono small">${esc(t.receiptNo)}</td>
        <td><span class="row small" style="gap:6px"><span class="cat-dot" style="background:${cat(t.category).color}"></span>${cat(t.category).label}</span></td>
        <td class="small">${esc(t.title)}</td>
        <td class="right num small">${rsd(t.amount)}</td><td class="right num small">${t.discountPct}%</td><td class="right num"><b>${rsd(t.discount)}</b></td>
        <td class="small muted">${esc(t.staff)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6">${rows.length} receipts</td><td class="right num">${rsd(totalAmt)}</td><td></td><td class="right num">${rsd(totalDisc)}</td><td></td></tr></tfoot>
    </table></div>
    ${rows.length > l.limit ? `<div style="padding:14px;text-align:center" class="no-print"><button class="btn quiet sm" data-action="ledger-more">Show ${Math.min(60, rows.length - l.limit)} more</button></div>` : ''}
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
  ${pageHead('Loyalty rules', 'Everything about points, tiers, discounts and expiry is set here. Changes apply to the next bill closed, with no developer involved.', ['§3 Discounts', '§4 Points & tiers', '§14 Self-managed'],
    `<div class="notice ok" style="max-width:360px"><ion-icon name="calculator-outline"></ion-icon><div class="small">A ${rsd(ex.amount)} dinner for a Gold member: <b>−${rsd(ex.d)}</b> and <b>+${n0(ex.pts)} points</b></div></div>`)}
  <div class="grid g2">
    <div class="card">
      <div class="card-head"><h2 class="h2">Membership tiers</h2></div>
      <table><thead><tr><th style="padding-left:0">Tier</th><th class="right">From points</th><th class="right">Discount</th><th class="right">Members</th></tr></thead>
      <tbody>${r.tiers.map((t, i) => `<tr><td style="padding-left:0">${tierBadge(t.id)}</td><td class="right">${input(`tiers.${i}.minPoints`, t.minPoints, i === 0 ? 'disabled' : 'step="500"')}</td><td class="right">${input(`tiers.${i}.discount`, t.discount, 'step="1" min="0" max="30"')} %</td><td class="right num">${n0(D.programme.tierCounts[t.id])}</td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="margin:12px 0 0">Members move up automatically the moment they cross a threshold. Welcome: every new member gets ${input('welcomeDiscount', r.welcomeDiscount, 'style="width:60px"')} % and ${input('welcomePoints', r.welcomePoints, 'style="width:80px" step="50"')} points.</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Earning & where the discount applies</h2></div>
      <table><thead><tr><th style="padding-left:0">Outlet</th><th class="right">Points / 100 RSD</th><th class="right">Member discount</th></tr></thead>
      <tbody>${D.CATEGORIES.map((c) => `<tr><td style="padding-left:0"><span class="row small" style="gap:8px"><span class="cat-dot" style="background:${c.color}"></span>${c.label}</span></td><td class="right">${input(`earn.${c.id}`, r.earn[c.id], 'step="0.5" min="0"')}</td><td class="right"><span style="display:inline-flex">${toggle(`data-rule-bool="discountOn.${c.id}"`, r.discountOn[c.id])}</span></td></tr>`).join('')}</tbody></table>
      <p class="small muted" style="margin:12px 0 0">Events are ticketed: points yes, member discount no. Private and corporate events are always excluded below.</p>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Bonus points</h2></div>
      <div class="list">${r.bonuses.map((b, i) => `<div class="list-item"><div style="flex:1" class="small">${esc(b.name)}</div>${b.multiplier ? `<span class="pill gold">×${b.multiplier}</span>` : `${input(`bonuses.${i}.points`, b.points, 'step="50"')}<span class="small dim">pts</span>`}${toggle(`data-rule-bool="bonuses.${i}.active"`, b.active)}</div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Expiry & combining</h2></div>
      <div class="list">
        <div class="list-item small"><div style="flex:1">Points stay valid for</div>${input('validityMonths', r.validityMonths, 'step="6" min="6"')}<span class="dim">months</span></div>
        <div class="list-item small"><div style="flex:1">Remind the member before expiry</div>${input('expiryNoticeDays', r.expiryNoticeDays, 'step="5" min="0"')}<span class="dim">days</span></div>
        <div class="list-item small" style="flex-wrap:wrap"><div style="flex:1;min-width:180px">When a member also has an offer</div><div class="seg"><button data-action="stacking" data-v="best" class="${r.stacking === 'best' ? 'on' : ''}">Best one wins</button><button data-action="stacking" data-v="add" class="${r.stacking === 'add' ? 'on' : ''}">Add up</button></div></div>
        ${r.stacking === 'add' ? `<div class="list-item small"><div style="flex:1">Never more than</div>${input('maxDiscount', r.maxDiscount, 'step="1"')}<span class="dim">% on one item</span></div>` : ''}
      </div>
      <div class="caption dim mt-lg">No discount on</div>
      <div class="row wrap mt" style="gap:8px">${r.exclusions.map((e, i) => `<span class="chip">${esc(e)}<button data-action="del-exclusion" data-i="${i}" aria-label="Remove"><ion-icon name="close"></ion-icon></button></span>`).join('')}</div>
      <form class="row mt" data-form="exclusion"><input class="input" style="flex:1" name="ex" placeholder="Add an exception, e.g. Magnum bottles"><button class="btn quiet sm">Add</button></form>
    </div>
  </div>
  <div class="notice info mt"><ion-icon name="shield-checkmark-outline"></ion-icon><div class="small">Fraud protection is always on: QR codes rotate every 30 seconds and are signed per member; one receipt can earn points once; manual points over 1,000 need a manager; every change on this page is in the audit log.</div></div>`;
}

/* ───────────── Content ───────────── */

function pageContent() {
  const c = state.content;
  const img = (f) => `media/${f}`;
  return `
  ${pageHead('App content', 'What guests see in the app: events, wines and offers. Changes go live in the app straight away, in Serbian and English.', ['§2 Content', '§12 Digital wine list · early access'])}
  <div class="card flush">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Events</h2><button class="btn quiet sm" data-action="soon"><ion-icon name="add"></ion-icon>New event</button></div>
    <div class="table-wrap"><table><thead><tr><th>Event</th><th>When</th><th>Booked</th><th>Languages</th><th>Members only</th><th>Published</th></tr></thead>
    <tbody>${c.events.map((e, i) => `<tr><td><div class="row"><img class="thumb" src="${img(e.img)}" alt=""><span>${esc(e.title)}</span></div></td><td class="small">${e.when}</td><td class="small num">${e.booked ?? '<span class="dim">open entry</span>'}</td>
      <td><span class="pill ${e.sr ? 'green' : 'red'}">SR</span> <span class="pill ${e.en ? 'green' : 'red'}">EN</span></td>
      <td>${toggle(`data-content="events.${i}.membersOnly"`, e.membersOnly)}</td><td>${toggle(`data-content="events.${i}.published"`, e.published)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Wine list</h2><span class="small muted">Stock from the shop POS</span></div>
    <div class="table-wrap"><table><thead><tr><th>Wine</th><th class="right">Price</th><th class="right">Stock</th><th>Tag</th><th>Published</th></tr></thead>
    <tbody>${c.wines.map((w, i) => `<tr><td><div class="row"><img class="thumb tall" src="${img(w.img)}" alt=""><div><div>${esc(w.name)}</div><div class="small dim">${esc(w.variety)}</div></div></div></td><td class="right num">${rsd(w.price)}</td>
      <td class="right num ${w.stock < 60 ? 'danger' : ''}">${w.stock}</td>
      <td>${w.limited ? '<span class="pill gold">Early access: Gold+</span>' : ''}${w.award ? `<span class="pill">${esc(w.award)}</span>` : ''}</td>
      <td>${toggle(`data-content="wines.${i}.published"`, w.published)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

/* ───────────── Partners · Phase 2 ───────────── */

function pagePartners() {
  const markOf = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `
  ${pageHead('Partners & Phase 2', 'Planned for the second phase. Shown here so the owners can see where the platform goes next; the data model already supports it.', ['§11 Partner programme', '§12 Additional features'],
    `<button class="btn" data-action="add-partner"><ion-icon name="add"></ion-icon>Add partner</button>`)}
  <div class="grid g2">${state.partners.map((p) => `
    <div class="card">
      <div class="row"><span class="partner-mark">${esc(markOf(p.name))}</span><div style="flex:1"><div class="caption dim">${esc(p.kind)}</div><div class="h2" style="margin-top:2px">${esc(p.name)}</div></div><span class="pill gold">${esc(p.status)}</span></div>
      <p style="margin:16px 0">${esc(p.benefit)}</p>
      <div class="grid g3" style="gap:10px">
        ${[['Members linked', p.members], ['Benefit uses', p.uses], ['Joint campaigns', 0]].map(([l, v]) => `<div style="background:var(--bg-warm);border-radius:12px;padding:10px 12px"><div class="caption dim" style="letter-spacing:1.4px">${l}</div><div style="font:300 22px/28px var(--display)" class="num">${v}</div></div>`).join('')}
      </div>
      <div class="row small muted mt"><ion-icon name="qr-code-outline" class="antique"></ion-icon>Members identified by the La Gora card at the partner's till</div>
    </div>`).join('')}</div>
  <h2 class="h2 mt-lg">More modules</h2>
  <div class="grid g4 mt">${[
    ['people-outline', 'Referral programme', 'Member invites a friend; both get points when the friend makes a first purchase. Bonus rule already in Loyalty rules.', 'Phase 1'],
    ['gift-outline', 'Vouchers & gift cards', 'Buy, send and redeem digital vouchers by QR. Excluded from discounts by default.', 'Phase 1'],
    ['star-outline', 'VIP club & early access', 'Members-only events and limited releases open first to Gold and Platinum.', 'Phase 1'],
    ['wallet-outline', 'Apple & Google Wallet', 'The loyalty card in the phone’s wallet, updated live with points and tier. Apple Wallet already works in the app.', 'Phase 1'],
    ['wine-outline', 'Wine Club', 'Quarterly subscription with club pricing and member-only bottles.', 'Phase 2'],
    ['cart-outline', 'Online shop', 'Order wine in the app, pick up at the winery or have it delivered. Points and discounts apply.', 'Phase 2'],
    ['bed-outline', 'HotelSync PMS sync', 'Stays and room spend flow into the guest profile automatically.', 'Phase 2'],
    ['sparkles-outline', 'Recommendations', 'Wines and experiences suggested from each guest’s history.', 'Phase 2'],
  ].map(([i, h, t, ph]) => `<div class="card module"><div class="row between"><ion-icon class="lead" name="${i}"></ion-icon><span class="pill ${ph === 'Phase 1' ? 'green' : ''}">${ph}</span></div><div class="h3" style="margin-top:12px">${h}</div><p class="small muted" style="margin:4px 0 0">${t}</p></div>`).join('')}</div>`;
}

/* ───────────── Team & data ───────────── */

function pageSecurity() {
  const pages = NAV.filter((n) => n.id);
  return `
  ${pageHead('Team & data', 'Who can see what, everything they changed, and how guest data is protected under Serbian data protection law and the GDPR.', ['§12 User roles', '§13 Security & data protection'], `<button class="btn quiet" data-action="export-db"><ion-icon name="download-outline"></ion-icon>Export full database</button>`)}
  <div class="card flush">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Roles</h2><span class="small muted">Switch role in the sidebar to see the panel as them</span></div>
    <div class="table-wrap"><table class="matrix"><thead><tr><th>Area</th>${Object.values(D.ROLES).map((r) => `<th>${r.label}</th>`).join('')}</tr></thead>
    <tbody>${pages.map((p) => `<tr><td class="small">${p.label}</td>${Object.values(D.ROLES).map((r) => `<td>${r.pages.includes(p.id) ? '<ion-icon name="checkmark-circle"></ion-icon>' : '<span class="no">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>
  <div class="grid g2 mt">
    <div class="card">
      <div class="card-head"><h2 class="h2">Team</h2></div>
      <div class="list">${D.staff.map((s) => `<div class="list-item small"><span class="avatar" style="width:30px;height:30px;font-size:12px">${s.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span><div style="flex:1">${esc(s.name)}<div class="dim">${D.ROLES[s.role].label}</div></div><span class="dim">${fmtDate(s.lastSeen, true)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 class="h2">Data protection</h2></div>
      <div class="list small">
        <div class="list-item"><ion-icon name="lock-closed-outline" class="antique"></ion-icon>Encrypted in transit (TLS 1.3) and at rest (AES-256)</div>
        <div class="list-item"><ion-icon name="cloud-done-outline" class="antique"></ion-icon>Nightly backup 03:00, kept 30 days, EU data centre<span class="pill green" style="margin-left:auto">Today ✓</span></div>
        <div class="list-item"><ion-icon name="refresh-outline" class="antique"></ion-icon>Restore tested monthly; recovery within 4 hours</div>
        <div class="list-item"><ion-icon name="document-text-outline" class="antique"></ion-icon>Programme terms v1.2 · privacy notice v1.1, accepted at sign-up</div>
        <div class="list-item"><ion-icon name="key-outline" class="antique"></ion-icon>La Gora owns the data and can export it any time (CSV / Excel)</div>
      </div>
      <div class="caption dim mt-lg">Marketing consent</div>
      <div class="mt">${hbars([['Push', 'push'], ['Email', 'email'], ['Personalised offers', 'personalized'], ['SMS', 'sms']].map(([label, k]) => ({ label, value: D.programme.consents[k] })), { fmt: (v) => pct(v), labelW: 140 })}</div>
    </div>
  </div>
  <div class="card mt">
    <div class="card-head"><h2 class="h2">Data requests</h2><span class="small muted">Answer within 30 days</span></div>
    <div class="list">${state.dataRequests.map((r) => { const g = guestById(r.guestId); return `<div class="list-item small"><ion-icon name="${r.kind.startsWith('Delete') ? 'trash-outline' : 'download-outline'}" class="antique"></ion-icon><div style="flex:1"><b style="font-weight:600">${esc(r.kind)}</b> · ${esc(fullName(g))} <span class="dim mono">${g.memberNo}</span><div class="dim">Received ${fmtDate(r.at, true)}</div></div>${r.done ? '<span class="pill green">Done</span>' : `<button class="btn quiet sm" data-action="dr-done" data-id="${r.id}">${r.kind.startsWith('Delete') ? 'Anonymise' : 'Send export'}</button>`}</div>`; }).join('')}</div>
  </div>
  <div class="card flush mt">
    <div class="card-head" style="padding:20px 20px 0"><h2 class="h2">Audit log</h2>${exportButtons('audit')}</div>
    <div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead>
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
    : `<div class="locked"><ion-icon name="lock-closed-outline"></ion-icon><h1 class="h1" style="margin-top:12px">Not available for ${D.ROLES[state.role].label}</h1><p class="muted">This role can open: ${D.ROLES[state.role].pages.map((p) => NAV.find((n) => n.id === p).label).join(', ')}.</p></div>`;
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
  'reset-demo': () => { if (confirm('Reset all demo data to the starting point?')) { state = freshState(); ui.pos = { guestId: null, tokenState: null, outlet: 'restaurant', lines: [], receiptNo: null, result: null }; save(); render(); toast('Demo data reset'); } },
  'open-guest': (el, e) => { e.preventDefault(); ui.drawerGuest = el.dataset.id; log('Viewed guest profile', `${guestById(el.dataset.id).memberNo} ${fullName(guestById(el.dataset.id))}`); save(); renderDrawer(); },
  'close-drawer': () => { ui.drawerGuest = null; renderDrawer(); },
  'close-modal': () => closeModal(),
  'export': (el) => exportFor(el.dataset.id, el.dataset.kind),
  'soon': () => toast('The editor opens here in the full version', 'construct-outline'),

  'pos-scan': (el) => { ui.pos.guestId = el.dataset.id; ui.pos.tokenState = 'ok'; ui.pos.result = null; render(); },
  'pos-expired': () => { ui.pos.tokenState = 'expired'; log('Rejected expired QR code', 'Possible screenshot'); save(); render(); },
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
  'toggle-vip': (el) => { const g = guestById(el.dataset.id); g.vip = el.checked; log(g.vip ? 'Granted VIP status' : 'Removed VIP status', g.memberNo); save(); render(); toast(g.vip ? `${esc(g.first)} is now VIP` : 'VIP removed', 'star'); },
  'gdpr-export': (el) => {
    const g = guestById(el.dataset.id);
    const data = { profile: g, transactions: guestStats(g).tx, reservations: state.reservations.filter((r) => r.guestId === g.id), feedback: state.feedback.filter((f) => f.guestId === g.id) };
    download(`${g.memberNo}-data.json`, JSON.stringify(data, null, 2), 'application/json');
    log('Exported guest data (GDPR)', g.memberNo);
    save();
  },
  'gdpr-erase': (el) => {
    const g = guestById(el.dataset.id);
    if (!confirm(`Schedule erasure of ${fullName(g)}? Transactions are kept anonymised for accounting.`)) return;
    state.dataRequests.unshift({ id: `dr${Date.now()}`, guestId: g.id, kind: 'Delete my account', at: now(), done: false });
    log('Scheduled erasure (GDPR)', g.memberNo);
    save();
    render();
  },

  'res-day': (el) => { ui.resDay = el.dataset.v; render(); },
  'new-res': () => resModal(null),
  'edit-res': (el) => resModal(state.reservations.find((r) => r.id === el.dataset.id)),
  'res-approve': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'confirmed'; log('Confirmed reservation', `${r.kind} · ${guestById(r.guestId).memberNo} · ${r.date}`); save(); render(); toast('Confirmed, the guest gets a push notification'); },
  'res-decline': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'cancelled'; log('Declined reservation', `${r.kind} · ${guestById(r.guestId).memberNo}`); save(); render(); toast('Declined, the guest is told and offered other dates', 'close-circle'); },
  'res-cancel': (el) => { const r = state.reservations.find((x) => x.id === el.dataset.id); r.status = 'cancelled'; log('Cancelled reservation', `${guestById(r.guestId).memberNo} · ${r.date} ${r.time}`); save(); closeModal(); render(); toast('Reservation cancelled'); },

  'new-campaign': (el) => { if (!D.ROLES[state.role].pages.includes('campaigns')) return toast('Campaigns are for Marketing and Management', 'lock-closed-outline'); campaignModal(el.dataset.preset); },
  'save-campaign': (el) => saveCampaign(el.dataset.status),
  'toggle-auto': (el) => { const a = state.automations.find((x) => x.id === el.dataset.id); a.active = el.checked; log(a.active ? 'Turned on automation' : 'Turned off automation', a.name); save(); render(); },

  'complaint-next': (el) => { const c = state.complaints.find((x) => x.id === el.dataset.id); c.status = c.status === 'open' ? 'progress' : 'resolved'; log(c.status === 'resolved' ? 'Resolved complaint' : 'Started complaint', c.title); save(); render(); },

  'ledger-outlet': (el) => { ui.ledger.outlet = el.dataset.v; ui.ledger.limit = 60; render(); },
  'ledger-more': () => { ui.ledger.limit += 60; render(); },

  'stacking': (el) => { state.rules.stacking = el.dataset.v; log('Changed offer combining', el.dataset.v === 'best' ? 'Best one wins' : 'Add up'); save(); render(); },
  'del-exclusion': (el) => { const [x] = state.rules.exclusions.splice(+el.dataset.i, 1); log('Removed discount exception', x); save(); render(); },

  'add-partner': () => openModal(`
    <form data-form="partner">
      <div class="row between"><h2 class="h2">New partner</h2><button type="button" class="icon-btn" data-action="close-modal"><ion-icon name="close"></ion-icon></button></div>
      <label class="field mt"><span>Company</span><input class="input" name="name" required></label>
      <label class="field mt"><span>Kind</span><input class="input" name="kind" placeholder="Bank, hotel group, car brand…"></label>
      <label class="field mt"><span>Benefit for members</span><textarea class="input" name="benefit" rows="2" required></textarea></label>
      <div class="row mt-lg" style="justify-content:flex-end"><button class="btn">Add partner</button></div>
    </form>`),

  'dr-done': (el) => { const r = state.dataRequests.find((x) => x.id === el.dataset.id); r.done = true; log(r.kind.startsWith('Delete') ? 'Anonymised member (GDPR)' : 'Sent data export (GDPR)', guestById(r.guestId).memberNo); save(); render(); },
  'export-db': () => { exportFor('guests', 'csv'); log('Exported full database', `${state.guests.length} profiles`); save(); },
};

function exportFor(id, kind) {
  if (id === 'overview') {
    return exportRows(kind, 'lagora-loyalty-monthly', ['Month', 'New members', 'Active members', 'Visits', ...D.CATEGORIES.map((c) => `${c.label} (RSD)`), 'Total spend (RSD)', 'Discounts (RSD)', 'Points earned', 'Points redeemed', 'Points expired'],
      D.monthly.map((m) => [m.month, m.newMembers, m.activeMembers, m.visits, ...D.CATEGORIES.map((c) => m.spend[c.id]), m.total, m.discounts, m.pointsEarned, m.pointsRedeemed, m.pointsExpired]));
  }
  if (id === 'guests') {
    return exportRows(kind, 'lagora-guests', ['Card no.', 'First name', 'Last name', 'Email', 'Phone', 'Tier', 'VIP', 'Points', 'Visits', 'Total spend (RSD)', 'Joined', 'Birthday', 'Allergens', 'Favourite wines', 'Email consent', 'Push consent', 'SMS consent'],
      filteredGuests().map(({ g, s }) => [g.memberNo, g.first, g.last, g.email, g.phone, g.tier, g.vip ? 'yes' : '', g.points, s.visits, s.spend, g.joined, g.birthday || '', g.allergens.join('; '), g.wines.join('; '), g.consents.email ? 'yes' : 'no', g.consents.push ? 'yes' : 'no', g.consents.sms ? 'yes' : 'no']));
  }
  if (id === 'ledger') {
    return exportRows(kind, 'lagora-discount-ledger', ['Date', 'Time', 'Card no.', 'Guest', 'Receipt no.', 'Outlet', 'Product / service', 'Bill (RSD)', 'Discount %', 'Discount (RSD)', 'Staff'],
      ledgerRows().map(({ t, g }) => [new Date(t.date).toLocaleDateString('en-GB'), fmtTime(t.date), g.memberNo, fullName(g), t.receiptNo, cat(t.category).label, t.title, t.amount, t.discountPct, t.discount, t.staff]));
  }
  if (id === 'audit') {
    return exportRows(kind, 'lagora-audit-log', ['When', 'Who', 'What', 'Detail'], state.audit.map((a) => [new Date(a.at).toLocaleString('en-GB'), a.who, a.what, a.target]));
  }
}

function saveCampaign(status) {
  const f = ui.campaignDraft;
  if (!f.name.trim()) return toast('Give the campaign a name', 'alert-circle');
  const est = audienceEstimate(f);
  const seg = [f.tiers.length === 4 ? 'All tiers' : f.tiers.map((t) => t[0].toUpperCase() + t.slice(1)).join(' + '), f.inactive && 'no visit 120+ days', f.birthday && 'birthday this month', f.interest !== 'any' && { red: 'likes red', white: 'likes white', stays: 'has stayed' }[f.interest]].filter(Boolean).join(' · ');
  state.campaigns.unshift({ id: `c${Date.now()}`, name: f.name, kind: f.inactive ? 'Re-engagement' : 'Campaign', channels: f.channels, segment: seg, audience: est.reachable, status, date: f.date, opened: null, converted: null, revenue: null });
  log(status === 'Draft' ? 'Saved campaign draft' : 'Scheduled campaign', f.name);
  save();
  closeModal();
  if (route() !== 'campaigns') location.hash = '#/campaigns'; else render();
  toast(status === 'Draft' ? 'Draft saved' : `Scheduled for ${fmtDate(f.date, true)} · ${n0(est.reachable)} members`);
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
    log('Changed tier manually', `${g.memberNo} ${g.tier} → ${el.value}`);
    g.tier = el.value;
    save();
    render();
    return toast(`${esc(g.first)} moved to ${el.value}`);
  }
  if (el.id === 'role') {
    state.role = el.value;
    ui.drawerGuest = null;
    save();
    const allowed = D.ROLES[state.role].pages;
    if (!allowed.includes(route())) location.hash = `#/${allowed[0]}`;
    render();
    return toast(`Viewing as ${D.ROLES[state.role].label}`, 'person-circle-outline');
  }
  if (el.dataset.ruleBool) {
    setPath(state.rules, el.dataset.ruleBool, el.checked);
    log('Changed loyalty rule', `${el.dataset.ruleBool} → ${el.checked ? 'on' : 'off'}`);
    save();
    render();
    return toast('Saved · applies to the next bill');
  }
  if (el.dataset.rule) {
    const v = parseFloat(el.value);
    if (!Number.isFinite(v) || v < 0) { el.value = getPath(state.rules, el.dataset.rule); return; }
    const old = getPath(state.rules, el.dataset.rule);
    if (old === v) return;
    setPath(state.rules, el.dataset.rule, v);
    log('Changed loyalty rule', `${el.dataset.rule}: ${old} → ${v}`);
    save();
    render();
    return toast('Saved · applies to the next bill');
  }
  if (el.dataset.content) {
    setPath(state.content, el.dataset.content, el.checked);
    log('Updated app content', el.dataset.content);
    save();
    return toast(el.checked ? 'Live in the app' : 'Hidden from the app');
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
    if (Math.abs(pts) > 1000 && state.role !== 'management') return toast('Over 1,000 points needs a manager', 'lock-closed-outline');
    g.points = Math.max(0, g.points + pts);
    const t = tierForPoints(g.points);
    if (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(g.tier)) { log('Automatic tier upgrade', `${g.memberNo} ${g.tier} → ${t}`); g.tier = t; }
    state.transactions.unshift({ id: `tx_${Date.now()}`, guestId: g.id, date: now(), category: 'event', title: `Ručno: ${data.reason}`, amount: 0, discountPct: 0, discount: 0, points: pts, receiptNo: `MANUAL-${Date.now() % 100000}`, staff: 'Admin' });
    log(`Awarded ${n0(pts)} points`, `${g.memberNo} · ${data.reason}`);
    save();
    render();
    return toast(`+${n0(pts)} points for ${esc(g.first)}`, 'sparkles');
  }
  if (kind === 'res') {
    const id = form.dataset.id;
    const r = id ? state.reservations.find((x) => x.id === id) : { id: `r${Date.now()}`, kind: 'restaurant' };
    Object.assign(r, { guestId: data.guestId, date: data.date, time: data.time, guests: +data.guests, status: data.status, note: data.note });
    if (!id) state.reservations.push(r);
    log(id ? 'Changed reservation' : 'Created reservation', `${guestById(r.guestId).memberNo} · ${r.date} ${r.time} · ${r.guests}`);
    ui.resDay = r.date;
    save();
    closeModal();
    render();
    return toast(id ? 'Reservation updated, guest notified' : 'Booked, confirmation sent to the guest');
  }
  if (kind === 'campaign') return saveCampaign('Scheduled');
  if (kind === 'exclusion') {
    const v = data.ex.trim();
    if (!v) return;
    state.rules.exclusions.push(v);
    log('Added discount exception', v);
    save();
    render();
    return toast('Exception added');
  }
  if (kind === 'partner') {
    state.partners.push({ id: `p${Date.now()}`, name: data.name, kind: data.kind || 'Partner', status: 'Draft', benefit: data.benefit, members: 0, uses: 0 });
    log('Added partner', data.name);
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
    : '<div class="empty small">No guest found</div>';
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

$('#today').textContent = D.TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
render();
