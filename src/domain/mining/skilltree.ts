/**
 * 武器ごとの恒久スキルツリーのマスターデータ＆生成（強化／ツリーをカタログから分離）。
 * 上→下に SKILL_TIERS 段の階層ツリー。各階層を一定数解放すると次が解禁。小さなノードが一杯。
 * balance.ts から分離して単体テストしやすくする（balance は本モジュールを再エクスポート）。
 */
import { WEAPON_DEFS, WEAPON_IDS, MATERIAL_IDS, type WeaponId, type MaterialId } from '@domain/mining/balance';

// ===== 武器ステータス（ツリーで伸ばす） =====
export type WeaponStat = 'damage' | 'speed' | 'range' | 'pierce' | 'area' | 'unique';
export const WEAPON_STATS: readonly WeaponStat[] = ['damage', 'speed', 'range', 'pierce', 'area', 'unique'];
export interface WeaponStatDef {
  readonly id: WeaponStat; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly lineOnly?: boolean;     // 貫通は直線(ビーム/ドリル)系だけ有効
  readonly notField?: boolean;     // 範囲(同時対象/横幅/方向)はフィールド系(オーラ/リング)には無効=半径は射程で
}
export const WEAPON_STAT_DEFS: Record<WeaponStat, WeaponStatDef> = {
  damage: { id: 'damage', label: 'ダメージ', emoji: '⚔️', desc: 'この武器のダメージ +5%/ノード' },
  speed: { id: 'speed', label: '攻撃速度', emoji: '⏱️', desc: 'この武器の攻撃が速くなる +5%/ノード' },
  range: { id: 'range', label: '射程', emoji: '📏', desc: 'この武器の射程/範囲 +1/ノード' },
  pierce: { id: 'pierce', label: '貫通', emoji: '➡️', desc: '直線がさらに奥へ +1/ノード', lineOnly: true },
  area: { id: 'area', label: '範囲', emoji: '💠', desc: '同時に当たる範囲/対象が広がる +1/ノード', notField: true },
  unique: { id: 'unique', label: '固有', emoji: '✨', desc: 'この武器だけの強力な底上げ +10〜15%/ノード' },
};
/** その武器にそのステータス強化が有効か（貫通は直線系のみ／範囲はフィールド系以外）。 */
export const weaponStatApplies = (stat: WeaponStat, w: WeaponId): boolean => {
  const def = WEAPON_STAT_DEFS[stat]; const pat = WEAPON_DEFS[w].pattern;
  if (def.lineOnly && pat !== 'cross' && pat !== 'forward') return false;
  if (def.notField && (pat === 'around' || pat === 'ring')) return false;
  return true;
};

// ===== 階層スキルツリー（素材で解放） =====
export interface WeaponSkillNode {
  readonly x: number; readonly y: number;          // グラフ上の位置（col, tier=row）
  readonly tier: number;                            // 階層（上→下）。解禁の単位。
  readonly stat: WeaponStat; readonly amount: number;
  readonly matId: MaterialId; readonly matCost: number; // 解放に必要な素材と個数
  readonly big?: boolean;
  readonly requires: readonly number[];            // 線（描画用）。解禁は階層制で行う。
}
export const SKILL_TIERS = 5; // 上→下に5段
const TIER_MAT = [0, 0, 1, 3, 4]; // 階層→素材index（土,土,石,銅,鉄）。深い＝上位素材。
/** ノードの素材コスト（fillerは安く一杯／特殊は上位素材＆大量。tier0,1の特殊は土のまま）。 */
function skillNodeCost(tier: number, special: boolean): { matId: MaterialId; matCost: number } {
  const bump = special && tier >= 2 ? 1 : 0;
  const matIndex = Math.min(MATERIAL_IDS.length - 1, (TIER_MAT[tier] ?? tier) + bump);
  const filler = Math.round(20 * Math.pow(1.7, tier));      // 20,34,58,98,167…
  return { matId: MATERIAL_IDS[matIndex]!, matCost: Math.max(1, special ? filler * 14 : filler) };
}
// 決定的PRNG（武器ごとに seed を変えて形を変える）。
const treeRand = (seed: number): (() => number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** その武器で意味を持つ特殊強化（範囲/射程/貫通）。三択には載せずツリーで取る。 */
function weaponSpecials(w: WeaponId): WeaponStat[] {
  const pat = WEAPON_DEFS[w].pattern;
  const out: WeaponStat[] = [];
  if (weaponStatApplies('area', w)) out.push('area');     // 範囲: spread/同時対象（フィールド系以外）
  if (pat !== 'front') out.push('range');                  // 射程: 前方(ツルハシ)は射程概念がないので除外
  if (weaponStatApplies('pierce', w)) out.push('pierce'); // 貫通: 直線系のみ
  return out;
}
/** 1武器ぶんの階層ツリーを生成。ツルハシは範囲を tier1 に（序盤3方向化）。その他の範囲/射程/貫通は終盤(tier3-4)。 */
function genSkillTree(seed: number, w: WeaponId): WeaponSkillNode[] {
  const rnd = treeRand(seed);
  const isPick = WEAPON_DEFS[w].pattern === 'front';
  const tiers: WeaponSkillNode[][] = [];
  for (let tier = 0; tier < SKILL_TIERS; tier++) {
    const count = 4 + Math.floor(rnd() * 3); // 4〜6ノード/階層（数値小さめが一杯）
    const row: WeaponSkillNode[] = [];
    for (let col = 0; col < count; col++) {
      const stat: WeaponStat = rnd() < 0.6 ? 'damage' : 'speed';
      row.push({ x: col, y: tier, tier, stat, amount: 0.03, ...skillNodeCost(tier, false), requires: [] });
    }
    tiers.push(row);
  }
  // 特殊ノードを所定の階層へ配置（fillerを差し替え）。ツルハシ範囲=tier1×2、その他=tier3とtier4。固有=tier2,4。
  const place = (tier: number, stat: WeaponStat, amount: number): void => {
    const row = tiers[tier]; if (!row) return;
    const di = row.findIndex((n) => n.stat === 'damage');
    const i = di >= 0 ? di : 0;
    row[i] = { ...row[i]!, stat, amount, big: true, ...skillNodeCost(tier, true) };
  };
  if (isPick) { place(1, 'area', 1); place(1, 'area', 1); } // 序盤に右+1/左+1で3方向
  else for (const s of weaponSpecials(w)) { place(3, s, 1); place(4, s, 1); } // 範囲/射程/貫通は終盤
  place(2, 'unique', 0.10); place(SKILL_TIERS - 1, 'unique', 0.12); // 固有は中盤と最終段
  // 平坦化＋描画用に前段の1ノードへ線を引く（解禁は階層制）。
  const flat: WeaponSkillNode[] = [];
  const startOf: number[] = [];
  for (let tier = 0; tier < tiers.length; tier++) { startOf[tier] = flat.length; for (const n of tiers[tier]!) flat.push(n); }
  return flat.map((n) => ({ ...n, requires: n.tier > 0 ? [startOf[n.tier - 1]! + Math.min(n.x, tiers[n.tier - 1]!.length - 1)] : [] }));
}

// 遅延生成＋メモ化（balance との循環初期化を避ける＝初回参照時に生成）。
const treeCache = new Map<WeaponId, readonly WeaponSkillNode[]>();
/** 武器ごとのスキルツリー（決定的・武器ごとに形が違う）。 */
export function weaponSkillNodes(w: WeaponId): readonly WeaponSkillNode[] {
  let t = treeCache.get(w);
  if (!t) { t = genSkillTree(Math.imul(WEAPON_IDS.indexOf(w) + 1, 2654435761), w); treeCache.set(w, t); }
  return t;
}
