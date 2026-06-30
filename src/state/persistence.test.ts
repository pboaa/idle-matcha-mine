import { describe, it, expect } from 'vitest';
import { exportSave, importSave } from '@state/persistence';
import { initialMineState } from '@application/mining/mineState';
import { stepMine } from '@application/mining/step';

describe('persistence/export-import', () => {
  it('書き出し→読み込みで状態が一致する（dug Set / damage Map も復元）', () => {
    const s = stepMine(initialMineState(), 20_000); // 少し進めた状態
    const r = importSave(exportSave(s));
    expect(r).not.toBeNull();
    expect(r!.floor).toBe(s.floor);
    expect(r!.coins).toBe(s.coins);
    expect(r!.startWeapon).toBe(s.startWeapon);
    expect(r!.runGrid.unlocked).toEqual(s.runGrid.unlocked);
    expect(r!.dug instanceof Set).toBe(true);
    expect(r!.dug.size).toBe(s.dug.size);
    expect(r!.damage instanceof Map).toBe(true);
    expect(r!.perm.starEarned).toBe(s.perm.starEarned);
    expect(r!.perm.unlockedWeapons).toEqual(s.perm.unlockedWeapons);
  });

  it('不正な文字列は null（読み込み失敗）', () => {
    expect(importSave('')).toBeNull();
    expect(importSave('これは壊れたデータ')).toBeNull();
    expect(importSave('{"v":1,"s":{}}')).toBeNull(); // 旧バージョンは弾く
  });
});
