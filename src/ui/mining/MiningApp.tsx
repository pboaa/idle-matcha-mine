import { useState } from 'react';
import { useMiningTick } from '@state/useMiningTick';
import { MiningGrid } from '@ui/mining/MiningGrid';
import { MiningOverlay } from '@ui/mining/MiningOverlay';
import { MiningHud } from '@ui/mining/MiningHud';
import { MiningPrestige } from '@ui/mining/MiningPrestige';

/** 採掘モックのルート。1匹の猫が自動でグリッドを掘り、強化／転生で成長する。 */
export function MiningApp() {
  useMiningTick();
  const [showWorkshop, setShowWorkshop] = useState(false);
  return (
    <div className="flex h-full w-full flex-col items-center bg-gradient-to-b from-stone-800 to-stone-950 p-4">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-wide text-stone-300">⛏️ 抹茶猫マイン（モック）</h1>
        <button onClick={() => setShowWorkshop(true)}
          className="rounded-md bg-stone-700 px-2.5 py-1 text-[11px] font-bold text-stone-100 shadow ring-1 ring-stone-600 transition hover:bg-stone-600">
          🔧 工房 / 転生
        </button>
      </div>
      <div className="flex flex-1 items-start justify-center gap-4 overflow-auto">
        <div className="relative shrink-0">
          <MiningGrid />
          <MiningOverlay />
        </div>
        <MiningHud />
      </div>
      <p className="mt-2 text-[11px] text-stone-500">序盤は手動で3択を選ぶ（右上で自動に切替）。コイン→目利き/ブースト、鉱石→武器ごとの恒久強化、熟練度は永続。</p>

      {showWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowWorkshop(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MiningPrestige onClose={() => setShowWorkshop(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
