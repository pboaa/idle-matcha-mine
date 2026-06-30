import { useMinePrestige, useMineBuyStarNode, useMineBuyStarGridMax, type MineStarNodeVM, type MineDexEntryVM } from '@state/miningSelectors';
import { useState } from 'react';
import { formatNumber } from '@shared/format';

const starCellCls = (n: MineStarNodeVM): string =>
  n.state === 'unlocked' ? (n.root ? 'bg-amber-700/50 text-amber-100 ring-amber-500/50' : 'bg-amber-900/40 text-amber-200/80 ring-amber-700/40') // 収集済み＝薄く残す
    : n.state === 'available' ? (n.can ? 'bg-amber-500 text-stone-900 ring-amber-300 hover:bg-amber-400 active:scale-95 cursor-pointer' : 'bg-stone-700 text-amber-200/80 ring-stone-500 cursor-not-allowed')
      : 'bg-stone-900/60 text-transparent ring-stone-800/60 cursor-default'; // 未到達＝隠す

/** ★グリッド：★を使ってマスを開け、レアお宝を図鑑へ。中央から外へ広げる。 */
function StarGrid({ size, nodes, onBuy }: { size: number; nodes: readonly MineStarNodeVM[]; onBuy: (id: number) => void }) {
  return (
    <div className="mx-auto grid w-fit gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, 1.7rem)` }}>
      {nodes.map((n) => (
        <button key={n.id} disabled={!(n.state === 'available' && n.can)} onClick={() => onBuy(n.id)}
          title={!n.visible ? '未到達（隣を開けると現れる）' : `${n.emoji}${n.name}${n.root ? '（中央/起点）' : ''} ／ ${n.state === 'unlocked' ? '収集済み' : n.can ? `★${n.star}で開ける` : `★不足（★${n.star}）`}`}
          style={{ height: '1.7rem' }}
          className={['flex flex-col items-center justify-center rounded-[3px] text-[12px] leading-none ring-1 transition', starCellCls(n)].join(' ')}>
          {n.visible && <span>{n.state === 'unlocked' ? n.emoji : '✦'}</span>}
          {n.visible && n.state !== 'unlocked' && <span className="text-[7px] leading-none opacity-90">⭐{n.star}</span>}
        </button>
      ))}
    </div>
  );
}

/** お宝図鑑：全100種。収集済みは絵文字、未収集は❓（レアは枠色）。 */
function DexBook({ entries }: { entries: readonly MineDexEntryVM[] }) {
  return (
    <div className="grid grid-cols-10 gap-0.5">
      {entries.map((e) => (
        <div key={e.id} title={e.collected ? `${e.emoji}${e.name}（${e.rarity === 'rare' ? 'レア' : 'ノーマル'}）／ ${e.text}` : `未収集（${e.rarity === 'rare' ? 'レア=★グリッド' : 'ノーマル=採掘'}）`}
          className={['flex h-[1.5rem] items-center justify-center rounded-[3px] text-[12px] leading-none ring-1',
            e.collected ? (e.rarity === 'rare' ? 'bg-amber-800/40 ring-amber-500/50' : 'bg-stone-700/50 ring-stone-500/40') : 'bg-stone-900/60 text-stone-700 ring-stone-800/60'].join(' ')}>
          {e.collected ? e.emoji : (e.rarity === 'rare' ? '✦' : '·')}
        </div>
      ))}
    </div>
  );
}

/** 強化ツリー画面: ★残高／★グリッド（レアお宝）／お宝図鑑（全100種）。 */
export function MiningTree({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  const buyStarNode = useMineBuyStarNode();
  const buyStarGridMax = useMineBuyStarGridMax();
  const [tab, setTab] = useState<'grid' | 'dex'>('grid');

  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🌳 強化（お宝図鑑）<span className="ml-2 text-[10px] font-normal text-stone-400">★でレアお宝・採掘でノーマルお宝</span></h2>
        <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
      </div>

      {/* ★残高＋累計★×倍率 */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-600/40">
        <div className="text-[12px] text-amber-100">⭐ ★残高 <b className="text-amber-200">{formatNumber(p.starPoints)}</b><span className="ml-1 text-[10px] font-normal text-amber-300/70">（★グリッドで消費）</span></div>
        <div className="text-right text-[10px] text-amber-300/80">累計★ {formatNumber(p.starTotal)}<br /><span className="text-amber-200">全体ダメージ ×{p.dmgMult.toFixed(2)}</span></div>
      </div>

      {/* 図鑑の収集効果（累積） */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-yellow-950/40 p-2 text-[11px] ring-1 ring-yellow-700/30">
        <span className="text-[10px] text-yellow-300/80">📒 図鑑 {p.dex.collected}/{p.dex.total}（ノーマル {p.dex.normalCollected}/{p.dex.normalTotal}・レア {p.dex.rareCollected}/{p.dex.rareTotal}）</span>
        {p.dex.effects.length === 0 ? <span className="text-[10px] text-stone-600">まだ効果なし</span>
          : p.dex.effects.map((s) => <span key={s.label} title={s.label} className="text-yellow-100">{s.emoji}<b className="text-yellow-300">{s.text}</b></span>)}
      </div>

      {/* タブ: ★グリッド / 図鑑一覧 */}
      <div className="flex gap-1">
        {(['grid', 'dex'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={['rounded-md px-3 py-1 text-[11px] font-bold transition', tab === t ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-200 hover:bg-stone-600'].join(' ')}>
            {t === 'grid' ? '✦ ★グリッド（レア）' : '📒 図鑑一覧'}
          </button>
        ))}
      </div>

      {tab === 'grid' ? (
        <div className="rounded-md bg-amber-950/30 p-2 ring-1 ring-amber-800/30">
          <div className="mb-1 flex items-center justify-between text-[10px] text-amber-300/80">
            <span>★を使ってマスを開け、レアお宝を集める（中央から外へ・コストは外周ほど高い）</span>
            <button onClick={buyStarGridMax} disabled={!p.starGrid.anyBuyable}
              className={['rounded px-2 py-0.5 text-[10px] font-bold shadow transition', p.starGrid.anyBuyable ? 'bg-amber-500 text-stone-900 hover:bg-amber-400 active:scale-95' : 'cursor-not-allowed bg-stone-700 text-stone-500'].join(' ')}>
              ⏫ 一気に開ける
            </button>
          </div>
          <StarGrid size={p.starGrid.size} nodes={p.starGrid.nodes} onBuy={buyStarNode} />
        </div>
      ) : (
        <div className="rounded-md bg-stone-800/40 p-2 ring-1 ring-stone-700/40">
          <div className="mb-1 text-[10px] text-stone-400">全{p.dex.total}種。ノーマルは採掘で、レア(✦)は★グリッドで集まる。</div>
          <DexBook entries={p.dex.entries} />
        </div>
      )}
    </div>
  );
}
