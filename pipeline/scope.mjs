// Picks what belongs on a Barcelona map and writes data/scope.json: which
// routes of the feed are on the sheet, the line KEY and the operator of each.
//
// ONE feed makes this map, and it is not a Barcelona feed: the ATM/Generalitat
// bundle (mirrored as mdb-2832) is the whole of CATALONIA — 1 615 routes of
// 180 operators, from TMB's metro to a village coach in the Pyrenees. So the
// sheet has to be cut, and it is cut by DISTANCE from Plaça de Catalunya, the
// way the Paris and Copenhagen maps cut their national feeds:
//
//   * trams (route_type 0), metro (1) and funiculars (7) — the urban rail —
//     ride in if at least half their stops are within CORE_KM. That keeps
//     T1–T6, L1–L12 and the Montjuïc and Vallvidrera funiculars, and drops
//     the Montserrat cable railways, which are 37 km away and belong to a
//     different mountain;
//   * buses (3) need 60 % of their stops inside: TMB, the AMB operators and
//     the town networks of the metropolitan ring stay, the intercity coaches
//     of Alsina Graells, Sagalés and the rest do not;
//   * trains (2) need only 40 %, because a commuter line is half suburban by
//     definition — that takes the FGC network (S1–S9, R5, R6, R50…R63) and
//     Rodalies' metropolitan lines (R1, R2, R2N, R2S, R7, R8) and leaves the
//     long-distance ones (R13…R17, RG1, the LAV and Iryo);
//   * long-distance coaches (route_type 200) are not on any city map.
//
// A line that passes is drawn WHOLE, the way Berlin draws its RB/RE: FGC's R6
// keeps its run to Manresa and Rodalies' R1 its run to Maçanet.
//
// LINE KEYS: with 180 operators the same number is used many times over —
// Barcelona's bus 1 is also a Sabadell line and a Terrassa line, and the metro
// L1 shares its name with a funicular. A name used by more than one operator
// therefore carries that operator's code in the KEY (tmb:1, tus:1) and prints
// bare on the street; the panel groups its chips by operator. The Randstad
// rule, as in Berlin and Vienna.
//
// Run by download.sh after the feed is unpacked; build.mjs needs the result.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iterCsv, readCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');

const t0 = Date.now();
const log = (m) => console.log(`[scope ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

// Plaça de Catalunya, and the radius that is "the metropolitan area" here:
// 22 km reaches Mataró, Terrassa, Sabadell, Martorell and Vilanova's edge.
const CORE = [41.3874, 2.1700];
const CORE_KM = 22;
const SHARE = { 0: 0.5, 1: 0.5, 7: 0.5, 3: 0.6, 2: 0.4 };
const kmTo = ([la, lo]) => Math.hypot((la - CORE[0]) * 111.13, (lo - CORE[1]) * 111.32 * Math.cos(CORE[0] * Math.PI / 180));

const stops = new Map();
for (const s of await readCsv(join(GD, 'stops.txt'))) {
  const la = Number(s.stop_lat), lo = Number(s.stop_lon);
  if (Number.isFinite(la) && Number.isFinite(lo)) stops.set(s.stop_id, [la, lo]);
}
log(`${stops.size} przystanków w feedzie`);

const routes = await readCsv(join(GD, 'routes.txt'));
const routeOf = new Map();
for await (const t of iterCsv(join(GD, 'trips.txt'))) routeOf.set(t.trip_id, t.route_id);
const seen = new Map();          // route_id → Set(stop_id)
for await (const st of iterCsv(join(GD, 'stop_times.txt'))) {
  const rid = routeOf.get(st.trip_id);
  if (!rid) continue;
  let set = seen.get(rid);
  if (!set) seen.set(rid, (set = new Set()));
  set.add(st.stop_id);
}
log(`${routeOf.size} kursów, ${seen.size} tras ze stopami`);

const keep = [];
const dropped = { far: 0, coach: 0, empty: 0 };
let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
for (const r of routes) {
  const type = (r.route_type || '').trim();
  if (type === '200') { dropped.coach++; continue; }
  const share = SHARE[type];
  if (share === undefined) { dropped.coach++; continue; }
  const pts = [...(seen.get(r.route_id) || [])].map((s) => stops.get(s)).filter(Boolean);
  if (!pts.length) { dropped.empty++; continue; }
  const near = pts.filter((p) => kmTo(p) <= CORE_KM).length;
  const inside = near / pts.length;
  if (inside < share) { dropped.far++; continue; }
  // a train that calls at one or two stations here is passing through, not
  // serving the area: Iryo's high-speed run stops at Sants and nowhere else
  // and would otherwise clear the 40 % bar on two stops
  if (type === '2' && near < 5) { dropped.far++; continue; }
  keep.push(r.route_id);
  for (const [la, lo] of pts) {
    if (la < latMin) latMin = la; if (la > latMax) latMax = la;
    if (lo < lonMin) lonMin = lo; if (lo > lonMax) lonMax = lo;
  }
}
const box = [latMin, lonMin, latMax, lonMax];
log(`na arkuszu: ${keep.length} tras (odrzucone: ${dropped.far} poza obszarem, `
  + `${dropped.coach} dalekobieżne/inne typy, ${dropped.empty} bez przystanków)`);
log(`zasięg: lat ${latMin.toFixed(3)}–${latMax.toFixed(3)}, lon ${lonMin.toFixed(3)}–${lonMax.toFixed(3)}`);

// ---- operators: a short code and a printable name -------------------------
const OP_CODE = [
  [/^TMB$/i, 'tmb'],
  [/^TRAM|Tramvia/i, 'tram'],
  [/Ferrocarrils de la Generalitat|^FGC$/i, 'fgc'],
  [/Renfe|Rodalies/i, 'renfe'],
  [/TUSGSAL/i, 'tusgsal'],
  [/Soler i Sauret/i, 'soler'],
  [/Avanza|Mohn/i, 'avanza'],
  [/Sagalés/i, 'sagales'],
  [/Sabadell/i, 'tus'],
  [/Terrassa/i, 'tmesa'],
  [/Mataró|CTSA/i, 'mataro'],
  [/^EMT$/i, 'emt'],
  [/Baixbus|Rosanbus|Oliveras/i, 'baixbus'],
];
const initials = (name) => (name.match(/\p{L}+/gu) || ['op']).slice(0, 3)
  .map((w) => w[0]).join('').toLowerCase() || 'op';
const codeOf = (name) => (OP_CODE.find(([re]) => re.test(name)) || [null, initials(name)])[1];

const agencies = new Map();
for (const a of await readCsv(join(GD, 'agency.txt'))) agencies.set(a.agency_id, a.agency_name);
const code = new Map();
for (const [id, name] of agencies) code.set(id, codeOf(name));
const opName = {};
for (const [id, name] of agencies) {
  const c = code.get(id);
  const short = name.replace(/\s*\b(S\.?A\.?U?|S\.?L\.?U?|SCCL|SA|SL)\b\.?/g, '')
    .replace(/\s*,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  if (!opName[c] || short.length < opName[c].length) opName[c] = short;
}

// ---- line keys: an operator code where a name is used by more than one -----
const kept = new Set(keep);
const byName = new Map();
for (const r of routes) {
  if (!kept.has(r.route_id)) continue;
  const sn = (r.route_short_name || '').trim();
  if (!sn) continue;
  let set = byName.get(sn);
  if (!set) byName.set(sn, (set = new Set()));
  set.add(code.get(r.agency_id));
}
const shared = new Set([...byName].filter(([, ops]) => ops.size > 1).map(([sn]) => sn));
const key = {}, op = {};
for (const r of routes) {
  if (!kept.has(r.route_id)) continue;
  const sn = (r.route_short_name || '').trim() || (r.route_long_name || '').trim();
  const c = code.get(r.agency_id);
  key[r.route_id] = shared.has(sn) ? `${c}:${sn}` : sn;
  op[r.route_id] = c;
}
log(`${new Set(Object.values(key)).size} linii, ${new Set(Object.values(op)).size} przewoźników, `
  + `${shared.size} numerów u więcej niż jednego (dostaną kod w kluczu)`);

writeFileSync(join(ROOT, 'data/scope.json'),
  JSON.stringify({ keep, bbox: box, key, op, opName }, null, 0));
log('zapisano data/scope.json');
