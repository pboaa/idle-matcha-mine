import type { Cell } from '@domain/grid/position';
import { cellKey } from '@domain/grid/position';
import type { MiningBalance, ChoiceId, WeaponId, OfferRarity, MaterialId } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, WEAPON_IDS, PASSIVE_IDS } from '@domain/mining/balance';
import { baseOf } from '@domain/mining/tile';

export type { ChoiceId } from '@domain/mining/balance';

export interface Drop { readonly id: number; readonly x: number; readonly y: number; readonly emoji: string; readonly value: number; readonly bornAt: number }
/** 武器の命中演出（短命・描画専用）。cells はこのtickで当たったマス。 */
export interface WeaponFx { readonly id: number; readonly weapon: WeaponId; readonly cells: readonly Cell[]; readonly bornAt: number }
export interface MineCat { readonly pos: Cell; readonly gauge: number; readonly target: Cell | null }

export type Levels = Record<ChoiceId, number>;
export interface OfferChoice { readonly id: ChoiceId; readonly rarity: OfferRarity; readonly bonus: ChoiceId | null }
export interface MineMeta { readonly appraise: number }
export type Materials = Record<MaterialId, number>;
/** 恒久(転生で保持): 開始レベル＋基礎目利き＋熟練度で買う開始ブースト解放数。 */
export interface Perm { readonly levels: Levels; readonly appraise: number; readonly startBoost: number }

const ALL_IDS: readonly ChoiceId[] = [...WEAPON_IDS, ...PASSIVE_IDS];
const zeroLevels = (): Levels => Object.fromEntries(ALL_IDS.map((id) => [id, 0])) as Levels;
const zeroDmg = (): Record<WeaponId, number> => Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])) as Record<WeaponId, number>;

export const emptyMaterials = (): Materials => ({ dirt: 0, stone: 0, ore: 0, gem: 0 });
export const emptyPerm = (): Perm => ({ levels: zeroLevels(), appraise: 0, startBoost: 0 });

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
  readonly levels: Levels;
  readonly autoMode: boolean;
  readonly offer: readonly OfferChoice[] | null;
  readonly meta: MineMeta;
  readonly boost: number; // 走行限定の採掘ブースト（コインで購入・転生でリセット）
  readonly dmgByWeapon: Record<WeaponId, number>;

  readonly materials: Materials;
  readonly perm: Perm;
  readonly prestiges: number;
  readonly mastery: number;      // 熟練度の残高（通貨・周回しても消えない）
  readonly masteryTotal: number; // 累計獲得（永続の威力倍率を決める・減らない）
}

/** 走行（1回の潜り）を新規生成。開始武器はツルハシ固定。素材/恒久/熟練度は引き継ぐ。seed は走行ごとの変化用。 */
export function freshRun(
  b: MiningBalance, materials: Materials, perm: Perm, prestiges: number,
  seed = 123456, mastery = 0, masteryTotal = 0,
): MineState {
  const base = baseOf(b);
  const levels = zeroLevels();
  for (const id of ALL_IDS) levels[id] = perm.levels[id];
  levels.pick += 1; // 開始は必ずツルハシ
  return {
    time: 0, coins: 0, rev: 0, seq: 0, floor: 0, rngState: seed,
    dug: new Set([cellKey(base)]), damage: new Map(), drops: [], fx: [],
    cat: { pos: { ...base }, gauge: 0, target: null }, cam: { ...base },
    xp: 0, level: 1, levels, autoMode: true, offer: null,
    meta: { appraise: perm.appraise },
    boost: perm.startBoost, // 熟練度で解放した開始ブースト
    dmgByWeapon: zeroDmg(),
    materials, perm, prestiges, mastery, masteryTotal,
  };
}

export function initialMineState(b: MiningBalance = defaultMiningBalance, seed = 123456): MineState {
  return freshRun(b, emptyMaterials(), emptyPerm(), 0, seed, 0, 0);
}

export { MATERIAL_IDS };
