import type { Cell } from '@domain/grid/position';
import { cellKey, sameCell } from '@domain/grid/position';
import { createRng, type Rng } from '@shared/rng';
import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_DEFS, WEAPON_IDS } from '@domain/mining/balance';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileDist, tileValue } from '@domain/mining/tile';
import { stepToward, patternHits } from '@domain/mining/patterns';
import { runPassiveLevels } from '@domain/mining/runGrid';
import { dexEffectTotals, RARITY_DEFS, RARITY_IDS, weaponOf } from '@domain/mining/treasures';
import { type MineState, type Levels } from '@application/mining/mineState';
import { globalDamageMult } from '@application/mining/prestige';
import { xpForNext } from '@application/mining/upgrades';
import { passiveTotals, weaponDmg, weaponRange, weaponMult, type EffectTotals } from '@application/mining/weapons';

export const MINE_STEP_MS = 100;

const isDug = (dug: ReadonlySet<string>, c: Cell): boolean => dug.has(cellKey(c));
const isSolid = (dug: ReadonlySet<string>, c: Cell, b: MiningBalance): boolean => inBounds(c, b) && !dug.has(cellKey(c));

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
  readonly globalMul: number; // 全武器共通の倍率（図鑑火力＋累計★倍率）
  readonly dexWeapon: Record<WeaponId, number>; // 武器個別の図鑑ダメージ強化（その武器だけ）
  readonly haste: number;     // 攻撃速度（図鑑の俊敏＋走行グリッド）
  readonly dtMs: number;
  readonly cd: Record<WeaponId, number>; // 武器ごとの攻撃クールダウン蓄積（この場で加算・消費）
  readonly rangeBonus: number;
  readonly pierceBonus: number;
  readonly b: MiningBalance;
}

/** 所持する全武器を「攻撃間隔ごと」に発射し、当たったマスへ deal でダメージを与える（命中判定は deal 側）。 */
function fireWeapons(ctx: FireCtx, deal: (cell: Cell, amt: number, w: WeaponId) => void): void {
  const { dug, pos, target, levels: L, totals: t, globalMul, dexWeapon, haste, dtMs, cd, rangeBonus, pierceBonus, b } = ctx;
  for (const id of WEAPON_IDS) {
    const lvl = L[id];
    if (lvl <= 0) continue;
    const def = WEAPON_DEFS[id];
    // 攻撃速度強化: 実効間隔を縮める（1ヒットの威力は基準間隔のままなので手数=DPSが増える）。
    const interval = def.attackIntervalMs / (1 + haste);
    cd[id] += dtMs;
    if (cd[id] < interval) continue; // まだクールダウン中
    cd[id] -= interval;              // 1回攻撃（位相を保つ）
    const dmg = weaponDmg(def, lvl) * weaponMult(def, t) * globalMul * (1 + dexWeapon[id]) * (def.attackIntervalMs / 1000); // 1ヒット=基準間隔ぶんの塊（図鑑の武器個別強化も乗る）
    const range = weaponRange(def, lvl, rangeBonus);
    const lineRange = range + pierceBonus;
    const spread = Math.floor((lvl - 1) / b.areaPerLvls);
    const targets = 1;
    const hits = patternHits(def.pattern, { pos, target, range, lineRange, spread, targets, rangeBase: def.rangeBase, isSolid: (c) => isSolid(dug, c, b) });
    for (const h of hits) deal(h.cell, dmg * h.factor, id);
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
  const t = passiveTotals(runPassiveLevels(state.runGrid)); // 走行グリッドで解放したバフの合計（その周限定）
  const { global: dg, perWeapon: dexWeapon } = dexEffectTotals(state.perm.dex); // お宝図鑑: 全体効果＋武器個別
  const equipped = new Set(WEAPON_IDS.filter((w) => L[w] > 0)); // 持ち込み中の武器（つるはし＋開始武器）
  let pos = state.cat.pos;
  const moveCost = b.moveCost / (1 + t.move);
  // 繰り越す移動ゲージは1マスぶんに制限。壁の手前で詰まっている間に溜め込み、壊れた瞬間に大量ワープするのを防ぐ。
  let gauge = Math.min(state.cat.gauge, moveCost) + b.baseRate * (1 + t.rate) * (1 + dg.mine) * dt;
  let target = state.cat.target;
  let coins = state.coins;
  let xpGain = 0;
  let seq = state.seq;
  let drops = state.drops;
  let cleared = false;
  const dmgAcc = { ...state.dmgByWeapon };
  const hits = new Map<WeaponId, Cell[]>(); // このtickで武器が当てたマス（エフェクト用）
  const total = totalTilesOf(b);
  const coinMult = (1 + t.coin) * (1 + dg.coin);
  const rangeBonus = Math.floor(t.range);   // 走行グリッドの射程（貫通/範囲は1階層1つまで）
  const pierceBonus = Math.floor(t.pierce);
  // お宝の採掘ドロップ（個数制で重複OK）。レアリティごとに独立ロール。持ち込み中の武器のお宝だけ出る。
  const dexAdds: Record<number, number> = {};
  const dropMul = (1 + dg.drop) * b.treasureDropMul; // 発掘効果＋全体調整でドロップ率UP
  const addFrom = (pool: readonly number[]): void => {
    const usable = pool.filter((id) => equipped.has(weaponOf(id))); // 持ち込み武器のお宝のみ
    if (usable.length === 0) return;
    const id = usable[Math.floor(rng.next() * usable.length)]!;
    dexAdds[id] = (dexAdds[id] ?? 0) + 1;
  };
  const tryDropTreasure = (): void => {
    for (const r of RARITY_DEFS) {
      if (state.floor < r.minFloor) continue;                  // そのレアリティの解禁階に未到達
      if (rng.next() < r.baseChance * dropMul) addFrom(RARITY_IDS[r.id]);
    }
  };

  const applyDmg = (cell: Cell, baseAmt: number, w: WeaponId): void => {
    if (cleared || !isSolid(dug, cell, b)) return;
    const amt = rng.next() < t.crit + dg.crit ? baseAmt * b.critMult : baseAmt; // 会心（走行グリッド＋図鑑）
    let hc = hits.get(w); if (!hc) { hc = []; hits.set(w, hc); } hc.push(cell); // 命中マスを記録（演出）
    const k = cellKey(cell);
    const kind = kindAt(cell, state.floor, b);
    const HP = tileHardness(state.floor, tileDist(cell, b), kind.hardMult, b); // 距離＋種類で固さが変わる
    const prev = damage.get(k) ?? 0;
    dmgAcc[w] += Math.min(amt, HP - prev); // 寄与はブロックのHPを超えた分(オーバーキル)を含めない
    const d = prev + amt;
    if (d < HP) { damage.set(k, d); return; }
    damage.delete(k);
    dug.add(k);
    coins += tileValue(kind, state.floor, coinMult, b);
    tryDropTreasure(); // 採掘でお宝（レアリティごとに解禁階＋確率・持ち込み武器のみ）
    xpGain += (1 + t.xp) * (1 + dg.xp);
    seq += 1;
    drops = [...drops, { id: seq, x: cell.x, y: cell.y, emoji: kind.emoji, value: tileValue(kind, state.floor, coinMult, b), bornAt: now }];
    if (dug.size >= total) cleared = true;
  };

  // 移動: ターゲットへ空洞を歩く（壁の手前で止まり武器で削る）。
  if (state.autoMode) {
    if (!target || !isSolid(dug, target, b)) target = pickTarget(dug, pos, rng, b); // 自動は最寄りを自分で選ぶ
  } else if (target && (sameCell(pos, target) || !inBounds(target, b))) {
    target = null; // 手動: 到達/圏外で解除（次のクリック待ち）。
  }
  if (target) {
    let guard = 0;
    while (gauge >= moveCost && !sameCell(pos, target) && guard++ < 64) {
      const next = stepToward(pos, target);
      if (sameCell(next, pos) || !isDug(dug, next)) break;
      gauge -= moveCost; pos = next;
    }
  }

  // 武器発射。図鑑火力＋累計★倍率（自動でも火力は下がらない）。攻撃速度は図鑑の俊敏。武器個別強化(dexWeapon)も乗る。
  const globalMul = (1 + dg.power) * globalDamageMult(state.perm.starTotal, b);
  const weaponCd = { ...state.weaponCd };
  fireWeapons({ dug, pos, target, levels: L, totals: t, globalMul, dexWeapon, haste: dg.haste, dtMs, cd: weaponCd, rangeBonus, pierceBonus, b }, applyDmg);

  let permWithDex = state.perm;
  if (Object.keys(dexAdds).length > 0) {
    const dex2 = { ...state.perm.dex };
    for (const [id, c] of Object.entries(dexAdds)) dex2[Number(id)] = (dex2[Number(id)] ?? 0) + c;
    permWithDex = { ...state.perm, dex: dex2 };
  }

  // 階クリアで降下。獲得予定★(runPoints)は「進行」で貯まる: 階を降りるごとに pointsPerFloor×新しい階。
  if (cleared) return descend({ ...state, perm: permWithDex, rngState: rng.state(), coins, xp: state.xp + xpGain, seq, dmgByWeapon: dmgAcc, weaponCd, runPoints: state.runPoints + b.pointsPerFloor * (state.floor + 1) }, b);

  // 武器の命中演出を追加（武器ごとに当たったマス）。古いものは寿命で消す。
  let fx = state.fx;
  if (hits.size > 0) {
    const fresh = [...hits].map(([w, cells]) => ({ id: now * 8 + WEAPON_IDS.indexOf(w), weapon: w, origin: pos, cells, bornAt: now }));
    fx = [...fx, ...fresh];
  }
  if (fx.length > 0) { const keep = fx.filter((f) => now - f.bornAt < b.fxVisualMs); if (keep.length !== fx.length) fx = keep; }

  // 演出ドロップは一定時間で消す（回収は済み）。
  if (drops.length > 0) { const keep = drops.filter((d) => now - d.bornAt < b.dropVisualMs); if (keep.length !== drops.length) drops = keep; }

  // レベルアップ＝獲得予定★+pointsPerLevel（走行グリッドはコインで手動解放）。
  let xp = state.xp + xpGain;
  let level = state.level;
  let runPoints = state.runPoints;
  while (xp >= xpForNext(level, b)) {
    xp -= xpForNext(level, b);
    level += 1;
    runPoints += b.pointsPerLevel;
  }

  return {
    ...state,
    perm: permWithDex,
    time: now, coins, rev: state.rev + 1, seq, rngState: rng.state(), drops, fx,
    cat: { pos, gauge, target }, cam: pos, // 猫は常に画面中央（カメラ＝猫の位置に固定）
    xp, level, dmgByWeapon: dmgAcc, weaponCd, runPoints,
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
