# Barcelona — interactive transport map

Interactive, poster-grade map of the public transport of the **Barcelona
metropolitan area**: TMB's buses and metro, the five TRAM lines, FGC's and
Rodalies' commuter railways, the Montjuïc and Vallvidrera funiculars, and the
bus networks of the towns around — drawn along the real street and track
geometry.

## Live

**https://miqell24.github.io/barcelona-bus-map/** — GitHub Pages from `main:/docs`. Local build on port 8189 (`npm run serve`).

## One feed, and it is not a Barcelona feed

The source is the open transport data of **Catalonia** (ATM / Generalitat,
published through MobilityDatabase as `mdb-2832`): 1 615 routes of 180
operators and 27 927 stops, from TMB's metro to a village coach in the
Pyrenees. So the sheet has to be cut, and `pipeline/scope.mjs` cuts it by
distance from Plaça de Catalunya — 22 km, which reaches Mataró, Terrassa,
Sabadell and Martorell:

| mode | route_type | needs | what that keeps |
|---|---|---|---|
| tram | 0 | 50 % of stops inside | T1, T3, T4, T5, T6 — the Trambaix and the Trambesòs |
| metro | 1 | 50 % | L1–L5, L9N/L9S, L10N/L10S, L11 (TMB) and L6, L7, L8, L12 (FGC) |
| funicular | 7 | 50 % | Montjuïc (FM) and Vallvidrera (FV); Montserrat's cable railways are 37 km away and stay out |
| train | 2 | 40 %, and at least five stations inside | FGC's S1–S9 and R5–R63, Rodalies' R1, R2, R2N, R2S, R7, R8 |
| bus | 3 | 60 % | TMB, the AMB carriers (TUSGSAL, Soler i Sauret, Baixbus, Avanza) and the town networks of Sabadell, Terrassa, Mataró, Badalona… |
| coach | 200 | — | dropped: those are the intercity services of Alsina Graells, Sagalés and the rest |

A line that passes is drawn **whole**, the way the Berlin map draws its RB/RE:
FGC's R6 keeps its run to Manresa and Rodalies' R1 its run to Maçanet. The
five-station rule is what keeps a high-speed train that calls once at Sants
(Iryo) off a city map.

Worth knowing:

- **Line keys carry an operator code where a name is shared.** Twenty-six
  numbers belong to more than one of the thirty operators — Barcelona's 1 is
  also a Sabadell line and a Terrassa line, and the metro L1 shares its name
  with a bus — so those keys read `tmb:1`, `tus:L1`, and print bare on the
  street. The panel groups its chips by operator. The Randstad rule.
- **The trams are red.** The feed ships TRAM's own line colours, and they are
  kept out on purpose: on these maps the colour says the MODE. The metro is the
  family's exception — a metro keeps its livery — so L1 is red, L2 purple, L3
  green, L4 yellow and L5 blue, straight from the feed.
- **A funicular is a railway.** OSM tags Montjuïc and Vallvidrera
  `railway=funicular`, which the graph builder does not know, so those ways are
  admitted and renamed before the graph is built — the rule Vienna's
  Verbindungsbahn set.
- **The OSM comes from Geofabrik, not Overpass**: `pipeline/pbf-tiles.py`
  (needs `pip3 install --user osmium`) cuts a 3 × 3 road grid over the
  metropolitan area and one much larger rail box out of
  `cataluna-latest.osm.pbf`, because the trains run far past the roads.

## Pipeline

`npm run download` fetches the feed, computes the scope, cuts the OSM and
vendors MapLibre GL. `npm run build` map-matches every line (HMM/Viterbi on the
OSM graphs) and writes GeoJSON to `data/out/`. `npm run serve` hosts the map at
http://localhost:8189.

Data: ATM / Generalitat de Catalunya open transport data · base map
© OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.
