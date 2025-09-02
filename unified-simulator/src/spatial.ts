import { Player, SpatialIndex } from './types';

const keyFor = (x: number, y: number, cell: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;

export function buildSpatialIndex(players: Player[], cellSize = 10): SpatialIndex {
  const cells = new Map<string, Player[]>();
  for (const p of players) {
    const k = keyFor(p.pos.x, p.pos.y, cellSize);
    const arr = cells.get(k) || [];
    arr.push(p);
    cells.set(k, arr);
  }
  return { cellSize, cells };
}

export function updateSpatialIndex(si: SpatialIndex, player: Player, oldX: number, oldY: number) {
  const c = si.cellSize;
  const oldKey = keyFor(oldX, oldY, c);
  const newKey = keyFor(player.pos.x, player.pos.y, c);
  if (oldKey === newKey) return;
  const oldArr = si.cells.get(oldKey);
  if (oldArr) si.cells.set(oldKey, oldArr.filter(p => p.id !== player.id));
  const newArr = si.cells.get(newKey) || [];
  newArr.push(player);
  si.cells.set(newKey, newArr);
}

export function queryNeighbors(si: SpatialIndex, x: number, y: number, radius: number): Player[] {
  const c = si.cellSize;
  const minX = Math.floor((x - radius) / c), maxX = Math.floor((x + radius) / c);
  const minY = Math.floor((y - radius) / c), maxY = Math.floor((y + radius) / c);
  const result: Player[] = [];
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      const arr = si.cells.get(`${cx}:${cy}`) || [];
      for (const p of arr) {
        const d = Math.hypot(p.pos.x - x, p.pos.y - y);
        if (d <= radius) result.push(p);
      }
    }
  }
  return result;
}


