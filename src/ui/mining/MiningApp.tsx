import { useState } from 'react';
import { useMiningTick } from '@state/useMiningTick';
import { useMiningStore } from '@state/miningStore';
import { MiningGrid } from '@ui/mining/MiningGrid';
import { MiningOverlay } from '@ui/mining/MiningOverlay';
import { MiningHud } from '@ui/mining/MiningHud';
import { MiningPrestige } from '@ui/mining/MiningPrestige';
import { MiningTree } from '@ui/mining/MiningTree';

/** 採掘モックのルート。1匹の猫が自動でグリッドを掘り、転生＝★獲得→転生ツリーで成長する。 */
export function MiningApp() {
  useMiningTick();
  const prestiges = useMiningStore((s) => s.state.prestiges);
  const [modal, setModal] = useState<null | 'prestige' | 'tree'>(null);
  const close = (): void => setModal(null);
  return (
    <div className="flex h-full w-full flex-col items-center bg-gradient-to-b from-stone-800 to-stone-950 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-sm font-bold tracking-wide text-stone-300">⛏️ 抹茶猫マイン</h1>
        <button onClick={() => setModal('prestige')}
          className="rounded-md bg-fuchsia-800 px-2.5 py-1 text-[11px] font-bold text-fuchsia-100 shadow ring-1 ring-fuchsia-600 transition hover:bg-fuchsia-700">
          🔄 転生
        </button>
        {prestiges > 0 && (
          <button onClick={() => setModal('tree')}
            className="rounded-md bg-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-100 shadow ring-1 ring-emerald-600 transition hover:bg-emerald-700">
            🌳 転生ツリー
          </button>
        )}
      </div>
      <div className="flex flex-1 items-start justify-center gap-4 overflow-auto">
        <div className="relative shrink-0">
          <MiningGrid />
          <MiningOverlay />
        </div>
        <MiningHud />
      </div>
      <p className="mt-2 text-[11px] text-stone-500">序盤は手動で3択を選ぶ（右上で自動に切替）。転生で★獲得→転生ツリーで強化。コイン→目利き/ブースト。</p>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div onClick={(e) => e.stopPropagation()}>
            {modal === 'prestige'
              ? <MiningPrestige onClose={close} onOpenTree={() => setModal('tree')} />
              : <MiningTree onClose={close} />}
          </div>
        </div>
      )}
    </div>
  );
}
