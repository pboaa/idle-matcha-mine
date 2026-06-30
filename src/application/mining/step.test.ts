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

  it('カメラは常に猫に固定（猫は画面の真ん中）', () => {
    const s = stepMine(initialMineState(), 10_000);
    expect(s.cam).toEqual(s.cat.pos); // カメラ＝猫の位置＝常に中央
  });

  it('累計★(starTotal)で火力が上がる（時間経過では変わらない＝放置ボーナス廃止）', () => {
    const hard = { ...defaultMiningBalance, hardnessBase: 1e6 }; // 1撃で壊れず＝倍率を純粋比較
    const dmg = (starTotal: number, startMs: number): number => {
      const init = initialMineState(hard);
      const s = { ...init, time: startMs, autoMode: false, perm: { ...init.perm, starTotal }, cat: { pos: { x: 15, y: 15 }, gauge: 0, target: { x: 16, y: 15 } } };
      return stepMine(s, 600, hard).dmgByWeapon.pick;
    };
    expect(dmg(0, 0)).toBeCloseTo(dmg(0, 9_999_000), 5);   // 時間経過で火力は変わらない（放置ボーナスなし）
    expect(dmg(400, 0)).toBeGreaterThan(dmg(0, 0));         // 累計★で火力UP
  });

  it('全部掘ると次の階へ（小ワールドで検証・balance注入）', () => {
    const small = { ...defaultMiningBalance, worldSize: 5 }; // 25マス
    let s = initialMineState(small);
    for (let i = 0; i < 60 && s.floor === 0; i++) s = stepMine(s, 5000, small);
    expect(s.floor).toBeGreaterThanOrEqual(1); // 掘り切って降りた
    expect(s.dug.size).toBeLessThan(25 / 2); // 新しい階はリセット（満タン25マスから大きく減っている）
  });

  it('コインは採掘で貯まる', () => {
    const s = stepMine(initialMineState(), 60_000);
    expect(s.coins).toBeGreaterThan(0);   // コインは貯まる（走行グリッドの即時解放/リロールに使う）
  });

  it('走行グリッドは自動では解放されない（手動のみ）・★は貯まる', () => {
    const s = stepMine(initialMineState(), 120_000);
    expect(s.level).toBeGreaterThan(1);                           // レベルが上がっている
    expect(s.runGrid.unlocked.length).toBe(1);                   // 中央のみ（自動では解放しない＝コインで手動）
    expect(s.runPoints).toBeGreaterThan(0);                      // 転生でもらえる★が貯まる
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

  it('武器の命中エフェクト(fx)が生成され寿命内に保たれる', () => {
    const s = stepMine(initialMineState(), 3000);
    expect(s.fx.length).toBeGreaterThan(0);                       // 演出が出る
    expect(s.fx.every((f) => s.time - f.bornAt < defaultMiningBalance.fxVisualMs)).toBe(true); // 古いものは消える
    expect(s.fx.every((f) => f.cells.length > 0)).toBe(true);     // 当たったマスを持つ
    expect(s.fx.every((f) => Number.isFinite(f.origin.x) && Number.isFinite(f.origin.y))).toBe(true); // 発射元(線描画用)
    expect(s.fx.some((f) => f.weapon === 'pick')).toBe(true);     // 初期武器ツルハシの演出
  });

  it('装備は つるはし＋開始武器の2種のみ（三択廃止で走行中は増えない）', () => {
    const s = stepMine(initialMineState(), 120_000);
    const equipped = Object.values(s.levels).reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
    expect(s.levels.pick).toBe(1);       // つるはしは常時
    expect(equipped).toBe(2);            // pick + 開始武器(bullet)
  });
});
