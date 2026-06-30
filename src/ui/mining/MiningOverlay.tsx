import { useMineHud, useMineToggleAuto } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

/** ゲーム画面（グリッド）に重ねるHUD: コイン・階・自動/手動／レベル・進捗。強化の取得は脇の走行グリッド。 */
export function MiningOverlay() {
  const hud = useMineHud();
  const toggleAuto = useMineToggleAuto();
  const xpRatio = hud.xpNext > 0 ? hud.xp / hud.xpNext : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
      {/* 上部: コイン・階・自動/手動 */}
      <div className="flex items-start justify-between p-1.5">
        <div className="pointer-events-auto rounded-md bg-black/55 px-2 py-1 text-[13px] font-bold text-amber-300 shadow backdrop-blur-sm">
          🪙 {formatNumber(hud.coins)}
          <span className="ml-2 text-stone-200">地下 {hud.floor + 1}階</span>
          {hud.dmgMult > 1.001 && <span className="ml-2 text-amber-200" title="累計★による全体ダメージ倍率（消費しても減らない）">⭐×{hud.dmgMult.toFixed(2)}</span>}
          {hud.runPoints > 0 && <span className="ml-2 text-fuchsia-300" title="転生でもらえる★">⭐+{formatNumber(hud.runPoints)}</span>}
          {hud.idleBonusPct > 0 && <span className={['ml-2', hud.idleBonusMaxed ? 'text-emerald-300' : 'text-emerald-400'].join(' ')} title="放置ボーナス: 時間で火力＆採掘速度が上昇（上限あり）">🌙+{hud.idleBonusPct}%{hud.idleBonusMaxed ? '(MAX)' : ''}</span>}
        </div>
        <button onClick={toggleAuto} title="手動: クリックで猫を誘導 ／ 自動: おまかせ移動。どちらも火力は同じ（ペナルティなし）"
          className={['pointer-events-auto rounded-md px-2 py-1 text-[11px] font-bold shadow backdrop-blur-sm transition', hud.autoMode ? 'bg-emerald-600/90 text-white hover:bg-emerald-500' : 'bg-amber-400/90 text-stone-900 hover:bg-amber-300'].join(' ')}>
          {hud.autoMode ? '⚙️ 自動' : '✋ 手動'}
        </button>
      </div>

      <div className="flex-1" />

      {/* 手動モードのヒント（移動はクリックで誘導） */}
      {!hud.autoMode && (
        <div className="flex justify-center pb-1">
          <span className="pointer-events-none rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-amber-200 backdrop-blur-sm">✋ クリックで猫を誘導（火力100%）</span>
        </div>
      )}

      {/* 下部: Lv＋XPバー／階の掘削進捗 */}
      <div className="flex flex-col gap-1 p-1.5">
        <div className="rounded-md bg-black/45 px-2 py-1 shadow backdrop-blur-sm">
          <div className="flex justify-between text-[10px] text-stone-300"><span>Lv {hud.level}{hud.runGrid.freePicks > 0 && <span className="ml-1 text-amber-300">🎁×{hud.runGrid.freePicks}</span>}</span><span>掘削 {hud.progressPct.toFixed(0)}%</span></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-stone-700"><span className="block h-full rounded-full bg-violet-400 transition-[width] duration-150" style={{ width: `${Math.min(100, xpRatio * 100)}%` }} /></div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-stone-700"><span className="block h-full rounded-full bg-sky-400 transition-[width] duration-150" style={{ width: `${hud.progressPct}%` }} /></div>
        </div>
      </div>
    </div>
  );
}
