import type { MiningBalance, ChoiceId, MaterialId } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, isWeapon } from '@domain/mining/balance';
import { freshRun, type MineState, type Perm } from '@application/mining/mineState';

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

/** 転生: 走行をリセット（素材・恒久・熟練度は保持）。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  return freshRun(b, state.materials, state.perm, state.prestiges + 1, state.rngState, state.mastery, state.masteryTotal);
}
