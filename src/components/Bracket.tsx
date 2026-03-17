import React, { useState, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { runMonteCarlo, type SimResults } from '../lib/simulation';
import { INITIAL_BRACKET, ALL_TEAMS, type RegionKey as SimRegionKey } from '../data/initialBracket';

/* ─── Layout constants ─── */
const SLOT = 96;
const GAME_H = 80;
const CARD_W = 190;

/* ─── Types ─── */
interface Team {
  s: number;
  n: string;
}
type GameEntry = [Team, Team, string];
interface Round {
  name: string;
  date: string;
  games: GameEntry[];
}
interface Region {
  label: string;
  short: string;
  color: string;
  winner: string;
  rounds: Round[];
}
type RegionKey = 'east' | 'west' | 'midwest' | 'south';
type TabKey = RegionKey | 'ff';
type UpsetRow = [string, string, string, string, string];

/* ─────────────────────────────────────────────────────────────────
   Global styles injected once
   ───────────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }

:root {
  --bg0:   #060d18;
  --bg1:   #0d1829;
  --bg2:   #152336;
  --bg3:   #192840;
  --line:  #253e5e;
  --muted: #6b8cad;
  --dim:   #8aaec8;
  --body:  #b0cce4;
  --text:  #eef4fc;
  --gold:  #f5c842;
  --gold2: #d4a017;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

html, body { background: var(--bg0); }

.bracket-root {
  background: var(--bg0);
  min-height: 100vh;
  color: var(--text);
  font-family: 'Barlow', sans-serif;
  padding: 28px 20px 48px;
  overflow-x: hidden;
}

/* scrollbar */
::-webkit-scrollbar { height: 4px }
::-webkit-scrollbar-track { background: var(--bg1) }
::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 4px }

/* tab button */
.tab-btn {
  padding: 7px 20px;
  border-radius: 30px;
  border: 1.5px solid var(--line);
  background: transparent;
  color: var(--body);
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color .18s, color .18s, background .18s, transform .1s;
}
.tab-btn:hover { color: var(--text); border-color: var(--body) }
.tab-btn.active { color: #fff; transform: translateY(-1px) }
.tab-btn:active { transform: translateY(0) scale(0.97) }

/* animate tab content */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px) }
  to   { opacity: 1; transform: translateY(0) }
}
.tab-panel { animation: fadeUp .22s ease both }

/* game card row hover */
.game-row { transition: background .14s }
.game-row:hover { background: rgba(255,255,255,0.03) !important }

/* champion pulse */
@keyframes crownPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,200,66,0) }
  50%       { box-shadow: 0 0 0 8px rgba(245,200,66,0.12) }
}
.champion-card { animation: crownPulse 2.8s ease-in-out infinite }
`;

function injectGlobalCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('bracket-styles')) return;
  const el = document.createElement('style');
  el.id = 'bracket-styles';
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}

/* ─────────────────────────────────────────────────────────────────
   GameCard
   ───────────────────────────────────────────────────────────────── */
interface GameCardProps {
  top: Team;
  bot: Team;
  winner: string;
  accent?: string;
  gameKey?: string;
  simResults?: SimResults;
}

function GameCard({
  top,
  bot,
  winner,
  accent = '#3b82f6',
  gameKey,
  simResults,
}: GameCardProps) {
  const rowH = GAME_H / 2;

  // Sim agreement for this game: did the sim pick the same winner we picked?
  const agree = gameKey && simResults ? simResults.pickAgree[gameKey] : undefined;
  // Show divergence warning on the loser row when sim disagrees more than 50%
  const simDisagrees = agree !== undefined && agree < 0.5;

  return (
    <div
      style={{
        width: CARD_W,
        height: GAME_H,
        background: 'var(--bg2)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      }}
    >
      {([top, bot] as Team[]).map((team, i) => {
        const isWinner = winner === team.n;
        const champPct = simResults?.champPct[team.n] ?? 0;
        // Show % badge if sim gives team >3% championship probability
        const showBadge = champPct >= 0.03;
        // Show divergence bolt on the WINNER row — flags the pick you made as questionable
        const showBolt = isWinner && simDisagrees;

        // Build hover tooltip with per-round survival probabilities
        const reach = simResults?.roundReach[team.n];
        const pct = (v: number) => `${Math.round(v * 100)}%`;
        const tooltip = reach
          ? `${team.n} — R32: ${pct(reach[0])} · S16: ${pct(reach[1])} · E8: ${pct(reach[2])} · F4: ${pct(reach[3])} · Final: ${pct(reach[4])} · Champ: ${pct(reach[5])}`
          : undefined;

        return (
          <div
            key={i}
            className="game-row"
            style={{
              height: rowH,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              gap: 6,
              background: isWinner ? `${accent}18` : 'transparent',
              borderBottom: i === 0 ? '1px solid var(--line)' : 'none',
              borderLeft: isWinner
                ? `3px solid ${accent}`
                : '3px solid transparent',
            }}
          >
            {/* seed */}
            <span
              style={{
                color: 'var(--body)',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                minWidth: 18,
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {team.s}
            </span>
            {/* name */}
            <span
              title={tooltip}
              style={{
                color: isWinner ? '#fff' : 'var(--text)',
                fontWeight: isWinner ? 600 : 400,
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                fontFamily: "'Barlow', sans-serif",
                cursor: tooltip ? 'help' : undefined,
              }}
            >
              {team.n}
            </span>
            {/* sim championship % badge */}
            {showBadge && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  color: champPct >= 0.15 ? 'var(--gold)' : 'var(--dim)',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {(champPct * 100).toFixed(1)}%
              </span>
            )}
            {/* divergence bolt — sim thinks the other team should win */}
            {showBolt && (
              <span
                title={`Sim agrees with this pick only ${Math.round((agree ?? 0) * 100)}% of the time`}
                style={{
                  fontSize: 11,
                  flexShrink: 0,
                  lineHeight: 1,
                  color: '#f59e0b',
                  cursor: 'default',
                }}
              >
                ⚡
              </span>
            )}
            {/* winner chevron */}
            {isWinner && (
              <svg
                width="7"
                height="10"
                viewBox="0 0 7 10"
                fill="none"
                style={{ flexShrink: 0, opacity: 0.8 }}
              >
                <path
                  d="M1 1l5 4-5 4"
                  stroke={accent}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RoundCol
   ───────────────────────────────────────────────────────────────── */
interface RoundColProps {
  round: Round;
  roundIdx: number;
  regionKey: string;
  accent?: string;
  simResults?: SimResults;
}

function RoundCol({
  round,
  roundIdx,
  regionKey,
  accent = '#3b82f6',
  simResults,
}: RoundColProps) {
  const slotH = SLOT * Math.pow(2, roundIdx);
  const padV = (slotH - GAME_H) / 2;
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Round label + date */}
      <div
        style={{
          marginBottom: 12,
          textAlign: 'center',
          width: CARD_W,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            color: 'var(--text)',
            textTransform: 'uppercase',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          {round.name}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--body)',
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: 1,
            marginTop: 3,
          }}
        >
          {round.date}
        </div>
      </div>

      {round.games.map((g, i) => {
        // East R64 is missing game g0 (Duke's 1v16) from the display data —
        // the sim data has it at index 0, so display games are offset by +1.
        const simGameIdx = regionKey === 'east' && roundIdx === 0 ? i + 1 : i;
        const gameKey = `${regionKey}-r${roundIdx}-g${simGameIdx}`;
        return (
          <div key={i} style={{ paddingTop: padV, paddingBottom: padV }}>
            <GameCard
              top={g[0]}
              bot={g[1]}
              winner={g[2]}
              accent={accent}
              gameKey={gameKey}
              simResults={simResults}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Data
   ───────────────────────────────────────────────────────────────── */
const B: Record<RegionKey, Region> = {
  east: {
    label: 'East',
    short: 'E',
    color: '#3b82f6',
    winner: 'Duke',
    rounds: [
      {
        name: 'Round of 64',
        date: 'Mar 20–21',
        games: [
          [{ s: 8, n: 'Ohio State' }, { s: 9, n: 'TCU' }, 'TCU'],
          [{ s: 5, n: "St. John's" }, { s: 12, n: 'N. Iowa' }, "St. John's"],
          [{ s: 4, n: 'Kansas' }, { s: 13, n: 'Cal Baptist' }, 'Kansas'],
          [{ s: 6, n: 'Louisville' }, { s: 11, n: 'S. Florida' }, 'Louisville'],
          [{ s: 3, n: 'Michigan St.' }, { s: 14, n: 'NDSU' }, 'Michigan St.'],
          [{ s: 7, n: 'UCLA' }, { s: 10, n: 'UCF' }, 'UCLA'],
          [{ s: 2, n: 'UConn' }, { s: 15, n: 'Furman' }, 'UConn'],
        ],
      },
      {
        name: 'Round of 32',
        date: 'Mar 22–23',
        games: [
          [{ s: 1, n: 'Duke' }, { s: 9, n: 'TCU' }, 'Duke'],
          [{ s: 5, n: "St. John's" }, { s: 4, n: 'Kansas' }, 'Kansas'],
          [
            { s: 6, n: 'Louisville' },
            { s: 3, n: 'Michigan St.' },
            'Michigan St.',
          ],
          [{ s: 7, n: 'UCLA' }, { s: 2, n: 'UConn' }, 'UConn'],
        ],
      },
      {
        name: 'Sweet 16',
        date: 'Mar 27–28',
        games: [
          [{ s: 1, n: 'Duke' }, { s: 4, n: 'Kansas' }, 'Duke'],
          [{ s: 3, n: 'Michigan St.' }, { s: 2, n: 'UConn' }, 'UConn'],
        ],
      },
      {
        name: 'Elite Eight',
        date: 'Mar 29–30',
        games: [[{ s: 1, n: 'Duke' }, { s: 2, n: 'UConn' }, 'Duke']],
      },
    ],
  },
  west: {
    label: 'West',
    short: 'W',
    color: '#ef4444',
    winner: 'Arizona',
    rounds: [
      {
        name: 'Round of 64',
        date: 'Mar 20–21',
        games: [
          [{ s: 1, n: 'Arizona' }, { s: 16, n: 'LIU' }, 'Arizona'],
          [{ s: 8, n: 'Villanova' }, { s: 9, n: 'Utah State' }, 'Utah State'],
          [{ s: 5, n: 'Wisconsin' }, { s: 12, n: 'High Point' }, 'Wisconsin'],
          [{ s: 4, n: 'Arkansas' }, { s: 13, n: 'Hawaii' }, 'Arkansas'],
          [{ s: 11, n: 'Texas★' }, { s: 6, n: 'BYU' }, 'Texas★'],
          [{ s: 3, n: 'Gonzaga' }, { s: 14, n: 'Kennesaw St.' }, 'Gonzaga'],
          [{ s: 7, n: 'Miami (FL)' }, { s: 10, n: 'Missouri' }, 'Missouri'],
          [{ s: 2, n: 'Purdue' }, { s: 15, n: 'Queens' }, 'Purdue'],
        ],
      },
      {
        name: 'Round of 32',
        date: 'Mar 22–23',
        games: [
          [{ s: 1, n: 'Arizona' }, { s: 9, n: 'Utah State' }, 'Arizona'],
          [{ s: 5, n: 'Wisconsin' }, { s: 4, n: 'Arkansas' }, 'Arkansas'],
          [{ s: 11, n: 'Texas★' }, { s: 3, n: 'Gonzaga' }, 'Gonzaga'],
          [{ s: 10, n: 'Missouri' }, { s: 2, n: 'Purdue' }, 'Purdue'],
        ],
      },
      {
        name: 'Sweet 16',
        date: 'Mar 27–28',
        games: [
          [{ s: 1, n: 'Arizona' }, { s: 4, n: 'Arkansas' }, 'Arizona'],
          [{ s: 3, n: 'Gonzaga' }, { s: 2, n: 'Purdue' }, 'Purdue'],
        ],
      },
      {
        name: 'Elite Eight',
        date: 'Mar 29–30',
        games: [[{ s: 1, n: 'Arizona' }, { s: 2, n: 'Purdue' }, 'Arizona']],
      },
    ],
  },
  midwest: {
    label: 'Midwest',
    short: 'MW',
    color: '#22c55e',
    winner: 'Michigan',
    rounds: [
      {
        name: 'Round of 64',
        date: 'Mar 20–21',
        games: [
          [{ s: 1, n: 'Michigan' }, { s: 16, n: 'Howard★' }, 'Michigan'],
          [{ s: 8, n: 'Georgia' }, { s: 9, n: 'Saint Louis' }, 'Georgia'],
          [{ s: 5, n: 'Texas Tech' }, { s: 12, n: 'Akron' }, 'Texas Tech'],
          [{ s: 4, n: 'Alabama' }, { s: 13, n: 'Hofstra' }, 'Alabama'],
          [{ s: 11, n: 'SMU★' }, { s: 6, n: 'Tennessee' }, 'SMU★'],
          [{ s: 3, n: 'Virginia' }, { s: 14, n: 'Wright State' }, 'Virginia'],
          [{ s: 7, n: 'Kentucky' }, { s: 10, n: 'Santa Clara' }, 'Kentucky'],
          [
            { s: 2, n: 'Iowa State' },
            { s: 15, n: 'Tenn. State' },
            'Iowa State',
          ],
        ],
      },
      {
        name: 'Round of 32',
        date: 'Mar 22–23',
        games: [
          [{ s: 1, n: 'Michigan' }, { s: 8, n: 'Georgia' }, 'Michigan'],
          [{ s: 5, n: 'Texas Tech' }, { s: 4, n: 'Alabama' }, 'Alabama'],
          [{ s: 11, n: 'SMU★' }, { s: 3, n: 'Virginia' }, 'Virginia'],
          [{ s: 7, n: 'Kentucky' }, { s: 2, n: 'Iowa State' }, 'Iowa State'],
        ],
      },
      {
        name: 'Sweet 16',
        date: 'Mar 27–28',
        games: [
          [{ s: 1, n: 'Michigan' }, { s: 4, n: 'Alabama' }, 'Michigan'],
          [{ s: 3, n: 'Virginia' }, { s: 2, n: 'Iowa State' }, 'Iowa State'],
        ],
      },
      {
        name: 'Elite Eight',
        date: 'Mar 29–30',
        games: [
          [{ s: 1, n: 'Michigan' }, { s: 2, n: 'Iowa State' }, 'Michigan'],
        ],
      },
    ],
  },
  south: {
    label: 'South',
    short: 'S',
    color: '#f97316',
    winner: 'Houston',
    rounds: [
      {
        name: 'Round of 64',
        date: 'Mar 20–21',
        games: [
          [{ s: 1, n: 'Florida' }, { s: 16, n: 'Prairie View★' }, 'Florida'],
          [{ s: 8, n: 'Clemson' }, { s: 9, n: 'Iowa' }, 'Iowa'],
          [{ s: 5, n: 'Vanderbilt' }, { s: 12, n: 'McNeese' }, 'McNeese'],
          [{ s: 4, n: 'Nebraska' }, { s: 13, n: 'Troy' }, 'Nebraska'],
          [{ s: 6, n: 'N. Carolina' }, { s: 11, n: 'VCU' }, 'N. Carolina'],
          [{ s: 3, n: 'Illinois' }, { s: 14, n: 'Penn' }, 'Illinois'],
          [{ s: 7, n: "St. Mary's" }, { s: 10, n: 'Texas A&M' }, 'Texas A&M'],
          [{ s: 2, n: 'Houston' }, { s: 15, n: 'Idaho' }, 'Houston'],
        ],
      },
      {
        name: 'Round of 32',
        date: 'Mar 22–23',
        games: [
          [{ s: 1, n: 'Florida' }, { s: 9, n: 'Iowa' }, 'Florida'],
          [{ s: 12, n: 'McNeese' }, { s: 4, n: 'Nebraska' }, 'Nebraska'],
          [{ s: 6, n: 'N. Carolina' }, { s: 3, n: 'Illinois' }, 'Illinois'],
          [{ s: 10, n: 'Texas A&M' }, { s: 2, n: 'Houston' }, 'Houston'],
        ],
      },
      {
        name: 'Sweet 16',
        date: 'Mar 27–28',
        games: [
          [{ s: 1, n: 'Florida' }, { s: 4, n: 'Nebraska' }, 'Florida'],
          [{ s: 3, n: 'Illinois' }, { s: 2, n: 'Houston' }, 'Houston'],
        ],
      },
      {
        name: 'Elite Eight',
        date: 'Mar 29–30',
        games: [[{ s: 1, n: 'Florida' }, { s: 2, n: 'Houston' }, 'Houston']],
      },
    ],
  },
};

const FF = {
  sf: [
    {
      label: 'East vs. South',
      g: [{ s: 1, n: 'Duke' }, { s: 2, n: 'Houston' }, 'Duke'] as GameEntry,
    },
    {
      label: 'Midwest vs. West',
      g: [
        { s: 1, n: 'Michigan' },
        { s: 1, n: 'Arizona' },
        'Michigan',
      ] as GameEntry,
    },
  ],
  final: [
    { s: 1, n: 'Duke' },
    { s: 1, n: 'Michigan' },
    'Michigan',
  ] as GameEntry,
};

const TABS: TabKey[] = ['east', 'west', 'midwest', 'south', 'ff'];
const TAB_LABELS: Record<TabKey, string> = {
  east: 'East',
  west: 'West',
  midwest: 'Midwest',
  south: 'South',
  ff: 'Final Four',
};
const TAB_COLORS: Record<TabKey, string> = {
  east: '#3b82f6',
  west: '#ef4444',
  midwest: '#22c55e',
  south: '#f97316',
  ff: '#c084fc',
};

const REGION_KEYS: RegionKey[] = ['east', 'west', 'midwest', 'south'];

const UPSETS: UpsetRow[] = [
  ['9', 'TCU', '8', 'Ohio State', 'East R64'],
  ['11', 'Texas', '6', 'BYU', 'West R64'],
  ['11', 'SMU', '6', 'Tennessee', 'Midwest R64'],
  ['10', 'Missouri', '7', 'Miami FL', 'West R64'],
  ['12', 'McNeese', '5', 'Vanderbilt', 'South R64'],
  ['10', 'Texas A&M', '7', "St. Mary's", 'South R64'],
  ['2', 'Houston', '1', 'Florida', 'South E8 🔥'],
];

/* ─────────────────────────────────────────────────────────────────
   RegionSummaryPill
   ───────────────────────────────────────────────────────────────── */
function RegionSummaryPill({ r }: { r: RegionKey }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 13,
        padding: '5px 14px',
        borderRadius: 30,
        border: `1px solid ${B[r].color}44`,
        color: B[r].color,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        background: `${B[r].color}0d`,
      }}
    >
      <span style={{ opacity: 0.75 }}>{B[r].short}</span>
      <span style={{ opacity: 0.5, fontSize: 10 }}>▸</span>
      <span>{B[r].winner}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   RegionView
   ───────────────────────────────────────────────────────────────── */
function RegionView({
  regionKey,
  simResults,
}: {
  regionKey: RegionKey;
  simResults?: SimResults;
}): React.JSX.Element {
  const region = B[regionKey];
  return (
    <div className="tab-panel">
      {/* Region heading */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: 14,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            color: region.color,
            borderBottom: `1px solid ${region.color}44`,
            paddingBottom: 3,
          }}
        >
          {region.label} Region — {region.winner} advances
        </div>
      </div>

      {/* Scrollable bracket */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 14,
            width: 'fit-content',
            margin: '0 auto',
          }}
        >
          {region.rounds.map((round, i) => (
            <RoundCol
              key={i}
              round={round}
              roundIdx={i}
              regionKey={regionKey}
              accent={region.color}
              simResults={simResults}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--body)', fontFamily: "'Barlow', sans-serif" }}>
          ★ = First Four participant
        </span>
        <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: "'Barlow', sans-serif" }}>
          <span style={{ color: 'var(--gold)' }}>12.3%</span> = sim championship probability
        </span>
        <span style={{ fontSize: 12, color: 'var(--body)', fontFamily: "'Barlow', sans-serif" }}>
          <span style={{ color: '#f59e0b' }}>⚡</span> = sim questions this pick (&lt;50% sim agreement)
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SimLeaderboard
   ───────────────────────────────────────────────────────────────── */

// Build region and metadata maps once (module scope — these are constants)
const TEAM_REGION: Record<string, SimRegionKey> = {};
const TEAM_META: Record<string, { seed: number; injuryAdj: number; momentumAdj: number }> = {};

for (const [regionKey, pairs] of Object.entries(INITIAL_BRACKET) as [SimRegionKey, typeof INITIAL_BRACKET[SimRegionKey]][]) {
  for (const [a, b] of pairs) {
    TEAM_REGION[a.name] = regionKey;
    TEAM_REGION[b.name] = regionKey;
  }
}
for (const team of ALL_TEAMS) {
  TEAM_META[team.name] = {
    seed: team.seed,
    injuryAdj: team.injuryAdj,
    momentumAdj: team.momentumAdj,
  };
}

const REGION_COLORS: Record<SimRegionKey, string> = {
  east: '#3b82f6',
  west: '#ef4444',
  midwest: '#22c55e',
  south: '#f97316',
};
const REGION_SHORT: Record<SimRegionKey, string> = {
  east: 'E',
  west: 'W',
  midwest: 'MW',
  south: 'S',
};

function SimLeaderboard({ simResults }: { simResults: SimResults }): React.JSX.Element {
  const maxChamp = Math.max(...Object.values(simResults.champPct));

  const rows = Object.entries(simResults.champPct)
    .filter(([, pct]) => pct >= 0.005)
    .sort(([, a], [, b]) => b - a);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--bg1)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--line)',
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: 2.5,
          color: 'var(--body)',
          textTransform: 'uppercase',
          marginBottom: 14,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
        }}
      >
        Sim Odds Leaderboard
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 32px 60px 56px 56px 20px',
          gap: '0 8px',
          alignItems: 'center',
          paddingBottom: 8,
          marginBottom: 6,
          borderBottom: '1px solid var(--line)',
        }}
      >
        {(['Team', 'Rgn', 'Champ%', 'F4%', 'E8%', ''] as const).map((h, i) => (
          <span
            key={i}
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textAlign: i >= 2 ? 'right' : 'left',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {rows.map(([name, champPct], idx) => {
        const region = TEAM_REGION[name];
        const meta = TEAM_META[name];
        const reach = simResults.roundReach[name] ?? [];
        const f4Pct = reach[3] ?? 0;
        const e8Pct = reach[2] ?? 0;
        const color = region ? REGION_COLORS[region] : 'var(--dim)';
        const short = region ? REGION_SHORT[region] : '?';
        const isInjured = meta && meta.injuryAdj < 0;
        const isCold = meta && meta.momentumAdj < 0;
        // Progress bar width relative to the field leader
        const barWidth = maxChamp > 0 ? champPct / maxChamp : 0;

        return (
          <div
            key={name}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 32px 60px 56px 56px 20px',
              gap: '0 8px',
              alignItems: 'center',
              paddingTop: 7,
              paddingBottom: 7,
              borderBottom: idx < rows.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            {/* Team name + seed + bar */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    minWidth: 16,
                    lineHeight: 1,
                  }}
                >
                  {meta?.seed ?? ''}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: "'Barlow', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </span>
              </div>
              {/* relative strength bar */}
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--bg3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barWidth * 100}%`,
                    background: color,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>

            {/* Region pill */}
            <div
              style={{
                fontSize: 11,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                color,
                background: `${color}18`,
                borderRadius: 4,
                padding: '2px 5px',
                textAlign: 'center',
                letterSpacing: 0.5,
                border: `1px solid ${color}33`,
              }}
            >
              {short}
            </div>

            {/* Champ% */}
            <span
              style={{
                fontSize: 14,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                color: champPct >= 0.15 ? 'var(--gold)' : champPct >= 0.08 ? 'var(--text)' : 'var(--dim)',
                textAlign: 'right',
                lineHeight: 1,
              }}
            >
              {pct(champPct)}
            </span>

            {/* F4% */}
            <span
              style={{
                fontSize: 13,
                fontFamily: "'Barlow Condensed', sans-serif",
                color: 'var(--body)',
                textAlign: 'right',
                lineHeight: 1,
              }}
            >
              {pct(f4Pct)}
            </span>

            {/* E8% */}
            <span
              style={{
                fontSize: 13,
                fontFamily: "'Barlow Condensed', sans-serif",
                color: 'var(--muted)',
                textAlign: 'right',
                lineHeight: 1,
              }}
            >
              {pct(e8Pct)}
            </span>

            {/* Flags */}
            <span
              style={{ fontSize: 11, textAlign: 'center', lineHeight: 1 }}
              title={
                isInjured && isCold
                  ? 'Injury concern + cold streak'
                  : isInjured
                  ? 'Injury concern'
                  : isCold
                  ? 'Cold entering tournament'
                  : ''
              }
            >
              {isInjured ? '🩹' : isCold ? '❄' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FinalFourView
   ───────────────────────────────────────────────────────────────── */
function FinalFourView({ simResults }: { simResults?: SimResults }): React.JSX.Element {
  const accent = '#c084fc';

  const divider = (
    <div
      style={{
        width: '100%',
        height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`,
        margin: '4px 0',
      }}
    />
  );

  return (
    <div
      className="tab-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        maxWidth: 460,
        margin: '0 auto',
      }}
    >
      {/* Location pill */}
      <div
        style={{
          fontSize: 14,
          letterSpacing: 2.5,
          color: 'var(--body)',
          textTransform: 'uppercase',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}
      >
        Indianapolis, IN · April 4 &amp; 6
      </div>

      {/* Semifinals */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {FF.sf.map((sf, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 13,
                letterSpacing: 1.5,
                color: accent,
                textTransform: 'uppercase',
                marginBottom: 8,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
              }}
            >
              {sf.label}
            </div>
            <GameCard
              top={sf.g[0]}
              bot={sf.g[1]}
              winner={sf.g[2]}
              accent={accent}
              gameKey={`ff-r4-g${i}`}
              simResults={simResults}
            />
          </div>
        ))}
      </div>

      {divider}

      {/* Championship */}
      <div
        style={{
          fontSize: 13,
          letterSpacing: 2.5,
          color: accent,
          textTransform: 'uppercase',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
        }}
      >
        National Championship
      </div>
      <GameCard
        top={FF.final[0]}
        bot={FF.final[1]}
        winner={FF.final[2]}
        accent={accent}
        gameKey="ff-r5-g0"
        simResults={simResults}
      />

      {/* Probability bar */}
      {simResults && (() => {
        const pA = simResults.champPct[FF.final[0].n] ?? 0;
        const pB = simResults.champPct[FF.final[1].n] ?? 0;
        const total = pA + pB || 1;
        const pctA = pA / total;
        return (
          <div style={{ width: CARD_W, marginTop: 6 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                color: 'var(--dim)',
                marginBottom: 4,
                letterSpacing: 0.5,
              }}
            >
              <span style={{ color: pA > pB ? 'var(--gold)' : 'var(--dim)' }}>
                {(pA * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>SIM CHAMP %</span>
              <span style={{ color: pB > pA ? 'var(--gold)' : 'var(--dim)' }}>
                {(pB * 100).toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: 'var(--bg3)',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${pctA * 100}%`,
                  background: accent,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Champion callout */}
      <div
        className="champion-card"
        style={
          {
            textAlign: 'center',
            padding: '26px 48px',
            background: '#1a2e4a',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(245,200,66,0.45)',
            width: '100%',
          } as CSSProperties
        }
      >
        <div
          style={{
            fontSize: 14,
            letterSpacing: 4,
            color: '#d4a8ff',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
          }}
        >
          National Champion
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            color: '#ffd84d',
            letterSpacing: -0.5,
            fontFamily: "'Barlow Condensed', sans-serif",
            lineHeight: 1.1,
            textShadow: '0 0 40px rgba(255,210,60,0.25)',
          }}
        >
          🏆 Michigan
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text)',
            marginTop: 10,
            fontFamily: "'Barlow', sans-serif",
            letterSpacing: 0.3,
          }}
        >
          (1) Midwest · 31–3
        </div>
      </div>

      {divider}

      {/* Upsets callout */}
      <div
        style={{
          width: '100%',
          background: 'var(--bg1)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--line)',
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: 2.5,
            color: 'var(--body)',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
          }}
        >
          Notable Upsets I'm Picking
        </div>
        {UPSETS.map(([s1, t1, s2, t2, rd], i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: i < UPSETS.length - 1 ? 9 : 0,
              paddingBottom: i < UPSETS.length - 1 ? 9 : 0,
              borderBottom:
                i < UPSETS.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <span
              style={{
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: "'Barlow', sans-serif",
              }}
            >
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                ({s1}) {t1}
              </span>
              <span
                style={{ color: 'var(--body)', margin: '0 5px', fontSize: 12 }}
              >
                over
              </span>
              <span style={{ color: 'var(--body)' }}>
                ({s2}) {t2}
              </span>
            </span>
            <span
              style={{
                color: 'var(--body)',
                fontSize: 13,
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
                marginLeft: 12,
              }}
            >
              {rd}
            </span>
          </div>
        ))}
      </div>

      {divider}

      {/* Sim odds leaderboard */}
      {simResults && <SimLeaderboard simResults={simResults} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Root component
   ───────────────────────────────────────────────────────────────── */
export default function Bracket(): React.JSX.Element {
  const [tab, setTab] = useState<TabKey>('east');

  useEffect(() => {
    injectGlobalCSS();
  }, []);

  const simResults = useMemo(() => runMonteCarlo(10_000), []);

  return (
    <div className="bracket-root">
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div
          style={{
            fontSize: 13,
          }}
        >
          NCAA Men's Tournament
        </div>
        <h1
          style={
            {
              fontSize: 38,
              fontWeight: 900,
              margin: 0,
              letterSpacing: -0.5,
              fontFamily: "'Barlow Condensed', sans-serif",
              background:
                'linear-gradient(100deg, #60a5fa 0%, #e2e8f0 50%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            } as CSSProperties
          }
        >
          2026 March Madness
        </h1>

        {/* Champion badge */}
        <div
          style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg2)',
            border: '1px solid rgba(245,200,66,0.3)',
            borderRadius: 30,
            padding: '5px 16px 5px 12px',
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: 'var(--body)',
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            My pick:
          </span>
          <span
            style={{
              fontSize: 16,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: 0.5,
            }}
          >
            🏆 Michigan
          </span>
        </div>
      </div>

      {/* ── Region summary pills ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {REGION_KEYS.map(r => (
          <RegionSummaryPill key={r} r={r} />
        ))}
      </div>

      {/* ── Tabs ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 5,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
            style={{
              borderColor: tab === t ? TAB_COLORS[t] : undefined,
              background: tab === t ? `${TAB_COLORS[t]}1a` : undefined,
              color: tab === t ? TAB_COLORS[t] : undefined,
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      {tab !== 'ff' ? (
        <RegionView key={tab} regionKey={tab as RegionKey} simResults={simResults} />
      ) : (
        <FinalFourView key="ff" simResults={simResults} />
      )}
    </div>
  );
}
