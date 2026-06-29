import { initialMineState, emptyPerm, type MineState, type Perm } from '@application/mining/mineState';
import { defaultMiningBalance } from '@domain/mining/balance';

const KEY = 'idle-matcha-mine/save';
const VERSION = 3; // 仕様変更でセーブ形式が変わったら上げる（旧セーブは破棄してフレッシュ開始）。v3=8段階素材／★全体ダメージ／階層ツリー

/** 新規ゲーム状態（走行ごとに開始武器が変わる・序盤は手動）。 */
export function freshState(): MineState {
  return { ...initialMineState(defaultMiningBalance, (Math.random() * 0x7fffffff) | 0), autoMode: false };
}

/** dug(Set)/damage(Map) を配列化してJSON保存。localStorage不可なら黙って無視。 */
export function saveState(state: MineState): void {
  try {
    const payload = { v: VERSION, s: { ...state, dug: [...state.dug], damage: [...state.damage] } };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch { /* 容量超過/プライベートモード等は無視 */ }
}

/** 保存済みがあれば復元（バージョン不一致・破損は null）。新フィールドはフレッシュ値で補完。 */
export function loadState(): MineState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v?: number; s?: Record<string, unknown> };
    if (data.v !== VERSION || !data.s) return null;
    const s = data.s as { dug: string[]; damage: [string, number][]; perm?: Partial<Perm> } & Record<string, unknown>;
    // perm は入れ子なので深めに補完（旧セーブが weaponUnlocks/mastery 等を欠いても落ちないように）。
    const base = emptyPerm();
    const perm: Perm = {
      ...base, ...(s.perm ?? {}),
      weaponSkill: { ...base.weaponSkill, ...(s.perm?.weaponSkill ?? {}) },
      mastery: { ...base.mastery, ...(s.perm?.mastery ?? {}) },
    };
    return { ...freshState(), ...s, perm, dug: new Set<string>(s.dug), damage: new Map<string, number>(s.damage) } as unknown as MineState;
  } catch { return null; }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}
