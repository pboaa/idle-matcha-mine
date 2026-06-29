import { type Rng } from '@shared/rng';
import type { MiningBalance, ChoiceId, OfferRarity, WeaponId } from '@domain/mining/balance';
import { WEAPON_IDS, PASSIVE_IDS, PASSIVE_DEFS, defaultMiningBalance, isWeapon } from '@domain/mining/balance';
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

/** 3択でそのIDを上げられる上限Lv（武器/強化で別）。到達したら3択に出ない＝走行内の青天井を防ぐ。 */
export const offerLevelCap = (id: ChoiceId, b: MiningBalance = defaultMiningBalance): number =>
  isWeapon(id) ? b.maxWeaponLevel : b.maxPassiveLevel;

/** 3択。武器は解放済み(allowed)のみ＋所持数制限(maxWeapons)＋上限Lv、強化も所持数(maxPassives)＋上限Lv。 */
export function makeOffer(rng: Rng, levels: Levels, appraise: number, allowed: readonly WeaponId[], b: MiningBalance = defaultMiningBalance): OfferChoice[] {
  const canNewWeapon = WEAPON_IDS.filter((w) => levels[w] > 0).length < b.maxWeapons;
  const canNewPassive = PASSIVE_IDS.filter((id) => levels[id] > 0).length < b.maxPassives;
  const pool: ChoiceId[] = [];
  for (const id of WEAPON_IDS) if (allowed.includes(id) && (levels[id] > 0 || canNewWeapon) && levels[id] < b.maxWeaponLevel) pool.push(id);
  for (const id of PASSIVE_IDS) {
    const def = PASSIVE_DEFS[id];
    if (def.reqWeapon && levels[def.reqWeapon] <= 0) continue; // 武器固有強化は対応武器を持っている時だけ
    if (levels[id] <= 0 && !canNewPassive) continue;           // 強化は最大 maxPassives 個（既存はLv上げのため出る）
    if (levels[id] >= b.maxPassiveLevel) continue;             // 上限Lv到達は出さない
    pool.push(id);
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

/** 自動モード/放置時の取得選択は「レアなもの優先」（epic>rare>common、同率はランダム）。 */
export function autoPick(offer: readonly OfferChoice[], rng: Rng): OfferChoice {
  const rank = (r: OfferRarity): number => (r === 'epic' ? 2 : r === 'rare' ? 1 : 0);
  const best = Math.max(...offer.map((o) => rank(o.rarity)));
  const top = offer.filter((o) => rank(o.rarity) === best);
  return top[Math.floor(rng.next() * top.length)]!;
}

// 三択は放置で自動選択されるので「特殊な強化要素(貫通/範囲/多点)」は持たせない。
// レア/エピックは取得レベルが増えるだけ（特殊効果は全て転生スキルツリー側へ）。
export function applyOfferChoice(state: MineState, choice: OfferChoice, b: MiningBalance = defaultMiningBalance): MineState {
  const lv = { ...state.levels };
  const cap = (id: ChoiceId): number => offerLevelCap(id, b);
  lv[choice.id] = Math.min(cap(choice.id), lv[choice.id] + (choice.rarity === 'rare' ? 2 : 1)); // 上限Lvで頭打ち
  if (choice.rarity === 'epic' && choice.bonus) lv[choice.bonus] = Math.min(cap(choice.bonus), lv[choice.bonus] + 1);
  return { ...state, levels: lv, offer: null, offerAt: null };
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

