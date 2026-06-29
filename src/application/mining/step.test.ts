import { describe, it, expect } from 'vitest';
import { initialMineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';
import { defaultMiningBalance } from '@domain/mining/balance';

describe('mining/step', () => {
  it('決定的（同じ初期状態・同じ時間で一致）', () => {
    const a = stepMine(initialMineState(), 10_000);
    const b = stepMine(initialMineState(), 10_000);
    expect(b.coins).toBe(a.coins);
    expect(b.dug.size).toBe(a.dug.size);
    expect(b.level).toBe(a.level);
    expect(b.cat.pos).toEqual(a.cat.pos);
  });

  it('掘って自動回収でコインが増える', () => {
    const s = stepMine(initialMineState(), 10_000);
    expect(s.dug.size).toBeGreaterThan(1);
    expect(s.coins).toBeGreaterThan(0);
  });

  it('壁で詰まって溜めた移動ゲージで大量ワープしない', () => {
    const base = initialMineState();
    const dug = new Set(base.dug);
    for (let x = 16; x <= 25; x++) dug.add(`${x},15`); // 右へ一直線の空洞（進める道）
    // gauge を極端に溜めた状態（壁の手前で詰まっていた想定）で前方が開いている
    const s = { ...base, autoMode: false, dug, cat: { pos: { x: 15, y: 15 }, gauge: 999, target: { x: 25, y: 15 } } };
    const moved = Math.abs(stepMine(s, 100).cat.pos.x - 15);
    expect(moved).toBeLessThanOrEqual(2); // 1tickで一気に飛ばない（溜め込み無効化）
  });

  it('カメラはデッドゾーン内で猫を追従（猫が中央付近を滑らかに動く）', () => {
    const B = defaultMiningBalance;
    const s = stepMine(initialMineState(), 10_000);
    expect(Math.abs(s.cam.x - s.cat.pos.x)).toBeLessThanOrEqual(B.camDeadzone); // 猫はデッドゾーン内
    expect(Math.abs(s.cam.y - s.cat.pos.y)).toBeLessThanOrEqual(B.camDeadzone);
  });

  it('全部掘ると次の階へ（小ワールドで検証・balance注入）', () => {
    const small = { ...defaultMiningBalance, worldSize: 5 }; // 25マス
    let s = initialMineState(small);
    for (let i = 0; i < 60 && s.floor === 0; i++) s = stepMine(s, 5000, small);
    expect(s.floor).toBeGreaterThanOrEqual(1); // 掘り切って降りた
    expect(s.dug.size).toBeLessThan(25 / 2); // 新しい階はリセット（満タン25マスから大きく減っている）
  });

  it('採掘ブースト(コイン購入)で武器の総ダメージが増える', () => {
    // 同一乱数で boost の有無だけ比較（divergenceなし）。手動＝目標を前方の壁に固定してツルハシを撃たせる。
    const base = { ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 16, y: 15 } } };
    const sumDmg = (s: ReturnType<typeof stepMine>): number => Object.values(s.dmgByWeapon).reduce((a, b) => a + b, 0);
    const noBoost = sumDmg(stepMine(base, 500));
    const boosted = sumDmg(stepMine({ ...base, boost: 10 }, 500));
    expect(boosted).toBeGreaterThan(noBoost);            // 威力UP
    expect(boosted).toBeCloseTo(noBoost * 1.8, 5);       // +8%/Lv × 10 = ×1.8
  });

  it('コインは貯まり、強化購入は手動（自動購入はしない）', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.coins).toBeGreaterThan(0);   // コインは貯まる（使い道は手動）
    expect(s.meta.appraise).toBe(0);      // 自動では目利きを買わない
    expect(s.boost).toBe(0);              // 自動ではブーストも買わない
  });

  it('手動の3択は一定時間(offerAutoMs)放置で自動選択される', () => {
    const B = defaultMiningBalance;
    const ch = { id: 'power', rarity: 'common', bonus: null } as const;
    const base = initialMineState();
    // 既に3択が出てから offerAutoMs 経過した状態（xpは低くして新規offerが出ないように）
    const s0 = { ...base, autoMode: false, offer: [ch, ch, ch], offerAt: 0, time: B.offerAutoMs + 100, xp: 0 };
    const s1 = stepMine(s0, 100);
    expect(s1.offer).toBeNull();                                  // 放置で自動選択
    expect(s1.levels.power).toBeGreaterThan(base.levels.power);   // 何か取得された
  });

  it('武器の範囲はレベル/射程で広がる（ツルハシ1マス→拡大、ビーム2→4→8方向）', () => {
    // 命中マス数で範囲を測る。手動＋前方の壁を固定してツルハシ。
    const fire = (lvl: number) => {
      const s = { ...initialMineState(), autoMode: false, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 16, y: 15 } }, levels: { ...initialMineState().levels, pick: lvl } };
      const r = stepMine(s, 600); // ツルハシが1回攻撃
      return new Set(r.fx.filter((f) => f.weapon === 'pick').flatMap((f) => f.cells.map((c) => `${c.x},${c.y}`))).size;
    };
    expect(fire(1)).toBe(1);              // Lv1: 前方1マス
    expect(fire(10)).toBeGreaterThan(1);  // 高Lv: 横に広がる
    // ビームの方向数: Lv1=2方向、高Lvで増える
    const beamDirs = (lvl: number) => {
      const s = { ...initialMineState(), autoMode: false, levels: { ...initialMineState().levels, pick: 0, beam: lvl } };
      const r = stepMine(s, 600);
      const cells = r.fx.filter((f) => f.weapon === 'beam').flatMap((f) => f.cells);
      // 中心(cat)から見た方向の種類数
      return new Set(cells.map((c) => `${Math.sign(c.x - 15)},${Math.sign(c.y - 15)}`)).size;
    };
    expect(beamDirs(1)).toBe(2);            // Lv1: 2方向
    expect(beamDirs(10)).toBeGreaterThan(2); // 高Lv: 4/8方向
  });

  it('レア/エピックの固有特性: 弾は多点同時／直線は貫通が伸びる', () => {
    const cells = (weapon: 'bullet' | 'beam', q: number) => {
      const init = initialMineState();
      const s = { ...init, autoMode: false, levels: { ...init.levels, pick: 0, [weapon]: 1 }, weaponQuality: { ...init.weaponQuality, [weapon]: q } };
      const r = stepMine(s, 350); // 弾/ビームが1回攻撃
      return new Set(r.fx.filter((f) => f.weapon === weapon).flatMap((f) => f.cells.map((c) => `${c.x},${c.y}`))).size;
    };
    expect(cells('bullet', 0)).toBe(1);                       // 固有なし: 1点
    expect(cells('bullet', 2)).toBeGreaterThan(1);            // 固有あり: 多点同時
    expect(cells('beam', 2)).toBeGreaterThan(cells('beam', 0)); // 直線は貫通で長くなる
  });

  it('武器の命中エフェクト(fx)が生成され寿命内に保たれる', () => {
    const s = stepMine(initialMineState(), 3000);
    expect(s.fx.length).toBeGreaterThan(0);                       // 演出が出る
    expect(s.fx.every((f) => s.time - f.bornAt < defaultMiningBalance.fxVisualMs)).toBe(true); // 古いものは消える
    expect(s.fx.every((f) => f.cells.length > 0)).toBe(true);     // 当たったマスを持つ
    expect(s.fx.every((f) => Number.isFinite(f.origin.x) && Number.isFinite(f.origin.y))).toBe(true); // 発射元(線描画用)
    expect(s.fx.some((f) => f.weapon === 'pick')).toBe(true);     // 初期武器ツルハシの演出
  });

  it('自動モードでレベルアップ強化が乗る', () => {
    const s = stepMine(initialMineState(), 120_000);
    const total = Object.values(s.levels).reduce((a, b) => a + b, 0);
    expect(s.level).toBeGreaterThan(1);
    expect(total).toBeGreaterThan(1); // pick:1 + 取得分
    expect(s.offer).toBeNull();
  });
});
