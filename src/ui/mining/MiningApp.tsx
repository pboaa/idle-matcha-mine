import { useState } from 'react';
import { useMiningTick } from '@state/useMiningTick';
import { MiningGrid } from '@ui/mining/MiningGrid';
import { MiningOverlay } from '@ui/mining/MiningOverlay';
import { MiningHud } from '@ui/mining/MiningHud';
import { MiningPrestige } from '@ui/mining/MiningPrestige';
import { MiningTree } from '@ui/mining/MiningTree';
import { MiningHelp } from '@ui/mining/MiningHelp';

/** 採掘モックのルート。1匹の猫が自動でグリッドを掘り、転生＝★獲得→転生ツリーで成長する。 */
export function MiningApp() {
  useMiningTick();
  const [modal, setModal] = useState<null | 'prestige' | 'tree' | 'help'>(null);
  const close = (): void => setModal(null);
  return (
    <div className="flex h-full w-full flex-col items-center bg-gradient-to-b from-stone-800 to-stone-950 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-sm font-bold tracking-wide text-stone-300">⛏️ 抹茶猫マイン</h1>
        <button onClick={() => setModal('prestige')}
          className="rounded-md bg-fuchsia-800 px-2.5 py-1 text-[11px] font-bold text-fuchsia-100 shadow ring-1 ring-fuchsia-600 transition hover:bg-fuchsia-700">
          🔄 転生
        </button>
        <button onClick={() => setModal('tree')}
          className="rounded-md bg-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-100 shadow ring-1 ring-emerald-600 transition hover:bg-emerald-700">
          🌳 強化ツリー
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
      <p className="mt-2 text-[11px] text-stone-500">手動で3択を選び猫を誘導（右上で自動に切替）。鉱石→転生ツリー、★→全体ダメージ。詳しくは ❓遊び方。</p>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div onClick={(e) => e.stopPropagation()}>
            {modal === 'prestige'
              ? <MiningPrestige onClose={close} onOpenTree={() => setModal('tree')} />
              : modal === 'help'
                ? <MiningHelp onClose={close} />
                : <MiningTree onClose={close} />}
          </div>
        </div>
      )}
    </div>
  );
}
