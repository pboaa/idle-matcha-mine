import { useState } from 'react';
import { useMiningTick } from '@state/useMiningTick';
import { MiningGrid } from '@ui/mining/MiningGrid';
import { MiningOverlay } from '@ui/mining/MiningOverlay';
import { MiningHud } from '@ui/mining/MiningHud';
import { MiningPrestige } from '@ui/mining/MiningPrestige';
import { MiningDex } from '@ui/mining/MiningDex';
import { MiningHelp } from '@ui/mining/MiningHelp';
import { APP_VERSION, BUILD_TIME } from '../../version';

/** 採掘モックのルート。1匹の猫が自動でグリッドを掘り、転生＝★獲得・採掘でお宝図鑑を集めて成長する。 */
export function MiningApp() {
  useMiningTick();
  const [modal, setModal] = useState<null | 'prestige' | 'dex' | 'help'>(null);
  const close = (): void => setModal(null);
  return (
    <div className="flex h-full w-full flex-col items-center bg-gradient-to-b from-stone-800 to-stone-950 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-sm font-bold tracking-wide text-stone-300">⛏️ 抹茶猫マイン</h1>
        <span title={`ビルド: ${BUILD_TIME} UTC`} className="rounded bg-stone-700/70 px-1.5 py-0.5 text-[10px] font-bold text-stone-300 ring-1 ring-stone-600">v{APP_VERSION}</span>
        <button onClick={() => setModal('prestige')}
          className="rounded-md bg-fuchsia-800 px-2.5 py-1 text-[11px] font-bold text-fuchsia-100 shadow ring-1 ring-fuchsia-600 transition hover:bg-fuchsia-700">
          🔄 転生
        </button>
        <button onClick={() => setModal('dex')}
          className="rounded-md bg-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-100 shadow ring-1 ring-emerald-600 transition hover:bg-emerald-700">
          📒 お宝図鑑
        </button>
        <button onClick={() => setModal('help')}
          className="rounded-md bg-stone-700 px-2.5 py-1 text-[11px] font-bold text-stone-200 shadow ring-1 ring-stone-600 transition hover:bg-stone-600">
          ❓ 遊び方
        </button>
      </div>
      <div className="flex flex-1 items-start justify-center gap-4 overflow-auto">
        <div className="relative shrink-0">
          <MiningGrid />
          <MiningOverlay />
        </div>
        <MiningHud />
      </div>
      <p className="mt-2 text-[11px] text-stone-500">最初に武器を選んで採掘。コインで走行グリッドを解放（右上で自動に切替）。採掘でお宝図鑑が集まる。詳しくは ❓遊び方。</p>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div onClick={(e) => e.stopPropagation()}>
            {modal === 'prestige'
              ? <MiningPrestige onClose={close} onOpenDex={() => setModal('dex')} />
              : modal === 'help'
                ? <MiningHelp onClose={close} />
                : <MiningDex onClose={close} />}
          </div>
        </div>
      )}
    </div>
  );
}
