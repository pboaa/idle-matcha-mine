import { useMinePrestige, useMineBuyWeaponSkill, useMineBuyWeaponSkillMax, useMineBuyIdle, type MineSkillNodeVM, type MineTierVM, type SkillTreeTarget } from '@state/miningSelectors';
import { useState } from 'react';
import { formatNumber } from '@shared/format';

const cellCls = (n: MineSkillNodeVM): string =>
  n.state === 'unlocked' ? (n.root ? 'bg-amber-800/40 text-amber-200/70 ring-amber-600/40' : 'bg-amber-900/30 text-amber-200/60 ring-amber-700/30') // 取得済み＝薄く残す
    : n.state === 'available' ? (n.can ? 'bg-amber-500 text-stone-900 ring-amber-300 hover:bg-amber-400 active:scale-95 cursor-pointer' : 'bg-stone-700 text-amber-200/80 ring-stone-500 cursor-not-allowed')
      : 'bg-stone-900/60 text-transparent ring-stone-800/60 cursor-default'; // 未到達＝隠す（広げると現れる）

/** 1階層ぶんのグリッド：中央◎から外へ。隣接を買うと外側が現れる。★コストで購入。 */
function SkillGrid({ size, nodes, onBuy }: { size: number; nodes: readonly MineSkillNodeVM[]; onBuy: (index: number) => void }) {
  const cell = size >= 9 ? '1.45rem' : '1.7rem';
  return (
    <div className="mx-auto grid w-fit gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, ${cell})` }}>
      {nodes.map((n) => (
        <button key={n.index} disabled={!(n.state === 'available' && n.can)} onClick={() => onBuy(n.index)}
          title={!n.visible ? '未到達（隣を解放すると現れる）' : `${n.label}${n.big ? '（特殊）' : ''}${n.root ? '（中央/起点）' : ''} ／ ${n.state === 'unlocked' ? '解放済み' : n.can ? `累計★${n.star}で解放（消費しない）` : `累計★${n.star}必要`}`}
          style={{ height: cell }}
          className={['flex flex-col items-center justify-center rounded-[3px] text-[11px] leading-none ring-1 transition', n.big && n.visible ? 'ring-2' : '', cellCls(n)].join(' ')}>
          {n.visible && <span>{n.state === 'unlocked' ? (n.root ? '◎' : '✓') : n.emoji}</span>}
          {n.visible && n.state !== 'unlocked' && <span className="text-[7px] leading-none opacity-90">⭐{n.star}</span>}
        </button>
      ))}
    </div>
  );
}

/** 階層の垂直タブ（各階層＝1グリッド。サイズ5x5→13x13。未解禁はロック・終盤ほど重い）。 */
function TierTabs({ tiers, sel, onSelect }: { tiers: readonly MineTierVM[]; sel: number; onSelect: (t: number) => void }) {
  return (
    <div className="flex w-[4.2rem] shrink-0 flex-col gap-1">
      {tiers.map((t) => (
        <button key={t.tier} onClick={() => onSelect(t.tier)}
          title={t.open ? `階層${t.tier + 1}（${t.size}x${t.size}・${t.bought}/${t.total}解放${t.need ? `・次の階層へは${t.need}個` : ''}）` : `階層${t.tier + 1}：前の階層を ${t.need} 個解放で解禁`}
          className={['flex flex-col items-center rounded-md px-1 py-1.5 text-[10px] leading-tight ring-1 transition',
            sel === t.tier ? 'bg-amber-500 text-stone-900 ring-amber-300' : t.open ? 'bg-stone-700 text-stone-200 ring-stone-600 hover:bg-stone-600' : 'bg-stone-800 text-stone-500 ring-stone-700'].join(' ')}>
          <span className="font-bold">{t.open ? `階層${t.tier + 1}` : `🔒${t.tier + 1}`}</span>
          <span className="text-[8px] opacity-90">{t.size}x{t.size}</span>
          <span className="text-[8px] opacity-90">{t.bought}/{t.total}</span>
        </button>
      ))}
    </div>
  );
}

/** 強化ツリー画面: ★残高／放置ツリー（★）／武器スキルツリー・メイン（階層ごとにグリッド・★で購入）。 */
export function MiningTree({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  const buyWeaponSkill = useMineBuyWeaponSkill();
  const buyWeaponSkillMax = useMineBuyWeaponSkillMax();
  const buyIdle = useMineBuyIdle();
  const [weaponSel, setWeaponSel] = useState<SkillTreeTarget>('pick');
  const [tierSel, setTierSel] = useState(0);
  const wt = p.weaponTree.find((w) => w.id === weaponSel) ?? p.weaponTree[0]!;
  const tier = wt.tiers[tierSel] ?? wt.tiers[0]!;
  const tierNodes = wt.skillNodes.filter((n) => n.tier === tierSel);

  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🌳 強化ツリー<span className="ml-2 text-[10px] font-normal text-stone-400">★で恒久強化（転生で貯まる）</span></h2>
        <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
      </div>

      {/* ★残高 */}
      <div className="flex items-center justify-between rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-600/40">
        <div className="text-[12px] text-amber-100">⭐ 累計★</div>
        <div className="text-[13px] font-bold text-amber-200">{formatNumber(p.starEarned)} <span className="text-[10px] font-normal text-amber-300/70">（増える一方・必要値に達したマスが解放可／消費しない）</span></div>
      </div>

      {/* 放置ツリー（★で自動効率を100%へ） */}
      <div className="flex items-center justify-between rounded-lg bg-emerald-950/40 p-2 ring-1 ring-emerald-700/40">
        <div className="text-[12px] text-emerald-100">
          🌙 放置ツリー Lv{p.idle.lv}/{p.idle.maxLv}
          <span className="ml-1 text-[10px] text-emerald-300/80">自動モードの火力 {p.idle.autoEffPct}%（手動は常に100%）</span>
        </div>
        <button onClick={buyIdle} disabled={!p.idle.can}
          className={['rounded-md px-2 py-1 text-[11px] font-bold shadow transition', p.idle.maxed ? 'bg-emerald-700 text-emerald-200' : p.idle.can ? 'bg-emerald-400 text-stone-900 hover:bg-emerald-300' : 'cursor-not-allowed bg-stone-700 text-stone-400'].join(' ')}>
          {p.idle.maxed ? 'MAX(100%)' : <>⭐{formatNumber(p.idle.cost ?? 0)}</>}
        </button>
      </div>

      {/* 武器ごとの強化＋メイン（階層ごとに1グリッド・タブ切替・中央から外へ広げる） */}
      <div>
        <div className="mb-1 text-[10px] text-stone-500">武器ごと／全体(🌐)の強化（階層＝グリッド。中央から外へ・前の階層を一定数で次が解禁・★で購入）</div>
        <div className="mb-1 flex flex-wrap gap-1">
          {p.weaponTree.map((w) => (
            <button key={w.id} onClick={() => { setWeaponSel(w.id); setTierSel(0); }} title={w.label}
              className={['relative rounded-md px-2 py-1 text-[14px] leading-none transition', weaponSel === w.id ? 'bg-amber-400 ring-1 ring-amber-200' : 'bg-stone-700 hover:bg-stone-600'].join(' ')}>
              {w.emoji}
            </button>
          ))}
        </div>
        <div className="rounded-md bg-amber-950/30 p-1.5 ring-1 ring-amber-800/30">
          <div className="mb-1 flex items-center justify-between text-[10px] text-amber-300/80">
            <span>{wt.emoji} {wt.label} <span className="text-stone-400">解放 {wt.skillUnlocked}/{wt.skillTotal}</span></span>
            <button onClick={() => buyWeaponSkillMax(wt.id)}
              className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-stone-900 shadow transition hover:bg-amber-400 active:scale-95">
              ⏫ 一気に上げる
            </button>
          </div>
          {/* 強化された内容（累積） */}
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded bg-stone-900/50 px-1.5 py-1 text-[11px]">
            {wt.stats.length === 0
              ? <span className="text-[10px] text-stone-600">まだ強化なし</span>
              : wt.stats.map((s) => <span key={s.label} title={s.label} className="text-amber-100">{s.emoji}<b className="text-amber-300">{s.text}</b></span>)}
          </div>
          {/* 垂直タブ（階層）＋ 選択中の階層のグリッド */}
          <div className="flex gap-2">
            <TierTabs tiers={wt.tiers} sel={tierSel} onSelect={setTierSel} />
            <div className="min-w-0 flex-1">
              {!tier.open && <div className="mb-1 rounded bg-stone-800/60 px-2 py-1 text-[10px] text-stone-400">🔒 前の階層を {tier.need} 個解放すると解禁（このグリッドが開く）</div>}
              <SkillGrid size={tier.size} nodes={tierNodes} onBuy={(i) => buyWeaponSkill(wt.id, i)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
