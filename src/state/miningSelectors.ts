import { useMemo } from 'react';
import { sameCell } from '@domain/grid/position';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileDist } from '@domain/mining/tile';
import type { MineState } from '@application/mining/mineState';
import { xpForNext, runUnlockCoinCost, runRerollCoinCost } from '@application/mining/upgrades';
import { weaponUnlockStar, globalDamageMult } from '@application/mining/prestige';
import { weaponDmg, weaponRange, passiveTotals } from '@application/mining/weapons';
import { runPassiveLevels, runGridUnlockable, runGridFilled, runGridFull } from '@domain/mining/runGrid';
import {
  TREASURE_DEFS, RARITY_DEFS, RARITY_BY_ID, RARITY_COUNT, TREASURE_TOTAL, TREASURE_EFFECT_LABEL, dexEffectTotals, dexKinds, dexTotalCount,
  type TreasureEffect, type TreasureRarity, type TreasureScope,
} from '@domain/mining/treasures';
import {
  WEAPON_IDS, PASSIVE_IDS, WEAPON_UNLOCK_ORDER, BASE_WEAPONS, defaultMiningBalance, choiceMeta,
  WEAPON_DEFS, PASSIVE_DEFS,
  type WeaponId, type PassiveId, type WeaponTag, type WeaponPattern,
} from '@domain/mining/balance';
import { useMiningStore } from '@state/miningStore';

export type { WeaponId } from '@domain/mining/balance';

export const VIEW_W = 19;
export const VIEW_H = 15;
const B = defaultMiningBalance;
const BASE = baseOf(B);
const TOTAL_TILES = totalTilesOf(B);

// ===== 盤面ビュー =====
export interface MineTileVM { readonly rx: number; readonly ry: number; readonly kind: 'dug' | 'wall' | 'solid'; readonly color: string; readonly isBase: boolean; readonly front: boolean; readonly crack: number; readonly tough: number; readonly fog: boolean }
export interface MineDropVM { readonly id: number; readonly rx: number; readonly ry: number; readonly emoji: string }
/** お宝を拾った演出（採掘地点に浮く・レアリティ色／高レアは大きく）。 */
export interface MineTreasurePopVM { readonly id: number; readonly rx: number; readonly ry: number; readonly emoji: string; readonly color: string; readonly big: boolean }
/** 武器命中エフェクトの見た目種別（パターンから決まる）。 */
export type MineEffectKind = 'line' | 'burst' | 'field' | 'impact';
/** 武器命中エフェクト（ビュー座標のマス群＋発射元＋色＋種別）。 */
export interface MineEffectVM { readonly id: number; readonly kind: MineEffectKind; readonly color: string; readonly ox: number; readonly oy: number; readonly cells: readonly { readonly rx: number; readonly ry: number }[] }
const FX_KIND: Record<WeaponPattern, MineEffectKind> = { front: 'impact', nearest: 'impact', burst: 'burst', cross: 'line', forward: 'line', around: 'field', ring: 'field' };
export interface MineViewVM {
  readonly w: number; readonly h: number;
  readonly x0: number; readonly y0: number;   // ビュー左上のワールド座標（クリック→セル変換用）
  readonly manual: boolean;                    // 手動モード（クリックで猫を誘導できる）
  readonly tiles: readonly MineTileVM[]; readonly drops: readonly MineDropVM[];
  readonly treasurePops: readonly MineTreasurePopVM[];
  readonly effects: readonly MineEffectVM[];
  readonly catRx: number; readonly catRy: number;
  readonly targetRx: number | null; readonly targetRy: number | null; // 手動目標マーカー（ビュー座標）
  /** 所持武器の絵文字（猫の周りを回る演出用）。 */
  readonly orbit: readonly string[];
}

const FX_CELL_CAP = 90; // 1フレームに描く演出マスの上限（パフォーマンス保護）

export function buildMineView(state: MineState): MineViewVM {
  const x0 = state.cam.x - (VIEW_W - 1) / 2;
  const y0 = state.cam.y - (VIEW_H - 1) / 2;
  const front = miningFrontCell(state);
  const tiles: MineTileVM[] = [];
  for (let ry = 0; ry < VIEW_H; ry++) {
    for (let rx = 0; rx < VIEW_W; rx++) {
      const c = { x: x0 + rx, y: y0 + ry };
      const isFront = front !== null && sameCell(c, front);
      if (!inBounds(c, B)) { tiles.push({ rx, ry, kind: 'wall', color: '#1c1917', isBase: false, front: false, crack: 0, tough: 0, fog: false }); continue; }
      const k = `${c.x},${c.y}`;
      const dug = state.dug.has(k);
      const isBase = c.x === BASE.x && c.y === BASE.y;
      // 霧(フォグ): 未採掘マスは、掘った場所の隣に来るまで隠す（拠点も既知）。掘り進むほど見える。
      const fog = !dug && !isBase && !isFront && !revealedNear(state.dug, c);
      if (fog) { tiles.push({ rx, ry, kind: 'solid', color: '#14110e', isBase: false, front: false, crack: 0, tough: 0, fog: true }); continue; }
      const kind = kindAt(c, state.floor, B);
      const dist = tileDist(c, B);
      const ratio = dug ? 0 : Math.min(1, (state.damage.get(k) ?? 0) / tileHardness(state.floor, dist, kind.hardMult, B));
      // 硬さの可視化: 拠点距離×種類で「relHard」を出し、硬いほど暗く（遠い/上位鉱石が一目で分かる）。
      const relHard = (1 + dist * B.distHardness) * kind.hardMult;
      const tough = dug ? 0 : Math.min(0.55, Math.max(0, (relHard - 1) / 8));
      tiles.push({ rx, ry, kind: dug ? 'dug' : 'solid', color: dug ? '#2e2a26' : kind.color, isBase, front: isFront, crack: ratio <= 0 ? 0 : Math.min(3, 1 + Math.floor(ratio * 3)), tough, fog: false });
    }
  }
  const drops: MineDropVM[] = [];
  for (const d of state.drops) {
    const rx = d.x - x0; const ry = d.y - y0;
    if (rx >= -1 && rx <= VIEW_W && ry >= -1 && ry <= VIEW_H) drops.push({ id: d.id, rx, ry, emoji: d.emoji });
  }
  const treasurePops: MineTreasurePopVM[] = [];
  for (const p of state.treasurePops) {
    const rx = p.x - x0; const ry = p.y - y0;
    if (rx >= -1 && rx <= VIEW_W && ry >= -1 && ry <= VIEW_H) treasurePops.push({ id: p.id, rx, ry, emoji: p.emoji, color: p.color, big: p.rarity !== 'common' && p.rarity !== 'uncommon' });
  }
  const effects: MineEffectVM[] = [];
  let fxBudget = FX_CELL_CAP;
  for (const f of state.fx) {
    if (fxBudget <= 0) break;
    const cells: { rx: number; ry: number }[] = [];
    for (const c of f.cells) {
      const rx = c.x - x0; const ry = c.y - y0;
      if (rx >= 0 && rx < VIEW_W && ry >= 0 && ry < VIEW_H) cells.push({ rx, ry });
    }
    if (cells.length === 0) continue;
    const take = cells.slice(0, fxBudget); fxBudget -= take.length;
    const def = WEAPON_DEFS[f.weapon];
    effects.push({ id: f.id, kind: FX_KIND[def.pattern], color: def.fxColor, ox: f.origin.x - x0, oy: f.origin.y - y0, cells: take });
  }
  const orbit = WEAPON_IDS.filter((w) => state.levels[w] > 0).map((w) => choiceMeta(w).emoji);
  const tgt = state.cat.target;
  const inView = tgt && tgt.x - x0 >= 0 && tgt.x - x0 < VIEW_W && tgt.y - y0 >= 0 && tgt.y - y0 < VIEW_H;
  return {
    w: VIEW_W, h: VIEW_H, x0, y0, manual: !state.autoMode, tiles, drops, treasurePops, effects,
    catRx: state.cat.pos.x - x0, catRy: state.cat.pos.y - y0,
    targetRx: inView ? tgt!.x - x0 : null, targetRy: inView ? tgt!.y - y0 : null,
    orbit,
  };
}

// 霧の解除判定: 8近傍に掘ったマスがあれば「見えている」（掘り進んだ縁が露出）。
function revealedNear(dug: ReadonlySet<string>, c: { x: number; y: number }): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (dug.has(`${c.x + dx},${c.y + dy}`)) return true;
  }
  return false;
}

// front を selectors 内で再計算（step に依存しすぎない簡易版）
function miningFrontCell(state: MineState): { x: number; y: number } | null {
  const { cat } = state;
  if (!cat.target || sameCell(cat.pos, cat.target)) return null;
  const dx = cat.target.x - cat.pos.x; const dy = cat.target.y - cat.pos.y;
  const n = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? { x: cat.pos.x + Math.sign(dx), y: cat.pos.y } : dy !== 0 ? { x: cat.pos.x, y: cat.pos.y + Math.sign(dy) } : cat.pos;
  if (sameCell(n, cat.pos)) return null;
  return inBounds(n, B) && !state.dug.has(`${n.x},${n.y}`) ? n : null;
}

// ===== アイテム詳細説明（数値つき） =====
const TAG_LABEL: Record<WeaponTag, string> = { melee: '近接', shot: '射撃', beam: 'ビーム', field: '範囲' };
const PATTERN_DESC: Record<WeaponPattern, string> = {
  front: '前方1マス→横に拡大', nearest: '最寄り1マス→拡大', burst: '着弾点3x3→拡大', cross: '2→4→8方向ビーム', forward: '進行方向へ貫通→幅増', around: '周囲全体', ring: '外周リング',
};
const SYNERGY_BY_TAG: Record<WeaponTag, PassiveId> = { melee: 'whet', shot: 'powder', beam: 'lens', field: 'echo' };

/** 装備武器の説明（基礎値＋系統シナジー）。 */
function weaponDetail(id: WeaponId): string {
  const def = WEAPON_DEFS[id];
  const dmg = weaponDmg(def, 1);
  const range = weaponRange(def, 1, 0);
  const syn = PASSIVE_DEFS[SYNERGY_BY_TAG[def.tag]];
  return `${PATTERN_DESC[def.pattern]}を攻撃（系統:${TAG_LABEL[def.tag]}）。威力 ${dmg.toFixed(2)}・射程 ${range}。シナジー ${syn.emoji}${syn.label} で強化`;
}

// ===== HUD =====
export interface MineGearVM { readonly emoji: string; readonly label: string; readonly detail: string }
export interface MineDmgShareVM { readonly emoji: string; readonly label: string; readonly pct: number }
/** 強化（走行グリッドのバフ）の威力への倍率影響。 */
export interface MineDmgModVM { readonly emoji: string; readonly label: string; readonly scope: string; readonly mult: number }
/** 走行グリッドのマス1つ。 */
export interface MineRunNodeVM {
  readonly index: number; readonly x: number; readonly y: number;
  readonly emoji: string; readonly label: string; readonly special: boolean; readonly root: boolean;
  readonly state: 'unlocked' | 'available' | 'locked'; readonly visible: boolean;
}
/** 走行グリッド（その周だけ・ランダム・手動・コインで解放・上限あり）。 */
export interface MineRunGridVM {
  readonly size: number; readonly nodes: readonly MineRunNodeVM[];
  readonly filled: number; readonly cap: number; readonly full: boolean; // 解放数／上限／満タン
  readonly coinCost: number; readonly coinCan: boolean;                   // 次の解放コスト／払えるか
  readonly rerollCost: number; readonly rerollCan: boolean;
  readonly bulkCan: boolean;                                              // 一括購入できる
  readonly stats: readonly { readonly emoji: string; readonly label: string; readonly count: number }[];
}
export interface MineHudVM {
  readonly coins: number; readonly floor: number; readonly progressPct: number; readonly runPoints: number;
  readonly starPoints: number; readonly starTotal: number; readonly dmgMult: number; // ★残高／累計★／全体倍率
  readonly dexCount: number; readonly dexTotal: number; // お宝図鑑の収集数／全種類
  readonly level: number; readonly xp: number; readonly xpNext: number; readonly autoMode: boolean;
  readonly weapons: readonly MineGearVM[];
  readonly damageShare: readonly MineDmgShareVM[];
  readonly damageMods: readonly MineDmgModVM[];
  readonly runGrid: MineRunGridVM;
}

/** 所持する強化のうち威力に効くものの現在倍率（ダメージ影響度）。走行グリッドのバフから算出。 */
function damageMods(state: MineState): MineDmgModVM[] {
  const lv = runPassiveLevels(state.runGrid);
  const t = passiveTotals(lv);
  const out: MineDmgModVM[] = [];
  if (t.power > 0) out.push({ emoji: '💪', label: '威力系', scope: '全武器', mult: 1 + t.power });
  if (t.crit > 0) out.push({ emoji: '✨', label: '会心', scope: '平均', mult: 1 + t.crit * (B.critMult - 1) });
  if (t.meleeDmg > 0) out.push({ emoji: '🪒', label: '砥石', scope: '近接', mult: 1 + t.meleeDmg });
  if (t.shotDmg > 0) out.push({ emoji: '🧨', label: '火薬', scope: '射撃', mult: 1 + t.shotDmg });
  if (t.beamDmg > 0) out.push({ emoji: '🔬', label: 'レンズ', scope: 'ビーム', mult: 1 + t.beamDmg });
  if (t.fieldDmg > 0) out.push({ emoji: '🔊', label: '共鳴', scope: '範囲', mult: 1 + t.fieldDmg });
  for (const id of PASSIVE_IDS) {
    const def = PASSIVE_DEFS[id];
    if (!def.targetWeapon || (lv[id] ?? 0) <= 0) continue;
    out.push({ emoji: def.emoji, label: def.label, scope: choiceMeta(def.targetWeapon).label, mult: 1 + t.perWeapon[def.targetWeapon] });
  }
  return out;
}

function buildRunGrid(state: MineState): MineRunGridVM {
  const g = state.runGrid;
  const nodes: MineRunNodeVM[] = g.nodes.map((n, i) => {
    const isUnlocked = g.unlocked.includes(i);
    const available = runGridUnlockable(g, i);
    const def = PASSIVE_DEFS[n.pid];
    return {
      index: i, x: n.x, y: n.y, emoji: def.emoji, label: `${def.label} ${def.desc}`, special: n.special, root: !!n.root,
      state: isUnlocked ? 'unlocked' as const : available ? 'available' as const : 'locked' as const,
      visible: isUnlocked || available,
    };
  });
  const lv = runPassiveLevels(g);
  const stats = PASSIVE_IDS.filter((id) => (lv[id] ?? 0) > 0).map((id) => ({ emoji: PASSIVE_DEFS[id].emoji, label: PASSIVE_DEFS[id].label, count: lv[id] ?? 0 }));
  const coinCost = runUnlockCoinCost(state);
  const rerollCost = runRerollCoinCost(state);
  const anyAvail = g.nodes.some((_, i) => runGridUnlockable(g, i));
  const coinCan = anyAvail && state.coins >= coinCost;
  return {
    size: g.size, nodes,
    filled: runGridFilled(g), cap: g.cap, full: runGridFull(g),
    coinCost, coinCan,
    rerollCost, rerollCan: state.coins >= rerollCost,
    bulkCan: coinCan,
    stats,
  };
}

export function buildMineHud(state: MineState): MineHudVM {
  const weapons = WEAPON_IDS.filter((id) => state.levels[id] > 0).map((id) => ({ emoji: choiceMeta(id).emoji, label: choiceMeta(id).label, detail: weaponDetail(id) }));
  const totalDmg = WEAPON_IDS.reduce((a, w) => a + state.dmgByWeapon[w], 0);
  return {
    coins: Math.floor(state.coins), floor: state.floor, runPoints: state.runPoints,
    starPoints: state.perm.starPoints, starTotal: state.perm.starTotal,
    dmgMult: globalDamageMult(state.perm.starTotal) * (1 + dexEffectTotals(state.perm.dex).global.power),
    dexCount: dexKinds(state.perm.dex), dexTotal: TREASURE_TOTAL,
    progressPct: Math.min(100, (state.dug.size / TOTAL_TILES) * 100),
    level: state.level, xp: Math.floor(state.xp), xpNext: xpForNext(state.level), autoMode: state.autoMode,
    weapons,
    damageShare: WEAPON_IDS.filter((w) => state.dmgByWeapon[w] > 0).map((w) => ({ emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, pct: totalDmg > 0 ? (state.dmgByWeapon[w] / totalDmg) * 100 : 0 })).sort((a, b) => b.pct - a.pct),
    damageMods: damageMods(state),
    runGrid: buildRunGrid(state),
  };
}

// ===== 転生パネル =====
/** お宝図鑑の1エントリ（個数つき）。 */
export interface MineDexEntryVM { readonly id: number; readonly emoji: string; readonly name: string; readonly weapon: WeaponId; readonly weaponEmoji: string; readonly rarity: TreasureRarity; readonly rarityLabel: string; readonly color: string; readonly scope: TreasureScope; readonly effectEmoji: string; readonly text: string; readonly count: number }
/** レアリティ別の収集進捗。 */
export interface MineRarityVM { readonly id: TreasureRarity; readonly label: string; readonly color: string; readonly kinds: number; readonly total: number; readonly minFloor: number }
/** 武器別の収集進捗（タブ用）。 */
export interface MineDexWeaponVM { readonly id: WeaponId; readonly emoji: string; readonly label: string; readonly kinds: number; readonly total: number; readonly equipped: boolean }
/** 図鑑の効果合計（表示用）。 */
export interface MineDexEffectVM { readonly emoji: string; readonly label: string; readonly text: string }
/** 武器の解放状態（つるはし/弾は最初から・残りは★を消費して解放）。cost=必要★。 */
export interface MineWeaponUnlockVM { readonly id: WeaponId; readonly emoji: string; readonly label: string; readonly status: 'base' | 'unlocked' | 'locked'; readonly cost: number; readonly can: boolean }
/** 開始武器の選択肢。 */
export interface MineStartOptionVM { readonly id: WeaponId; readonly emoji: string; readonly label: string; readonly selected: boolean }
export interface MinePrestigeVM {
  readonly prestiges: number; readonly runPoints: number;
  readonly starPoints: number; readonly starTotal: number; readonly dmgMult: number;
  readonly dex: {
    readonly kinds: number; readonly total: number; readonly count: number; // 集めた種類／全種類／総個数
    readonly rarities: readonly MineRarityVM[]; // レアリティ別の進捗
    readonly weapons: readonly MineDexWeaponVM[]; // 武器別の進捗（タブ）
    readonly entries: readonly MineDexEntryVM[]; readonly effects: readonly MineDexEffectVM[];
  };
  readonly unlocks: readonly MineWeaponUnlockVM[];
  readonly startWeapon: WeaponId; readonly startOptions: readonly MineStartOptionVM[];
}

const treasureText = (d: { scope: TreasureScope; effect: TreasureEffect | null; amount: number; weapon: WeaponId }): string =>
  d.scope === 'self'
    ? `${choiceMeta(d.weapon).label} 火力 +${(d.amount * 100).toFixed(1)}%`
    : `${TREASURE_EFFECT_LABEL[d.effect!].label} +${(d.amount * 100).toFixed(1)}%`;

export function buildPrestige(state: MineState): MinePrestigeVM {
  const sp = state.perm.starPoints;
  const dex = state.perm.dex;
  const { global: eff, perWeapon } = dexEffectTotals(dex);
  const equipped = new Set(WEAPON_IDS.filter((w) => state.levels[w] > 0));
  const effects: MineDexEffectVM[] = [
    ...(Object.keys(TREASURE_EFFECT_LABEL) as TreasureEffect[]).filter((e) => eff[e] > 0).map((e) => ({ emoji: TREASURE_EFFECT_LABEL[e].emoji, label: TREASURE_EFFECT_LABEL[e].label, text: `+${Math.round(eff[e] * 100)}%` })),
    ...WEAPON_IDS.filter((w) => perWeapon[w] > 0).map((w) => ({ emoji: choiceMeta(w).emoji, label: `${choiceMeta(w).label}火力`, text: `+${Math.round(perWeapon[w] * 100)}%` })),
  ];
  const dexKindsOf = (filter: (d: typeof TREASURE_DEFS[number]) => boolean): number => TREASURE_DEFS.filter((d) => filter(d) && (dex[d.id] ?? 0) > 0).length;
  return {
    prestiges: state.prestiges,
    runPoints: state.runPoints,
    starPoints: sp, starTotal: state.perm.starTotal, dmgMult: globalDamageMult(state.perm.starTotal) * (1 + eff.power),
    dex: {
      kinds: dexKinds(dex), total: TREASURE_TOTAL, count: dexTotalCount(dex),
      rarities: RARITY_DEFS.map((r) => ({ id: r.id, label: r.label, color: r.color, minFloor: r.minFloor, total: RARITY_COUNT[r.id], kinds: dexKindsOf((d) => d.rarity === r.id) })),
      weapons: WEAPON_IDS.map((w) => ({ id: w, emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, total: TREASURE_DEFS.filter((d) => d.weapon === w).length, kinds: dexKindsOf((d) => d.weapon === w), equipped: equipped.has(w) })),
      entries: TREASURE_DEFS.map((d) => ({ id: d.id, emoji: d.emoji, name: d.name, weapon: d.weapon, weaponEmoji: choiceMeta(d.weapon).emoji, rarity: d.rarity, rarityLabel: RARITY_BY_ID[d.rarity].label, color: RARITY_BY_ID[d.rarity].color, scope: d.scope, effectEmoji: d.scope === 'self' ? choiceMeta(d.weapon).emoji : TREASURE_EFFECT_LABEL[d.effect!].emoji, text: treasureText(d), count: dex[d.id] ?? 0 })),
      effects,
    },
    unlocks: [...BASE_WEAPONS, ...WEAPON_UNLOCK_ORDER].map((w) => {
      const cost = weaponUnlockStar(w);
      const status = BASE_WEAPONS.includes(w) ? 'base' as const : state.perm.unlockedWeapons.includes(w) ? 'unlocked' as const : 'locked' as const;
      return { id: w, emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, status, cost, can: status === 'locked' && sp >= cost };
    }),
    startWeapon: state.startWeapon,
    startOptions: state.perm.unlockedWeapons.map((w) => ({ id: w, emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, selected: w === state.startWeapon })),
  };
}

// ===== フック =====
export const useMineView = (): MineViewVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildMineView(s), [s]); };
export const useMineHud = (): MineHudVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildMineHud(s), [s]); };
export const useMinePrestige = (): MinePrestigeVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildPrestige(s), [s]); };
export const useMineBuyRunUnlock = (): ((index: number) => void) => useMiningStore((s) => s.buyRunUnlock);
export const useMineBuyRunBulk = (): (() => void) => useMiningStore((s) => s.buyRunBulk);
export const useMineRerollRun = (): (() => void) => useMiningStore((s) => s.rerollRun);
export const useMinePrestigeAct = (): (() => void) => useMiningStore((s) => s.prestige);
export const useMineStartRun = (): ((w: WeaponId) => void) => useMiningStore((s) => s.startRun);
export const useMineUnlockWeapon = (): ((w: WeaponId) => void) => useMiningStore((s) => s.unlockWeapon);
export const useMineSetTarget = (): ((cell: { x: number; y: number }) => void) => useMiningStore((s) => s.setTarget);
export const useMineSave = (): (() => void) => useMiningStore((s) => s.save);
export const useMineResetData = (): (() => void) => useMiningStore((s) => s.resetData);
export const useMineExportSave = (): (() => string) => useMiningStore((s) => s.exportSave);
export const useMineImportSave = (): ((text: string) => boolean) => useMiningStore((s) => s.importSave);
