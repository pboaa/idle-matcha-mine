import { describe, it, expect } from 'vitest';
import { weaponDmg, weaponRange, weaponMult, passiveTotals } from '@application/mining/weapons';
import { WEAPON_DEFS, PASSIVE_DEFS } from '@domain/mining/balance';
import { emptyPerm } from '@application/mining/mineState';

const zero = () => emptyPerm().levels;

describe('mining/weapons', () => {
  it('ツルハシが主力（lv1単体DPSが他の武器より高い）', () => {
    expect(weaponDmg(WEAPON_DEFS.pick, 1)).toBeGreaterThan(weaponDmg(WEAPON_DEFS.aura, 1));
    expect(weaponDmg(WEAPON_DEFS.pick, 1)).toBeGreaterThan(weaponDmg(WEAPON_DEFS.beam, 1));
  });

  it('レベルでダメージが増える', () => {
    expect(weaponDmg(WEAPON_DEFS.pick, 2)).toBeGreaterThan(weaponDmg(WEAPON_DEFS.pick, 1));
  });

  it('射程はレベルと射程パッシブで伸びる', () => {
    const r0 = weaponRange(WEAPON_DEFS.beam, 1, 0);
    expect(weaponRange(WEAPON_DEFS.beam, 1, 2)).toBe(r0 + 2); // 射程パッシブ+2
    expect(weaponRange(WEAPON_DEFS.beam, 1 + WEAPON_DEFS.beam.rangePerLvls, 0)).toBe(r0 + 1); // レベルで+1
  });

  it('シナジー: 砥石は近接だけを強化する', () => {
    const lv = zero(); lv.whet = 2;
    const t = passiveTotals(lv);
    expect(weaponMult(WEAPON_DEFS.pick, t)).toBeGreaterThan(1); // 近接強化
    expect(weaponMult(WEAPON_DEFS.beam, t)).toBe(1); // ビームには効かない
  });

  it('威力(全体)は全武器に効く', () => {
    const lv = zero(); lv.power = 3;
    const t = passiveTotals(lv);
    expect(weaponMult(WEAPON_DEFS.beam, t)).toBeGreaterThan(1);
  });

  it('武器固有ユニークは対象武器だけに乗る', () => {
    const lv = zero(); lv.upick = 2; // ⛏️二刀流（targetWeapon: pick）
    const t = passiveTotals(lv);
    expect(t.perWeapon.pick).toBeGreaterThan(0);
    expect(weaponMult(WEAPON_DEFS.pick, t)).toBeGreaterThan(1);
    expect(weaponMult(WEAPON_DEFS.bullet, t)).toBe(1); // 他武器には乗らない
  });

  it('貫通は pierce に積まれる', () => {
    const lv = zero(); lv.pierce = 3;
    expect(passiveTotals(lv).pierce).toBe(3 * PASSIVE_DEFS.pierce.perLvl);
  });

  it('balance(def)差し替えが効く', () => {
    expect(weaponDmg({ ...WEAPON_DEFS.pick, baseDmg: 5 }, 1)).toBe(5);
  });
});
