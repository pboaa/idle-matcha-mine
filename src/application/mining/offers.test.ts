import { describe, it, expect } from 'vitest';
import { createRng } from '@shared/rng';
import { initialMineState } from '@application/mining/mineState';
import { makeOffer, autoPick, applyOfferChoice, appraiseCost, buyAppraise, rareChance, epicChance, boostCost, buyBoost, boostMul } from '@application/mining/upgrades';
import { defaultMiningBalance, PASSIVE_IDS } from '@domain/mining/balance';
import { emptyPerm } from '@application/mining/mineState';

const B = defaultMiningBalance;
const lv = () => initialMineState().levels;

describe('mining/offers', () => {
  it('makeOffer は3枠・各枠に rarity', () => {
    const o = makeOffer(createRng(1), lv(), 0, B);
    expect(o.length).toBe(3);
    o.forEach((c) => expect(['common', 'rare', 'epic']).toContain(c.rarity));
  });

  it('目利き(appraise)でレア/エピック率が上がる', () => {
    expect(rareChance(0, B)).toBeLessThan(rareChance(5, B));
    expect(epicChance(0, B)).toBeLessThan(epicChance(5, B));
    const nonCommon = (appraise: number): number => {
      const rng = createRng(7); let n = 0;
      for (let i = 0; i < 400; i++) n += makeOffer(rng, lv(), appraise, B).filter((c) => c.rarity !== 'common').length;
      return n;
    };
    expect(nonCommon(10)).toBeGreaterThan(nonCommon(0));
  });

  it('applyOfferChoice: common=+1 / rare=+2 / epic=+1＋bonus', () => {
    const s = initialMineState();
    expect(applyOfferChoice(s, { id: 'speed', rarity: 'common', bonus: null }).levels.speed).toBe(s.levels.speed + 1);
    expect(applyOfferChoice(s, { id: 'speed', rarity: 'rare', bonus: null }).levels.speed).toBe(s.levels.speed + 2);
    const e = applyOfferChoice(s, { id: 'speed', rarity: 'epic', bonus: 'luck' });
    expect(e.levels.speed).toBe(s.levels.speed + 1);
    expect(e.levels.luck).toBe(s.levels.luck + 1);
  });

  it('コインの使い道: 目利き購入（コスト消費＋Lv）', () => {
    const s = { ...initialMineState(), coins: 99999 };
    const cost = appraiseCost(0, B);
    const r = buyAppraise(s, B);
    expect(r.meta.appraise).toBe(1);
    expect(r.coins).toBe(99999 - cost);
    expect(appraiseCost(1, B)).toBeGreaterThan(cost); // 上がっていく
  });

  it('コインの使い道: 採掘ブースト購入（走行限定の威力UP）', () => {
    const s = { ...initialMineState(), coins: 99999 };
    expect(s.boost).toBe(0);
    const cost = boostCost(0, B);
    const r = buyBoost(s, B);
    expect(r.boost).toBe(1);
    expect(r.coins).toBe(99999 - cost);
    expect(boostMul(1, B)).toBeGreaterThan(boostMul(0, B)); // 倍率が上がる
    expect(boostCost(1, B)).toBeGreaterThan(cost);          // コストも上がる
  });

  it('採掘ブーストはコイン不足だと買えない', () => {
    const s = { ...initialMineState(), coins: 0 };
    expect(buyBoost(s, B).boost).toBe(0);
  });

  it('強化(パッシブ)は最大 maxPassives 個まで（上限後は新規が出ない／既存はLv上げで出る）', () => {
    // 汎用パッシブを上限個だけ所持させる（reqWeapon無しのものを使う）
    const generic = PASSIVE_IDS.filter((id) => !id.startsWith('u')).slice(0, B.maxPassives);
    const levels = lv();
    for (const id of generic) levels[id] = 1;
    const rng = createRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) makeOffer(rng, levels, 0, B).forEach((c) => seen.add(c.id));
    // 未所持の新規パッシブは出ない
    const newPassive = PASSIVE_IDS.find((id) => !id.startsWith('u') && levels[id] <= 0)!;
    expect(seen.has(newPassive)).toBe(false);
    // 所持済みパッシブはLv上げのため出る
    expect(seen.has(generic[0]!)).toBe(true);
  });

  it('autoPick は恒久強化(perm)済みのものを優先で取る', () => {
    const offer = [
      { id: 'speed', rarity: 'common', bonus: null },
      { id: 'luck', rarity: 'common', bonus: null },
      { id: 'power', rarity: 'common', bonus: null },
    ] as const;
    const perm = { ...emptyPerm(), levels: { ...emptyPerm().levels, luck: 3 } }; // luck を恒久強化済み
    const rng = createRng(11);
    for (let i = 0; i < 20; i++) expect(autoPick(offer, rng, perm).id).toBe('luck'); // 常に優先
    // perm 無しなら従来通りランダム（必ずしも luck ではない）
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(autoPick(offer, rng).id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it('武器固有ユニークは対応武器を持っていないと3択に出ない', () => {
    const levels = lv(); // 初期: pick=1 のみ
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) makeOffer(rng, levels, 0, B).forEach((c) => seen.add(c.id));
    expect(seen.has('upick')).toBe(true);     // ツルハシ所持 → 固有が出る
    expect(seen.has('ubullet')).toBe(false);  // 弾は未所持 → 固有は出ない
  });
});
