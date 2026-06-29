import type { MiningBalance, MaterialId, WeaponId, CoinUpId } from '@domain/mining/balance';
import { defaultMiningBalance, MATERIAL_IDS, BASE_WEAPONS, WEAPON_UNLOCK_ORDER, COIN_UP_DEFS, WEAPON_IDS, weaponSkillNodes, skillGridUnlockNeed } from '@domain/mining/balance';
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

/** その階層(グリッド)が解禁済みか（前の階層を skillGridUnlockNeed だけ解放していれば解禁）。 */
export function skillGridOpen(weapon: WeaponId, unlocked: readonly number[], tier: number): boolean {
  if (tier <= 0) return true;
  const nodes = weaponSkillNodes(weapon);
  const boughtPrev = unlocked.filter((i) => nodes[i]?.tier === tier - 1).length;
  return boughtPrev >= skillGridUnlockNeed(tier - 1);
}
/** そのノードが今解放できるか（未解放・階層が解禁済み・中央 or 同グリッド隣接が解放済み）。
 * 階層グリッド型：各階層は中央(root)起点、上下左右どれかが解放済みなら解禁＝外へ広げていく。 */
export function skillNodeUnlockable(weapon: WeaponId, unlocked: readonly number[], nodeIndex: number): boolean {
  const n = weaponSkillNodes(weapon)[nodeIndex];
  if (!n || unlocked.includes(nodeIndex)) return false;
  if (!skillGridOpen(weapon, unlocked, n.tier)) return false; // その階層グリッドが未解禁
  return !!n.root || n.requires.some((r) => unlocked.includes(r));
}
/** 武器スキルツリーのノードを1つ解放（隣接解禁＋素材を満たせば）。 */
export function buyWeaponSkill(state: MineState, weapon: WeaponId, nodeIndex: number): MineState {
  const unlocked = state.perm.weaponSkill[weapon];
  const node = weaponSkillNodes(weapon)[nodeIndex];
  if (!node || !skillNodeUnlockable(weapon, unlocked, nodeIndex) || state.materials[node.matId] < node.matCost) return state;
  const materials = { ...state.materials, [node.matId]: state.materials[node.matId] - node.matCost };
  const weaponSkill = { ...state.perm.weaponSkill, [weapon]: [...unlocked, nodeIndex] };
  return { ...state, materials, perm: { ...state.perm, weaponSkill } };
}
/** 解放済みノードの累積ステータス（武器に恒久で乗る）。 */
export function weaponSkillStats(weapon: WeaponId, unlocked: readonly number[]): WeaponStatLevels {
  const s: WeaponStatLevels = { damage: 0, speed: 0, range: 0, pierce: 0, area: 0, unique: 0 };
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
