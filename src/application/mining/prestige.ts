import type { MiningBalance, MaterialId, WeaponId, CoinUpId } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, BASE_WEAPONS, WEAPON_UNLOCK_ORDER, COIN_UP_DEFS, WEAPON_IDS, weaponSkillNodes, mainSkillNodes, nodeUnlockableIn, gridOpenFor, sumSkillStats, type MainStat } from '@domain/mining/balance';
import { freshRun, type MineState, type Perm, type WeaponStatLevels } from '@application/mining/mineState';

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

// ===== 武器の解放（累計★で自動解放・序盤は2種のみ） =====
/** その武器が解放されるのに必要な累計★（基本武器は0、対象外はInfinity）。 */
export function weaponUnlockStar(w: WeaponId, b: MiningBalance = defaultMiningBalance): number {
  if (BASE_WEAPONS.includes(w)) return 0;
  const i = WEAPON_UNLOCK_ORDER.indexOf(w);
  return i < 0 ? Infinity : (b.weaponUnlockStars[i] ?? Infinity);
}
/** 3択に出せる武器（基本2種＋累計★が閾値に達したもの）。 */
export function allowedWeapons(perm: Perm, b: MiningBalance = defaultMiningBalance): readonly WeaponId[] {
  return [...BASE_WEAPONS, ...WEAPON_UNLOCK_ORDER.filter((w) => perm.starEarned >= weaponUnlockStar(w, b))];
}

// ===== スキルツリー（武器ツリー＋メインツリー共通のグリッド解禁・素材購入） =====
/** unlocked配列（武器ならその武器、メインなら perm.mainSkill）を取得。 */
const unlockedOf = (perm: Perm, target: WeaponId | 'main'): readonly number[] => target === 'main' ? perm.mainSkill : perm.weaponSkill[target];
const nodesOf = (target: WeaponId | 'main'): ReturnType<typeof weaponSkillNodes> => target === 'main' ? mainSkillNodes() : weaponSkillNodes(target);
/** そのノードが今解放できるか（未解放・階層が解禁済み・中央or隣接が解放済み）。 */
export function skillNodeUnlockable(target: WeaponId | 'main', unlocked: readonly number[], nodeIndex: number): boolean {
  return nodeUnlockableIn(nodesOf(target), unlocked, nodeIndex);
}
/** その階層グリッドが解禁済みか。 */
export function skillGridOpen(target: WeaponId | 'main', unlocked: readonly number[], tier: number): boolean {
  return gridOpenFor(nodesOf(target), unlocked, tier);
}
const withUnlocked = (perm: Perm, target: WeaponId | 'main', unlocked: number[]): Perm =>
  target === 'main' ? { ...perm, mainSkill: unlocked } : { ...perm, weaponSkill: { ...perm.weaponSkill, [target]: unlocked } };
/** ノードを1つ解放（隣接解禁＋素材）。武器/メイン共通。 */
export function buySkill(state: MineState, target: WeaponId | 'main', nodeIndex: number): MineState {
  const unlocked = unlockedOf(state.perm, target);
  const node = nodesOf(target)[nodeIndex];
  if (!node || !skillNodeUnlockable(target, unlocked, nodeIndex)) return state;
  if (node.matCosts.some((c) => state.materials[c.matId] < c.amount)) return state;
  const materials = { ...state.materials };
  for (const c of node.matCosts) materials[c.matId] -= c.amount;
  return { ...state, materials, perm: withUnlocked(state.perm, target, [...unlocked, nodeIndex]) };
}
/** 一気に上げる: 解禁可能＆素材が足りるノードを「安い順」に買えるだけ。 */
export function buySkillMax(state: MineState, target: WeaponId | 'main'): MineState {
  const nodes = nodesOf(target);
  const cost = (i: number): number => nodes[i]!.matCosts.reduce((a, c) => a + c.amount, 0);
  let s = state;
  for (let guard = 0; guard < nodes.length; guard++) {
    const unlocked = unlockedOf(s.perm, target);
    let best = -1, bestCost = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (unlocked.includes(i) || !skillNodeUnlockable(target, unlocked, i)) continue;
      if (nodes[i]!.matCosts.some((c) => s.materials[c.matId] < c.amount)) continue;
      const c = cost(i); if (c < bestCost) { bestCost = c; best = i; }
    }
    if (best < 0) break;
    s = buySkill(s, target, best);
  }
  return s;
}
// 後方互換エイリアス（武器ツリー）。
export const buyWeaponSkill = (state: MineState, weapon: WeaponId, i: number): MineState => buySkill(state, weapon, i);
export const buyWeaponSkillMax = (state: MineState, weapon: WeaponId): MineState => buySkillMax(state, weapon);
/** 武器ツリーの累積ステータス（武器に恒久で乗る）。 */
export function weaponSkillStats(weapon: WeaponId, unlocked: readonly number[]): WeaponStatLevels {
  const s = sumSkillStats(weaponSkillNodes(weapon), unlocked);
  return { damage: s.damage ?? 0, speed: s.speed ?? 0, range: s.range ?? 0, pierce: s.pierce ?? 0, area: s.area ?? 0, unique: s.unique ?? 0 };
}
/** メインツリーの累積（全体強化）。 */
export function mainSkillStats(unlocked: readonly number[]): Partial<Record<MainStat, number>> {
  return sumSkillStats(mainSkillNodes(), unlocked) as Partial<Record<MainStat, number>>;
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
/** 放置ツリーに使う素材（銀）。 */
export const IDLE_MATERIAL: MaterialId = 'silver';
/** 放置ツリーの次の1段のコスト（素材=銀）。最大なら null。 */
export function idleCost(idle: number, b: MiningBalance = defaultMiningBalance): number | null {
  if (idle >= idleMaxLevel(b)) return null;
  return Math.floor(b.idleMatCostBase * Math.pow(b.idleMatCostGrowth, idle));
}
/** 放置ツリーを1段解放（素材=銀を消費）。 */
export function buyIdle(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = idleCost(state.perm.idle, b);
  if (cost === null || state.materials[IDLE_MATERIAL] < cost) return state;
  const materials = { ...state.materials, [IDLE_MATERIAL]: state.materials[IDLE_MATERIAL] - cost };
  return { ...state, materials, perm: { ...state.perm, idle: state.perm.idle + 1 } };
}

// ===== ★(累計)＝全体ダメージが「勝手に」上がる（消費しない）。√で逓減＝インフレで壊れない。 =====
/** 全武器に乗る全体ダメージ倍率（1 + k×√累計★）。★を貯めるほど自動で全武器が強くなる。 */
export function globalDamageMult(starEarned: number, b: MiningBalance = defaultMiningBalance): number {
  return 1 + b.starDmgPerLvl * Math.sqrt(Math.max(0, starEarned));
}

// ===== 熟練度（転生で使った武器が少しずつ恒久強化・幾何の硬さに追従させる線形） =====
/** 武器の熟練度ダメージ倍率（1 + 熟練Lv × masteryPerLvl）。 */
export function masteryMult(level: number, b: MiningBalance = defaultMiningBalance): number {
  return 1 + level * b.masteryPerLvl;
}
/** 熟練+1に必要な「その走行のその武器の累計ダメージ」閾値（Lvが上がるほど高い＝段々取りにくく）。 */
export function masteryGate(level: number, b: MiningBalance = defaultMiningBalance): number {
  return Math.floor(b.masteryGateBase * Math.pow(b.masteryGateGrowth, level));
}
/** その走行で閾値以上のダメージを出した武器だけ +1 熟練（転生連打では伸びない・深く潜るほど次が要る）。 */
export function gainMastery(state: MineState, b: MiningBalance = defaultMiningBalance): MineState['perm']['mastery'] {
  const next = { ...state.perm.mastery };
  for (const w of WEAPON_IDS) {
    const lv = next[w] ?? 0;
    if (state.dmgByWeapon[w] >= masteryGate(lv, b)) next[w] = lv + 1;
  }
  return next;
}

/** 転生: 走行をリセット。獲得予定★(runPoints)をここで★(points)に加算してもらえる。鉱石・恒久は保持。
 * 使った武器は+1熟練。累計★(starEarned)も加算し、閾値に達した武器が次走から3択に出る（自動解放）。 */
export function prestige(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const perm = { ...state.perm, mastery: gainMastery(state, b), starEarned: state.perm.starEarned + state.runPoints };
  return freshRun(b, state.materials, perm, state.prestiges + 1, state.rngState);
}
