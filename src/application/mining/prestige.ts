import type { MiningBalance, ChoiceId, MaterialId, WeaponId, WeaponStat } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, WEAPON_IDS, WEAPON_STAT_DEFS, WEAPON_SKILL_NODES, weaponStatApplies, isWeapon } from '@domain/mining/balance';
import { freshRun, type MineState, type Perm, type WeaponMastery, type WeaponStatLevels, type WeaponUpgrades } from '@application/mining/mineState';

/** 恒久強化の種類（素材で買う）。武器・強化・基礎採掘・基礎目利き。 */
export type PermId = ChoiceId | 'appraise';

/** その恒久強化が消費する素材（材料ごとに役割を分ける＝全部に使い道）。 */
export function permMaterial(id: PermId): MaterialId {
  if (id === 'appraise') return 'gem';
  if (id === 'pick') return 'stone';
  if (isWeapon(id)) return 'ore'; // 武器
  return 'dirt'; // パッシブ強化
}

const permLevel = (perm: Perm, id: PermId): number => (id === 'appraise' ? perm.appraise : perm.levels[id]);

/** 恒久強化の次の1段のコスト（素材数）。 */
export function permCost(id: PermId, perm: Perm, b: MiningBalance = defaultMiningBalance): number {
  const lvl = permLevel(perm, id);
  if (id === 'appraise') return Math.floor(b.permAppraiseBase * Math.pow(b.permAppraiseGrowth, lvl));
  if (id === 'pick') return Math.floor(b.permPickBase * Math.pow(b.permPickGrowth, lvl));
  if (isWeapon(id)) return Math.floor(b.permWeaponBase * Math.pow(b.permWeaponGrowth, lvl));
  return Math.floor(b.permStatBase * Math.pow(b.permStatGrowth, lvl));
}

/** 恒久強化を1段買う（素材を消費）。足りなければ何もしない。 */
export function buyPerm(state: MineState, id: PermId, b: MiningBalance = defaultMiningBalance): MineState {
  const mat = permMaterial(id);
  const cost = permCost(id, state.perm, b);
  if (state.materials[mat] < cost) return state;
  const materials = { ...state.materials, [mat]: state.materials[mat] - cost };
  const perm: Perm = id === 'appraise'
    ? { ...state.perm, appraise: state.perm.appraise + 1 }
    : { ...state.perm, levels: { ...state.perm.levels, [id]: state.perm.levels[id] + 1 } };
  return { ...state, materials, perm };
}

/** 精錬: 下位素材 refineRatio 個 → 上位1個（土が腐らない）。 */
export function refine(state: MineState, from: MaterialId, b: MiningBalance = defaultMiningBalance): MineState {
  const idx = MATERIAL_IDS.indexOf(from);
  if (idx < 0 || idx >= MATERIAL_IDS.length - 1) return state; // 宝石は上が無い
  const to = MATERIAL_IDS[idx + 1]!;
  const ratio = b.refineRatio;
  if (state.materials[from] < ratio) return state;
  return { ...state, materials: { ...state.materials, [from]: state.materials[from] - ratio, [to]: state.materials[to] + 1 } };
}

// ===== ラン中の武器強化（鉱石で買う・転生でリセット） =====
/** ラン強化の次の1段のコスト（鉱石数）。 */
export function runUpCost(weapon: WeaponId, stat: WeaponStat, runUp: WeaponUpgrades): number {
  const def = WEAPON_STAT_DEFS[stat];
  return Math.floor(def.costBase * Math.pow(def.costGrowth, runUp[weapon][stat]));
}
/** ラン中の武器強化を1段（対応鉱石を消費）。適用外/鉱石不足なら何もしない。 */
export function buyRunUp(state: MineState, weapon: WeaponId, stat: WeaponStat): MineState {
  if (!weaponStatApplies(stat, weapon)) return state;
  const mat = WEAPON_STAT_DEFS[stat].material;
  const cost = runUpCost(weapon, stat, state.runUp);
  if (state.materials[mat] < cost) return state;
  const runUp = { ...state.runUp, [weapon]: { ...state.runUp[weapon], [stat]: state.runUp[weapon][stat] + 1 } };
  return { ...state, materials: { ...state.materials, [mat]: state.materials[mat] - cost }, runUp };
}

// ===== 武器ごとの恒久スキルツリー（ポイントで解放・tier順） =====
/** 鉱石→ポイント変換量（種類ごとの価値=kind.mult ×変換係数。少しずつ貯まる）。 */
export function oreToPoints(materials: MineState['materials'], b: MiningBalance = defaultMiningBalance): number {
  return Math.floor(MATERIAL_IDS.reduce((a, m) => a + materials[m] * b.kinds[m].mult, 0) * b.oreToPointRate);
}
/** 次に解放できるノードのコスト（ポイント）。これ以上無ければ null。 */
export function weaponSkillCost(weapon: WeaponId, perm: Perm): number | null {
  const node = WEAPON_SKILL_NODES[perm.weaponSkill[weapon]];
  return node ? node.cost : null;
}
/** 武器のスキルツリーを1ノード解放（ポイント消費）。 */
export function buyWeaponSkill(state: MineState, weapon: WeaponId): MineState {
  const idx = state.perm.weaponSkill[weapon];
  const node = WEAPON_SKILL_NODES[idx];
  if (!node || state.points < node.cost) return state;
  const weaponSkill = { ...state.perm.weaponSkill, [weapon]: idx + 1 };
  return { ...state, points: state.points - node.cost, perm: { ...state.perm, weaponSkill } };
}
/** 解放済みノードの累積ステータス（武器に恒久で乗る）。 */
export function weaponSkillStats(unlocked: number): WeaponStatLevels {
  const s: WeaponStatLevels = { damage: 0, speed: 0, range: 0, pierce: 0, unique: 0 };
  for (let i = 0; i < unlocked && i < WEAPON_SKILL_NODES.length; i++) { const n = WEAPON_SKILL_NODES[i]!; s[n.stat] += n.amount; }
  return s;
}

/** 転生時の熟練度獲得: その走行で使った（Lv1以上の）武器ごとに +1（≒ダメージ+masteryPerLvl）。 */
export function masteryGainOnPrestige(state: MineState): WeaponMastery {
  const next = { ...state.mastery };
  for (const w of WEAPON_IDS) if (state.levels[w] > 0) next[w] += 1;
  return next;
}

/** 転生: 走行をリセット。残った鉱石はポイントへ変換し、ポイント/恒久/熟練度を引き継ぐ。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const points = state.points + oreToPoints(state.materials, b);
  return freshRun(b, state.perm, state.prestiges + 1, state.rngState, masteryGainOnPrestige(state), points);
}
