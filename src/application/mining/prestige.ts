import type { MiningBalance, WeaponId, MainStat } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_UNLOCK_ORDER, BASE_WEAPONS, weaponSkillNodes, mainSkillNodes, nodeUnlockableIn, gridOpenFor, sumSkillStats } from '@domain/mining/balance';
import { freshRun, type MineState, type Perm, type WeaponStatLevels } from '@application/mining/mineState';

// ===== 武器の解放（★を消費・つるはし＋bulletは最初から） =====
/** その武器の解放に必要な★（基本武器は0、対象外はInfinity）。 */
export function weaponUnlockStar(w: WeaponId, b: MiningBalance = defaultMiningBalance): number {
  if (BASE_WEAPONS.includes(w)) return 0;
  const i = WEAPON_UNLOCK_ORDER.indexOf(w);
  return i < 0 ? Infinity : (b.weaponUnlockStarCost[i] ?? Infinity);
}
/** 開始時に選べる武器（つるはし以外）。perm.unlockedWeapons をそのまま返す。 */
export function allowedWeapons(perm: Perm): readonly WeaponId[] {
  return perm.unlockedWeapons;
}
/** 武器を★で解放（残高不足/既解放/対象外は何もしない・★を消費）。 */
export function unlockWeapon(state: MineState, w: WeaponId, b: MiningBalance = defaultMiningBalance): MineState {
  if (state.perm.unlockedWeapons.includes(w)) return state;
  const cost = weaponUnlockStar(w, b);
  if (!isFinite(cost) || state.perm.starPoints < cost) return state;
  return { ...state, perm: { ...state.perm, starPoints: state.perm.starPoints - cost, unlockedWeapons: [...state.perm.unlockedWeapons, w] } };
}

// ===== 恒久スキルツリー（武器ツリー＋メインツリー・★を消費して購入・グリッド解禁） =====
const unlockedOf = (perm: Perm, target: WeaponId | 'main'): readonly number[] => target === 'main' ? perm.mainSkill : perm.weaponSkill[target];
const nodesOf = (target: WeaponId | 'main'): ReturnType<typeof weaponSkillNodes> => target === 'main' ? mainSkillNodes() : weaponSkillNodes(target);
/** そのノードが今解放できるか（未解放・階層が解禁済み・中央or隣接が解放済み）。 */
export function skillNodeUnlockable(target: WeaponId | 'main', unlocked: readonly number[], nodeIndex: number): boolean {
  return nodeUnlockableIn(nodesOf(target), unlocked, nodeIndex);
}
/** その階層グリッドが解禁済みか。 */
export function skillGridOpen(target: WeaponId | 'main', unlocked: readonly number[], tier: number): boolean {
  return gridOpenFor(nodesOf(target), unlocked, tier);
}
const withUnlocked = (perm: Perm, target: WeaponId | 'main', unlocked: number[]): Perm =>
  target === 'main' ? { ...perm, mainSkill: unlocked } : { ...perm, weaponSkill: { ...perm.weaponSkill, [target]: unlocked } };
/** ノードを1つ★で解放（隣接解禁＋★残高を消費）。武器/メイン共通。 */
export function buySkill(state: MineState, target: WeaponId | 'main', nodeIndex: number): MineState {
  const unlocked = unlockedOf(state.perm, target);
  const node = nodesOf(target)[nodeIndex];
  if (!node || !skillNodeUnlockable(target, unlocked, nodeIndex)) return state;
  if (state.perm.starPoints < node.starCost) return state;
  const perm = withUnlocked({ ...state.perm, starPoints: state.perm.starPoints - node.starCost }, target, [...unlocked, nodeIndex]);
  return { ...state, perm };
}
/** 一気に上げる: 解禁可能＆★が足りるノードを「安い順」に買えるだけ。 */
export function buySkillMax(state: MineState, target: WeaponId | 'main'): MineState {
  const nodes = nodesOf(target);
  let s = state;
  for (let guard = 0; guard < nodes.length; guard++) {
    const unlocked = unlockedOf(s.perm, target);
    let best = -1, bestCost = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (unlocked.includes(i) || !skillNodeUnlockable(target, unlocked, i)) continue;
      if (nodes[i]!.starCost > s.perm.starPoints) continue;
      if (nodes[i]!.starCost < bestCost) { bestCost = nodes[i]!.starCost; best = i; }
    }
    if (best < 0) break;
    s = buySkill(s, target, best);
  }
  return s;
}
// 後方互換エイリアス（武器ツリー）。
export const buyWeaponSkill = (state: MineState, weapon: WeaponId, i: number): MineState => buySkill(state, weapon, i);
export const buyWeaponSkillMax = (state: MineState, weapon: WeaponId): MineState => buySkillMax(state, weapon);
/** 武器ツリーの累積ステータス（武器に恒久で乗る）。 */
export function weaponSkillStats(weapon: WeaponId, unlocked: readonly number[]): WeaponStatLevels {
  const s = sumSkillStats(weaponSkillNodes(weapon), unlocked);
  return { damage: s.damage ?? 0, speed: s.speed ?? 0, range: s.range ?? 0, pierce: s.pierce ?? 0, area: s.area ?? 0, unique: s.unique ?? 0 };
}
/** メインツリーの累積（全体強化）。 */
export function mainSkillStats(unlocked: readonly number[]): Partial<Record<MainStat, number>> {
  return sumSkillStats(mainSkillNodes(), unlocked) as Partial<Record<MainStat, number>>;
}

// ===== 累計★＝全体ダメージ倍率（消費しても減らない総獲得★・√で逓減＝壊れない） =====
/** 全武器に乗る全体ダメージ倍率（1 + starMultPerLvl×√累計★）。 */
export function globalDamageMult(starTotal: number, b: MiningBalance = defaultMiningBalance): number {
  return 1 + b.starMultPerLvl * Math.sqrt(Math.max(0, starTotal));
}

// ===== お宝（永続資源）で買う永続強化 =====
/** 走行グリッド上限+1 の次のお宝コスト。 */
export const capUpgradeCost = (capLevel: number, b: MiningBalance = defaultMiningBalance): number =>
  Math.floor(b.capCostBase * Math.pow(b.capCostGrowth, capLevel));
/** 走行グリッド上限を1段（お宝を消費）。 */
export function buyCapUpgrade(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = capUpgradeCost(state.perm.capLevel, b);
  if (state.perm.treasure < cost) return state;
  return { ...state, perm: { ...state.perm, treasure: state.perm.treasure - cost, capLevel: state.perm.capLevel + 1 } };
}
/** 永続全体火力+1 の次のお宝コスト。 */
export const treasurePowerCost = (lvl: number, b: MiningBalance = defaultMiningBalance): number =>
  Math.floor(b.treasurePowerCostBase * Math.pow(b.treasurePowerCostGrowth, lvl));
/** 永続全体火力倍率（1 + treasurePowerPerLvl×Lv）。 */
export const treasurePowerMult = (lvl: number, b: MiningBalance = defaultMiningBalance): number =>
  1 + lvl * b.treasurePowerPerLvl;
/** 永続全体火力を1段（お宝を消費）。 */
export function buyTreasurePower(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = treasurePowerCost(state.perm.treasurePower, b);
  if (state.perm.treasure < cost) return state;
  return { ...state, perm: { ...state.perm, treasure: state.perm.treasure - cost, treasurePower: state.perm.treasurePower + 1 } };
}

// ===== 開始武器の選択／転生 =====
/** 開始武器を選んで走行をやり直す（floor0想定・★は据え置き）。解放済み武器のみ。 */
export function startRun(state: MineState, w: WeaponId, b: MiningBalance = defaultMiningBalance): MineState {
  if (w !== 'pick' && !state.perm.unlockedWeapons.includes(w)) return state;
  return freshRun(b, state.perm, state.prestiges, w, state.rngState);
}
/** 転生: 走行をリセット。獲得予定★(runPoints)を★残高(starPoints)と累計★(starTotal)の両方へ加算。開始武器は引き継ぐ。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const perm: Perm = { ...state.perm, starPoints: state.perm.starPoints + state.runPoints, starTotal: state.perm.starTotal + state.runPoints };
  return freshRun(b, perm, state.prestiges + 1, state.startWeapon, state.rngState);
}
