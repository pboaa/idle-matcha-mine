import type { MiningBalance, ChoiceId, MaterialId, WeaponId, CoinUpId } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, WEAPON_IDS, COIN_UP_DEFS, weaponSkillNodes, isWeapon } from '@domain/mining/balance';
import { freshRun, type MineState, type Perm, type WeaponMastery, type WeaponStatLevels } from '@application/mining/mineState';

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

// ===== コインで買う全体強化（走行限定・転生でリセット） =====
/** 全体強化の次の1段のコスト（コイン）。 */
export function coinUpCost(id: CoinUpId, coinUp: MineState['coinUp']): number {
  const def = COIN_UP_DEFS[id];
  return Math.floor(def.costBase * Math.pow(def.costGrowth, coinUp[id]));
}
/** 全体強化を1段（コインを消費）。不足なら何もしない。 */
export function buyCoinUp(state: MineState, id: CoinUpId): MineState {
  const cost = coinUpCost(id, state.coinUp);
  if (state.coins < cost) return state;
  return { ...state, coins: state.coins - cost, coinUp: { ...state.coinUp, [id]: state.coinUp[id] + 1 } };
}

// ===== 武器ごとの恒久スキルツリー（★ポイントで解放・グラフ） =====
/** そのノードが今解放できるか（前提を全て満たし・未解放）。 */
export function skillNodeUnlockable(weapon: WeaponId, unlocked: readonly number[], nodeIndex: number): boolean {
  const n = weaponSkillNodes(weapon)[nodeIndex];
  return !!n && !unlocked.includes(nodeIndex) && n.requires.every((r) => unlocked.includes(r));
}
/** 武器スキルツリーのノードを1つ解放（前提＋ポイントを満たせば）。 */
export function buyWeaponSkill(state: MineState, weapon: WeaponId, nodeIndex: number): MineState {
  const unlocked = state.perm.weaponSkill[weapon];
  const node = weaponSkillNodes(weapon)[nodeIndex];
  if (!node || !skillNodeUnlockable(weapon, unlocked, nodeIndex) || state.points < node.cost) return state;
  const weaponSkill = { ...state.perm.weaponSkill, [weapon]: [...unlocked, nodeIndex] };
  return { ...state, points: state.points - node.cost, perm: { ...state.perm, weaponSkill } };
}
/** 解放済みノードの累積ステータス（武器に恒久で乗る）。 */
export function weaponSkillStats(weapon: WeaponId, unlocked: readonly number[]): WeaponStatLevels {
  const s: WeaponStatLevels = { damage: 0, speed: 0, range: 0, pierce: 0, unique: 0 };
  const nodes = weaponSkillNodes(weapon);
  for (const i of unlocked) { const n = nodes[i]; if (n) s[n.stat] += n.amount; }
  return s;
}

// ===== 放置ツリー（自動モードの効率・ポイントで恒久解放） =====
/** 自動モードの火力倍率（放置Lvで base→1.0）。手動は常に1.0。 */
export function autoEfficiency(idle: number, b: MiningBalance = defaultMiningBalance): number {
  return Math.min(1, b.autoEffBase + idle * b.idleEffPerLvl);
}
/** 放置ツリーの最大Lv（自動効率100%に到達する解放数）。 */
export function idleMaxLevel(b: MiningBalance = defaultMiningBalance): number {
  return Math.ceil((1 - b.autoEffBase) / b.idleEffPerLvl);
}
/** 放置ツリーの次の1段のコスト（ポイント）。最大なら null。 */
export function idleCost(idle: number, b: MiningBalance = defaultMiningBalance): number | null {
  if (idle >= idleMaxLevel(b)) return null;
  return Math.floor(b.idleCostBase * Math.pow(b.idleCostGrowth, idle));
}
/** 放置ツリーを1段解放（ポイント消費）。 */
export function buyIdle(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = idleCost(state.perm.idle, b);
  if (cost === null || state.points < cost) return state;
  return { ...state, points: state.points - cost, perm: { ...state.perm, idle: state.perm.idle + 1 } };
}

/** 転生時の熟練度獲得: その走行で十分掘った(seq>=masteryMinTiles)時のみ、実際にダメージを出した武器ごとに +1。
 *  転生ボタン連打（ほぼ未採掘の即転生）では増えない。 */
export function masteryGainOnPrestige(state: MineState, b: MiningBalance = defaultMiningBalance): WeaponMastery {
  const next = { ...state.mastery };
  if (state.seq < b.masteryMinTiles) return next; // 走行が短すぎる＝連打抑止
  for (const w of WEAPON_IDS) if (state.dmgByWeapon[w] > 0) next[w] += 1;
  return next;
}

/** 転生: 走行をリセット。鉱石・★ポイント・恒久・熟練度は引き継ぐ（走行限定のみリセット）。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  return freshRun(b, state.materials, state.perm, state.prestiges + 1, state.rngState, masteryGainOnPrestige(state, b), state.points);
}
