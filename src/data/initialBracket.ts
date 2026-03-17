/* ─────────────────────────────────────────────────────────────────
   Initial bracket data for Monte Carlo simulation
   Sources: KenPom AdjEM (Mar 16, 2026), injury reports, conference
   tournament results as of Selection Sunday.
   ───────────────────────────────────────────────────────────────── */

export type RegionKey = 'east' | 'west' | 'midwest' | 'south';

export interface SimTeam {
  seed: number;
  name: string;
  /** KenPom Adjusted Efficiency Margin, Mar 16 2026 */
  rating: number;
  /**
   * Permanent structural adjustment (injuries, suspensions).
   * Applied in full for every round — these don't heal mid-tournament.
   */
  injuryAdj: number;
  /**
   * Recency/momentum adjustment from conference tournament or recent form.
   * Decays each round via decay(r) = max(0.1, 1 - r * 0.18).
   * Hot streaks are real entering the tourney but regress to mean over time.
   */
  momentumAdj: number;
  /** Human-readable source for any non-zero adjustments */
  notes: string;
}

/** 8 R64 matchup pairs per region, in bracket order */
export type RegionBracket = [SimTeam, SimTeam][];

function t(
  seed: number,
  name: string,
  rating: number,
  injuryAdj = 0,
  momentumAdj = 0,
  notes = ''
): SimTeam {
  return { seed, name, rating, injuryAdj, momentumAdj, notes };
}

/* ─── East Region ─────────────────────────────────────────────────
   Note: East R64 is missing the 1v16 game in the display data
   because Duke entered after a First Four game. We insert it here
   so the simulation has a full 8-game region bracket.
   ───────────────────────────────────────────────────────────────── */
const east: RegionBracket = [
  // 1 vs 16 (First Four winner — Siena won, KenPom ~192)
  [
    t(
      1,
      'Duke',
      38.9,
      -2.5,
      1.0,
      'Foster (starter PG) out w/ foot fracture; Ngongba (C, 10.7 ppg) day-to-day; won ACC tournament'
    ),
    t(16, 'Siena', 2.0),
  ],
  // 8 vs 9
  [t(8, 'Ohio State', 21.5), t(9, 'TCU', 18.0)],
  // 5 vs 12
  [
    t(5, "St. John's", 25.5, 0, 1.0, 'Won Big East tournament'),
    t(12, 'N. Iowa', 13.0),
  ],
  // 4 vs 13
  [t(4, 'Kansas', 23.0), t(13, 'Cal Baptist', 8.5)],
  // 6 vs 11
  [
    t(6, 'Louisville', 24.0),
    t(11, 'S. Florida', 16.5, 0, 0.5, 'Won American Athletic tournament'),
  ],
  // 3 vs 14
  [t(3, 'Michigan St.', 29.5), t(14, 'NDSU', 8.0)],
  // 7 vs 10
  [t(7, 'UCLA', 21.0), t(10, 'UCF', 15.5)],
  // 2 vs 15
  [t(2, 'UConn', 27.5), t(15, 'Furman', 3.5)],
];

/* ─── West Region ─────────────────────────────────────────────────── */
const west: RegionBracket = [
  // 1 vs 16
  [
    t(
      1,
      'Arizona',
      37.5,
      -0.5,
      0.5,
      'Bradley (Big 12 POY) playing through hand/thumb brace but won tournament MVP with it; won Big 12 tournament'
    ),
    t(16, 'LIU', 1.5),
  ],
  // 8 vs 9
  [t(8, 'Villanova', 20.0), t(9, 'Utah State', 20.5)],
  // 5 vs 12
  [
    t(5, 'Wisconsin', 23.0),
    t(12, 'High Point', 10.0, 0, 0.5, 'Won Big South tournament, 30-4 record'),
  ],
  // 4 vs 13
  [
    t(
      4,
      'Arkansas',
      24.5,
      -0.5,
      1.5,
      'Acuff ankle injury; won SEC tournament (first since 2000)'
    ),
    t(13, 'Hawaii', 8.0, 0, 0.5, 'Won Big West tournament'),
  ],
  // 6 vs 11  (Texas★ = First Four winner)
  [t(6, 'BYU', 22.5), t(11, 'Texas★', 19.0)],
  // 3 vs 14
  [t(3, 'Gonzaga', 29.0), t(14, 'Kennesaw St.', 4.5)],
  // 7 vs 10
  [t(7, 'Miami (FL)', 20.5), t(10, 'Missouri', 16.0)],
  // 2 vs 15
  [
    t(
      2,
      'Purdue',
      31.2,
      0,
      2.5,
      'Won Big Ten tournament as #7 seed; beat #3 Michigan 80-72 in final on Mar 15'
    ),
    t(15, 'Queens', 3.0),
  ],
];

/* ─── Midwest Region ─────────────────────────────────────────────── */
const midwest: RegionBracket = [
  // 1 vs 16  (Howard★ = First Four winner)
  [
    t(
      1,
      'Michigan',
      37.6,
      0,
      -1.0,
      'Lost Big Ten final to 7-seed Purdue on Mar 15, day before Selection Sunday'
    ),
    t(16, 'Howard★', 2.0),
  ],
  // 8 vs 9
  [t(8, 'Georgia', 20.5), t(9, 'Saint Louis', 18.0)],
  // 5 vs 12
  [
    t(
      5,
      'Texas Tech',
      23.5,
      -2.0,
      0,
      'JT Toppin (21.8 ppg, 10.8 reb) season-ending ACL Feb 17; partially priced into KenPom'
    ),
    t(
      12,
      'Akron',
      14.0,
      0,
      1.0,
      '3rd consecutive MAC title, program-record 29 wins'
    ),
  ],
  // 4 vs 13
  [
    t(
      4,
      'Alabama',
      25.0,
      -5.5,
      0,
      'Aden Holloway (16.8 ppg, 43.8% 3PT, #2 scorer) removed from team after drug arrest; confirmed out'
    ),
    t(13, 'Hofstra', 10.5),
  ],
  // 6 vs 11  (SMU★ = First Four winner)
  [t(6, 'Tennessee', 26.0), t(11, 'SMU★', 18.0)],
  // 3 vs 14
  [t(3, 'Virginia', 27.0), t(14, 'Wright State', 6.0)],
  // 7 vs 10
  [t(7, 'Kentucky', 21.0), t(10, 'Santa Clara', 19.5)],
  // 2 vs 15
  [t(2, 'Iowa State', 32.4), t(15, 'Tenn. State', 3.0)],
];

/* ─── South Region ─────────────────────────────────────────────────
   Note: Prairie View★ = First Four winner
   ───────────────────────────────────────────────────────────────── */
const south: RegionBracket = [
  // 1 vs 16  (Prairie View★ = First Four winner)
  [
    t(1, 'Florida', 33.8, 0, -0.5, 'Lost SEC tournament final to Arkansas'),
    t(16, 'Prairie View★', 0.5),
  ],
  // 8 vs 9
  [t(8, 'Clemson', 19.5), t(9, 'Iowa', 22.0)],
  // 5 vs 12
  [t(5, 'Vanderbilt', 28.0), t(12, 'McNeese', 13.5)],
  // 4 vs 13
  [t(4, 'Nebraska', 26.5), t(13, 'Troy', 6.0)],
  // 6 vs 11
  [
    t(6, 'N. Carolina', 21.0),
    t(11, 'VCU', 17.0, 0, 0.5, 'Won A-10 tournament'),
  ],
  // 3 vs 14
  [
    t(3, 'Illinois', 32.1),
    t(14, 'Penn', 5.0, 0, 0.5, 'Won Ivy League tournament in OT'),
  ],
  // 7 vs 10
  [t(7, "St. Mary's", 22.0), t(10, 'Texas A&M', 18.5)],
  // 2 vs 15
  [
    t(2, 'Houston', 33.4),
    t(15, 'Idaho', 6.0, 0, 0.5, 'Won Big Sky tournament'),
  ],
];

export const INITIAL_BRACKET: Record<RegionKey, RegionBracket> = {
  east,
  west,
  midwest,
  south,
};

/** Flat list of all 64 tournament teams (for initializing result counters) */
export const ALL_TEAMS: SimTeam[] = Object.values(INITIAL_BRACKET).flatMap(
  region => region.flatMap(([a, b]) => [a, b])
);
