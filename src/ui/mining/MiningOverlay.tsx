import { useMineHud, useMineChoose, useMineToggleAuto } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

const RARITY_CLASS: Record<string, string> = {
  common: 'bg-violet-600 hover:bg-violet-500',
  rare: 'bg-amber-500 ring-2 ring-amber-300 hover:bg-amber-400',
  epic: 'bg-fuchsia-600 ring-2 ring-fuchsia-300 hover:bg-fuchsia-500',
};
const RARITY_TAG: Record<string, string> = { common: '', rare: '★レア', epic: '★★エピック' };

/** ゲーム画面（グリッド）に重ねるHUD: ステータス／レベル・進捗／レベルアップ3択（手動選択）。 */
export function MiningOverlay() {
  const hud = useMineHud();
  const choose = useMineChoose();
  const toggleAuto = useMineToggleAuto();
  const xpRatio = hud.xpNext > 0 ? hud.xp / hud.xpNext : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
      {/* 上部: コイン・階・自動/手動 */}
      <div className="flex items-start justify-between p-1.5">
        <div className="pointer-events-auto rounded-md bg-black/55 px-2 py-1 text-[13px] font-bold text-amber-300 shadow backdrop-blur-sm">
          🪙 {formatNumber(hud.coins)}
          <span className="ml-2 text-stone-200">地下 {hud.floor + 1}階</span>
          {hud.runPoints > 0 && <span className="ml-2 text-fuchsia-300" title="転生でもらえる★">⭐+{formatNumber(hud.runPoints)}</span>}
        </div>
        <button onClick={toggleAuto} title="手動: 移動も3択も自分で操作（火力100%） ／ 自動: おまかせ（火力↓・放置ツリーで回復）"
          className={['pointer-events-auto rounded-md px-2 py-1 text-[11px] font-bold shadow backdrop-blur-sm transition', hud.autoMode ? 'bg-emerald-600/90 text-white hover:bg-emerald-500' : 'bg-amber-400/90 text-stone-900 hover:bg-amber-300'].join(' ')}>
          {hud.autoMode ? `⚙️ 自動 火力${hud.autoEffPct}%` : '✋ 手動 火力100%'}
        </button>
      </div>

      <div className="flex-1" />

      {/* 手動モードのヒント（移動はクリックで誘導） */}
      {!hud.autoMode && hud.offer.length === 0 && (
        <div className="flex justify-center pb-1">
          <span className="pointer-events-none rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-amber-200 backdrop-blur-sm">✋ クリックで猫を誘導（火力100%）</span>
        </div>
      )}

      {/* 下部: Lv＋XPバー／階の掘削進捗 */}
      <div className="flex flex-col gap-1 p-1.5">
        <div className="rounded-md bg-black/45 px-2 py-1 shadow backdrop-blur-sm">
          <div className="flex justify-between text-[10px] text-stone-300"><span>Lv {hud.level}</span><span>掘削 {hud.progressPct.toFixed(0)}%</span></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-stone-700"><span className="block h-full rounded-full bg-violet-400 transition-[width] duration-150" style={{ width: `${Math.min(100, xpRatio * 100)}%` }} /></div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-stone-700"><span className="block h-full rounded-full bg-sky-400 transition-[width] duration-150" style={{ width: `${hud.progressPct}%` }} /></div>
        </div>
      </div>

      {/* 中央: レベルアップ3択（手動選択の楽しみ） */}
      {hud.offer.length > 0 && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/45 p-2">
          <div className="flex flex-col gap-2 rounded-xl bg-stone-900/95 p-3 shadow-2xl ring-2 ring-violet-400/60">
            <div className="text-center text-[12px] font-bold text-violet-200">⬆️ レベルアップ！ 強化を選ぶ</div>
            <div className="flex gap-2">
              {hud.offer.map((o) => (
                <button key={o.index} onClick={() => choose(o.index)} title={o.detail}
                  className={['flex w-[8.5rem] flex-col items-center rounded-lg px-2 py-2 text-white shadow transition active:scale-95', RARITY_CLASS[o.rarity]].join(' ')}>
                  <span className="text-3xl leading-none">{o.emoji}{o.bonusEmoji && <span className="text-base">+{o.bonusEmoji}</span>}</span>
                  <span className="mt-1 text-[12px] font-bold">{o.label}{o.rarity === 'rare' && ' ×2'}</span>
                  {RARITY_TAG[o.rarity] && <span className="text-[9px] text-yellow-100">{RARITY_TAG[o.rarity]}</span>}
                  <span className="text-[9px] opacity-80">{o.lv === 0 ? 'NEW!' : `Lv${o.lv}`}</span>
                  <span className="mt-1 text-center text-[9px] leading-tight text-white/85">{o.detail}</span>
                </button>
              ))}
            </div>
            <div className="text-center text-[9px] text-stone-400">クリックで選択（自動にすると以後おまかせ）</div>
          </div>
        </div>
      )}
    </div>
  );
}
