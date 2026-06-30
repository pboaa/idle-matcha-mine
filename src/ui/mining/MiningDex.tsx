import { useMinePrestige, type MineDexEntryVM } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

/** お宝図鑑：全100種・個数つき。集めた数だけ✕N、未収集は薄く。レアは枠色。 */
function DexBook({ entries }: { entries: readonly MineDexEntryVM[] }) {
  return (
    <div className="grid grid-cols-10 gap-0.5">
      {entries.map((e) => (
        <div key={e.id} title={`${e.emoji}${e.name}（${e.rarity === 'rare' ? 'レア' : 'ノーマル'}）／ ${e.text}${e.count > 0 ? ` ／ ×${e.count}（重なるほど1個あたり弱まる）` : ' ／ 未入手'}`}
          className={['relative flex h-[1.7rem] items-center justify-center rounded-[3px] text-[12px] leading-none ring-1',
            e.count > 0 ? (e.rarity === 'rare' ? 'bg-amber-800/40 ring-amber-500/50' : 'bg-stone-700/50 ring-stone-500/40') : 'bg-stone-900/60 text-stone-700 ring-stone-800/60'].join(' ')}>
          {e.count > 0 ? e.emoji : (e.rarity === 'rare' ? '✦' : '·')}
          {e.count > 1 && <span className="absolute -bottom-0.5 -right-0.5 rounded bg-stone-900/80 px-0.5 text-[7px] font-bold text-amber-200">{e.count > 99 ? '99+' : e.count}</span>}
        </div>
      ))}
    </div>
  );
}

/** お宝図鑑画面: ★残高/累計★×倍率／お宝図鑑（全100種・採掘でランダム入手・重複OK）。 */
export function MiningDex({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">📒 お宝図鑑<span className="ml-2 text-[10px] font-normal text-stone-400">採掘でランダム入手（遠い/深いほどレア）</span></h2>
        <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
      </div>

      {/* ★残高＋累計★×倍率 */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-600/40">
        <div className="text-[12px] text-amber-100">⭐ ★残高 <b className="text-amber-200">{formatNumber(p.starPoints)}</b><span className="ml-1 text-[10px] font-normal text-amber-300/70">（武器の解放に使う）</span></div>
        <div className="text-right text-[10px] text-amber-300/80">累計★ {formatNumber(p.starTotal)}<br /><span className="text-amber-200">全体ダメージ ×{p.dmgMult.toFixed(2)}</span></div>
      </div>

      {/* 図鑑の収集状況＋効果（累積） */}
      <div className="flex flex-col gap-1 rounded-lg bg-yellow-950/40 p-2 ring-1 ring-yellow-700/30">
        <div className="text-[11px] text-yellow-100">
          📒 {p.dex.kinds}/{p.dex.total} 種（総 {formatNumber(p.dex.count)} 個）
          <span className="ml-1 text-[10px] text-yellow-300/80">ノーマル {p.dex.normalKinds}/{p.dex.normalTotal}・レア {p.dex.rareKinds}/{p.dex.rareTotal}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          {p.dex.effects.length === 0 ? <span className="text-[10px] text-stone-600">まだ効果なし（採掘でお宝を集めよう）</span>
            : p.dex.effects.map((s) => <span key={s.label} title={s.label} className="text-yellow-100">{s.emoji}<b className="text-yellow-300">{s.text}</b></span>)}
        </div>
      </div>

      {/* 図鑑一覧（全100種） */}
      <div className="rounded-md bg-stone-800/40 p-2 ring-1 ring-stone-700/40">
        <div className="mb-1 text-[10px] text-stone-400">全{p.dex.total}種。✦=未入手レア（遠くに埋まってる）・·=未入手ノーマル。重なるほど1個あたりの効果は弱まる（√）。</div>
        <DexBook entries={p.dex.entries} />
      </div>
    </div>
  );
}
