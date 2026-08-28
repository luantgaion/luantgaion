/* Builds stats.svg from the GitHub API.
   Written out as a file in this repository rather than rendered on demand by a
   third-party service, so the profile cannot break when that service is down —
   which is exactly what happened to the card this replaced. */
import { writeFileSync } from 'node:fs';

const USER = 'luantgaion';
const TOKEN = process.env.GITHUB_TOKEN;
const api = async (p) => {
  const r = await fetch('https://api.github.com' + p, {
    headers: { 'User-Agent': 'stats', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }
  });
  if (!r.ok) throw new Error(p + ' -> HTTP ' + r.status);
  return r.json();
};

const user  = await api(`/users/${USER}`);
const repos = await api(`/users/${USER}/repos?per_page=100&type=owner`);

/* language bytes, summed across every owned repository */
const bytes = {};
for (const r of repos) {
  if (r.fork) continue;
  const l = await api(`/repos/${USER}/${r.name}/languages`);
  for (const k in l) bytes[k] = (bytes[k] || 0) + l[k];
}
const langs = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
const total = langs.reduce((a, b) => a + b[1], 0);

const years = Math.floor((Date.now() - Date.parse(user.created_at)) / 31557600000);
const pad   = (n) => String(n).padStart(2, '0');

/* ---- layout ------------------------------------------------------------ */
const W = 1000, H = 340, P = 56;
const INK = '#ECECEC';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const mono = (x, y, t, o = 0.5, size = 11, anchor = 'start', track = 2.2) =>
  `  <text x="${x}" y="${y}" text-anchor="${anchor}" fill="${INK}" opacity="${o}" ` +
  `font-family="JetBrains Mono, SFMono-Regular, Consolas, monospace" font-size="${size}" ` +
  `letter-spacing="${track}">${esc(t)}</text>\n`;

const stats = [
  [pad(repos.filter(r => !r.fork).length), 'REPOSITORIES'],
  [pad(langs.length),                      'LANGUAGES'],
  [pad(years),                             'YEARS ON GITHUB']
];

let s = '';
const colW = (W - P * 2) / stats.length;
s += `  <line x1="${P}" y1="60" x2="${W - P}" y2="60" stroke="${INK}" stroke-width="1" opacity="0.35"/>\n`;
stats.forEach(([n, label], i) => {
  const x = P + colW * i;
  if (i) s += `  <line x1="${x}" y1="60" x2="${x}" y2="168" stroke="${INK}" stroke-width="1" opacity="0.35"/>\n`;
  s += `  <text x="${x + 22}" y="128" fill="${INK}" font-family="Archivo, Arial Black, Helvetica, Arial, sans-serif" ` +
       `font-weight="900" font-size="58" letter-spacing="-2.5">${n}</text>\n`;
  s += mono(x + 24, 154, label);
});
s += `  <line x1="${P}" y1="168" x2="${W - P}" y2="168" stroke="${INK}" stroke-width="1" opacity="0.35"/>\n`;

/* stacked language bar, lightest = most used */
const BW = W - P * 2, BY = 218, BH = 15;
let cx = P;
langs.forEach(([, v], i) => {
  const w = (v / total) * BW;
  s += `  <rect x="${cx.toFixed(1)}" y="${BY}" width="${Math.max(w, 0.6).toFixed(1)}" height="${BH}" ` +
       `fill="${INK}" opacity="${Math.max(0.86 - i * 0.075, 0.12).toFixed(3)}"/>\n`;
  cx += w;
});

/* legend: the ones actually worth naming */
langs.slice(0, 6).forEach(([k, v], i) => {
  const x = P + (BW / 6) * i;
  s += `  <rect x="${x}" y="${BY + 44}" width="9" height="9" fill="${INK}" opacity="${(0.86 - i * 0.075).toFixed(3)}"/>\n`;
  s += mono(x + 16, BY + 53, `${k}  ${(v / total * 100).toFixed(1)}%`, 0.62, 10, 'start', 1);
});

s += mono(P, 40, 'GITHUB', 0.45);
s += mono(W - P, 40, new Date().toISOString().slice(0, 10), 0.3, 11, 'end');

writeFileSync(new URL('../stats.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ` +
  `role="img" aria-label="GitHub statistics for ${USER}">\n` +
  `  <rect width="${W}" height="${H}" fill="#0A0A0A"/>\n${s}</svg>\n`);

console.log(`stats.svg written — ${langs.length} languages, ${total.toLocaleString()} bytes`);
