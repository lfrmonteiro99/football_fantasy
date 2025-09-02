import { Player, Team, Vec } from './types';

const log = (...a: any[]) => console.log('[UnifiedSim][Formation]', ...a);

// Basic 4-4-2 base template in 0..100 pitch coordinates
const BASE_442_HOME: Record<string, Vec> = {
  GK: { x: 5, y: 50 },
  CB1: { x: 15, y: 35 }, CB2: { x: 15, y: 65 },
  RB: { x: 20, y: 15 }, LB: { x: 20, y: 85 },
  CM1: { x: 40, y: 40 }, CM2: { x: 40, y: 60 },
  WM1: { x: 50, y: 20 }, WM2: { x: 50, y: 80 },
  ST1: { x: 80, y: 45 }, ST2: { x: 80, y: 55 },
};

function mirrorY(v: Vec): Vec { return { x: 100 - v.x, y: v.y }; }

export function assign_base_positions_by_formation(team: Team, side: 'home' | 'away') {
  log('Assign base positions', { team: team.name, side });
  const map = (role: string, idx: number): Vec => {
    // Role resolution by simple heuristics from player's role/name
    const key = role.includes('GK') ? 'GK'
      : role.includes('CB') ? (idx === 0 ? 'CB1' : 'CB2')
      : role.includes('RB') ? 'RB'
      : role.includes('LB') ? 'LB'
      : role.includes('WM') || role.includes('RW') || role.includes('LW') ? (idx % 2 === 0 ? 'WM1' : 'WM2')
      : role.includes('CM') || role.includes('DM') || role.includes('AM') ? (idx % 2 === 0 ? 'CM1' : 'CM2')
      : 'ST' + ((idx % 2) + 1);
    // If job provides formation_slots, prefer those
    const provided = team.formation_slots && (team.formation_slots[role] || team.formation_slots[key]);
    const base = BASE_442_HOME[key as keyof typeof BASE_442_HOME] || { x: 50, y: 50 };
    const pos = provided || base;
    return side === 'home' ? pos : mirrorY(pos);
  };

  const grouped: Record<string, Player[]> = {} as any;
  for (const p of team.players) {
    const cat = p.is_keeper ? 'GK' : p.role || 'CM';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(p);
  }

  for (const [cat, arr] of Object.entries(grouped)) {
    arr.forEach((p, i) => {
      const base = map(cat, i);
      p.base_position = base;
      if (!p.pos) p.pos = { ...base };
    });
  }
  log('Base positions assigned', {
    players: team.players.map(p => ({ id: p.id, role: p.role, base: p.base_position }))
  });
}


