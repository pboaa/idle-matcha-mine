import { describe, it, expect } from 'vitest';
import { initialMineState, freshRun, emptyPerm, type MineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { buyWeaponSkill, buyWeaponSkillMax, skillNodeUnlockable, allowedWeapons, weaponUnlockStar, unlockWeapon, startRun, prestige, globalDamageMult, buyCapUpgrade, buyTreasurePower } from '@application/mining/prestige';
import { buyRunUnlock } from '@application/mining/upgrades';
import { runGridUnlockable } from '@domain/mining/runGrid';
import { defaultMiningBalance, WEAPON_IDS, WEAPON_UNLOCK_ORDER, weaponSkillNodes } from '@domain/mining/balance';

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

  it('恒久グリッド(階層): 中央起点・隣接で解放・★を消費・不足は不可', () => {
    const nodes = weaponSkillNodes('pick');
    const rootIdx = nodes.findIndex((n) => n.root);
    const tier1Root = nodes.findIndex((n) => n.root && n.tier === 1);
    const s0 = withStars(initialMineState(), 9_999_999);
    expect(skillNodeUnlockable('pick', [], rootIdx)).toBe(true);     // 階層1中央は最初から解放可
    expect(skillNodeUnlockable('pick', [], tier1Root)).toBe(false);  // 階層2はまだ解禁されていない
    const root = nodes[rootIdx]!;
    const s1 = buyWeaponSkill(s0, 'pick', rootIdx);
    expect(s1.perm.weaponSkill.pick).toEqual([rootIdx]);
    expect(s1.perm.starPoints).toBe(9_999_999 - root.starCost);   // ★残高を消費
    const neighbor = root.requires[0]!;
    expect(skillNodeUnlockable('pick', s1.perm.weaponSkill.pick, neighbor)).toBe(true); // 隣接が解禁
    expect(buyWeaponSkill(withStars(initialMineState(), 0), 'pick', rootIdx).perm.weaponSkill.pick).toEqual([]); // ★残高不足で不可
  });

  it('一気に上げる: 解禁可能＆★が足りるノードを買えるだけ買う', () => {
    const r = buyWeaponSkillMax(withStars(initialMineState(), 9_999_999), 'pick');
    expect(r.perm.weaponSkill.pick.length).toBeGreaterThan(10);
    const poor = buyWeaponSkillMax(withStars(initialMineState(), 0), 'pick');
    expect(poor.perm.weaponSkill.pick.length).toBe(0);
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

  it('お宝: 走行グリッドのマス解放でお宝+1、お宝で上限/全体火力を永続購入', () => {
    let s: MineState = { ...initialMineState(), coins: 99_999 };
    const i = s.runGrid.nodes.findIndex((_, idx) => runGridUnlockable(s.runGrid, idx));
    s = buyRunUnlock(s, i, B);
    expect(s.perm.treasure).toBe(B.treasurePerUnlock); // 解放でお宝+1
    expect(s.runGrid.unlocked.length).toBe(2);         // 中央＋1
    const rich = { ...s, perm: { ...s.perm, treasure: 9_999 } };
    expect(buyCapUpgrade(rich, B).perm.capLevel).toBe(1);             // お宝で上限+1
    expect(buyTreasurePower(rich, B).perm.treasurePower).toBe(1);     // お宝で全体火力+1
    expect(buyCapUpgrade({ ...rich, perm: { ...rich.perm, treasure: 0 } }, B).perm.capLevel).toBe(0); // お宝不足で不可
  });

  it('累計★で全体ダメージ倍率が上がる（消費しても減らない）', () => {
    const s = stepMine(initialMineState(), 30_000);
    const r = prestige(s, B);
    expect(globalDamageMult(0, B)).toBe(1);
    expect(globalDamageMult(r.perm.starTotal, B)).toBeGreaterThan(1); // 累計★>0で倍率>1
    // ★を消費(buySkill)しても starTotal は減らない＝倍率は維持
    const spent = buyWeaponSkill(withStars(r, 9_999_999), 'pick', weaponSkillNodes('pick').findIndex((n) => n.root));
    expect(spent.perm.starTotal).toBe(r.perm.starTotal);
  });
});
