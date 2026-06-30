import { initialMineState, emptyPerm, type MineState, type Perm } from '@application/mining/mineState';
import { defaultMiningBalance } from '@domain/mining/balance';

const KEY = 'idle-matcha-mine/save';
const VERSION = 12; // 仕様変更でセーブ形式が変わったら上げる（旧セーブは破棄）。v12=お宝を武器別(持込中のみドロップ・個別/全体強化)・常に自動

/** 新規ゲーム状態（走行ごとに開始武器が変わる・常に自動）。 */
export function freshState(): MineState {
  return { ...initialMineState(defaultMiningBalance, (Math.random() * 0x7fffffff) | 0), autoMode: true };
}

/** state を保存形式のJSON文字列に（dug Set / damage Map を配列化＋実時刻t）。 */
function serialize(state: MineState): string {
  return JSON.stringify({ v: VERSION, t: Date.now(), s: { ...state, dug: [...state.dug], damage: [...state.damage] } });
}
/** 保存JSON文字列を MineState に復元（バージョン不一致・破損は null）。新フィールドはフレッシュ値で補完。 */
function deserialize(raw: string): MineState | null {
  try {
    const data = JSON.parse(raw) as { v?: number; s?: Record<string, unknown> };
    if (data.v !== VERSION || !data.s) return null;
    const s = data.s as { dug: string[]; damage: [string, number][]; perm?: Partial<Perm> } & Record<string, unknown>;
    const base = emptyPerm(); // perm は配列が入るので欠損フィールドを補完（落ちないように）。
    const perm: Perm = {
      ...base, ...(s.perm ?? {}),
      unlockedWeapons: Array.isArray(s.perm?.unlockedWeapons) ? s.perm.unlockedWeapons : base.unlockedWeapons,
      dex: (s.perm?.dex && typeof s.perm.dex === 'object' && !Array.isArray(s.perm.dex)) ? s.perm.dex : {},
    };
    return { ...freshState(), ...s, perm, dug: new Set<string>(s.dug), damage: new Map<string, number>(s.damage) } as unknown as MineState;
  } catch { return null; }
}

/** JSON保存（実時刻tも記録＝オフライン進行用）。localStorage不可なら黙って無視。 */
export function saveState(state: MineState): void {
  try { localStorage.setItem(KEY, serialize(state)); } catch { /* 容量超過/プライベートモード等は無視 */ }
}

/** セーブを文字列で書き出し（base64・エクスポート/共有用）。 */
export function exportSave(state: MineState): string {
  try { return btoa(unescape(encodeURIComponent(serialize(state)))); } catch { return ''; }
}
/** 書き出した文字列からセーブを読み込み（base64 or 生JSON）。不正なら null。 */
export function importSave(text: string): MineState | null {
  const raw = text.trim();
  if (!raw) return null;
  let json = raw;
  try { json = decodeURIComponent(escape(atob(raw))); } catch { /* base64でなければ生JSONとして扱う */ }
  return deserialize(json);
}

/** 前回セーブからの経過ms（オフライン進行の追いつき用）。保存が無い/不正なら0。 */
export function loadElapsedMs(): number {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return 0;
    const data = JSON.parse(raw) as { v?: number; t?: number };
    if (data.v !== VERSION || typeof data.t !== 'number') return 0;
    return Math.max(0, Date.now() - data.t);
  } catch { return 0; }
}

/** 保存済みがあれば復元（バージョン不一致・破損は null）。 */
export function loadState(): MineState | null {
  try { const raw = localStorage.getItem(KEY); return raw ? deserialize(raw) : null; } catch { return null; }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}
