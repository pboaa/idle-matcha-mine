import { useState } from 'react';
import { useMinePrestige, useMineBuyPerm, useMineBuyWeaponSkill, useMineBuyIdle, useMineBuyStarDamage, useMineRefine, type WeaponId, type MineSkillNodeVM } from '@state/miningSelectors';
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
        {nodes.flatMap((n) => n.requires.map((r) => {
          const p = nodes[r]; if (!p) return null;
          const lit = n.state === 'unlocked';
          return <line key={`${n.index}-${r}`} x1={cx(p)} y1={cy(p)} x2={cx(n)} y2={cy(n)} stroke={lit ? '#f59e0b' : '#57534e'} strokeWidth={lit ? 3 : 2} />;
        }))}
        {nodes.map((n) => {
          const r = n.big ? RBIG : R;
          const clickable = n.state === 'available' && n.can;
          return (
            <g key={n.index} onClick={() => clickable && onBuy(n.index)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
              <title>{`${n.label}${n.big ? '（特殊）' : ''} ／ ${n.state === 'unlocked' ? '解放済み' : n.state === 'available' ? (n.can ? 'クリックで解放' : '素材不足') : '前の階層を埋めると解禁'} ／ ${n.matEmoji}${n.matCost}`}</title>
              {clickable && <circle cx={cx(n)} cy={cy(n)} r={r + 4} fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.5} className="animate-[pop_1.2s_ease-in-out_infinite]" />}
              <circle cx={cx(n)} cy={cy(n)} r={r} fill={nodeFill(n)} stroke={nodeStroke(n)} strokeWidth={n.big ? 3 : 2} />
              <text x={cx(n)} y={cy(n)} textAnchor="middle" dominantBaseline="central" fontSize={n.big ? 18 : 14}>{n.emoji}</text>
              <text x={cx(n)} y={cy(n) + r + 9} textAnchor="middle" fontSize={9} fill={n.state === 'unlocked' ? '#fbbf24' : n.state === 'locked' ? '#57534e' : '#fde68a'}>
                {n.state === 'unlocked' ? '✓' : `${n.matEmoji}${n.matCost}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 転生ツリー画面: ★で武器スキルツリー（貫通/固有など特殊強化を含む）／放置ツリー／パッシブ恒久／鉱石・精錬。 */
export function MiningTree({ onClose }: { onClose: () => void }) {
  const p = useMinePrestige();
  const buyPerm = useMineBuyPerm();
  const buyWeaponSkill = useMineBuyWeaponSkill();
  const buyIdle = useMineBuyIdle();
  const buyStarDamage = useMineBuyStarDamage();
  const refine = useMineRefine();
  const [permTab, setPermTab] = useState<'weapon' | 'passive'>('weapon');
  const [weaponSel, setWeaponSel] = useState<WeaponId>('pick');
  const shownPerms = p.perms.filter((u) => u.kind === 'passive');
  const wt = p.weaponTree.find((w) => w.id === weaponSel) ?? p.weaponTree[0]!;

  return (
    <div className="flex max-h-[88vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">🌳 転生ツリー</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-amber-200">⭐ {formatNumber(p.points)}</span>
          <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
        </div>
      </div>

      {/* ★＝全体ダメージ強化（★の唯一の用途） */}
      <div className="flex items-center justify-between rounded-lg bg-amber-950/40 p-2 ring-1 ring-amber-600/40">
        <div className="text-[12px] text-amber-100">
          ⭐ 全体ダメージ強化 Lv{p.star.lv}
          <span className="ml-1 text-[10px] text-amber-300/80">全武器の威力 ×{(p.star.mult / 100).toFixed(2)} → ×{(p.star.nextMult / 100).toFixed(2)}</span>
        </div>
        <button onClick={buyStarDamage} disabled={!p.star.can}
          className={['rounded-md px-2 py-1 text-[11px] font-bold shadow transition', p.star.can ? 'bg-amber-400 text-stone-900 hover:bg-amber-300 active:scale-95' : 'cursor-not-allowed bg-stone-700 text-stone-400'].join(' ')}>
          ⭐{formatNumber(p.star.cost)}
        </button>
      </div>

      {/* 鉱石（保存・8段階）＋精錬。ツリー/解放/放置は素材で買う。 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-stone-800/50 p-2 text-[12px] text-stone-200">
        <span className="text-[10px] text-stone-500">鉱石8段</span>
        {p.materials.map((m) => <span key={m.id} title={`${m.name}（永続保存・ツリーの素材）`}>{m.emoji} {formatNumber(m.count)}</span>)}
        <span className="text-stone-600">｜精錬</span>
        {p.refines.map((r) => (
          <button key={r.from} onClick={() => refine(r.from)} disabled={!r.can} title={`${r.fromEmoji}${r.ratio}個 → ${r.toEmoji}1個`}
            className={['rounded px-1.5 py-0.5 text-[11px]', r.can ? 'bg-stone-700 text-stone-100 hover:bg-stone-600' : 'cursor-not-allowed bg-stone-800 text-stone-500'].join(' ')}>
            {r.fromEmoji}{r.ratio}→{r.toEmoji}
          </button>
        ))}
      </div>

      {/* 武器の解放（累計★で自動解放） */}
      <div className="flex flex-col gap-1 rounded-lg bg-sky-950/40 p-2 ring-1 ring-sky-700/40">
        <div className="text-[11px] text-sky-100">🔓 武器の自動解放
          <span className="text-[10px] text-sky-300/80">（累計★ {formatNumber(p.starEarned)}{p.nextUnlock && ` ／ 次は ${p.nextUnlock.emoji} ＝ ⭐${p.nextUnlock.star}`}）</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.unlocks.map((u) => (
            <div key={u.id}
              title={u.status === 'base' ? `${u.label}（最初から）` : u.status === 'unlocked' ? `${u.label}（解放済み）` : `${u.label}：累計★${u.star} で自動解放`}
              className={['flex items-center gap-0.5 rounded-md px-2 py-1 text-[13px] leading-none',
                u.status === 'locked' ? 'bg-stone-800 text-stone-500' : 'bg-stone-700 text-stone-100'].join(' ')}>
              {u.status === 'locked' ? '🔒' : u.status === 'base' ? '⭐' : '✅'}{u.emoji}
              {u.status === 'locked' && <span className="text-[9px] text-sky-300/70">⭐{u.star}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 放置ツリー（素材=銀で自動効率を100%へ） */}
      <div className="flex items-center justify-between rounded-lg bg-emerald-950/40 p-2 ring-1 ring-emerald-700/40">
        <div className="text-[12px] text-emerald-100">
          🌙 放置ツリー Lv{p.idle.lv}/{p.idle.maxLv}
          <span className="ml-1 text-[10px] text-emerald-300/80">自動モードの火力 {p.idle.autoEffPct}%（手動は常に100%）</span>
        </div>
        <button onClick={buyIdle} disabled={!p.idle.can}
          className={['rounded-md px-2 py-1 text-[11px] font-bold shadow transition', p.idle.maxed ? 'bg-emerald-700 text-emerald-200' : p.idle.can ? 'bg-emerald-400 text-stone-900 hover:bg-emerald-300' : 'cursor-not-allowed bg-stone-700 text-stone-400'].join(' ')}>
          {p.idle.maxed ? 'MAX(100%)' : <>{p.idle.matEmoji}{formatNumber(p.idle.cost ?? 0)}</>}
        </button>
      </div>

      {/* 武器ごとの強化（スキルツリー=ポイント）— 武器/強化の個別タブ */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] text-stone-500">武器ごとの強化（素材で解放・階層制／貫通や範囲も）</div>
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
            <div className="flex flex-wrap gap-1">
              {p.weaponTree.map((w) => (
                <button key={w.id} onClick={() => setWeaponSel(w.id)} title={`${w.label}｜熟練Lv${w.mastery}（+${w.masteryPct}% 火力・転生で使うと上昇）`}
                  className={['relative rounded-md px-2 py-1 text-[14px] leading-none transition', weaponSel === w.id ? 'bg-amber-400 ring-1 ring-amber-200' : 'bg-stone-700 hover:bg-stone-600'].join(' ')}>
                  {w.emoji}
                  {w.mastery > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[8px] font-bold leading-tight text-white">{w.mastery}</span>}
                </button>
              ))}
            </div>
            <div className="rounded-md bg-amber-950/30 p-1.5 ring-1 ring-amber-800/30">
              <div className="mb-1 flex items-center justify-between text-[10px] text-amber-300/80">
                <span>{wt.emoji} スキルツリー（階層を{2}ノード埋めると次へ）</span>
                <span>熟練Lv{wt.mastery}<span className="text-rose-300">(+{wt.masteryPct}%)</span> ／ 解放 {wt.skillUnlocked}/{wt.skillTotal}</span>
              </div>
              {/* 強化された内容（累積）を分かりやすく表示 */}
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded bg-stone-900/50 px-1.5 py-1 text-[11px]">
                <span className="text-[9px] text-stone-500">強化済</span>
                {wt.stats.length === 0
                  ? <span className="text-[10px] text-stone-600">まだなし</span>
                  : wt.stats.map((s) => <span key={s.label} title={s.label} className="text-amber-100">{s.emoji}<b className="text-amber-300">{s.text}</b></span>)}
                {wt.mastery > 0 && <span className="text-rose-200" title="熟練度（転生で使うと上昇）">🗡️<b className="text-rose-300">+{wt.masteryPct}%</b></span>}
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
    </div>
  );
}
