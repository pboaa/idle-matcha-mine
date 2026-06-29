/**
 * 採掘モックのマスターデータ（数値・カタログを集約）。ロジックから分離＝調整しやすい。
 */

export type MaterialId = 'dirt' | 'stone' | 'ore' | 'gem';
export const MATERIAL_IDS: readonly MaterialId[] = ['dirt', 'stone', 'ore', 'gem'];
export interface MiningKind { readonly id: MaterialId; readonly name: string; readonly emoji: string; readonly color: string; readonly mult: number; readonly hardMult: number }

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
  readonly attackIntervalMs: number; // 攻撃間隔（小さいほど手数が多い）。1ヒットの威力 = baseDmg×interval/1000。
  readonly fxColor: string; // 命中エフェクトの色
}

// baseDmg は「毎秒の素ダメージ」。1ヒットはこれに attackIntervalMs/1000 を掛けた塊で出る（＝DPSは間隔に依らず一定）。
export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pick: { id: 'pick', label: 'ツルハシ', emoji: '⛏️', desc: '前方を横振り（3マス）', tag: 'melee', pattern: 'front', baseDmg: 0.6, dmgPerLvl: 0.28, rangeBase: 1, rangePerLvls: 99, attackIntervalMs: 500, fxColor: '#fbbf24' },
  bullet: { id: 'bullet', label: '弾', emoji: '🔫', desc: '近くの1マスを撃つ', tag: 'shot', pattern: 'nearest', baseDmg: 0.35, dmgPerLvl: 0.18, rangeBase: 5, rangePerLvls: 99, attackIntervalMs: 300, fxColor: '#f87171' },
  bomb: { id: 'bomb', label: '爆弾', emoji: '💣', desc: '近くで小爆発（3x3）', tag: 'shot', pattern: 'burst', baseDmg: 0.12, dmgPerLvl: 0.055, rangeBase: 6, rangePerLvls: 99, attackIntervalMs: 800, fxColor: '#fb923c' },
  beam: { id: 'beam', label: 'ビーム', emoji: '⚡', desc: '十字に削る', tag: 'beam', pattern: 'cross', baseDmg: 0.07, dmgPerLvl: 0.03, rangeBase: 1, rangePerLvls: 3, attackIntervalMs: 250, fxColor: '#67e8f9' },
  drill: { id: 'drill', label: 'ドリル', emoji: '🌀', desc: '進行方向へ貫く', tag: 'beam', pattern: 'forward', baseDmg: 0.18, dmgPerLvl: 0.07, rangeBase: 2, rangePerLvls: 2, attackIntervalMs: 400, fxColor: '#a78bfa' },
  aura: { id: 'aura', label: 'オーラ', emoji: '💥', desc: '周囲をじわっと削る', tag: 'field', pattern: 'around', baseDmg: 0.045, dmgPerLvl: 0.02, rangeBase: 1, rangePerLvls: 4, attackIntervalMs: 700, fxColor: '#f472b6' },
  ring: { id: 'ring', label: 'リング', emoji: '🪃', desc: '外周をぐるりと削る', tag: 'field', pattern: 'ring', baseDmg: 0.035, dmgPerLvl: 0.015, rangeBase: 2, rangePerLvls: 3, attackIntervalMs: 600, fxColor: '#bef264' },
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

// ===== 武器ごとの恒久強化ツリー（Stage2: 素材=鉱石で買う武器別ステータス・データ駆動で拡張可） =====
export type WeaponStat = 'damage' | 'speed' | 'range' | 'pierce' | 'unique';
export const WEAPON_STATS: readonly WeaponStat[] = ['damage', 'speed', 'range', 'pierce', 'unique'];
export interface WeaponStatDef {
  readonly id: WeaponStat; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly material: MaterialId;   // 消費する鉱石(=素材)。土/石=基本、鉱石/宝石=上位。
  readonly costBase: number; readonly costGrowth: number; readonly perLvl: number;
  readonly lineOnly?: boolean;     // 貫通は直線(ビーム/ドリル)系だけ有効
}
export const WEAPON_STAT_DEFS: Record<WeaponStat, WeaponStatDef> = {
  damage: { id: 'damage', label: 'ダメージ', emoji: '⚔️', desc: 'この武器のダメージ +8%/Lv', material: 'dirt', costBase: 6, costGrowth: 1.45, perLvl: 0.08 },
  speed: { id: 'speed', label: '攻撃速度', emoji: '⏱️', desc: 'この武器の攻撃が速くなる +8%/Lv', material: 'stone', costBase: 6, costGrowth: 1.5, perLvl: 0.08 },
  range: { id: 'range', label: '射程', emoji: '📏', desc: 'この武器の射程/範囲 +1/Lv', material: 'ore', costBase: 3, costGrowth: 1.7, perLvl: 1 },
  pierce: { id: 'pierce', label: '貫通', emoji: '➡️', desc: '直線がさらに奥へ +1/Lv', material: 'ore', costBase: 3, costGrowth: 1.7, perLvl: 1, lineOnly: true },
  unique: { id: 'unique', label: '固有', emoji: '✨', desc: 'この武器だけの強力な底上げ +15%/Lv', material: 'gem', costBase: 2, costGrowth: 1.9, perLvl: 0.15 },
};
/** その武器にそのステータス強化が有効か（貫通は直線系のみ）。 */
export const weaponStatApplies = (stat: WeaponStat, w: WeaponId): boolean =>
  !WEAPON_STAT_DEFS[stat].lineOnly || WEAPON_DEFS[w].pattern === 'cross' || WEAPON_DEFS[w].pattern === 'forward';

// ===== 武器ごとの恒久スキルツリー（分岐グラフ・ポイントで解放）。前提を満たすと広がる。所々に大ノード。 =====
export interface WeaponSkillNode {
  readonly x: number; readonly y: number;          // グラフ上の位置（col, row）
  readonly stat: WeaponStat; readonly amount: number;
  readonly cost: number; readonly big?: boolean;
  readonly requires: readonly number[];            // 解放に必要な先行ノードのindex
}
/** 全武器共通のノードグラフ（武器ごとに独立に解放）。amount: damage/speed/uniqueは倍率加算、rangeはマス+。 */
export const WEAPON_SKILL_NODES: readonly WeaponSkillNode[] = [
  { x: 0, y: 1.5, stat: 'damage', amount: 0.10, cost: 1, requires: [] },             // 0 起点
  { x: 1, y: 0.5, stat: 'damage', amount: 0.15, cost: 2, requires: [0] },            // 1 威力枝
  { x: 1, y: 2.5, stat: 'speed', amount: 0.15, cost: 2, requires: [0] },             // 2 速度枝
  { x: 2, y: 0, stat: 'damage', amount: 0.20, cost: 4, requires: [1] },              // 3
  { x: 2, y: 1, stat: 'range', amount: 1, cost: 8, big: true, requires: [1] },       // 4 大:射程
  { x: 2, y: 2, stat: 'speed', amount: 0.20, cost: 4, requires: [2] },               // 5
  { x: 2, y: 3, stat: 'range', amount: 1, cost: 8, big: true, requires: [2] },       // 6 大:射程
  { x: 3, y: 0.5, stat: 'unique', amount: 0.5, cost: 18, big: true, requires: [3, 4] }, // 7 大:威力の極
  { x: 3, y: 2.5, stat: 'unique', amount: 0.5, cost: 18, big: true, requires: [5, 6] }, // 8 大:速度の極
  { x: 4, y: 1.5, stat: 'damage', amount: 0.40, cost: 30, requires: [7, 8] },        // 9 合流
  { x: 5, y: 1.5, stat: 'unique', amount: 1.0, cost: 70, big: true, requires: [9] }, // 10 最終大
];

// ===== コインで買う全体強化（走行限定・転生でリセット）。採掘ブースト(boost)に加えての全体バフ。 =====
export type CoinUpId = 'haste' | 'greed' | 'luck';
export const COIN_UP_IDS: readonly CoinUpId[] = ['haste', 'greed', 'luck'];
export type CoinUpEffect = 'move' | 'material' | 'coin';
export interface CoinUpDef {
  readonly id: CoinUpId; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly effect: CoinUpEffect; readonly perLvl: number; readonly costBase: number; readonly costGrowth: number;
}
export const COIN_UP_DEFS: Record<CoinUpId, CoinUpDef> = {
  haste: { id: 'haste', label: '俊足', emoji: '👟', desc: '移動が速くなる', effect: 'move', perLvl: 0.08, costBase: 50, costGrowth: 1.4 },
  greed: { id: 'greed', label: '強欲', emoji: '🧲', desc: '鉱石が増えやすい', effect: 'material', perLvl: 0.12, costBase: 70, costGrowth: 1.45 },
  luck: { id: 'luck', label: '幸運', emoji: '🍀', desc: 'コインが増えやすい', effect: 'coin', perLvl: 0.10, costBase: 70, costGrowth: 1.45 },
};

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
  readonly kinds: { readonly dirt: MiningKind; readonly stone: MiningKind; readonly ore: MiningKind; readonly gem: MiningKind };
  // 素材のレア度は深さ連動: 浅い階はほぼ土、深いほど石→鉱石→宝石が解禁され出やすくなる（%は0..100のhと比較）。
  readonly kindThresh: {
    readonly stoneBase: number; readonly stonePerFloor: number; readonly stoneMax: number;  // 石: 浅くても少し、深いほど増える
    readonly oreFloor: number; readonly orePerFloor: number; readonly oreMax: number;        // 鉱石(金): この階から解禁
    readonly gemFloor: number; readonly gemPerFloor: number; readonly gemMax: number;        // 宝石(ダイヤ): さらに深い階から・ごく稀
  };

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

  // 熟練度（武器ごと・転生時に上がる永続強化）: その武器のダメージを恒久で上げる＋合計でスループット
  readonly masteryPerLvl: number;        // 武器の熟練1につきその武器ダメージ+（既定+10%/Lv＝転生1回ぶん）
  readonly masteryMovePerLvl: number;    // 合計熟練1につき移動速度+（永続・周回で序盤が速くなる主因）
  readonly masteryRangePerLvl: number;   // 合計熟練ごとに武器の射程/範囲+1（永続・浅い階を一掃＝サクサク）
  readonly masteryMinTiles: number;      // この走行で最低これだけ掘らないと熟練度を獲得できない（転生連打の抑止）

  readonly oreToPointRate: number; // 鉱石(価値=kind.mult)→ポイント変換係数。少しずつ貯めて大ノードを解放する想定。

  readonly permStatBase: number; readonly permStatGrowth: number;
  readonly permPickBase: number; readonly permPickGrowth: number;
  readonly permWeaponBase: number; readonly permWeaponGrowth: number;
  readonly permAppraiseBase: number; readonly permAppraiseGrowth: number;
  readonly refineRatio: number;
}

export const defaultMiningBalance: MiningBalance = {
  worldSize: 30,
  baseRate: 0.5,
  moveCost: 0.5,
  dropVisualMs: 900,
  fxVisualMs: 220,

  hardnessBase: 2,
  hardnessGrowth: 1.34,
  distHardness: 0.15,
  valueGrowth: 1.13,
  kinds: {
    dirt: { id: 'dirt', name: '土', emoji: '🟫', color: '#8d6e63', mult: 1, hardMult: 1 },
    stone: { id: 'stone', name: '石', emoji: '🪨', color: '#78909c', mult: 2, hardMult: 1.5 },
    ore: { id: 'ore', name: '鉱石', emoji: '🟡', color: '#ffd54f', mult: 5, hardMult: 2.5 },
    gem: { id: 'gem', name: '宝石', emoji: '💎', color: '#4dd0e1', mult: 12, hardMult: 4 },
  },
  kindThresh: {
    stoneBase: 4, stonePerFloor: 2, stoneMax: 40,
    oreFloor: 3, orePerFloor: 1.5, oreMax: 18,
    gemFloor: 8, gemPerFloor: 0.5, gemMax: 6,
  },

  critMult: 3,
  maxWeapons: 6,
  maxPassives: 6,

  xpBase: 5, xpPerLevel: 3,

  offerRareBase: 0.12, offerEpicBase: 0.03,
  appraiseRarePerLvl: 0.04, appraiseEpicPerLvl: 0.012,
  offerRareCap: 0.6, offerEpicCap: 0.25,
  appraiseCostBase: 80, appraiseCostGrowth: 1.7,

  boostPerLvl: 0.08, boostCostBase: 40, boostCostGrowth: 1.35,

  masteryPerLvl: 0.10, masteryMovePerLvl: 0.02, masteryRangePerLvl: 0.05, masteryMinTiles: 40,

  oreToPointRate: 0.03,

  permStatBase: 25, permStatGrowth: 1.6,
  permPickBase: 18, permPickGrowth: 1.7,
  permWeaponBase: 12, permWeaponGrowth: 1.8,
  permAppraiseBase: 5, permAppraiseGrowth: 2.0,
  refineRatio: 8,
};
