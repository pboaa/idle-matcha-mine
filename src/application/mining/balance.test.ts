import { describe, it, expect } from 'vitest';
import { initialMineState, type MineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { defaultMiningBalance, WEAPON_IDS, choiceMeta } from '@domain/mining/balance';
import { totalTilesOf } from '@domain/mining/tile';

/** 採掘バランスの自動監視（数値はここを見て調整する）。 */
describe('mining/balance', () => {
  const total = totalTilesOf(defaultMiningBalance);

  it('5分の進捗・コイン・成長（調整の目安／壊れていない）', () => {
    let s: MineState = initialMineState();
    for (const min of [1, 3, 5]) {
      s = stepMine(s, min * 60_000 - s.time);
      const weapons = WEAPON_IDS.filter((w) => s.levels[w] > 0).map((w) => choiceMeta(w).emoji);
      console.log(`${min}分: 階${s.floor + 1} 掘削${((s.dug.size / total) * 100).toFixed(1)}% コイン${s.coins} Lv${s.level} 走行グリッド${s.runGrid.unlocked.length}解放 武器[${weapons.join('')}]`);
    }
    // 武器ごとのダメージ寄与（調整の指標）
    const tot = WEAPON_IDS.reduce((a, w) => a + s.dmgByWeapon[w], 0);
    const share = WEAPON_IDS.filter((w) => s.dmgByWeapon[w] > 0).map((w) => `${choiceMeta(w).emoji}${tot > 0 ? Math.round((s.dmgByWeapon[w] / tot) * 100) : 0}%`);
    console.log(`ダメージ内訳: ${share.join(' ')}`);
    expect(s.runPoints).toBeGreaterThan(0); // 進行で獲得予定★が貯まっている
    expect(s.dug.size).toBeGreaterThan(10);
    expect(s.dmgByWeapon.pick).toBeGreaterThan(0);
  });

  it('ツルハシは他武器と同程度（武器無しでも掘れる／全武器ありでも極端に速くない）', () => {
    const pickOnly = stepMine(initialMineState(), 120_000); // 自動で武器も付くので…
    // 武器を完全に無効化した状態(pickのみ固定)で比較。手動なので遠い目標へツルハシで掘り進ませる。
    let onlyPick: MineState = { ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 0, y: 0 } } };
    onlyPick = stepMine(onlyPick, 120_000);
    const pickDug = onlyPick.dug.size;
    console.log(`2分: 自動強化あり 掘削${pickOnly.dug.size} / ピックのみ(強化保留) 掘削${pickDug}`);
    expect(pickDug).toBeGreaterThan(5); // ピックだけでも掘れる
    expect(pickOnly.dug.size).toBeLessThan(pickDug * 8); // 武器で極端には速くならない

    // ツルハシは主役ではないが「埋もれない」: 5分時点の火力寄与が平均の半分以上（同程度）。
    const s5 = stepMine(initialMineState(), 300_000);
    const tot = WEAPON_IDS.reduce((a, w) => a + s5.dmgByWeapon[w], 0);
    const active = WEAPON_IDS.filter((w) => s5.dmgByWeapon[w] > 0).length;
    const pickShare = s5.dmgByWeapon.pick / tot;
    const avgShare = 1 / active;
    console.log(`ツルハシ寄与 ${(pickShare * 100).toFixed(0)}% / 平均 ${(avgShare * 100).toFixed(0)}%（武器${active}種）`);
    expect(pickShare).toBeGreaterThan(avgShare * 0.5); // 最下位に沈まない＝同程度
  }, 20000);
});
