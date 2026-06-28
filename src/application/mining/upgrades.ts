import { type Rng } from '@shared/rng';
import type { MiningBalance, ChoiceId, OfferRarity } from '@domain/mining/balance';
import { WEAPON_IDS, PASSIVE_IDS, PASSIVE_DEFS, defaultMiningBalance } from '@domain/mining/balance';
import type { MineState, OfferChoice, Levels } from '@application/mining/mineState';

export const xpForNext = (level: number, b: MiningBalance = defaultMiningBalance): number => b.xpBase + level * b.xpPerLevel;

export const rareChance = (appraise: number, b: MiningBalance = defaultMiningBalance): number => Math.min(b.offerRareCap, b.offerRareBase + appraise * b.appraiseRarePerLvl);
export const epicChance = (appraise: number, b: MiningBalance = defaultMiningBalance): number => Math.min(b.offerEpicCap, b.offerEpicBase + appraise * b.appraiseEpicPerLvl);

function rollRarity(rng: Rng, rare: number, epic: number): OfferRarity {
  const r = rng.next();
  if (r < epic) return 'epic';
  if (r < epic + rare) return 'rare';
  return 'common';
}

const owned = (levels: Levels): ChoiceId[] => ([...WEAPON_IDS, ...PASSIVE_IDS] as ChoiceId[]).filter((id) => levels[id] > 0);

/** 3択。武器は所持数制限(maxWeapons)あり。強化(特殊能力)は無制限に積める。武器固有強化はその武器所持が条件。 */
export function makeOffer(rng: Rng, levels: Levels, appraise: number, b: MiningBalance = defaultMiningBalance): OfferChoice[] {
  const canNewWeapon = WEAPON_IDS.filter((w) => levels[w] > 0).length < b.maxWeapons;
  const pool: ChoiceId[] = [];
  for (const id of WEAPON_IDS) if (levels[id] > 0 || canNewWeapon) pool.push(id);
  for (const id of PASSIVE_IDS) {
    const def = PASSIVE_DEFS[id];
    if (def.reqWeapon && levels[def.reqWeapon] <= 0) continue; // 武器固有強化は対応武器を持っている時だけ
    pool.push(id); // 強化は無制限
  }

  const p = [...pool];
  const ids: ChoiceId[] = [];
  while (ids.length < 3 && p.length > 0) ids.push(p.splice(Math.floor(rng.next() * p.length), 1)[0]!);

  const ownedIds = owned(levels);
  const rare = rareChance(appraise, b);
  const epic = epicChance(appraise, b);
  return ids.map((id) => {
    const rarity = rollRarity(rng, rare, epic);
    const bonus = rarity === 'epic' && ownedIds.length > 0 ? ownedIds[Math.floor(rng.next() * ownedIds.length)]! : null;
    return { id, rarity, bonus };
  });
}

export const autoPick = (offer: readonly OfferChoice[], rng: Rng): OfferChoice => offer[Math.floor(rng.next() * offer.length)]!;

export function applyOfferChoice(state: MineState, choice: OfferChoice): MineState {
  const lv = { ...state.levels };
  lv[choice.id] += choice.rarity === 'rare' ? 2 : 1;
  if (choice.rarity === 'epic' && choice.bonus) lv[choice.bonus] += 1;
  return { ...state, levels: lv, offer: null };
}

// ===== コインの使い道: 目利き（レアが出やすく） =====
export const appraiseCost = (level: number, b: MiningBalance = defaultMiningBalance): number => Math.floor(b.appraiseCostBase * Math.pow(b.appraiseCostGrowth, level));
export const appraiseCapped = (appraise: number, b: MiningBalance = defaultMiningBalance): boolean =>
  rareChance(appraise, b) >= b.offerRareCap && epicChance(appraise, b) >= b.offerEpicCap;
export function buyAppraise(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  if (appraiseCapped(state.meta.appraise, b)) return state;
  const cost = appraiseCost(state.meta.appraise, b);
  if (state.coins < cost) return state;
  return { ...state, coins: state.coins - cost, meta: { ...state.meta, appraise: state.meta.appraise + 1 } };
}

// ===== コインの使い道: 採掘ブースト（走行限定・全武器の威力+） =====
export const boostCost = (level: number, b: MiningBalance = defaultMiningBalance): number => Math.floor(b.boostCostBase * Math.pow(b.boostCostGrowth, level));
export const boostMul = (level: number, b: MiningBalance = defaultMiningBalance): number => 1 + level * b.boostPerLvl;
export function buyBoost(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = boostCost(state.boost, b);
  if (state.coins < cost) return state;
  return { ...state, coins: state.coins - cost, boost: state.boost + 1 };
}

// ===== 熟練度（永続）: 倍率は累計で自動、残高は開始ブースト解放に使う通貨 =====
export const masteryMul = (masteryTotal: number, b: MiningBalance = defaultMiningBalance): number => 1 + masteryTotal * b.masteryPerLvl;
export const masteryStartBoostCost = (unlocked: number, b: MiningBalance = defaultMiningBalance): number =>
  Math.floor(b.masteryStartBoostBase * Math.pow(b.masteryStartBoostGrowth, unlocked));
/** 熟練度を払って「毎走の開始ブースト+1」を恒久解放。 */
export function buyMasteryStartBoost(state: MineState, b: MiningBalance = defaultMiningBalance): MineState {
  const cost = masteryStartBoostCost(state.perm.startBoost, b);
  if (state.mastery < cost) return state;
  return { ...state, mastery: state.mastery - cost, perm: { ...state.perm, startBoost: state.perm.startBoost + 1 } };
}
