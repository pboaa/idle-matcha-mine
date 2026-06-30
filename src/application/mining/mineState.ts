import type { Cell } from '@domain/grid/position';
import { cellKey } from '@domain/grid/position';
import type { MiningBalance, ChoiceId, WeaponId, WeaponStat } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_IDS, PASSIVE_IDS } from '@domain/mining/balance';
import { baseOf } from '@domain/mining/tile';
import { genRunGrid, type RunGrid } from '@domain/mining/runGrid';

export type { ChoiceId } from '@domain/mining/balance';

export interface Drop { readonly id: number; readonly x: number; readonly y: number; readonly emoji: string; readonly value: number; readonly bornAt: number }
/** 武器の命中演出（短命・描画専用）。origin は発射元(猫)、cells はこのtickで当たったマス。 */
export interface WeaponFx { readonly id: number; readonly weapon: WeaponId; readonly origin: Cell; readonly cells: readonly Cell[]; readonly bornAt: number }
export interface MineCat { readonly pos: Cell; readonly gauge: number; readonly target: Cell | null }

export type Levels = Record<ChoiceId, number>;
/** 武器ステータス量（ダメージ/攻撃速度/射程/貫通/範囲/固有）。恒久スキルツリーの累積。 */
export type WeaponStatLevels = Record<WeaponStat, number>;
/** 武器ごとの恒久スキルツリー進捗（解放済みノードindexの配列）。★で解放。 */
export type WeaponSkill = Record<WeaponId, number[]>;
/** 恒久(転生で保持): 武器スキルツリー＋メイン(全体)ツリー＋放置ツリー＋★残高＋解放済み武器。 */
export interface Perm {
  readonly weaponSkill: WeaponSkill;
  readonly mainSkill: number[];
  readonly starPoints: number;            // 消費可能な★残高（恒久グリッド/武器解放に使う）
  readonly starTotal: number;             // 累計★（消費しても減らない総獲得★・全体ダメージ倍率に使う）
  readonly unlockedWeapons: WeaponId[];   // 開始時に選べる武器（つるはし以外。★で解放）
}

const ALL_IDS: readonly ChoiceId[] = [...WEAPON_IDS, ...PASSIVE_IDS];
export const zeroLevels = (): Levels => Object.fromEntries(ALL_IDS.map((id) => [id, 0])) as Levels;
const zeroDmg = (): Record<WeaponId, number> => Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])) as Record<WeaponId, number>;

export const emptyWeaponSkill = (): WeaponSkill => Object.fromEntries(WEAPON_IDS.map((w) => [w, [] as number[]])) as WeaponSkill;
export const emptyPerm = (): Perm => ({ weaponSkill: emptyWeaponSkill(), mainSkill: [], starPoints: 0, starTotal: 0, unlockedWeapons: ['bullet'] });

export interface MineState {
  readonly time: number;
  readonly coins: number;
  readonly rev: number;
  readonly seq: number;
  readonly floor: number;
  readonly rngState: number;
  readonly dug: Set<string>;
  readonly damage: Map<string, number>;
  readonly drops: readonly Drop[];
  readonly fx: readonly WeaponFx[];
  readonly cat: MineCat;
  readonly cam: Cell;

  readonly xp: number;
  readonly level: number;
  readonly levels: Levels;          // 装備中の武器フラグ（pick＋開始武器のみ1、他0）
  readonly autoMode: boolean;
  readonly dmgByWeapon: Record<WeaponId, number>;
  readonly weaponCd: Record<WeaponId, number>;

  readonly startWeapon: WeaponId;   // この走行で選んだ武器（つるはしは常時）
  readonly runGrid: RunGrid;        // 走行グリッド（その周だけ・ランダム・転生でリセット）
  readonly runPoints: number;       // この走行の獲得予定★（進行で貯まる→転生で perm.starPoints へ）
  readonly perm: Perm;
  readonly prestiges: number;
}

/** 走行（1回の潜り）を新規生成。つるはし＋選んだ武器のみ装備。走行グリッドは毎走ランダム。恒久(perm)は引き継ぐ。 */
export function freshRun(b: MiningBalance, perm: Perm, prestiges: number, startWeapon: WeaponId, seed = 123456): MineState {
  const base = baseOf(b);
  const levels = zeroLevels();
  levels.pick = 1;          // つるはしは常時
  levels[startWeapon] = 1;  // 選んだ武器
  return {
    time: 0, coins: 0, rev: 0, seq: 0, floor: 0, rngState: seed,
    dug: new Set([cellKey(base)]), damage: new Map(), drops: [], fx: [],
    cat: { pos: { ...base }, gauge: 0, target: null }, cam: { ...base },
    xp: 0, level: 1, levels, autoMode: true,
    dmgByWeapon: zeroDmg(), weaponCd: zeroDmg(),
    startWeapon,
    runGrid: genRunGrid(seed, b.runGridSize, ['pick', startWeapon]),
    runPoints: 0, perm, prestiges,
  };
}

export function initialMineState(b: MiningBalance = defaultMiningBalance, seed = 123456): MineState {
  return freshRun(b, emptyPerm(), 0, 'bullet', seed);
}
