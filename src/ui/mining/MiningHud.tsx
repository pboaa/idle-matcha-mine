import { useMineHud, useMineBuyAppraise, useMineBuyBoost } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

/** 採掘ダッシュボード（脇）: 熟練度／所持武器・強化／ダメージ内訳／コインの使い道。ステータスと3択は画面内オーバーレイ側。 */
export function MiningHud() {
  const hud = useMineHud();
  const buyAppraise = useMineBuyAppraise();
  const buyBoost = useMineBuyBoost();

  return (
    <div className="flex w-64 flex-col items-stretch gap-2">
      {/* 熟練度（武器ごと・転生時に上がる永続強化） */}
      {hud.mastery.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-indigo-950/50 px-2 py-1 text-[11px] text-indigo-200" title="武器ごとに転生時+10%。合計で移動速度・射程も永続UP。">
          <span className="text-indigo-300">🎓 熟練</span>
          {hud.mastery.perWeapon.map((w) => <span key={w.label} title={`${w.label} 熟練Lv${w.lv}：ダメージ +${w.pct}%`}>{w.emoji}<b className="text-indigo-100">+{w.pct}%</b></span>)}
          <span className="text-indigo-400">🏃+{hud.mastery.movePct}% 📏+{hud.mastery.rangeBonus}</span>
        </div>
      )}

      {/* 所持武器＋強化（所持数制限つき） */}
      <div className="flex flex-col gap-1 text-[12px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-stone-500">武器 {hud.weaponSlots}</span>
          {hud.weapons.map((w) => <span key={w.label} title={w.detail} className="cursor-help text-stone-100">{w.emoji}<b className="text-amber-300">{w.lv}</b></span>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-stone-500">強化 {hud.passiveSlots}</span>
          {hud.passives.map((w) => <span key={w.label} title={w.detail} className="cursor-help text-stone-300">{w.emoji}{w.lv}</span>)}
        </div>
      </div>

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

      {/* コインの使い道: 目利き（レアが出やすく）＋採掘ブースト（走行中の威力UP） */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between rounded-md bg-stone-800/60 p-1.5">
          <div className="text-[11px] text-stone-300">
            🔎 目利き Lv{hud.meta.appraiseLv}
            <span className="ml-1 text-[10px] text-stone-500">レア{hud.meta.rarePct}% / エピック{hud.meta.epicPct}%</span>
          </div>
          <button onClick={buyAppraise} disabled={!hud.meta.canAppraise}
            className={['rounded-md px-2 py-0.5 text-[11px] font-bold shadow transition', hud.meta.canAppraise ? 'bg-amber-400 text-stone-900 hover:bg-amber-300' : 'cursor-not-allowed bg-stone-700 text-stone-400'].join(' ')}>
            {hud.meta.appraiseMaxed ? 'MAX' : <>🪙{formatNumber(hud.meta.appraiseCost)}</>}
          </button>
        </div>
        <div className="flex items-center justify-between rounded-md bg-stone-800/60 p-1.5">
          <div className="text-[11px] text-stone-300">
            🔥 採掘ブースト Lv{hud.boost.lv}
            <span className="ml-1 text-[10px] text-stone-500">威力 +{hud.boost.pct}%（この潜りだけ）</span>
          </div>
          <button onClick={buyBoost} disabled={!hud.boost.can}
            className={['rounded-md px-2 py-0.5 text-[11px] font-bold shadow transition', hud.boost.can ? 'bg-orange-400 text-stone-900 hover:bg-orange-300' : 'cursor-not-allowed bg-stone-700 text-stone-400'].join(' ')}>
            🪙{formatNumber(hud.boost.cost)}
          </button>
        </div>
      </div>
    </div>
  );
}
