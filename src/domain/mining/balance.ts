/**
 * 採掘モックのマスターデータ（数値・カタログを集約）。ロジックから分離＝調整しやすい。
 */

export type MaterialId = 'dirt' | 'stone' | 'ore' | 'gem';
export const MATERIAL_IDS: readonly MaterialId[] = ['dirt', 'stone', 'ore', 'gem'];
export interface MiningKind { readonly id: MaterialId; readonly name: string; readonly emoji: string; readonly color: string; readonly mult: number }

// ===== 武器・強化のカタログ（ヴァンサバ風・データ駆動） =====
export type WeaponId = 'pick' | 'bullet' | 'bomb' | 'beam' | 'drill' | 'aura' | 'ring';
export type PassiveId =
  | 'power' | 'speed' | 'haste' | 'luck' | 'greed' | 'xp' | 'range' | 'crit' | 'pierce' | 'bighit'
  | 'whet' | 'powder' | 'lens' | 'echo'
  | 'upick' | 'ubullet' | 'ubomb' | 'ubeam' | 'udrill' | 'uaura' | 'uring';
export type ChoiceId = WeaponId | PassiveId;

export type WeaponTag = 'melee' | 'shot' | 'beam' | 'field';
export type WeaponPattern = 'front' | 'nearest' | 'burst' | 'cross' | 'forward' | 'around' | 'ring';

export interface WeaponDef {
  readonly id: WeaponId; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly tag: WeaponTag; readonly pattern: WeaponPattern;
  readonly baseDmg: number; readonly dmgPerLvl: number;
  readonly rangeBase: number; readonly rangePerLvls: number; // 射程/半径（rangePerLvls レベルごとに +1）
  readonly fxColor: string; // 命中エフェクトの色
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pick: { id: 'pick', label: 'ツルハシ', emoji: '⛏️', desc: '前方を掘る基本武器', tag: 'melee', pattern: 'front', baseDmg: 0.6, dmgPerLvl: 0.24, rangeBase: 1, rangePerLvls: 99, fxColor: '#fbbf24' },
  bullet: { id: 'bullet', label: '弾', emoji: '🔫', desc: '近くの1マスを撃つ', tag: 'shot', pattern: 'nearest', baseDmg: 0.35, dmgPerLvl: 0.18, rangeBase: 5, rangePerLvls: 99, fxColor: '#f87171' },
  bomb: { id: 'bomb', label: '爆弾', emoji: '💣', desc: '近くで小爆発（3x3）', tag: 'shot', pattern: 'burst', baseDmg: 0.16, dmgPerLvl: 0.07, rangeBase: 6, rangePerLvls: 99, fxColor: '#fb923c' },
  beam: { id: 'beam', label: 'ビーム', emoji: '⚡', desc: '十字に削る', tag: 'beam', pattern: 'cross', baseDmg: 0.07, dmgPerLvl: 0.03, rangeBase: 1, rangePerLvls: 3, fxColor: '#67e8f9' },
  drill: { id: 'drill', label: 'ドリル', emoji: '🌀', desc: '進行方向へ貫く', tag: 'beam', pattern: 'forward', baseDmg: 0.18, dmgPerLvl: 0.07, rangeBase: 2, rangePerLvls: 2, fxColor: '#a78bfa' },
  aura: { id: 'aura', label: 'オーラ', emoji: '💥', desc: '周囲をじわっと削る', tag: 'field', pattern: 'around', baseDmg: 0.045, dmgPerLvl: 0.02, rangeBase: 1, rangePerLvls: 4, fxColor: '#f472b6' },
  ring: { id: 'ring', label: 'リング', emoji: '🪃', desc: '外周をぐるりと削る', tag: 'field', pattern: 'ring', baseDmg: 0.035, dmgPerLvl: 0.015, rangeBase: 2, rangePerLvls: 3, fxColor: '#bef264' },
};
export const WEAPON_IDS = Object.keys(WEAPON_DEFS) as WeaponId[];

/** 強化（特殊能力）の効果種別。weaponDmg は targetWeapon 指定の固有強化に使う。 */
export type PassiveEffect = 'power' | 'rate' | 'move' | 'coin' | 'material' | 'xp' | 'range' | 'pierce' | 'crit' | 'meleeDmg' | 'shotDmg' | 'beamDmg' | 'fieldDmg' | 'weaponDmg';
export interface PassiveDef {
  readonly id: PassiveId; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly effect: PassiveEffect; readonly perLvl: number;
  readonly reqWeapon?: WeaponId;    // この武器を所持中のみ3択に出る（武器固有のユニーク強化）
  readonly targetWeapon?: WeaponId; // weaponDmg をこの武器だけに乗せる
}

export const PASSIVE_DEFS: Record<PassiveId, PassiveDef> = {
  // 汎用（全体）特殊能力
  power: { id: 'power', label: '威力', emoji: '💪', desc: '全武器のダメージ+', effect: 'power', perLvl: 0.10 },
  bighit: { id: 'bighit', label: '強撃', emoji: '💢', desc: '全武器のダメージ+（大）', effect: 'power', perLvl: 0.18 },
  range: { id: 'range', label: '射程', emoji: '📏', desc: '武器の射程/範囲 +1', effect: 'range', perLvl: 0.5 },
  pierce: { id: 'pierce', label: '貫通', emoji: '➡️', desc: 'ビーム/ドリルが奥まで貫通 +1', effect: 'pierce', perLvl: 1 },
  crit: { id: 'crit', label: '会心', emoji: '✨', desc: 'たまに3倍ダメージ', effect: 'crit', perLvl: 0.05 },
  speed: { id: 'speed', label: '速さ', emoji: '🏃', desc: '採掘/移動が速い', effect: 'rate', perLvl: 0.14 },
  haste: { id: 'haste', label: '俊足', emoji: '👟', desc: '移動が速い', effect: 'move', perLvl: 0.20 },
  luck: { id: 'luck', label: '幸運', emoji: '🍀', desc: 'コイン+', effect: 'coin', perLvl: 0.15 },
  greed: { id: 'greed', label: '強欲', emoji: '🧲', desc: '素材が増えやすい', effect: 'material', perLvl: 0.12 },
  xp: { id: 'xp', label: '修学', emoji: '📖', desc: '経験値+', effect: 'xp', perLvl: 0.18 },
  // 系統シナジー
  whet: { id: 'whet', label: '砥石', emoji: '🪒', desc: '近接(ツルハシ)強化', effect: 'meleeDmg', perLvl: 0.25 },
  powder: { id: 'powder', label: '火薬', emoji: '🧨', desc: '射撃(弾/爆弾)強化', effect: 'shotDmg', perLvl: 0.25 },
  lens: { id: 'lens', label: 'レンズ', emoji: '🔬', desc: 'ビーム(ビーム/ドリル)強化', effect: 'beamDmg', perLvl: 0.25 },
  echo: { id: 'echo', label: '共鳴', emoji: '🔊', desc: '範囲(オーラ/リング)強化', effect: 'fieldDmg', perLvl: 0.25 },
  // 武器固有ユニーク（その武器を持っている時だけ出る）
  upick: { id: 'upick', label: '⛏️二刀流', emoji: '⛏️', desc: 'ツルハシ専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'pick', targetWeapon: 'pick' },
  ubullet: { id: 'ubullet', label: '🔫速射', emoji: '🔫', desc: '弾 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'bullet', targetWeapon: 'bullet' },
  ubomb: { id: 'ubomb', label: '💣大火力', emoji: '💣', desc: '爆弾 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'bomb', targetWeapon: 'bomb' },
  ubeam: { id: 'ubeam', label: '⚡集束', emoji: '⚡', desc: 'ビーム 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'beam', targetWeapon: 'beam' },
  udrill: { id: 'udrill', label: '🌀高速回転', emoji: '🌀', desc: 'ドリル 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'drill', targetWeapon: 'drill' },
  uaura: { id: 'uaura', label: '💥増幅', emoji: '💥', desc: 'オーラ 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'aura', targetWeapon: 'aura' },
  uring: { id: 'uring', label: '🪃軌道', emoji: '🪃', desc: 'リング 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'ring', targetWeapon: 'ring' },
};
export const PASSIVE_IDS = Object.keys(PASSIVE_DEFS) as PassiveId[];

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
  readonly valueGrowth: number;    // 階ごとの価値倍率（幾何級数・硬さよりやや緩く）
  readonly kinds: { readonly dirt: MiningKind; readonly stone: MiningKind; readonly ore: MiningKind; readonly gem: MiningKind };
  readonly kindThresh: { readonly dirtMax: number; readonly stoneMax: number; readonly oreMax: number; readonly boostPerFloor: number; readonly boostMax: number };

  readonly critMult: number;     // 会心倍率
  readonly maxWeapons: number;   // 所持できる武器数
  readonly maxPassives: number;  // 所持できる強化数

  readonly xpBase: number; readonly xpPerLevel: number;

  readonly offerRareBase: number; readonly offerEpicBase: number;
  readonly appraiseRarePerLvl: number; readonly appraiseEpicPerLvl: number;
  readonly offerRareCap: number; readonly offerEpicCap: number;
  readonly appraiseCostBase: number; readonly appraiseCostGrowth: number;

  // コインで買う走行限定ブースト（転生でリセット）
  readonly boostPerLvl: number; readonly boostCostBase: number; readonly boostCostGrowth: number;

  // 熟練度（周回しても消えない経験値）: 永続の威力倍率＋スループット＋通貨として開始ブースト解放に使う
  readonly masteryPerLvl: number;        // 累計熟練1につき全武器ダメージ+（永続）
  readonly masteryMovePerLvl: number;    // 累計熟練1につき移動速度+（永続・周回で序盤が速くなる主因）
  readonly masteryRangePerLvl: number;   // 累計熟練ごとに武器の射程/範囲+1（永続・浅い階を一掃＝サクサク）
  readonly masteryStartBoostBase: number; readonly masteryStartBoostGrowth: number; // 開始ブースト解放のコスト

  readonly permStatBase: number; readonly permStatGrowth: number;
  readonly permPickBase: number; readonly permPickGrowth: number;
  readonly permWeaponBase: number; readonly permWeaponGrowth: number;
  readonly permAppraiseBase: number; readonly permAppraiseGrowth: number;
  readonly refineRatio: number;
}

export const defaultMiningBalance: MiningBalance = {
  worldSize: 30,
  baseRate: 0.45,
  moveCost: 0.5,
  dropVisualMs: 900,
  fxVisualMs: 220,

  hardnessBase: 1,
  hardnessGrowth: 1.26,
  valueGrowth: 1.13,
  kinds: {
    dirt: { id: 'dirt', name: '土', emoji: '🟫', color: '#8d6e63', mult: 1 },
    stone: { id: 'stone', name: '石', emoji: '🪨', color: '#78909c', mult: 2 },
    ore: { id: 'ore', name: '鉱石', emoji: '🟡', color: '#ffd54f', mult: 5 },
    gem: { id: 'gem', name: '宝石', emoji: '💎', color: '#4dd0e1', mult: 12 },
  },
  kindThresh: { dirtMax: 70, stoneMax: 92, oreMax: 99, boostPerFloor: 2, boostMax: 20 },

  critMult: 3,
  maxWeapons: 6,
  maxPassives: 6,

  xpBase: 5, xpPerLevel: 3,

  offerRareBase: 0.12, offerEpicBase: 0.03,
  appraiseRarePerLvl: 0.04, appraiseEpicPerLvl: 0.012,
  offerRareCap: 0.6, offerEpicCap: 0.25,
  appraiseCostBase: 80, appraiseCostGrowth: 1.7,

  boostPerLvl: 0.08, boostCostBase: 40, boostCostGrowth: 1.35,

  masteryPerLvl: 0.02, masteryMovePerLvl: 0.004, masteryRangePerLvl: 0.004,
  masteryStartBoostBase: 3, masteryStartBoostGrowth: 1.8,

  permStatBase: 25, permStatGrowth: 1.6,
  permPickBase: 18, permPickGrowth: 1.7,
  permWeaponBase: 12, permWeaponGrowth: 1.8,
  permAppraiseBase: 5, permAppraiseGrowth: 2.0,
  refineRatio: 8,
};
