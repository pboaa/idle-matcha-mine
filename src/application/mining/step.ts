import type { Cell } from '@domain/grid/position';
import { cellKey, sameCell } from '@domain/grid/position';
import { createRng, type Rng } from '@shared/rng';
import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_DEFS, WEAPON_IDS } from '@domain/mining/balance';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileValue } from '@domain/mining/tile';
import { type MineState, type Levels } from '@application/mining/mineState';
import { xpForNext, makeOffer, autoPick, appraiseCost, appraiseCapped, boostCost, boostMul } from '@application/mining/upgrades';
import { passiveTotals, weaponDmg, weaponRange, weaponMult, type EffectTotals } from '@application/mining/weapons';

export const MINE_STEP_MS = 100;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

const isDug = (dug: ReadonlySet<string>, c: Cell): boolean => dug.has(cellKey(c));
const isSolid = (dug: ReadonlySet<string>, c: Cell, b: MiningBalance): boolean => inBounds(c, b) && !dug.has(cellKey(c));

function stepToward(from: Cell, target: Cell): Cell {
  const dx = target.x - from.x; const dy = target.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: from.x + Math.sign(dx), y: from.y };
  if (dy !== 0) return { x: from.x, y: from.y + Math.sign(dy) };
  return from;
}
const dirToward = (from: Cell, target: Cell): Cell => { const n = stepToward(from, target); return { x: Math.sign(n.x - from.x), y: Math.sign(n.y - from.y) }; };

function pickTarget(dug: ReadonlySet<string>, from: Cell, rng: Rng, b: MiningBalance): Cell | null {
  for (let R = 4; R <= b.worldSize * 2; R *= 2) {
    const cands: Cell[] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const c = { x: from.x + dx, y: from.y + dy };
      if (isSolid(dug, c, b)) cands.push(c);
    }
    if (cands.length > 0) return cands[Math.floor(rng.next() * cands.length)] ?? null;
  }
  return null;
}

export function nearestSolid(dug: ReadonlySet<string>, from: Cell, range: number, b: MiningBalance = defaultMiningBalance): Cell | null {
  for (let r = 1; r <= range; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: from.x + dx, y: from.y + dy };
      if (isSolid(dug, c, b)) return c;
    }
  }
  return null;
}

export function miningFront(state: MineState, b: MiningBalance = defaultMiningBalance): Cell | null {
  const { cat } = state;
  if (!cat.target || sameCell(cat.pos, cat.target)) return null;
  const next = stepToward(cat.pos, cat.target);
  return isSolid(state.dug, next, b) ? next : null;
}

/** 武器発射に必要な文脈（1tick分・読み取り専用）。 */
interface FireCtx {
  readonly dug: ReadonlySet<string>;
  readonly pos: Cell;
  readonly target: Cell | null;
  readonly levels: Levels;
  readonly totals: EffectTotals;
  readonly globalMul: number; // 採掘ブースト×熟練度（全武器共通）
  readonly dt: number;
  readonly rangeBonus: number;
  readonly pierceBonus: number;
  readonly b: MiningBalance;
}

/** 所持する全武器を pattern に従って毎tick発射し、当たったマスへ deal でダメージを与える（命中判定は deal 側）。 */
function fireWeapons(ctx: FireCtx, deal: (cell: Cell, amt: number, w: WeaponId) => void): void {
  const { dug, pos, target, levels: L, totals: t, globalMul, dt, rangeBonus, pierceBonus, b } = ctx;
  for (const id of WEAPON_IDS) {
    const lvl = L[id];
    if (lvl <= 0) continue;
    const def = WEAPON_DEFS[id];
    const dmg = weaponDmg(def, lvl) * weaponMult(def, t) * globalMul * dt;
    const range = weaponRange(def, lvl, rangeBonus);
    const lineRange = range + pierceBonus; // 直線系は貫通で奥まで
    switch (def.pattern) {
      case 'front': { if (target) { const f = stepToward(pos, target); if (!sameCell(f, pos)) deal(f, dmg, id); } break; }
      case 'nearest': { const c = nearestSolid(dug, pos, range, b); if (c) deal(c, dmg, id); break; }
      case 'burst': { const c = nearestSolid(dug, pos, range, b); if (c) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) deal({ x: c.x + dx, y: c.y + dy }, dmg, id); break; }
      case 'cross': { for (const [dx, dy] of DIRS) for (let r = 1; r <= lineRange; r++) deal({ x: pos.x + dx * r, y: pos.y + dy * r }, dmg, id); break; }
      case 'forward': { const d = target ? dirToward(pos, target) : { x: 1, y: 0 }; for (let r = 1; r <= lineRange; r++) deal({ x: pos.x + d.x * r, y: pos.y + d.y * r }, dmg, id); break; }
      case 'around': { for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) deal({ x: pos.x + dx, y: pos.y + dy }, dmg, id); break; }
      case 'ring': { for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === range) deal({ x: pos.x + dx, y: pos.y + dy }, dmg, id); break; }
    }
  }
}

function descend(state: MineState, b: MiningBalance): MineState {
  const base = baseOf(b);
  return { ...state, floor: state.floor + 1, dug: new Set([cellKey(base)]), damage: new Map(), drops: [], cat: { pos: { ...base }, gauge: 0, target: null }, cam: { ...base } };
}

function stepOnce(state: MineState, dtMs: number, b: MiningBalance): MineState {
  const dug = state.dug;
  const damage = state.damage;
  const dt = dtMs / 1000;
  const now = state.time + dtMs;
  const rng = createRng(state.rngState);
  const L = state.levels;
  const t = passiveTotals(L);
  let pos = state.cat.pos;
  let gauge = state.cat.gauge + b.baseRate * (1 + t.rate) * dt;
  let target = state.cat.target;
  let coins = state.coins;
  let xpGain = 0;
  let seq = state.seq;
  let drops = state.drops;
  let cleared = false;
  const materials = { ...state.materials };
  const dmgAcc = { ...state.dmgByWeapon };
  const hits = new Map<WeaponId, Cell[]>(); // このtickで武器が当てたマス（エフェクト用）
  const total = totalTilesOf(b);
  const HP = tileHardness(state.floor, b);
  // 熟練度（永続）はスループットにも効く: 移動速度＋射程。周回を重ねるほど序盤が速くなる（=サクサク）。
  const masteryMove = state.masteryTotal * b.masteryMovePerLvl;
  const masteryRange = Math.floor(state.masteryTotal * b.masteryRangePerLvl);
  const moveCost = b.moveCost / (1 + t.move + masteryMove);
  const coinMult = 1 + t.coin;
  const matChance = t.material;
  const rangeBonus = Math.floor(t.range) + masteryRange;
  const pierceBonus = Math.floor(t.pierce); // 貫通: ビーム/ドリル(直線)が奥まで届く

  const applyDmg = (cell: Cell, baseAmt: number, w: WeaponId): void => {
    if (cleared || !isSolid(dug, cell, b)) return;
    const amt = rng.next() < t.crit ? baseAmt * b.critMult : baseAmt; // 会心
    dmgAcc[w] += amt;
    let hc = hits.get(w); if (!hc) { hc = []; hits.set(w, hc); } hc.push(cell); // 命中マスを記録（演出）
    const k = cellKey(cell);
    const d = (damage.get(k) ?? 0) + amt;
    if (d < HP) { damage.set(k, d); return; }
    damage.delete(k);
    dug.add(k);
    const kind = kindAt(cell, state.floor, b);
    coins += tileValue(kind, state.floor, coinMult, b);
    materials[kind.id] += 1 + (rng.next() < matChance ? 1 : 0); // 強欲
    xpGain += 1 + t.xp;
    seq += 1;
    drops = [...drops, { id: seq, x: cell.x, y: cell.y, emoji: kind.emoji, value: tileValue(kind, state.floor, coinMult, b), bornAt: now }];
    if (dug.size >= total) cleared = true;
  };

  // 移動: ターゲットへ空洞を歩く（壁の手前で止まり武器で削る）。
  if (!target || !isSolid(dug, target, b)) target = pickTarget(dug, pos, rng, b);
  if (target) {
    let guard = 0;
    while (gauge >= moveCost && !sameCell(pos, target) && guard++ < 64) {
      const next = stepToward(pos, target);
      if (sameCell(next, pos) || !isDug(dug, next)) break;
      gauge -= moveCost; pos = next;
    }
  }

  // 武器発射（所持している全武器をパターンで毎tick）。採掘ブースト(コイン)＋熟練度(永続)が全武器に乗る。
  const globalMul = boostMul(state.boost, b) * (1 + state.masteryTotal * b.masteryPerLvl);
  fireWeapons({ dug, pos, target, levels: L, totals: t, globalMul, dt, rangeBonus, pierceBonus, b }, applyDmg);

  if (cleared) return descend({ ...state, rngState: rng.state(), coins, xp: state.xp + xpGain, seq, dmgByWeapon: dmgAcc, materials }, b);

  // 武器の命中演出を追加（武器ごとに当たったマス）。古いものは寿命で消す。
  let fx = state.fx;
  if (hits.size > 0) {
    const fresh = [...hits].map(([w, cells]) => ({ id: now * 8 + WEAPON_IDS.indexOf(w), weapon: w, cells, bornAt: now }));
    fx = [...fx, ...fresh];
  }
  if (fx.length > 0) { const keep = fx.filter((f) => now - f.bornAt < b.fxVisualMs); if (keep.length !== fx.length) fx = keep; }

  // 演出ドロップは一定時間で消す（回収は済み）。
  if (drops.length > 0) { const keep = drops.filter((d) => now - d.bornAt < b.dropVisualMs); if (keep.length !== drops.length) drops = keep; }

  // コイン自動購入（自動モード）: 目利き／採掘ブーストの安い方を交互に買う。
  let meta = state.meta;
  let boost = state.boost;
  if (state.autoMode) {
    let guard = 0;
    while (guard++ < 100) {
      const aCost = appraiseCost(meta.appraise, b);
      const canA = !appraiseCapped(meta.appraise, b) && coins >= aCost;
      const bCost = boostCost(boost, b);
      const canB = coins >= bCost;
      if (!canA && !canB) break;
      if (canA && (!canB || aCost <= bCost)) { coins -= aCost; meta = { appraise: meta.appraise + 1 }; }
      else { coins -= bCost; boost += 1; }
    }
  }

  // レベルアップ解決（3択・レア度つき）。レベルごとに熟練度+1（周回しても消えない）。
  let xp = state.xp + xpGain;
  let level = state.level;
  let levels = state.levels;
  let offer = state.offer;
  let masteryGain = 0;
  while (!offer && xp >= xpForNext(level, b)) {
    xp -= xpForNext(level, b);
    level += 1;
    masteryGain += 1;
    const choices = makeOffer(rng, levels, meta.appraise, b);
    if (state.autoMode) {
      const ch = autoPick(choices, rng);
      levels = { ...levels, [ch.id]: levels[ch.id] + (ch.rarity === 'rare' ? 2 : 1) };
      if (ch.rarity === 'epic' && ch.bonus) levels = { ...levels, [ch.bonus]: levels[ch.bonus] + 1 };
    } else offer = choices;
  }

  return {
    ...state,
    time: now, coins, rev: state.rev + 1, seq, rngState: rng.state(), drops, fx,
    cat: { pos, gauge, target }, cam: { ...pos },
    xp, level, levels, offer, meta, boost, dmgByWeapon: dmgAcc, materials,
    mastery: state.mastery + masteryGain, masteryTotal: state.masteryTotal + masteryGain,
  };
}

export function stepMine(state: MineState, dtMs: number, b: MiningBalance = defaultMiningBalance): MineState {
  let s = state;
  let remaining = dtMs;
  while (remaining > 0.0001) {
    const dt = Math.min(MINE_STEP_MS, remaining);
    s = stepOnce(s, dt, b);
    remaining -= dt;
  }
  return s;
}
