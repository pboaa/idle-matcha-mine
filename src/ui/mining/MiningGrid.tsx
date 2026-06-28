import { useMineView } from '@state/miningSelectors';

const CELL = 30;

function Cracks({ stage }: { stage: number }) {
  if (stage <= 0) return null;
  const lines = ['M50 0 L45 40 L55 60 L48 100', 'M0 45 L40 52 L60 46 L100 55', 'M20 10 L45 45 L80 85'].slice(0, stage);
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
      {lines.map((d, i) => <path key={i} d={d} stroke="rgba(0,0,0,0.75)" strokeWidth={4} fill="none" />)}
    </svg>
  );
}

/** 採掘ビューポート＋猫（周りに所持武器が回る）＋素材の演出ドロップ。 */
export function MiningGrid() {
  const view = useMineView();
  const cx = (view.catRx + 0.5) * CELL;
  const cy = (view.catRy + 0.5) * CELL;
  return (
    <div className="relative overflow-hidden rounded-lg ring-2 ring-stone-950/70 shadow-inner" style={{ width: view.w * CELL, height: view.h * CELL }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${view.w}, ${CELL}px)`, gridTemplateRows: `repeat(${view.h}, ${CELL}px)` }}>
        {view.tiles.map((t) => (
          <div key={`${t.rx},${t.ry}`} style={{ background: t.color }} className={['relative', t.kind === 'solid' ? 'border border-black/25' : '', t.front ? 'ring-2 ring-amber-300' : ''].join(' ')}>
            {t.crack > 0 && <Cracks stage={t.crack} />}
            {t.isBase && <span className="absolute inset-0 flex items-center justify-center text-[18px]">🏠</span>}
          </div>
        ))}
      </div>

      {/* 武器の命中エフェクト（武器ごとの色でマスがピカッと光る） */}
      {view.effects.map((fx) =>
        fx.cells.map((c, i) => (
          <span key={`${fx.id}-${i}`} className="pointer-events-none absolute z-[14] rounded-[3px] animate-[fx-flash_0.22s_ease-out_forwards]"
            style={{ left: c.rx * CELL + 2, top: c.ry * CELL + 2, width: CELL - 4, height: CELL - 4, background: fx.color, boxShadow: `0 0 8px ${fx.color}` }} />
        )),
      )}

      {/* 自動回収済みの素材＝演出だけ（ふわっと浮いて消える） */}
      {view.drops.map((d) => (
        <span key={d.id} className="pointer-events-none absolute z-20 flex items-center justify-center text-[16px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] animate-[coin-float_0.9s_ease-out_forwards]"
          style={{ left: d.rx * CELL + (d.id % 7) - 3, top: d.ry * CELL - 4 + (d.id % 5) - 2, width: CELL, height: CELL }}>{d.emoji}</span>
      ))}

      {/* 所持武器が猫の周りを回る（ヴァンサバ風） */}
      {view.orbit.length > 0 && (
        <div className="pointer-events-none absolute z-[15] animate-spin" style={{ left: cx, top: cy, width: 0, height: 0, animationDuration: '2.6s' }}>
          {view.orbit.map((e, i) => {
            const a = (i / view.orbit.length) * Math.PI * 2;
            return <span key={i} className="absolute text-[14px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" style={{ transform: `translate(-50%,-50%) translate(${Math.cos(a) * 22}px, ${Math.sin(a) * 22}px)` }}>{e}</span>;
          })}
        </div>
      )}

      {/* 猫 */}
      <div className="pointer-events-none absolute z-10 flex items-center justify-center" style={{ left: view.catRx * CELL, top: view.catRy * CELL, width: CELL, height: CELL, transition: 'left 150ms linear, top 150ms linear' }}>
        <span className="animate-[catbob_0.9s_ease-in-out_infinite] text-[24px] leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">🐱</span>
      </div>
    </div>
  );
}
