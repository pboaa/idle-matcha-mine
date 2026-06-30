/**
 * 採掘モックのマスターデータ（数値・カタログを集約）。ロジックから分離＝調整しやすい。
 */

export type MaterialId = 'dirt' | 'stone' | 'coal' | 'copper' | 'iron' | 'silver' | 'gold' | 'gem';
export interface MiningKind { readonly id: MaterialId; readonly name: string; readonly emoji: string; readonly color: string; readonly mult: number; readonly hardMult: number }
// 素材は8段階（浅い=土、深いほど上位）。tier=配列index。価値(mult)と硬さ(hardMult)が段階で上昇。
export const MINING_KINDS: readonly MiningKind[] = [
  { id: 'dirt', name: '土', emoji: '🟫', color: '#8d6e63', mult: 1, hardMult: 1 },
  { id: 'stone', name: '石', emoji: '🪨', color: '#78909c', mult: 2, hardMult: 1.35 },
  { id: 'coal', name: '石炭', emoji: '⬛', color: '#374151', mult: 4, hardMult: 1.75 },
  { id: 'copper', name: '銅', emoji: '🟠', color: '#d97706', mult: 7, hardMult: 2.25 },
  { id: 'iron', name: '鉄', emoji: '⚙️', color: '#9ca3af', mult: 11, hardMult: 2.9 },
  { id: 'silver', name: '銀', emoji: '🥈', color: '#cbd5e1', mult: 17, hardMult: 3.7 },
  { id: 'gold', name: '金', emoji: '🥇', color: '#fbbf24', mult: 26, hardMult: 4.7 },
  { id: 'gem', name: '宝石', emoji: '💎', color: '#4dd0e1', mult: 40, hardMult: 6 },
];
export const MATERIAL_IDS: readonly MaterialId[] = MINING_KINDS.map((k) => k.id);
export const materialTier = (id: MaterialId): number => MATERIAL_IDS.indexOf(id);
export const KINDS_BY_ID: Record<MaterialId, MiningKind> = Object.fromEntries(MINING_KINDS.map((k) => [k.id, k])) as Record<MaterialId, MiningKind>;

// ===== 武器・強化のカタログ（ヴァンサバ風・データ駆動） =====
export type WeaponId = 'pick' | 'bullet' | 'bomb' | 'beam' | 'drill' | 'aura' | 'ring';
// 「強化（パッシブ）」のマスターデータは passives.ts に分離（ここで取り込み再エクスポート）。
import { PASSIVE_DEFS, type PassiveId } from '@domain/mining/passives';
export type { PassiveId, PassiveEffect, PassiveDef } from '@domain/mining/passives';
export { PASSIVE_DEFS, PASSIVE_IDS } from '@domain/mining/passives';
export type ChoiceId = WeaponId | PassiveId;

export type WeaponTag = 'melee' | 'shot' | 'beam' | 'field';
export type WeaponPattern = 'front' | 'nearest' | 'burst' | 'cross' | 'forward' | 'around' | 'ring';

export interface WeaponDef {
  readonly id: WeaponId; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly tag: WeaponTag; readonly pattern: WeaponPattern;
  readonly baseDmg: number; readonly dmgPerLvl: number;
  readonly rangeBase: number; readonly rangePerLvls: number; // 射程/半径（rangePerLvls レベルごとに +1）
  readonly attackIntervalMs: number; // 攻撃間隔（小さいほど手数が多い）。1ヒットの威力 = baseDmg×interval/1000。
  readonly fxColor: string; // 命中エフェクトの色
}

// baseDmg は「毎秒の素ダメージ」。1ヒットはこれに attackIntervalMs/1000 を掛けた塊で出る（＝DPSは間隔に依らず一定）。
export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pick: { id: 'pick', label: 'ツルハシ', emoji: '⛏️', desc: '前方1マス→レベルで横に広がる', tag: 'melee', pattern: 'front', baseDmg: 0.5, dmgPerLvl: 0.16, rangeBase: 1, rangePerLvls: 99, attackIntervalMs: 500, fxColor: '#fbbf24' },
  bullet: { id: 'bullet', label: '弾', emoji: '🔫', desc: '近くの1マスを撃つ', tag: 'shot', pattern: 'nearest', baseDmg: 0.5, dmgPerLvl: 0.25, rangeBase: 5, rangePerLvls: 99, attackIntervalMs: 300, fxColor: '#f87171' },
  bomb: { id: 'bomb', label: '爆弾', emoji: '💣', desc: '近くで小爆発（3x3）', tag: 'shot', pattern: 'burst', baseDmg: 0.07, dmgPerLvl: 0.16, rangeBase: 6, rangePerLvls: 99, attackIntervalMs: 800, fxColor: '#fb923c' },
  beam: { id: 'beam', label: 'ビーム', emoji: '⚡', desc: '直線ビーム（レベルで2→4→8方向）', tag: 'beam', pattern: 'cross', baseDmg: 0.25, dmgPerLvl: 0.12, rangeBase: 1, rangePerLvls: 6, attackIntervalMs: 250, fxColor: '#67e8f9' },
  drill: { id: 'drill', label: 'ドリル', emoji: '🌀', desc: '進行方向へ貫く', tag: 'beam', pattern: 'forward', baseDmg: 0.25, dmgPerLvl: 0.12, rangeBase: 2, rangePerLvls: 4, attackIntervalMs: 400, fxColor: '#a78bfa' },
  aura: { id: 'aura', label: 'オーラ', emoji: '💥', desc: '周囲をじわっと削る', tag: 'field', pattern: 'around', baseDmg: 0.056, dmgPerLvl: 0.12, rangeBase: 1, rangePerLvls: 7, attackIntervalMs: 700, fxColor: '#f472b6' },
  ring: { id: 'ring', label: 'リング', emoji: '🪃', desc: '外周をぐるりと削る', tag: 'field', pattern: 'ring', baseDmg: 0.04, dmgPerLvl: 0.12, rangeBase: 2, rangePerLvls: 6, attackIntervalMs: 600, fxColor: '#bef264' },
};
export const WEAPON_IDS = Object.keys(WEAPON_DEFS) as WeaponId[];
/** 最初から3択に出る武器（2種）。残りは転生ポイントで解放。 */
export const BASE_WEAPONS: readonly WeaponId[] = ['pick', 'bullet'];
/** 累計★で自動解放される武器の順番（必要★は balance.weaponUnlockStars）。 */
export const WEAPON_UNLOCK_ORDER: readonly WeaponId[] = ['bomb', 'beam', 'drill', 'aura', 'ring'];


export const isWeapon = (id: ChoiceId): id is WeaponId => id in WEAPON_DEFS;
export const choiceMeta = (id: ChoiceId): { label: string; emoji: string; desc: string } =>
  isWeapon(id) ? WEAPON_DEFS[id] : PASSIVE_DEFS[id as PassiveId];

/** 3択のレア度。rare=効果2倍、epic=効果＋おまけ強化(オプション)。 */
export type OfferRarity = 'common' | 'rare' | 'epic';

// ===== スカラー数値 =====
export interface MiningBalance {
  readonly worldSize: number;
  readonly baseRate: number;
  readonly moveCost: number;
  readonly dropVisualMs: number;
  readonly fxVisualMs: number; // 武器命中エフェクトの表示寿命

  readonly hardnessBase: number;
  readonly hardnessGrowth: number; // 階ごとの硬さ倍率（幾何級数＝乗算で伸びる火力に追従）
  readonly distHardness: number;   // 拠点からの距離1マスごとの硬さ+（同じ階でも外側ほど固い）
  readonly valueGrowth: number;    // 階ごとの価値倍率（幾何級数・硬さよりやや緩く）
  readonly kinds: Record<MaterialId, MiningKind>;
  // 素材のレア度は深さ連動: 浅い階はほぼ土、深いほど上位素材(tier1..7)が解禁され出やすくなる。index0=tier1(石)..index6=tier7(宝石)。
  readonly matTiers: readonly { readonly unlockFloor: number; readonly perFloor: number; readonly max: number }[];

  readonly areaPerLvls: number;  // 武器レベル何段ごとに範囲段階(spread)が+1（射程投資でも増える）
  readonly critMult: number;     // 会心倍率
  readonly maxRangeBonus: number;  // 走行グリッドの射程ボーナスのハードキャップ（盤面を覆い尽くさないように）
  readonly maxPierceBonus: number; // 走行グリッドの貫通ボーナスのハードキャップ

  readonly xpBase: number; readonly xpPerLevel: number; // レベルアップ＝走行グリッドの無料解放権+1

  readonly pointsPerLevel: number; // レベルアップで貯まる★（runPoints・転生で確定）
  readonly pointsPerFloor: number; // 階を降りるごとに貯まる★（深いほど＝floor倍）

  // 武器の解放に必要な★（消費・WEAPON_UNLOCK_ORDER順に少しずつ高い）。
  readonly weaponUnlockStarCost: readonly number[];
  // 累計★（消費しない総獲得★）による全体ダメージ倍率: 1 + starMultPerLvl×√累計★（√で逓減＝壊れない）。
  readonly starMultPerLvl: number;

  // 走行グリッド（その周だけ・ランダム・手動のみ）。コインでマス解放（上限まで・少しずつ高く）。
  readonly runGridSize: number;
  readonly runCoinCostBase: number; readonly runCoinGrowth: number;     // マス解放（コスト逓増）
  readonly runRerollCostBase: number; readonly runRerollGrowth: number; // 未解放マスのリロール
  readonly runCapBase: number; readonly runCapPerTreasures: number;     // 走行グリッド上限（基本＋図鑑N個ごとに+1）

  // お宝図鑑のドロップ全体倍率（レアリティ別の確率/解禁階は treasures.ts の RARITY_DEFS が保持）。
  readonly treasureDropMul: number;
  readonly treasureVisualMs: number; // お宝を拾った演出の表示寿命
}

export const defaultMiningBalance: MiningBalance = {
  worldSize: 26,
  baseRate: 0.9,
  moveCost: 0.5,
  dropVisualMs: 900,
  fxVisualMs: 220,

  hardnessBase: 0.38,
  hardnessGrowth: 1.27,
  distHardness: 0.10,
  valueGrowth: 1.10,
  kinds: KINDS_BY_ID,
  matTiers: [
    { unlockFloor: 0, perFloor: 4, max: 38 },    // tier1 石
    { unlockFloor: 1, perFloor: 3, max: 24 },    // tier2 石炭
    { unlockFloor: 3, perFloor: 2.5, max: 17 },  // tier3 銅
    { unlockFloor: 6, perFloor: 2, max: 12 },    // tier4 鉄
    { unlockFloor: 10, perFloor: 1.6, max: 9 },  // tier5 銀
    { unlockFloor: 14, perFloor: 1.2, max: 6 },  // tier6 金
    { unlockFloor: 19, perFloor: 0.9, max: 4 },  // tier7 宝石
  ],

  areaPerLvls: 6,
  critMult: 3,
  maxRangeBonus: 4, maxPierceBonus: 4, // 貫通/範囲は最大+4まで（ハードキャップ）

  xpBase: 5, xpPerLevel: 3,

  pointsPerLevel: 1, pointsPerFloor: 3,

  weaponUnlockStarCost: [10, 24, 48, 85, 140], // bomb/beam/drill/aura/ring（★消費・少しずつ高く）
  starMultPerLvl: 0.06, // 累計★で全体ダメージ 1+0.06×√累計★（補填: 旧スキルツリー廃止ぶんを永続火力で）

  runGridSize: 9,                            // 9x9＝マス多め（大量に上げられる）
  runCoinCostBase: 20, runCoinGrowth: 1.18,  // 逓増だが緩め＝コインを貯めれば沢山上げられる（やり込み）
  runRerollCostBase: 40, runRerollGrowth: 1.8,
  runCapBase: 70, runCapPerTreasures: 16,    // 最初から上限ゆるめ70（9x9のほぼ全マス）・図鑑16種ごとに+1。実質の制限はコスト逓増

  treasureDropMul: 1, // お宝ドロップの全体倍率（レアリティ別の率は RARITY_DEFS）
  treasureVisualMs: 1600, // お宝を拾った演出の表示寿命（少し長めで気づける）
};
