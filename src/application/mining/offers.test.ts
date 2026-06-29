import { describe, it, expect } from 'vitest';
import { createRng } from '@shared/rng';
import { initialMineState } from '@application/mining/mineState';
import { makeOffer, autoPick, applyOfferChoice, offerLevelCap, appraiseCost, buyAppraise, rareChance, epicChance, boostCost, buyBoost, boostMul } from '@application/mining/upgrades';
import { stepMine } from '@application/mining/step';
import { defaultMiningBalance, PASSIVE_IDS, WEAPON_IDS } from '@domain/mining/balance';

const B = defaultMiningBalance;
const lv = () => initialMineState().levels;

describe('mining/offers', () => {
  it('三択の武器/強化には上限Lv: 到達したら3択に出ない＆超えて上がらない', () => {
    // 武器pickを上限に。makeOfferのpoolにpickが出ない。
    const maxed = { ...lv(), pick: B.maxWeaponLevel };
    for (let i = 0; i < 30; i++) expect(makeOffer(createRng(i), maxed, 0, WEAPON_IDS, B).some((c) => c.id === 'pick')).toBe(false);
    // applyOfferChoice は上限で頭打ち（rare=+2でも超えない）。
    const near = { ...initialMineState(), levels: { ...lv(), pick: B.maxWeaponLevel - 1 } };
    const r = applyOfferChoice(near, { id: 'pick', rarity: 'rare', bonus: null }, B);
    expect(r.levels.pick).toBe(B.maxWeaponLevel);
    // 長時間走行しても上限を超えない。
    const s = stepMine(initialMineState(), 60 * 60_000); // 1時間
    for (const w of WEAPON_IDS) expect(s.levels[w]).toBeLessThanOrEqual(B.maxWeaponLevel);
    for (const p of PASSIVE_IDS) expect(s.levels[p]).toBeLessThanOrEqual(B.maxPassiveLevel);
    expect(offerLevelCap('pick')).toBe(B.maxWeaponLevel);
    expect(offerLevelCap('power')).toBe(B.maxPassiveLevel);
  });

  it('射程(範囲)・貫通のパッシブは3択に出さない（ツリー側で扱う）', () => {
    const all = new Set<string>();
    for (let i = 0; i < 300; i++) makeOffer(createRng(i * 7 + 1), lv(), 0, WEAPON_IDS, B).forEach((c) => all.add(c.id));
    expect(all.has('range')).toBe(false);
    expect(all.has('pierce')).toBe(false);
    expect(all.has('power')).toBe(true); // 他のパッシブは出る
  });

  it('makeOffer は3枠・各枠に rarity', () => {
    const o = makeOffer(createRng(1), lv(), 0, WEAPON_IDS, B);
    expect(o.length).toBe(3);
    o.forEach((c) => expect(['common', 'rare', 'epic']).toContain(c.rarity));
  });

  it('目利き(appraise)でレア/エピック率が上がる', () => {
    expect(rareChance(0, B)).toBeLessThan(rareChance(5, B));
    expect(epicChance(0, B)).toBeLessThan(epicChance(5, B));
    const nonCommon = (appraise: number): number => {
      const rng = createRng(7); let n = 0;
      for (let i = 0; i < 400; i++) n += makeOffer(rng, lv(), appraise, WEAPON_IDS, B).filter((c) => c.rarity !== 'common').length;
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
    for (let i = 0; i < 400; i++) makeOffer(rng, levels, 0, WEAPON_IDS, B).forEach((c) => seen.add(c.id));
    // 未所持の新規パッシブは出ない
    const newPassive = PASSIVE_IDS.find((id) => !id.startsWith('u') && levels[id] <= 0)!;
    expect(seen.has(newPassive)).toBe(false);
    // 所持済みパッシブはLv上げのため出る
    expect(seen.has(generic[0]!)).toBe(true);
  });

  it('autoPick はレア優先（同率はランダム）', () => {
    const rng = createRng(11);
    // 同率(全common)はランダムにばらける＝必ず3択内
    const common = [
      { id: 'speed', rarity: 'common', bonus: null },
      { id: 'luck', rarity: 'common', bonus: null },
      { id: 'power', rarity: 'common', bonus: null },
    ] as const;
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = autoPick(common, rng).id;
      ids.add(id);
      expect(['speed', 'luck', 'power']).toContain(id);
    }
    expect(ids.size).toBeGreaterThan(1);
    // レア/エピックがあれば必ずそれを取る
    const mixed = [
      { id: 'speed', rarity: 'common', bonus: null },
      { id: 'luck', rarity: 'epic', bonus: null },
      { id: 'power', rarity: 'rare', bonus: null },
    ] as const;
    for (let i = 0; i < 20; i++) expect(autoPick(mixed, rng).id).toBe('luck'); // epicを優先
  });

  it('武器固有ユニークは対応武器を持っていないと3択に出ない', () => {
    const levels = lv(); // 初期: pick=1 のみ
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) makeOffer(rng, levels, 0, WEAPON_IDS, B).forEach((c) => seen.add(c.id));
    expect(seen.has('upick')).toBe(true);     // ツルハシ所持 → 固有が出る
    expect(seen.has('ubullet')).toBe(false);  // 弾は未所持 → 固有は出ない
  });
});
