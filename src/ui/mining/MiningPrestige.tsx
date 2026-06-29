import { useState } from 'react';
import { useMinePrestige, useMinePrestigeAct, useMineBuyPerm, useMineBuyWeaponSkill, useMineRefine, type WeaponId, type MineSkillNodeVM } from '@state/miningSelectors';
import { formatNumber } from '@shared/format';

const COL = 80, ROW = 52, PADX = 30, PADY = 30, R = 16, RBIG = 20;
const nodeFill = (n: MineSkillNodeVM): string =>
  n.state === 'unlocked' ? '#b45309' : n.state === 'available' ? (n.can ? '#f59e0b' : '#57534e') : '#292524';
const nodeStroke = (n: MineSkillNodeVM): string =>
  n.state === 'unlocked' ? '#fbbf24' : n.state === 'available' ? '#fde68a' : '#44403c';

/** 武器スキルツリーの分岐グラフ（SVG）。前提を線で繋ぎ、解放可能ノードをクリックで取得。 */
function SkillGraph({ nodes, onBuy }: { nodes: readonly MineSkillNodeVM[]; onBuy: (index: number) => void }) {
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const w = PADX * 2 + maxX * COL;
  const h = PADY * 2 + maxY * ROW;
  const cx = (n: MineSkillNodeVM): number => PADX + n.x * COL;
  const cy = (n: MineSkillNodeVM): number => PADY + n.y * ROW;
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="block">
        {/* 前提のエッジ */}
        {nodes.flatMap((n) => n.requires.map((r) => {
          const p = nodes[r]; if (!p) return null;
          const lit = n.state === 'unlocked';
          return <line key={`${n.index}-${r}`} x1={cx(p)} y1={cy(p)} x2={cx(n)} y2={cy(n)} stroke={lit ? '#f59e0b' : '#57534e'} strokeWidth={lit ? 3 : 2} />;
        }))}
        {/* ノード */}
        {nodes.map((n) => {
          const r = n.big ? RBIG : R;
          const clickable = n.state === 'available' && n.can;
          return (
            <g key={n.index} onClick={() => clickable && onBuy(n.index)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
              <title>{`${n.label}${n.big ? '（大）' : ''} ／ ${n.state === 'unlocked' ? '解放済み' : n.state === 'available' ? (n.can ? 'クリックで解放' : 'ポイント不足') : '前提が必要'} ／ ⭐${n.cost}`}</title>
              {clickable && <circle cx={cx(n)} cy={cy(n)} r={r + 4} fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.5} className="animate-[pop_1.2s_ease-in-out_infinite]" />}
              <circle cx={cx(n)} cy={cy(n)} r={r} fill={nodeFill(n)} stroke={nodeStroke(n)} strokeWidth={n.big ? 3 : 2} />
              <text x={cx(n)} y={cy(n)} textAnchor="middle" dominantBaseline="central" fontSize={n.big ? 18 : 14}>{n.emoji}</text>
              <text x={cx(n)} y={cy(n) + r + 9} textAnchor="middle" fontSize={9} fill={n.state === 'unlocked' ? '#fbbf24' : n.state === 'locked' ? '#57534e' : '#fde68a'}>
                {n.state === 'unlocked' ? '✓' : `⭐${n.cost}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 工房/転生モーダル: 熟練度／鉱石(ラン中)・ポイント／武器ごとの強化(ラン強化＋スキルツリー)／転生。 */
export function MiningPrestige({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  const doPrestige = useMinePrestigeAct();
  const buyPerm = useMineBuyPerm();
  const buyWeaponSkill = useMineBuyWeaponSkill();
  const refine = useMineRefine();
  const [permTab, setPermTab] = useState<'weapon' | 'passive'>('weapon');
  const [weaponSel, setWeaponSel] = useState<WeaponId>('pick');
  const shownPerms = p.perms.filter((u) => u.kind === 'passive');
  const wt = p.weaponTree.find((w) => w.id === weaponSel) ?? p.weaponTree[0]!;

  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🔧 工房 / 転生</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">転生 {p.prestiges}回</span>
          <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
        </div>
      </div>

      {/* 熟練度（武器ごと・転生時に上がる永続強化） */}
      <div className="flex flex-col gap-1 rounded-lg bg-indigo-950/60 p-2.5 ring-1 ring-indigo-500/40">
        <div className="text-[12px] text-indigo-100">
          🎓 熟練度（武器ごと・<b>転生で使った武器ごとに +{p.mastery.gainPct}%</b>）
          <span className="ml-1 text-[10px] text-indigo-300">合計{p.mastery.total} → 永続 🏃+{p.mastery.movePct}% 📏+{p.mastery.rangeBonus}（周回で序盤がサクサク）</span>
        </div>
        {p.mastery.perWeapon.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-indigo-200">
            {p.mastery.perWeapon.map((w) => <span key={w.label} title={`${w.label} 熟練Lv${w.lv}`}>{w.emoji} Lv{w.lv} <span className="text-indigo-400">+{w.pct}%</span></span>)}
          </div>
        ) : <div className="text-[10px] text-indigo-400">まだ熟練度なし。転生すると、その走行で使った武器のダメージが恒久で上がる。</div>}
      </div>

      {/* ポイント（恒久）＋鉱石（今のラン）＋精錬 */}
      <div className="flex flex-col gap-1 rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-700/40">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-bold text-amber-200">⭐ ポイント {formatNumber(p.points)}</span>
          <span className="text-[10px] text-amber-300/80">転生で残り鉱石 → +{formatNumber(p.pointsPreview)}pt</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-200">
          <span className="text-[10px] text-stone-500">鉱石(今のラン)</span>
          {p.materials.map((m) => <span key={m.id} title={`${m.name}（ラン中の強化に使用。残りは転生でポイントへ）`}>{m.emoji} {formatNumber(m.count)}</span>)}
          <span className="text-stone-600">｜精錬</span>
          {p.refines.map((r) => (
            <button key={r.from} onClick={() => refine(r.from)} disabled={!r.can} title={`${r.fromEmoji}${r.ratio}個 → ${r.toEmoji}1個`}
              className={['rounded px-1.5 py-0.5 text-[11px]', r.can ? 'bg-stone-700 text-stone-100 hover:bg-stone-600' : 'cursor-not-allowed bg-stone-800 text-stone-500'].join(' ')}>
              {r.fromEmoji}{r.ratio}→{r.toEmoji}
            </button>
          ))}
        </div>
      </div>

      {/* 武器ごとの強化（ラン強化=鉱石／スキルツリー=ポイント）— 武器/強化の個別タブ */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] text-stone-500">武器ごとの強化</div>
          <div className="flex gap-1">
            {([['weapon', '⚔️ 武器'], ['passive', '✨ 強化']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setPermTab(k)}
                className={['rounded-md px-2 py-0.5 text-[11px] font-bold transition', permTab === k ? 'bg-amber-400 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {permTab === 'weapon' ? (
          <div className="flex flex-col gap-1.5">
            {/* 武器サブタブ（武器ごと） */}
            <div className="flex flex-wrap gap-1">
              {p.weaponTree.map((w) => (
                <button key={w.id} onClick={() => setWeaponSel(w.id)} title={w.label}
                  className={['rounded-md px-2 py-1 text-[14px] leading-none transition', weaponSel === w.id ? 'bg-amber-400 ring-1 ring-amber-200' : 'bg-stone-700 hover:bg-stone-600'].join(' ')}>
                  {w.emoji}{w.masteryLv > 0 && <span className="ml-0.5 align-middle text-[9px] text-indigo-200">🎓{w.masteryLv}</span>}
                </button>
              ))}
            </div>

            {/* スキルツリー（ポイント・恒久・分岐グラフ） */}
            <div className="rounded-md bg-amber-950/30 p-1.5 ring-1 ring-amber-800/30">
              <div className="mb-1 flex items-center justify-between text-[10px] text-amber-300/80">
                <span>スキルツリー（ポイント・恒久・前提を満たすと広がる）</span>
                <span>解放 {wt.skillUnlocked}/{wt.skillTotal}</span>
              </div>
              <SkillGraph nodes={wt.skillNodes} onBuy={(i) => buyWeaponSkill(wt.id, i)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {shownPerms.map((u) => (
              <button key={u.id} onClick={() => buyPerm(u.id)} disabled={!u.can} title={`${u.label}（恒久Lv${u.lv}）／ ${u.matEmoji}${u.cost}`}
                className={['flex items-center justify-between rounded-md px-2 py-1 text-[11px] shadow transition', u.can ? 'bg-stone-700 text-stone-100 hover:bg-stone-600 active:scale-95' : 'cursor-not-allowed bg-stone-800 text-stone-500'].join(' ')}>
                <span className="truncate">{u.emoji}<b className="text-amber-300">{u.lv}</b></span>
                <span className="ml-1 whitespace-nowrap text-[10px]">{u.matEmoji}{formatNumber(u.cost)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={doPrestige}
        className="rounded-lg bg-fuchsia-600 px-2 py-2 text-sm font-bold text-white shadow ring-2 ring-fuchsia-300 transition hover:bg-fuchsia-500 active:scale-95">
        🔄 転生する（残り鉱石 → +{formatNumber(p.pointsPreview)}pt ／ 階・Lv・コインはリセット、ポイント・熟練度は保持）
      </button>
    </div>
  );
}
