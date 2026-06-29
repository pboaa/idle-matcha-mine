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
  pick: { id: 'pick', label: 'ツルハシ', emoji: '⛏️', desc: '前方1マス→レベル/射程で横に広がる', tag: 'melee', pattern: 'front', baseDmg: 0.6, dmgPerLvl: 0.28, rangeBase: 1, rangePerLvls: 99, attackIntervalMs: 500, fxColor: '#fbbf24' },
  bullet: { id: 'bullet', label: '弾', emoji: '🔫', desc: '近くの1マスを撃つ', tag: 'shot', pattern: 'nearest', baseDmg: 0.35, dmgPerLvl: 0.18, rangeBase: 5, rangePerLvls: 99, attackIntervalMs: 300, fxColor: '#f87171' },
  bomb: { id: 'bomb', label: '爆弾', emoji: '💣', desc: '近くで小爆発（3x3）', tag: 'shot', pattern: 'burst', baseDmg: 0.12, dmgPerLvl: 0.055, rangeBase: 6, rangePerLvls: 99, attackIntervalMs: 800, fxColor: '#fb923c' },
  beam: { id: 'beam', label: 'ビーム', emoji: '⚡', desc: '直線ビーム（2→4→8方向に増える）', tag: 'beam', pattern: 'cross', baseDmg: 0.07, dmgPerLvl: 0.03, rangeBase: 1, rangePerLvls: 3, attackIntervalMs: 250, fxColor: '#67e8f9' },
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

// ===== 武器ごとの恒久スキルツリー（分岐グラフ・ポイントで解放）。+5%ダメージが大量＋所々に大ノード。武器ごとに形が違う。 =====
export interface WeaponSkillNode {
  readonly x: number; readonly y: number;          // グラフ上の位置（col, row）
  readonly stat: WeaponStat; readonly amount: number;
  readonly cost: number; readonly big?: boolean;
  readonly requires: readonly number[];            // 解放に必要な先行ノードのindex
}
// 木生成用の小さな決定的PRNG（武器ごとに seed を変えて形を変える）。
const treeRand = (seed: number): (() => number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** 1武器ぶんの分岐ツリーを生成（多数の+5%＋たまに大ノード/貫通/固有などの特殊強化）。 */
function genSkillTree(seed: number, w: WeaponId): WeaponSkillNode[] {
  const rnd = treeRand(seed);
  const canPierce = weaponStatApplies('pierce', w); // 直線系(ビーム/ドリル)だけ貫通が有効
  const nodes: WeaponSkillNode[] = [];
  const add = (x: number, y: number, requires: number[]): number => {
    const r = rnd();
    let stat: WeaponStat = 'damage', amount = 0.05, cost = (x + 1) * 2, big: boolean | undefined;
    if (x >= 3 && r < 0.12) { // 大ノード: 射程 or 貫通（直線系）
      if (canPierce && rnd() < 0.5) { stat = 'pierce'; amount = 1; } else { stat = 'range'; amount = 1; }
      cost = (x + 1) * 6; big = true;
    } else if (x >= 2 && r < 0.24) { stat = 'unique'; amount = 0.10; cost = (x + 1) * 8; big = true; } // 特殊: 固有
    else if (r < 0.40) { stat = 'speed'; amount = 0.05; }
    nodes.push({ x, y, stat, amount, cost, big, requires });
    return nodes.length - 1;
  };
  let prev = [add(0, 1.5, [])];
  const cols = 6 + Math.floor(rnd() * 3); // 6〜8列
  for (let x = 1; x < cols; x++) {
    const count = 1 + Math.floor(rnd() * 3); // 1〜3ノード/列
    const col: number[] = [];
    for (let i = 0; i < count; i++) {
      const y = count === 1 ? 1.5 : i * (3 / (count - 1));
      const p1 = prev[Math.floor(rnd() * prev.length)]!;
      const req = [p1];
      if (prev.length > 1 && rnd() < 0.35) { const p2 = prev[Math.floor(rnd() * prev.length)]!; if (p2 !== p1) req.push(p2); }
      col.push(add(x, y, req));
    }
    prev = col;
  }
  return nodes;
}
/** 武器ごとのスキルツリー（形が様々・起点ノード0は前提なし）。 */
export const WEAPON_SKILL_TREES: Record<WeaponId, readonly WeaponSkillNode[]> =
  Object.fromEntries(WEAPON_IDS.map((w, i) => [w, genSkillTree(Math.imul(i + 1, 2654435761), w)])) as unknown as Record<WeaponId, readonly WeaponSkillNode[]>;
export const weaponSkillNodes = (w: WeaponId): readonly WeaponSkillNode[] => WEAPON_SKILL_TREES[w];

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
  readonly camDeadzone: number;  // カメラ追従のデッドゾーン半径（中央±これ以内は世界を固定＝猫が滑らかに動く）
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

  readonly areaPerLvls: number;  // 武器レベル何段ごとに範囲段階(spread)が+1（射程投資でも増える）
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

  readonly pointsPerLevel: number; // レベルアップで得る★（進行で貯まる）
  readonly pointsPerFloor: number; // 階を降りるごとに得る★（深いほど＝floor倍）
  readonly offerAutoMs: number;    // 3択を放置した時に自動選択されるまでのゲーム内時間

  // 自動モードの効率（自動は火力が下がる。放置ツリーをポイントで上げると100%へ）
  readonly autoEffBase: number;    // 放置ツリーLv0での自動効率（火力倍率）
  readonly idleEffPerLvl: number;  // 放置ツリー1Lvあたりの自動効率+
  readonly idleCostBase: number; readonly idleCostGrowth: number; // 放置ツリーのポイントコスト

  readonly permStatBase: number; readonly permStatGrowth: number;
  readonly permPickBase: number; readonly permPickGrowth: number;
  readonly permWeaponBase: number; readonly permWeaponGrowth: number;
  readonly permAppraiseBase: number; readonly permAppraiseGrowth: number;
  readonly refineRatio: number;
}

export const defaultMiningBalance: MiningBalance = {
  worldSize: 30,
  camDeadzone: 4,
  baseRate: 0.5,
  moveCost: 0.5,
  dropVisualMs: 900,
  fxVisualMs: 220,

  hardnessBase: 1.2,
  hardnessGrowth: 1.34,
  distHardness: 0.1,
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

  areaPerLvls: 3,
  critMult: 3,
  maxWeapons: 6,
  maxPassives: 6,

  xpBase: 5, xpPerLevel: 3,

  offerRareBase: 0.12, offerEpicBase: 0.03,
  appraiseRarePerLvl: 0.04, appraiseEpicPerLvl: 0.012,
  offerRareCap: 0.6, offerEpicCap: 0.25,
  appraiseCostBase: 80, appraiseCostGrowth: 1.7,

  boostPerLvl: 0.08, boostCostBase: 40, boostCostGrowth: 1.35,


  pointsPerLevel: 1, pointsPerFloor: 3, offerAutoMs: 60_000,

  autoEffBase: 0.5, idleEffPerLvl: 0.05, idleCostBase: 20, idleCostGrowth: 1.6,

  permStatBase: 25, permStatGrowth: 1.6,
  permPickBase: 18, permPickGrowth: 1.7,
  permWeaponBase: 12, permWeaponGrowth: 1.8,
  permAppraiseBase: 5, permAppraiseGrowth: 2.0,
  refineRatio: 8,
};
