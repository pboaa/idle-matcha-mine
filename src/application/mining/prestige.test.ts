import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyPerm, type MineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { allowedWeapons, weaponUnlockStar, unlockWeapon, startRun, prestige, globalDamageMult } from '@application/mining/prestige';
import { rarityOf, dexKinds, dexEffectTotals } from '@domain/mining/treasures';
import { defaultMiningBalance, WEAPON_IDS, WEAPON_UNLOCK_ORDER } from '@domain/mining/balance';

const B = defaultMiningBalance;
const withStars = (s: MineState, n: number): MineState => ({ ...s, perm: { ...s.perm, starPoints: n } });

describe('mining/prestige', () => {
  it('freshRun: つるはし＋選んだ武器のみ装備（持ち込みバグ防止）', () => {
    const s = freshRun(B, emptyPerm(), 0, 'bullet');
    expect(s.levels.pick).toBe(1);                          // つるはしは常時
    expect(s.levels.bullet).toBe(1);                        // 選んだ武器
    expect(WEAPON_IDS.filter((w) => w !== 'pick' && w !== 'bullet').every((w) => s.levels[w] === 0)).toBe(true);
    expect(s.runGrid.unlocked.length).toBe(1);             // 走行グリッドは中央のみ解放済み
  });

  it('開始時に選べる武器＝perm.unlockedWeapons（初期は弾のみ）', () => {
    const s0 = initialMineState();
    expect([...allowedWeapons(s0.perm)]).toEqual(['bullet']);
  });

  it('武器の★解放: ★を消費して解放／不足は不可', () => {
    const first = WEAPON_UNLOCK_ORDER[0]!;                  // 最初に買える武器
    const cost = weaponUnlockStar(first);
    const s0 = initialMineState();
    expect(unlockWeapon(withStars(s0, cost - 1), first).perm.unlockedWeapons).not.toContain(first); // ★残高不足で不可
    const r = unlockWeapon(withStars(s0, cost), first);
    expect(r.perm.unlockedWeapons).toContain(first);       // 解放
    expect(r.perm.starPoints).toBe(0);                    // ★残高を消費（cost を引く）
    expect(unlockWeapon(r, first).perm.unlockedWeapons.filter((w) => w === first).length).toBe(1); // 二重解放しない
  });

  it('開始武器の変更: 解放済みのみ・走行はやり直し', () => {
    const s0 = initialMineState();
    const r = startRun(s0, 'bullet');
    expect(r.startWeapon).toBe('bullet');
    expect(r.levels.bullet).toBe(1);
    // 未解放の武器には変えられない
    const locked = WEAPON_UNLOCK_ORDER[0]!;
    expect(startRun(s0, locked).startWeapon).toBe(s0.startWeapon);
  });

  it('図鑑効果: 重なるほど1個あたり弱まる（√逓減）', () => {
    const one = dexEffectTotals({ 0: 1 }).power;   // #0=火力
    const four = dexEffectTotals({ 0: 4 }).power;  // 4個
    expect(four).toBeCloseTo(one * 2, 6);          // √4=2倍（線形の4倍より弱い）
    expect(four).toBeLessThan(one * 4);            // インフレしない
  });

  it('転生: 走行リセット・runPoints を★残高と累計★の両方へ・回数+1・コイン0', () => {
    const s = stepMine(initialMineState(), 30_000);
    const r = prestige(s, B);
    expect(r.floor).toBe(0);
    expect(r.level).toBe(1);
    expect(r.perm.starPoints).toBe(s.perm.starPoints + s.runPoints); // ★残高に加算（消費可能）
    expect(r.perm.starTotal).toBe(s.perm.starTotal + s.runPoints);   // 累計★にも加算（減らない）
    expect(r.prestiges).toBe(s.prestiges + 1);
    expect(r.coins).toBe(0);
    expect(r.runPoints).toBe(0);
    expect(r.startWeapon).toBe(s.startWeapon);             // 開始武器は引き継ぐ
  });

  it('★は走行中に獲得予定(runPoints)が貯まり、転生で★残高・累計★に積まれる', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.runPoints).toBeGreaterThan(0);
    expect(s.perm.starPoints).toBe(0);                   // 転生まで増えない
    expect(s.perm.starTotal).toBe(0);
    const r = prestige(s, B);
    expect(r.perm.starPoints).toBe(s.runPoints);
    expect(r.perm.starTotal).toBe(s.runPoints);
  });

  it('お宝は採掘でランダムに貯まる・高レアリティは深い階でないと出ない', () => {
    const b = { ...B, treasureDropMul: 50 }; // ドロップ率を上げて検証を安定化
    const s = stepMine({ ...initialMineState(b), perm: { ...emptyPerm() } }, 120_000, b);
    expect(dexKinds(s.perm.dex)).toBeGreaterThan(0);              // 採掘でお宝が貯まる
    expect(s.floor).toBe(0);                                      // まだ地下1階
    const rarities = new Set(Object.keys(s.perm.dex).map((id) => rarityOf(Number(id))));
    expect(rarities.has('common')).toBe(true);                   // コモンは floor0 から出る
    expect([...rarities].every((r) => r === 'common')).toBe(true); // アンコモン以上(minFloor>=1)は浅い階では出ない
  });

  it('累計★で全体ダメージ倍率が上がる', () => {
    const s = stepMine(initialMineState(), 30_000);
    const r = prestige(s, B);
    expect(globalDamageMult(0, B)).toBe(1);
    expect(globalDamageMult(r.perm.starTotal, B)).toBeGreaterThan(1); // 累計★>0で倍率>1
  });
});
