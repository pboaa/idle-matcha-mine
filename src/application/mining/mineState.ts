import type { Cell } from '@domain/grid/position';
import { cellKey } from '@domain/grid/position';
import type { MiningBalance, ChoiceId, WeaponId, OfferRarity, MaterialId, WeaponStat } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, WEAPON_IDS, PASSIVE_IDS, WEAPON_STATS } from '@domain/mining/balance';
import { baseOf } from '@domain/mining/tile';

export type { ChoiceId } from '@domain/mining/balance';

export interface Drop { readonly id: number; readonly x: number; readonly y: number; readonly emoji: string; readonly value: number; readonly bornAt: number }
/** 武器の命中演出（短命・描画専用）。origin は発射元(猫)、cells はこのtickで当たったマス。 */
export interface WeaponFx { readonly id: number; readonly weapon: WeaponId; readonly origin: Cell; readonly cells: readonly Cell[]; readonly bornAt: number }
export interface MineCat { readonly pos: Cell; readonly gauge: number; readonly target: Cell | null }

export type Levels = Record<ChoiceId, number>;
export interface OfferChoice { readonly id: ChoiceId; readonly rarity: OfferRarity; readonly bonus: ChoiceId | null }
export interface MineMeta { readonly appraise: number }
export type Materials = Record<MaterialId, number>;
export type WeaponMastery = Record<WeaponId, number>;
/** 武器ごとのステータス強化Lv（ダメージ/攻撃速度/射程/貫通/固有）。ラン中の鉱石強化に使う。 */
export type WeaponStatLevels = Record<WeaponStat, number>;
export type WeaponUpgrades = Record<WeaponId, WeaponStatLevels>;
/** 武器ごとの恒久スキルツリー進捗（解放済みノード数）。ポイントで伸ばす。 */
export type WeaponSkill = Record<WeaponId, number>;
/** 恒久(転生で保持): 開始レベル＋基礎目利き＋武器ごとのスキルツリー。 */
export interface Perm { readonly levels: Levels; readonly appraise: number; readonly weaponSkill: WeaponSkill }

const ALL_IDS: readonly ChoiceId[] = [...WEAPON_IDS, ...PASSIVE_IDS];
const zeroLevels = (): Levels => Object.fromEntries(ALL_IDS.map((id) => [id, 0])) as Levels;
const zeroDmg = (): Record<WeaponId, number> => Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])) as Record<WeaponId, number>;

export const emptyMaterials = (): Materials => ({ dirt: 0, stone: 0, ore: 0, gem: 0 });
export const emptyMastery = (): WeaponMastery => Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])) as WeaponMastery;
const zeroStats = (): WeaponStatLevels => Object.fromEntries(WEAPON_STATS.map((s) => [s, 0])) as WeaponStatLevels;
/** 武器ごとのステータスLvマップ（ラン中の鉱石強化 runUp の初期値）。 */
export const emptyWeaponUp = (): WeaponUpgrades => Object.fromEntries(WEAPON_IDS.map((w) => [w, zeroStats()])) as WeaponUpgrades;
export const emptyWeaponSkill = (): WeaponSkill => Object.fromEntries(WEAPON_IDS.map((w) => [w, 0])) as WeaponSkill;
export const emptyPerm = (): Perm => ({ levels: zeroLevels(), appraise: 0, weaponSkill: emptyWeaponSkill() });
export const totalMastery = (m: WeaponMastery): number => WEAPON_IDS.reduce((a, w) => a + m[w], 0);

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
  readonly weaponCd: Record<WeaponId, number>; // 武器ごとの攻撃クールダウン蓄積ms（攻撃間隔の管理）

  readonly materials: Materials;   // 鉱石（ラン中の通貨・採掘で集め、ラン中の強化に使う。転生で残りはポイントへ）
  readonly runUp: WeaponUpgrades;  // ラン中の武器強化（鉱石で購入・転生でリセット）
  readonly points: number;         // 恒久ポイント（転生時に残り鉱石を変換して貯まる）
  readonly perm: Perm;
  readonly prestiges: number;
  readonly mastery: WeaponMastery; // 武器ごとの熟練度（永続・転生時に上がる）。武器ダメージ＋合計でスループット。
}

/** 走行（1回の潜り）を新規生成。開始武器はツルハシ固定。鉱石/ラン強化はリセット、恒久(perm)/熟練度/ポイントは引き継ぐ。 */
export function freshRun(
  b: MiningBalance, perm: Perm, prestiges: number,
  seed = 123456, mastery: WeaponMastery = emptyMastery(), points = 0,
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
    boost: 0, // 採掘ブーストはコインで毎走購入（転生でリセット）
    dmgByWeapon: zeroDmg(),
    weaponCd: zeroDmg(),
    materials: emptyMaterials(), runUp: emptyWeaponUp(), points,
    perm, prestiges, mastery,
  };
}

export function initialMineState(b: MiningBalance = defaultMiningBalance, seed = 123456): MineState {
  return freshRun(b, emptyPerm(), 0, seed, emptyMastery(), 0);
}

export { MATERIAL_IDS };
