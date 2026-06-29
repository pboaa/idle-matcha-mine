import { useMinePrestige, useMinePrestigeAct, useMineResetData } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

/** 転生画面（シンプル）: 今回の獲得予定★を確認して転生するだけ。強化は「転生ツリー」で。 */
export function MiningPrestige({ onClose, onOpenTree }: { onClose: () => void; onOpenTree: () => void }) {
  const p = useMinePrestige();
  const doPrestige = useMinePrestigeAct();
  const resetData = useMineResetData();

  return (
    <div className="flex w-[22rem] flex-col gap-3 rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🔄 転生</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">転生 {p.prestiges}回</span>
          <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
        </div>
      </div>

      {/* 今回の獲得予定★ */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg bg-amber-950/40 p-3 ring-1 ring-amber-700/40">
        <span className="text-[11px] text-amber-300/80">この走行で もらえる ★（全体ダメージが自動UP）</span>
        <span className="text-2xl font-bold text-amber-200">+{formatNumber(p.runPoints)} ⭐</span>
        <span className="text-[10px] text-stone-400">累計★ {formatNumber(p.starEarned)} → {formatNumber(p.starEarned + p.runPoints)}</span>
      </div>

      {/* 使った武器の熟練度が+1（恒久・転生を重ねるほど強くなる） */}
      {p.masteryGains.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-rose-950/30 p-2 text-[11px] text-rose-100 ring-1 ring-rose-800/40">
          <span className="text-[10px] text-rose-300/80">🗡️ 熟練度 +1（使った武器）</span>
          {p.masteryGains.map((m) => <span key={m.id}>{m.emoji}<b className="text-rose-300">{m.from}→{m.to}</b></span>)}
        </div>
      )}

      <button onClick={doPrestige} disabled={p.runPoints <= 0}
        className={['rounded-lg px-2 py-2 text-sm font-bold text-white shadow ring-2 transition active:scale-95', p.runPoints > 0 ? 'bg-fuchsia-600 ring-fuchsia-300 hover:bg-fuchsia-500' : 'cursor-not-allowed bg-stone-700 ring-stone-600'].join(' ')}>
        🔄 転生する（★獲得 ／ 階・Lv・コインはリセット、鉱石・恒久は保持）
      </button>
      {p.runPoints <= 0 && <div className="text-center text-[10px] text-stone-500">レベルアップ・階を進めると★が貯まります</div>}

      <button onClick={onOpenTree}
        className="rounded-lg bg-emerald-700 px-2 py-1.5 text-[12px] font-bold text-emerald-100 shadow ring-1 ring-emerald-500/50 transition hover:bg-emerald-600">
        🌳 転生ツリーを開く（★で強化）
      </button>

      {/* データ: 自動セーブ＋削除 */}
      <div className="flex items-center justify-between border-t border-stone-700 pt-2 text-[10px] text-stone-500">
        <span>💾 自動セーブ中</span>
        <button onClick={() => { if (window.confirm('セーブを削除して最初からやり直します。よろしいですか？')) resetData(); }}
          className="rounded bg-stone-800 px-2 py-0.5 text-rose-300 ring-1 ring-rose-900/60 hover:bg-stone-700">
          🗑️ データ削除
        </button>
      </div>
    </div>
  );
}
