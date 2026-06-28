import { useMineHud, useMineChoose, useMineToggleAuto, useMineBuyAppraise, useMineBuyBoost } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

const RARITY_CLASS: Record<string, string> = {
  common: 'bg-violet-500 hover:bg-violet-400',
  rare: 'bg-amber-500 ring-2 ring-amber-300 hover:bg-amber-400',
  epic: 'bg-fuchsia-600 ring-2 ring-fuchsia-300 hover:bg-fuchsia-500',
};
const RARITY_TAG: Record<string, string> = { common: '', rare: '★レア', epic: '★★エピック' };

/** 採掘モックのHUD（コイン／階・進捗／レベル＆3択／武器／自動モード）。 */
export function MiningHud() {
  const hud = useMineHud();
  const choose = useMineChoose();
  const toggleAuto = useMineToggleAuto();
  const buyAppraise = useMineBuyAppraise();
  const buyBoost = useMineBuyBoost();
  const xpRatio = hud.xpNext > 0 ? hud.xp / hud.xpNext : 0;

  return (
    <div className="flex w-72 flex-col items-stretch gap-2">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-amber-300">🪙 {formatNumber(hud.coins)}</div>
        <div className="text-sm font-bold text-stone-300">地下 {hud.floor + 1}階</div>
      </div>

      {/* 熟練度（周回しても消えない永続強化） */}
      <div className="flex items-center justify-between rounded-md bg-indigo-950/50 px-2 py-1 text-[11px] text-indigo-200" title="レベルアップで貯まり転生でも消えない。全武器ダメージが永続で上がる。">
        <span>🎓 熟練度 {hud.mastery.total}</span>
        <span className="text-indigo-300">威力 +{hud.mastery.pct}%（永続）</span>
      </div>

      {/* レベル＆XP */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[11px] text-stone-400"><span>Lv {hud.level}</span><span>{hud.xp}/{hud.xpNext}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-700"><span className="block h-full bg-violet-400 transition-[width] duration-150" style={{ width: `${Math.min(100, xpRatio * 100)}%` }} /></div>
      </div>

      {/* 階の掘削進捗 */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[11px] text-stone-400"><span>この階の掘削</span><span>{hud.progressPct.toFixed(1)}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-700"><span className="block h-full bg-sky-400 transition-[width] duration-150" style={{ width: `${hud.progressPct}%` }} /></div>
      </div>

      <div className="text-center text-[11px] text-stone-400">💎 掘った素材は自動で回収されます</div>

      {/* レベルアップ3択（手動モードで提示中のみ） */}
      {hud.offer.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-violet-950/60 p-2 ring-1 ring-violet-400/50">
          <div className="text-center text-[11px] font-bold text-violet-200">レベルアップ！強化を選ぶ</div>
          <div className="flex gap-1">
            {hud.offer.map((o) => (
              <button key={o.index} onClick={() => choose(o.index)} title={o.detail}
                className={['flex flex-1 flex-col items-center rounded-md px-1 py-1.5 text-[11px] font-bold text-white shadow transition active:scale-95', RARITY_CLASS[o.rarity]].join(' ')}>
                <span className="text-lg">{o.emoji}{o.bonusEmoji && <span className="text-xs">+{o.bonusEmoji}</span>}</span>
                <span>{o.label}{o.rarity === 'rare' && '×2'}</span>
                {RARITY_TAG[o.rarity] && <span className="text-[8px] text-yellow-100">{RARITY_TAG[o.rarity]}</span>}
                <span className="text-[9px] opacity-80">{o.lv === 0 ? 'NEW!' : `Lv${o.lv}`}</span>
              </button>
            ))}
          </div>
          {/* 各選択肢の詳細（数値つき） */}
          <div className="flex flex-col gap-1">
            {hud.offer.map((o) => (
              <div key={o.index} className="rounded bg-violet-900/40 px-1.5 py-1 text-[10px] leading-tight text-violet-100">
                <span className="font-bold">{o.emoji} {o.label}</span>
                {o.bonusEmoji && <span className="ml-1 text-fuchsia-300">＋おまけ {o.bonusEmoji}</span>}
                <span className="block text-violet-200/80">{o.detail}</span>
              </div>
            ))}
          </div>
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

      {/* 武器ごとのダメージ寄与＋強化の威力倍率（バランスの記録） */}
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

      <button onClick={toggleAuto}
        className={['self-start rounded-md px-2 py-0.5 text-[11px] font-bold shadow transition', hud.autoMode ? 'bg-emerald-500 text-white' : 'bg-stone-600 text-stone-200'].join(' ')}>
        自動強化 {hud.autoMode ? 'ON（コインで目利き自動購入）' : 'OFF'}
      </button>
    </div>
  );
}
