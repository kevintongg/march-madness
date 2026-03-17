/* ─────────────────────────────────────────────────────────────────
   Monte Carlo bracket simulation
   ───────────────────────────────────────────────────────────────── */

import {
  INITIAL_BRACKET,
  ALL_TEAMS,
  type SimTeam,
  type RegionKey,
} from '../data/initialBracket';

/* ─── Model constants ──────────────────────────────────────────── */

/**
 * Logistic scale factor for tournament games.
 * Regular season KenPom uses σ=10; we use 15 to model the higher
 * single-elimination variance of neutral-site March play.
 */
const SIGMA = 15;

/**
 * Weight given to KenPom probability in the R64 blend.
 * Remainder (0.40) goes to historical seed matchup rates.
 */
const BLEND_ALPHA = 0.6;

/**
 * Historical R64 win rates for the UNDERDOG (higher seed number).
 * Key = "{favorSeed}v{underdogSeed}" e.g. "1v16".
 * Source: NCAA tournament history 1985–2024.
 */
const HISTORICAL_R64: Record<string, number> = {
  '1v16': 0.013,
  '2v15': 0.06,
  '3v14': 0.15,
  '4v13': 0.21,
  '5v12': 0.35,
  '6v11': 0.37,
  '7v10': 0.39,
  '8v9': 0.487,
};

/* ─── Manual bracket picks for agree% tracking ────────────────── */

/**
 * The manually-picked winner for every game in the bracket.
 * Key format: "{region|ff}-r{roundIdx}-g{gameIdx}"
 *
 * Region round indices: 0=R64, 1=R32, 2=S16, 3=E8
 * FF round indices: 4=semis, 5=championship
 */
const MANUAL_PICKS: Record<string, string> = {
  // East R64 (g0 = Duke 1v16, not in display data but in sim data)
  'east-r0-g0': 'Duke',
  'east-r0-g1': 'TCU',
  'east-r0-g2': "St. John's",
  'east-r0-g3': 'Kansas',
  'east-r0-g4': 'Louisville',
  'east-r0-g5': 'Michigan St.',
  'east-r0-g6': 'UCLA',
  'east-r0-g7': 'UConn',
  // East R32
  'east-r1-g0': 'Duke',
  'east-r1-g1': 'Kansas',
  'east-r1-g2': 'Michigan St.',
  'east-r1-g3': 'UConn',
  // East S16
  'east-r2-g0': 'Duke',
  'east-r2-g1': 'UConn',
  // East E8
  'east-r3-g0': 'Duke',

  // West R64
  'west-r0-g0': 'Arizona',
  'west-r0-g1': 'Utah State',
  'west-r0-g2': 'Wisconsin',
  'west-r0-g3': 'Arkansas',
  'west-r0-g4': 'Texas★',
  'west-r0-g5': 'Gonzaga',
  'west-r0-g6': 'Missouri',
  'west-r0-g7': 'Purdue',
  // West R32
  'west-r1-g0': 'Arizona',
  'west-r1-g1': 'Arkansas',
  'west-r1-g2': 'Gonzaga',
  'west-r1-g3': 'Purdue',
  // West S16
  'west-r2-g0': 'Arizona',
  'west-r2-g1': 'Purdue',
  // West E8
  'west-r3-g0': 'Arizona',

  // Midwest R64
  'midwest-r0-g0': 'Michigan',
  'midwest-r0-g1': 'Georgia',
  'midwest-r0-g2': 'Texas Tech',
  'midwest-r0-g3': 'Alabama',
  'midwest-r0-g4': 'SMU★',
  'midwest-r0-g5': 'Virginia',
  'midwest-r0-g6': 'Kentucky',
  'midwest-r0-g7': 'Iowa State',
  // Midwest R32
  'midwest-r1-g0': 'Michigan',
  'midwest-r1-g1': 'Alabama',
  'midwest-r1-g2': 'Virginia',
  'midwest-r1-g3': 'Iowa State',
  // Midwest S16
  'midwest-r2-g0': 'Michigan',
  'midwest-r2-g1': 'Iowa State',
  // Midwest E8
  'midwest-r3-g0': 'Michigan',

  // South R64
  'south-r0-g0': 'Florida',
  'south-r0-g1': 'Iowa',
  'south-r0-g2': 'McNeese',
  'south-r0-g3': 'Nebraska',
  'south-r0-g4': 'N. Carolina',
  'south-r0-g5': 'Illinois',
  'south-r0-g6': 'Texas A&M',
  'south-r0-g7': 'Houston',
  // South R32
  'south-r1-g0': 'Florida',
  'south-r1-g1': 'Nebraska',
  'south-r1-g2': 'Illinois',
  'south-r1-g3': 'Houston',
  // South S16
  'south-r2-g0': 'Florida',
  'south-r2-g1': 'Houston',
  // South E8
  'south-r3-g0': 'Houston',

  // Final Four semis
  'ff-r4-g0': 'Duke', // East vs South
  'ff-r4-g1': 'Michigan', // Midwest vs West
  // Championship
  'ff-r5-g0': 'Michigan',
};

/* ─── Types ────────────────────────────────────────────────────── */

export interface SimResults {
  /**
   * Championship win probability per team name.
   * e.g. { "Duke": 0.294, "Michigan": 0.228 }
   */
  champPct: Record<string, number>;
  /**
   * Per-round survival probability. Index = round (0=R64 survivor, …, 5=Champion).
   * e.g. { "Duke": [0.99, 0.82, 0.67, 0.51, 0.37, 0.294] }
   */
  roundReach: Record<string, number[]>;
  /**
   * How often the sim agrees with the manual pick for each game.
   * Key: "{region|ff}-r{roundIdx}-g{gameIdx}"
   * Value: fraction of simulations where the manually-picked team won that game.
   */
  pickAgree: Record<string, number>;
}

/* ─── Core probability helpers ─────────────────────────────────── */

/**
 * Momentum decay per round.
 * Round 0 (R64): 100%, Round 1 (R32): 82%, …, Round 5 (championship): 10%.
 */
function momentumDecay(round: number): number {
  return Math.max(0.1, 1 - round * 0.18);
}

/** Effective KenPom-equivalent rating for a team at a given round. */
function getAdjRating(team: SimTeam, round: number): number {
  return team.rating + team.injuryAdj + team.momentumAdj * momentumDecay(round);
}

/**
 * Win probability for team A over team B at a given tournament round.
 * R64: blends KenPom logistic with historical seed-vs-seed rates.
 * Later rounds: pure KenPom logistic with σ=15.
 */
function winProb(a: SimTeam, b: SimTeam, round: number): number {
  const diff = getAdjRating(a, round) - getAdjRating(b, round);
  const pKenpom = 1 / (1 + Math.exp(-diff / SIGMA));

  if (round !== 0) return pKenpom;

  // R64: blend with historical seed win rates
  const loSeed = Math.min(a.seed, b.seed);
  const hiSeed = Math.max(a.seed, b.seed);
  const key = `${loSeed}v${hiSeed}`;
  const historicalUnderdogRate = HISTORICAL_R64[key] ?? 0.5;
  const pHistorical =
    a.seed > b.seed ? historicalUnderdogRate : 1 - historicalUnderdogRate;

  return BLEND_ALPHA * pKenpom + (1 - BLEND_ALPHA) * pHistorical;
}

function simulateGame(a: SimTeam, b: SimTeam, round: number): SimTeam {
  return Math.random() < winProb(a, b, round) ? a : b;
}

/* ─── Single tournament simulation ────────────────────────────── */

/**
 * Simulate one full tournament. Returns a map of game key → winner name.
 *
 * Bracket structure per region:
 *   R64 (round 0): 8 matchups → 8 winners
 *   R32 (round 1): pair adjacent winners → 4 matchups → 4 winners
 *   S16 (round 2): pair adjacent winners → 2 matchups → 2 winners
 *   E8  (round 3): pair adjacent winners → 1 matchup  → 1 region winner
 * FF (round 4): East vs South, Midwest vs West
 * Championship (round 5): FF winners
 */
function simulateOnce(): Record<string, string> {
  const result: Record<string, string> = {};
  const regionKeys: RegionKey[] = ['east', 'west', 'midwest', 'south'];
  const regionWinners: SimTeam[] = [];

  for (const region of regionKeys) {
    // Each element is [teamA, teamB]; after each round it becomes [winnerA, winnerB]
    // for the next round's matchup pairings.
    let matchups: [SimTeam, SimTeam][] = INITIAL_BRACKET[region].map(
      ([a, b]) => [a, b]
    );

    for (let round = 0; round < 4; round++) {
      // Simulate every matchup in this round
      const roundWinners: SimTeam[] = matchups.map((pair, gameIdx) => {
        const winner = simulateGame(pair[0], pair[1], round);
        result[`${region}-r${round}-g${gameIdx}`] = winner.name;
        return winner;
      });

      if (round < 3) {
        // Pair adjacent winners: (0,1), (2,3), (4,5), (6,7)
        const next: [SimTeam, SimTeam][] = [];
        for (let j = 0; j < roundWinners.length; j += 2) {
          next.push([roundWinners[j], roundWinners[j + 1]]);
        }
        matchups = next;
      } else {
        // E8 — one game, one region winner
        regionWinners.push(roundWinners[0]);
      }
    }
  }

  // Final Four: [east, south] and [midwest, west]
  const ffMatchups: [SimTeam, SimTeam][] = [
    [regionWinners[0], regionWinners[3]], // East vs South
    [regionWinners[2], regionWinners[1]], // Midwest vs West
  ];
  const finalists: SimTeam[] = ffMatchups.map(([a, b], i) => {
    const winner = simulateGame(a, b, 4);
    result[`ff-r4-g${i}`] = winner.name;
    return winner;
  });

  // Championship
  const champion = simulateGame(finalists[0], finalists[1], 5);
  result['ff-r5-g0'] = champion.name;

  return result;
}

/* ─── Main export ──────────────────────────────────────────────── */

export function runMonteCarlo(n = 10_000): SimResults {
  // Initialize accumulators
  const champCount: Record<string, number> = {};
  const roundCount: Record<string, number[]> = {};
  const pickAgreeCount: Record<string, number> = {};

  for (const team of ALL_TEAMS) {
    champCount[team.name] = 0;
    roundCount[team.name] = [0, 0, 0, 0, 0, 0];
  }
  for (const key of Object.keys(MANUAL_PICKS)) {
    pickAgreeCount[key] = 0;
  }

  for (let i = 0; i < n; i++) {
    const gameWinners = simulateOnce();

    // Track which teams won which rounds
    // A team "survived round r" means it appears as a winner in a round-r game.
    // Round 0 = survived R64, 1 = survived R32, ..., 5 = won championship.
    for (const [key, winnerName] of Object.entries(gameWinners)) {
      // Parse round from key: "east-r0-g2" or "ff-r4-g0"
      const rMatch = key.match(/-r(\d+)-/);
      if (!rMatch) continue;
      const round = parseInt(rMatch[1], 10);
      if (roundCount[winnerName]) {
        roundCount[winnerName][round]++;
      }
    }

    // Championship
    const champ = gameWinners['ff-r5-g0'];
    if (champ !== undefined) champCount[champ]++;

    // Pick agreement
    for (const [key, picked] of Object.entries(MANUAL_PICKS)) {
      if (gameWinners[key] === picked) {
        pickAgreeCount[key]++;
      }
    }
  }

  // Normalize
  const champPct: Record<string, number> = {};
  const roundReach: Record<string, number[]> = {};
  const pickAgree: Record<string, number> = {};

  for (const name of Object.keys(champCount)) {
    champPct[name] = champCount[name] / n;
    roundReach[name] = (roundCount[name] ?? [0, 0, 0, 0, 0, 0]).map(c => c / n);
  }

  for (const key of Object.keys(MANUAL_PICKS)) {
    pickAgree[key] = pickAgreeCount[key] / n;
  }

  return { champPct, roundReach, pickAgree };
}
