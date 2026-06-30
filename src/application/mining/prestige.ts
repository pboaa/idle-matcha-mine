import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_UNLOCK_ORDER, BASE_WEAPONS } from '@domain/mining/balance';
import { STAR_NODES, starNodeUnlockable } from '@domain/mining/treasures';
import { freshRun, type MineState, type Perm } from '@application/mining/mineState';

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

// ===== ★グリッド（旧・恒久スキルツリーの置き換え）。★を消費してマスを開け、レアお宝を入手 =====
/** そのレアマスが今開けられるか（未収集・中央or隣接が収集済み）。 */
export function starNodeBuyable(perm: Perm, id: number): boolean {
  return starNodeUnlockable(new Set(perm.dex), id);
}
/** ★グリッドのマスを開ける（★を消費・レアお宝を図鑑に追加）。 */
export function buyStarNode(state: MineState, id: number): MineState {
  const node = STAR_NODES[id];
  if (!node || !starNodeBuyable(state.perm, id)) return state;
  if (state.perm.starPoints < node.starCost) return state;
  return { ...state, perm: { ...state.perm, starPoints: state.perm.starPoints - node.starCost, dex: [...state.perm.dex, id] } };
}
/** 一気に開ける: 開放可能＆★が足りるマスを「安い順」に買えるだけ。 */
export function buyStarGridMax(state: MineState): MineState {
  let s = state;
  for (let guard = 0; guard < STAR_NODES.length; guard++) {
    const collected = new Set(s.perm.dex);
    let best = -1, bestCost = Infinity;
    for (const n of STAR_NODES) {
      if (collected.has(n.id) || !starNodeUnlockable(collected, n.id)) continue;
      if (n.starCost > s.perm.starPoints) continue;
      if (n.starCost < bestCost) { bestCost = n.starCost; best = n.id; }
    }
    if (best < 0) break;
    s = buyStarNode(s, best);
  }
  return s;
}

// ===== 累計★＝全体ダメージ倍率（消費しても減らない総獲得★・√で逓減＝壊れない） =====
/** 全武器に乗る全体ダメージ倍率（1 + starMultPerLvl×√累計★）。 */
export function globalDamageMult(starTotal: number, b: MiningBalance = defaultMiningBalance): number {
  return 1 + b.starMultPerLvl * Math.sqrt(Math.max(0, starTotal));
}

// ===== 開始武器の選択／転生 =====
/** 開始武器を選んで走行をやり直す（floor0想定・★は据え置き）。解放済み武器のみ。 */
export function startRun(state: MineState, w: WeaponId, b: MiningBalance = defaultMiningBalance): MineState {
  if (w !== 'pick' && !state.perm.unlockedWeapons.includes(w)) return state;
  return freshRun(b, state.perm, state.prestiges, w, state.rngState);
}
/** 転生: 走行をリセット。獲得予定★(runPoints)を★残高(starPoints)と累計★(starTotal)の両方へ加算。開始武器・図鑑は引き継ぐ。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const perm: Perm = { ...state.perm, starPoints: state.perm.starPoints + state.runPoints, starTotal: state.perm.starTotal + state.runPoints };
  return freshRun(b, perm, state.prestiges + 1, state.startWeapon, state.rngState);
}
