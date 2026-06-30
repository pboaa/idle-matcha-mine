import { useMinePrestige, useMinePrestigeAct, useMineStartRun, useMineUnlockWeapon, useMineResetData, useMineExportSave, useMineImportSave } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

/** 転生画面: ★残高／今回の獲得予定★／開始武器の選択・武器の★解放／転生ツリーへ。 */
export function MiningPrestige({ onClose, onOpenTree }: { onClose: () => void; onOpenTree: () => void }) {
  const p = useMinePrestige();
  const doPrestige = useMinePrestigeAct();
  const startRun = useMineStartRun();
  const unlockWeapon = useMineUnlockWeapon();
  const resetData = useMineResetData();
  const exportSave = useMineExportSave();
  const importSave = useMineImportSave();
  const onExport = (): void => {
    const code = exportSave();
    navigator.clipboard?.writeText(code).then(() => window.alert('セーブをクリップボードにコピーしました（テスト用に保存/共有できます）'),
      () => window.prompt('セーブ文字列（コピーしてください）', code));
  };
  const onImport = (): void => {
    const text = window.prompt('セーブ文字列を貼り付け（上書きされます）');
    if (text == null) return;
    window.alert(importSave(text) ? '読み込みました' : '読み込めませんでした（文字列が不正です）');
  };
  const onStart = (w: string): void => {
    if (window.confirm('開始武器を変えて、今の走行をやり直します（潜り直し）。よろしいですか？')) startRun(w as never);
  };

  return (
    <div className="flex w-[22rem] flex-col gap-3 rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🔄 転生</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">転生 {p.prestiges}回</span>
          <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
        </div>
      </div>

      {/* ★残高（消費）＋累計★（消費しても減らない・全体倍率）＋今回の獲得予定★ */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg bg-amber-950/40 p-3 ring-1 ring-amber-700/40">
        <span className="text-[11px] text-amber-300/80">★残高（恒久グリッド・武器解放に使う）</span>
        <span className="text-2xl font-bold text-amber-200">{formatNumber(p.starPoints)} ⭐</span>
        <span className="text-[10px] text-stone-400">この走行で +{formatNumber(p.runPoints)} → {formatNumber(p.starPoints + p.runPoints)}</span>
        <span className="mt-1 text-[10px] text-amber-300/80">累計★ {formatNumber(p.starTotal)} ＝ 全体ダメージ <b className="text-amber-200">×{p.dmgMult.toFixed(2)}</b> <span className="text-stone-500">（消費しても減らない）</span></span>
      </div>

      {/* 開始武器の選択（つるはしは常時＋選んだ1種） */}
      <div className="flex flex-col gap-1 rounded-lg bg-sky-950/40 p-2 ring-1 ring-sky-700/40">
        <div className="text-[11px] text-sky-100">🗡️ 開始武器（つるはし⛏️＋選んだ1種）</div>
        <div className="flex flex-wrap gap-1.5">
          <div className="flex items-center gap-0.5 rounded-md bg-stone-700 px-2 py-1 text-[14px] leading-none text-stone-100" title="つるはしは常時装備">⛏️<span className="text-[9px] text-stone-400">常時</span></div>
          {p.startOptions.map((o) => (
            <button key={o.id} onClick={() => onStart(o.id)} title={`${o.label} を開始武器にする（潜り直し）`}
              className={['flex items-center gap-0.5 rounded-md px-2 py-1 text-[14px] leading-none transition', o.selected ? 'bg-amber-400 text-stone-900 ring-1 ring-amber-200' : 'bg-stone-700 text-stone-100 hover:bg-stone-600'].join(' ')}>
              {o.emoji}{o.selected && <span className="text-[9px]">選択中</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 武器の解放（★で購入） */}
      <div className="flex flex-col gap-1 rounded-lg bg-fuchsia-950/30 p-2 ring-1 ring-fuchsia-800/40">
        <div className="text-[11px] text-fuchsia-100">🔓 武器を★で解放</div>
        <div className="flex flex-wrap gap-1.5">
          {p.unlocks.map((u) => (
            <button key={u.id} disabled={u.status !== 'locked' || !u.can} onClick={() => unlockWeapon(u.id)}
              title={u.status === 'base' ? `${u.label}（最初から）` : u.status === 'unlocked' ? `${u.label}（解放済み）` : `${u.label}：★${u.cost}で解放（消費）`}
              className={['flex items-center gap-0.5 rounded-md px-2 py-1 text-[13px] leading-none transition',
                u.status === 'locked' ? (u.can ? 'bg-fuchsia-500 text-stone-900 ring-1 ring-fuchsia-300 hover:bg-fuchsia-400' : 'bg-stone-800 text-stone-500') : 'bg-stone-700 text-stone-100'].join(' ')}>
              {u.status === 'locked' ? '🔒' : u.status === 'base' ? '⭐' : '✅'}{u.emoji}
              {u.status === 'locked' && <span className="text-[9px] text-fuchsia-200/80">⭐{u.cost}</span>}
            </button>
          ))}
        </div>
      </div>

      <button onClick={doPrestige} disabled={p.runPoints <= 0}
        className={['rounded-lg px-2 py-2 text-sm font-bold text-white shadow ring-2 transition active:scale-95', p.runPoints > 0 ? 'bg-fuchsia-600 ring-fuchsia-300 hover:bg-fuchsia-500' : 'cursor-not-allowed bg-stone-700 ring-stone-600'].join(' ')}>
        🔄 転生する（★獲得 ／ 階・Lv・コイン・走行グリッドはリセット、恒久は保持）
      </button>
      {p.runPoints <= 0 && <div className="text-center text-[10px] text-stone-500">レベルアップ・階を進めると★が貯まります</div>}

      <button onClick={onOpenTree}
        className="rounded-lg bg-emerald-700 px-2 py-1.5 text-[12px] font-bold text-emerald-100 shadow ring-1 ring-emerald-500/50 transition hover:bg-emerald-600">
        🌳 強化ツリーを開く（★で強化）
      </button>

      {/* データ: 自動セーブ＋書き出し/読み込み＋削除 */}
      <div className="flex items-center justify-between gap-1 border-t border-stone-700 pt-2 text-[10px] text-stone-500">
        <span>💾 自動セーブ</span>
        <div className="flex gap-1">
          <button onClick={onExport} className="rounded bg-stone-800 px-2 py-0.5 text-sky-300 ring-1 ring-sky-900/60 hover:bg-stone-700">📤 書き出し</button>
          <button onClick={onImport} className="rounded bg-stone-800 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-900/60 hover:bg-stone-700">📥 読み込み</button>
          <button onClick={() => { if (window.confirm('セーブを削除して最初からやり直します。よろしいですか？')) resetData(); }}
            className="rounded bg-stone-800 px-2 py-0.5 text-rose-300 ring-1 ring-rose-900/60 hover:bg-stone-700">🗑️ 削除</button>
        </div>
      </div>
    </div>
  );
}
