import { useMinePrestige, type MineDexEntryVM, type WeaponId } from '@state/miningSelectors';
import { useState } from 'react';
import { formatNumber } from '@shared/format';

/** お宝図鑑：個数つき。集めた数だけ✕N、未収集は薄く。レアリティで枠色・武器絵文字つき。 */
function DexBook({ entries }: { entries: readonly MineDexEntryVM[] }) {
  return (
    <div className="grid grid-cols-10 gap-0.5">
      {entries.map((e) => (
        <div key={e.id} title={`${e.emoji}${e.name}／${e.rarityLabel}・${e.weaponEmoji}持込${e.scope === 'self' ? '・武器個別' : '・全体'}／${e.text}${e.count > 0 ? `／×${e.count}（重なるほど1個あたり弱まる）` : '／未入手'}`}
          style={e.count > 0 ? { borderColor: e.color, background: `${e.color}22` } : undefined}
          className={['relative flex h-[1.7rem] items-center justify-center rounded-[3px] border text-[12px] leading-none',
            e.count > 0 ? '' : 'border-stone-800/60 bg-stone-900/60 text-stone-700'].join(' ')}>
          {e.count > 0 ? e.emoji : '·'}
          {e.count > 1 && <span className="absolute -bottom-0.5 -right-0.5 rounded bg-stone-900/80 px-0.5 text-[7px] font-bold text-amber-200">{e.count > 99 ? '99+' : e.count}</span>}
        </div>
      ))}
    </div>
  );
}

/** お宝図鑑画面: ★残高/累計★×倍率／武器ごと・レアリティ別の図鑑。 */
export function MiningDex({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  const [wsel, setWsel] = useState<WeaponId | 'all'>('all');
  const entries = wsel === 'all' ? p.dex.entries : p.dex.entries.filter((e) => e.weapon === wsel);

  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">📒 お宝図鑑<span className="ml-2 text-[10px] font-normal text-stone-400">持ち込んだ武器のお宝が採掘でドロップ</span></h2>
        <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
      </div>

      {/* ★残高＋累計★×倍率 */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-600/40">
        <div className="text-[12px] text-amber-100">⭐ ★残高 <b className="text-amber-200">{formatNumber(p.starPoints)}</b><span className="ml-1 text-[10px] font-normal text-amber-300/70">（武器の解放に使う）</span></div>
        <div className="text-right text-[10px] text-amber-300/80">累計★ {formatNumber(p.starTotal)}<br /><span className="text-amber-200">全体ダメージ ×{p.dmgMult.toFixed(2)}</span></div>
      </div>

      {/* 収集状況（レアリティ別）＋効果（累積） */}
      <div className="flex flex-col gap-1 rounded-lg bg-yellow-950/40 p-2 ring-1 ring-yellow-700/30">
        <div className="text-[11px] text-yellow-100">📒 {p.dex.kinds}/{p.dex.total} 種（総 {formatNumber(p.dex.count)} 個）</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
          {p.dex.rarities.map((r) => (
            <span key={r.id} title={`${r.label}：${r.kinds}/${r.total} 種${r.minFloor > 0 ? `（地下${r.minFloor + 1}階〜出現）` : ''}`} style={{ color: r.color }}>
              ●<span className="text-stone-300">{r.label} {r.kinds}/{r.total}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-yellow-800/30 pt-1 text-[11px]">
          {p.dex.effects.length === 0 ? <span className="text-[10px] text-stone-600">まだ効果なし（採掘でお宝を集めよう）</span>
            : p.dex.effects.map((s) => <span key={s.label} title={s.label} className="text-yellow-100">{s.emoji}<b className="text-yellow-300">{s.text}</b></span>)}
        </div>
      </div>

      {/* 武器タブ（持ち込み中は強調・各武器の収集進捗） */}
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setWsel('all')}
          className={['rounded-md px-2 py-1 text-[11px] font-bold transition', wsel === 'all' ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-200 hover:bg-stone-600'].join(' ')}>
          全{p.dex.kinds}/{p.dex.total}
        </button>
        {p.dex.weapons.map((w) => (
          <button key={w.id} onClick={() => setWsel(w.id)} title={`${w.label}${w.equipped ? '（持ち込み中＝ドロップする）' : '（未持込＝ドロップしない）'} ／ ${w.kinds}/${w.total}`}
            className={['rounded-md px-2 py-1 text-[12px] leading-none transition', wsel === w.id ? 'bg-amber-500 text-stone-900' : w.equipped ? 'bg-stone-700 text-stone-100 ring-1 ring-emerald-500/60 hover:bg-stone-600' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'].join(' ')}>
            {w.emoji}<span className="ml-0.5 text-[9px]">{w.kinds}/{w.total}</span>
          </button>
        ))}
      </div>

      {/* 図鑑一覧 */}
      <div className="rounded-md bg-stone-800/40 p-2 ring-1 ring-stone-700/40">
        <div className="mb-1 text-[10px] text-stone-400">枠色＝レアリティ。武器個別強化(その武器の絵文字)と全体強化がある。重なるほど効果は弱まる（√）。持ち込んだ武器のお宝だけドロップ。</div>
        <DexBook entries={entries} />
      </div>
    </div>
  );
}
