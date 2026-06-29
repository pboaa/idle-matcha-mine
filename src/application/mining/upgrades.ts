import { type Rng } from '@shared/rng';
import type { MiningBalance, ChoiceId, OfferRarity } from '@domain/mining/balance';
import { WEAPON_IDS, PASSIVE_IDS, PASSIVE_DEFS, defaultMiningBalance, isWeapon } from '@domain/mining/balance';
import type { MineState, OfferChoice, Levels, WeaponSkill } from '@application/mining/mineState';

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

/** 3択。武器は所持数制限(maxWeapons)・強化(特殊能力)も所持数制限(maxPassives)あり。武器固有強化はその武器所持が条件。 */
export function makeOffer(rng: Rng, levels: Levels, appraise: number, b: MiningBalance = defaultMiningBalance): OfferChoice[] {
  const canNewWeapon = WEAPON_IDS.filter((w) => levels[w] > 0).length < b.maxWeapons;
  const canNewPassive = PASSIVE_IDS.filter((id) => levels[id] > 0).length < b.maxPassives;
  const pool: ChoiceId[] = [];
  for (const id of WEAPON_IDS) if (levels[id] > 0 || canNewWeapon) pool.push(id);
  for (const id of PASSIVE_IDS) {
    const def = PASSIVE_DEFS[id];
    if (def.reqWeapon && levels[def.reqWeapon] <= 0) continue; // 武器固有強化は対応武器を持っている時だけ
    if (levels[id] <= 0 && !canNewPassive) continue;           // 強化は最大 maxPassives 個（既存はLv上げのため出る）
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

/** 自動モードの取得選択。3択(=持ち込み)はランダムだが、強化済み(開始Lv＋スキルツリー)のものを優先で取る。 */
export function autoPick(offer: readonly OfferChoice[], rng: Rng, opts?: { readonly levels: Levels; readonly weaponSkill?: WeaponSkill }): OfferChoice {
  const priority = (c: OfferChoice): number => {
    if (!opts) return 0;
    let p = opts.levels[c.id];
    if (isWeapon(c.id) && opts.weaponSkill) p += opts.weaponSkill[c.id].length; // 恒久スキルツリーへの投資（解放数）
    return p;
  };
  let best = -1;
  const top: OfferChoice[] = [];
  for (const c of offer) {
    const p = priority(c);
    if (p > best) { best = p; top.length = 0; top.push(c); }
    else if (p === best) top.push(c);
  }
  return top[Math.floor(rng.next() * top.length)]!;
}

/** レア/エピックで武器を取った時の固有特性ゲイン（common=0, rare=1, epic=2）。 */
export const offerQualityGain = (choice: OfferChoice): number =>
  isWeapon(choice.id) ? (choice.rarity === 'epic' ? 2 : choice.rarity === 'rare' ? 1 : 0) : 0;

export function applyOfferChoice(state: MineState, choice: OfferChoice): MineState {
  const lv = { ...state.levels };
  lv[choice.id] += choice.rarity === 'rare' ? 2 : 1;
  if (choice.rarity === 'epic' && choice.bonus) lv[choice.bonus] += 1;
  const q = offerQualityGain(choice); // レア/エピック武器は固有特性を持つ（重ねると強化）
  const weaponQuality = q > 0 && isWeapon(choice.id) ? { ...state.weaponQuality, [choice.id]: state.weaponQuality[choice.id] + q } : state.weaponQuality;
  return { ...state, levels: lv, offer: null, offerAt: null, weaponQuality };
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

