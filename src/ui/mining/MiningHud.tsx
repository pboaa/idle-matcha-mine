import { useMineHud, useMinePickRunFree, useMineBuyRunUnlock, useMineRerollRun, type MineRunGridVM, type MineRunNodeVM } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

const runCellCls = (n: MineRunNodeVM): string =>
  n.state === 'unlocked'
    ? (n.special ? 'bg-fuchsia-900/40 text-fuchsia-200/70 ring-fuchsia-700/40' : 'bg-stone-700/40 text-stone-300/60 ring-stone-600/40') // 取得済み＝薄く残す
    : n.state === 'available'
      ? (n.special ? 'bg-fuchsia-500 text-stone-900 ring-fuchsia-300 hover:bg-fuchsia-400 active:scale-95 cursor-pointer' : 'bg-amber-400 text-stone-900 ring-amber-200 hover:bg-amber-300 active:scale-95 cursor-pointer')
      : 'bg-stone-900/60 text-transparent ring-stone-800/50 cursor-default'; // 未到達＝隠す

/** 走行グリッド（その周だけ・ランダム）。レベルアップで1マス無料解放／コインで即時解放・リロール。 */
function RunGridView({ g, onPick }: { g: MineRunGridVM; onPick: (i: number) => void }) {
  const cell = g.size >= 9 ? '1.4rem' : '1.6rem';
  return (
    <div className="flex flex-col gap-1 rounded-md bg-stone-800/60 p-2 ring-1 ring-amber-700/30">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-amber-200">🎁 走行グリッド</span>
        <span className={g.freePicks > 0 ? 'rounded bg-amber-500 px-1.5 text-[10px] font-bold text-stone-900' : 'text-[10px] text-stone-500'}>
          解放権 ×{g.freePicks}
        </span>
      </div>
      <div className="mx-auto grid w-fit gap-0.5" style={{ gridTemplateColumns: `repeat(${g.size}, ${cell})` }}>
        {g.nodes.map((n) => (
          <button key={n.index} disabled={n.state !== 'available'} onClick={() => onPick(n.index)} style={{ height: cell }}
            title={!n.visible ? '未到達（隣を解放すると現れる）' : `${n.label}${n.special ? '（特殊）' : ''}${n.state === 'unlocked' ? '・取得済み' : g.freePicks > 0 ? '・クリックで解放(無料)' : `・🪙${formatNumber(g.coinCost)}で解放`}`}
            className={['flex items-center justify-center rounded-[3px] text-[12px] leading-none ring-1 transition', n.special && n.visible ? 'ring-2' : '', runCellCls(n)].join(' ')}>
            {n.visible && <span>{n.state === 'unlocked' ? n.emoji : n.emoji}</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-stone-400">
        <span>{g.freePicks > 0 ? 'マスをクリックで解放' : `クリックで 🪙${formatNumber(g.coinCost)} 解放`}</span>
        <button onClick={() => onPick(-1)} disabled={!g.rerollCan}
          className={['rounded px-1.5 py-0.5 text-[10px] font-bold transition', g.rerollCan ? 'bg-sky-500 text-stone-900 hover:bg-sky-400' : 'cursor-not-allowed bg-stone-700 text-stone-500'].join(' ')}>
          🔄リロール 🪙{formatNumber(g.rerollCost)}
        </button>
      </div>
      {g.stats.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 border-t border-stone-700/50 pt-1 text-[11px]">
          {g.stats.map((s) => <span key={s.label} title={s.label} className="text-amber-100">{s.emoji}<b className="text-amber-300">×{s.count}</b></span>)}
        </div>
      )}
    </div>
  );
}

/** 採掘ダッシュボード（脇）: 所持武器／ダメージ内訳／走行グリッド。 */
export function MiningHud() {
  const hud = useMineHud();
  const pickFree = useMinePickRunFree();
  const buyUnlock = useMineBuyRunUnlock();
  const reroll = useMineRerollRun();

  const onPick = (i: number): void => {
    if (i < 0) { reroll(); return; }
    if (hud.runGrid.freePicks > 0) pickFree(i);
    else buyUnlock(i);
  };

  return (
    <div className="flex w-64 flex-col items-stretch gap-2">
      {/* 所持武器 */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-[10px] text-stone-500">装備</span>
        {hud.weapons.map((w) => <span key={w.label} title={w.detail} className="cursor-help text-stone-100">{w.emoji}<span className="ml-0.5 text-[10px] text-stone-400">{w.label}</span></span>)}
      </div>

      {/* 走行グリッド */}
      <RunGridView g={hud.runGrid} onPick={onPick} />

      {/* 武器ごとのダメージ寄与＋強化の威力倍率 */}
      {(hud.damageShare.length > 0 || hud.damageMods.length > 0) && (
        <div className="flex flex-col gap-1 rounded-md bg-stone-800/60 p-1.5">
          {hud.damageShare.length > 0 && (
            <>
              <div className="text-[10px] text-stone-500">武器別ダメージ内訳</div>
              {hud.damageShare.map((d) => (
                <div key={d.label} className="flex items-center gap-1 text-[11px]">
                  <span className="w-5 text-center">{d.emoji}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-700">
                    <span className="block h-full bg-rose-400" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-9 text-right text-stone-300">{d.pct.toFixed(0)}%</span>
                </div>
              ))}
            </>
          )}
          {hud.damageMods.length > 0 && (
            <>
              <div className="mt-0.5 text-[10px] text-stone-500">強化の威力影響</div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {hud.damageMods.map((m) => (
                  <span key={m.label} title={`${m.label}：${m.scope}を ×${m.mult.toFixed(2)}`} className="text-[11px] text-emerald-300">
                    {m.emoji}<span className="text-stone-400">{m.scope}</span> ×{m.mult.toFixed(2)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
