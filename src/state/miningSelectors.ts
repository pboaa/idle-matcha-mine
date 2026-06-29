import { useMemo } from 'react';
import { sameCell } from '@domain/grid/position';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileDist } from '@domain/mining/tile';
import type { MineState } from '@application/mining/mineState';
import { xpForNext, appraiseCost, appraiseCapped, rareChance, epicChance, boostCost, boostMul } from '@application/mining/upgrades';
import { coinUpCost, skillNodeUnlockable, skillGridOpen, autoEfficiency, idleCost, idleMaxLevel, weaponUnlockStar, globalDamageMult, IDLE_MATERIAL } from '@application/mining/prestige';
import { weaponDmg, weaponRange, passiveTotals } from '@application/mining/weapons';
import {
  WEAPON_IDS, PASSIVE_IDS, MATERIAL_IDS, WEAPON_STATS, MAIN_STATS, WEAPON_UNLOCK_ORDER, SKILL_TIERS, skillGridSize, skillGridUnlockNeed, COIN_UP_IDS, COIN_UP_DEFS, BASE_WEAPONS, defaultMiningBalance, choiceMeta, isWeapon,
  WEAPON_DEFS, PASSIVE_DEFS, skillStatDef, weaponSkillNodes, mainSkillNodes, sumSkillStats,
  type OfferRarity, type MaterialId, type ChoiceId, type WeaponId, type PassiveId, type WeaponTag, type WeaponPattern, type SkillStat, type CoinUpId,
} from '@domain/mining/balance';
import { useMiningStore } from '@state/miningStore';

export type { WeaponId, WeaponStat } from '@domain/mining/balance';

export const VIEW_W = 19;
export const VIEW_H = 15;
const B = defaultMiningBalance;
const BASE = baseOf(B);
const TOTAL_TILES = totalTilesOf(B);
const matEmoji = (id: MaterialId): string => B.kinds[id].emoji;

// ===== 盤面ビュー =====
export interface MineTileVM { readonly rx: number; readonly ry: number; readonly kind: 'dug' | 'wall' | 'solid'; readonly color: string; readonly isBase: boolean; readonly front: boolean; readonly crack: number; readonly tough: number }
export interface MineDropVM { readonly id: number; readonly rx: number; readonly ry: number; readonly emoji: string }
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
      if (!inBounds(c, B)) { tiles.push({ rx, ry, kind: 'wall', color: '#1c1917', isBase: false, front: false, crack: 0, tough: 0 }); continue; }
      const k = `${c.x},${c.y}`;
      const dug = state.dug.has(k);
      const kind = kindAt(c, state.floor, B);
      const dist = tileDist(c, B);
      const ratio = dug ? 0 : Math.min(1, (state.damage.get(k) ?? 0) / tileHardness(state.floor, dist, kind.hardMult, B));
      // 硬さの可視化: 拠点距離×種類で「relHard」を出し、硬いほど暗く（遠い/上位鉱石が一目で分かる）。
      const relHard = (1 + dist * B.distHardness) * kind.hardMult;
      const tough = dug ? 0 : Math.min(0.55, Math.max(0, (relHard - 1) / 8));
      tiles.push({ rx, ry, kind: dug ? 'dug' : 'solid', color: dug ? '#2e2a26' : kind.color, isBase: c.x === BASE.x && c.y === BASE.y, front: isFront, crack: ratio <= 0 ? 0 : Math.min(3, 1 + Math.floor(ratio * 3)), tough });
    }
  }
  const drops: MineDropVM[] = [];
  for (const d of state.drops) {
    const rx = d.x - x0; const ry = d.y - y0;
    if (rx >= -1 && rx <= VIEW_W && ry >= -1 && ry <= VIEW_H) drops.push({ id: d.id, rx, ry, emoji: d.emoji });
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
    w: VIEW_W, h: VIEW_H, x0, y0, manual: !state.autoMode, tiles, drops, effects,
    catRx: state.cat.pos.x - x0, catRy: state.cat.pos.y - y0,
    targetRx: inView ? tgt!.x - x0 : null, targetRy: inView ? tgt!.y - y0 : null,
    orbit,
  };
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

function weaponDetail(id: WeaponId, lv: number): string {
  const def = WEAPON_DEFS[id];
  const nLv = lv + 1;
  const dmg = weaponDmg(def, nLv);
  const range = weaponRange(def, nLv, 0);
  const syn = PASSIVE_DEFS[SYNERGY_BY_TAG[def.tag]];
  const lvtxt = lv > 0 ? `Lv${lv}→${nLv}` : '新規入手';
  return `${PATTERN_DESC[def.pattern]}を攻撃（系統:${TAG_LABEL[def.tag]}）。威力 ${dmg.toFixed(2)}・射程 ${range} ／ ${lvtxt}。シナジー ${syn.emoji}${syn.label} で強化`;
}

function passiveDetail(id: PassiveId, lv: number): string {
  const def = PASSIVE_DEFS[id];
  const nLv = lv + 1;
  const lvtxt = lv > 0 ? `Lv${lv}→${nLv}` : '新規入手';
  if (def.effect === 'range' || def.effect === 'pierce') {
    const unit = def.effect === 'pierce' ? '貫通' : '射程';
    return `${def.desc}。${unit} +${def.perLvl}/Lv（合計 +${Math.floor(def.perLvl * nLv)}）／ ${lvtxt}`;
  }
  const per = Math.round(def.perLvl * 100);
  const total = Math.round(def.perLvl * nLv * 100);
  const tag = def.targetWeapon ? '（武器固有）' : '';
  return `${def.desc}${tag}。+${per}%/Lv（合計 +${total}%）／ ${lvtxt}`;
}

/** 選択肢/所持アイテムの詳細説明（現在レベル lv を踏まえ次Lvの効果も表示）。 */
export const choiceDetail = (id: ChoiceId, lv: number): string =>
  isWeapon(id) ? weaponDetail(id, lv) : passiveDetail(id as PassiveId, lv);

// ===== HUD =====
export interface MineOfferVM { readonly index: number; readonly label: string; readonly emoji: string; readonly desc: string; readonly detail: string; readonly lv: number; readonly rarity: OfferRarity; readonly bonusEmoji: string | null; readonly isWeapon: boolean }
export interface MineGearVM { readonly emoji: string; readonly label: string; readonly lv: number; readonly detail: string }
export interface MineDmgShareVM { readonly emoji: string; readonly label: string; readonly pct: number }
/** 強化（パッシブ/ブースト）の威力への倍率影響。 */
export interface MineDmgModVM { readonly emoji: string; readonly label: string; readonly scope: string; readonly mult: number }
export interface MineMetaVM { readonly appraiseLv: number; readonly appraiseCost: number; readonly canAppraise: boolean; readonly appraiseMaxed: boolean; readonly rarePct: number; readonly epicPct: number }
export interface MineBoostVM { readonly lv: number; readonly cost: number; readonly can: boolean; readonly pct: number }
/** コインで買う全体強化（走行限定）。 */
export interface MineCoinUpVM { readonly id: CoinUpId; readonly emoji: string; readonly label: string; readonly desc: string; readonly lv: number; readonly cost: number; readonly can: boolean; readonly pct: number }
export interface MineHudVM {
  readonly coins: number; readonly floor: number; readonly progressPct: number; readonly runPoints: number;
  readonly level: number; readonly xp: number; readonly xpNext: number; readonly autoMode: boolean;
  readonly offer: readonly MineOfferVM[];
  readonly weapons: readonly MineGearVM[]; readonly passives: readonly MineGearVM[];
  readonly weaponSlots: string; readonly passiveSlots: string;
  readonly damageShare: readonly MineDmgShareVM[];
  readonly damageMods: readonly MineDmgModVM[];
  readonly meta: MineMetaVM;
  readonly boost: MineBoostVM;
  readonly coinUps: readonly MineCoinUpVM[];
  readonly autoEffPct: number; // 自動モードの火力倍率%（手動は実質100%）
  readonly idleBonusPct: number; readonly idleBonusMaxed: boolean; // 放置(時間経過)ボーナス%（火力＆採掘速度・上限あり）
}

/** 所持する強化のうち威力に効くものの現在倍率（ダメージ影響度）。 */
function damageMods(state: MineState): MineDmgModVM[] {
  const t = passiveTotals(state.levels);
  const out: MineDmgModVM[] = [];
  const add = (id: PassiveId, scope: string, mult: number): void => {
    if (state.levels[id] > 0) out.push({ emoji: choiceMeta(id).emoji, label: choiceMeta(id).label, scope, mult });
  };
  if (state.boost > 0) out.push({ emoji: '🔥', label: 'ブースト', scope: '全武器', mult: boostMul(state.boost) });
  if (t.power > 0) out.push({ emoji: '💪', label: '威力系', scope: '全武器', mult: 1 + t.power }); // 威力＋強撃の合算
  add('crit', '平均', 1 + t.crit * (B.critMult - 1));
  add('whet', '近接', 1 + t.meleeDmg);
  add('powder', '射撃', 1 + t.shotDmg);
  add('lens', 'ビーム', 1 + t.beamDmg);
  add('echo', '範囲', 1 + t.fieldDmg);
  // 武器固有ユニーク（その武器だけに乗る倍率）
  for (const id of PASSIVE_IDS) {
    const def = PASSIVE_DEFS[id];
    if (!def.targetWeapon || state.levels[id] <= 0) continue;
    out.push({ emoji: def.emoji, label: def.label, scope: choiceMeta(def.targetWeapon).label, mult: 1 + t.perWeapon[def.targetWeapon] });
  }
  return out;
}

export function buildMineHud(state: MineState): MineHudVM {
  const weapons = WEAPON_IDS.filter((id) => state.levels[id] > 0).map((id) => ({ emoji: choiceMeta(id).emoji, label: choiceMeta(id).label, lv: state.levels[id], detail: choiceDetail(id, state.levels[id]) }));
  const passives = PASSIVE_IDS.filter((id) => state.levels[id] > 0).map((id) => ({ emoji: choiceMeta(id).emoji, label: choiceMeta(id).label, lv: state.levels[id], detail: choiceDetail(id, state.levels[id]) }));
  const totalDmg = WEAPON_IDS.reduce((a, w) => a + state.dmgByWeapon[w], 0);
  return {
    coins: Math.floor(state.coins), floor: state.floor, runPoints: state.runPoints,
    progressPct: Math.min(100, (state.dug.size / TOTAL_TILES) * 100),
    level: state.level, xp: Math.floor(state.xp), xpNext: xpForNext(state.level), autoMode: state.autoMode,
    offer: (state.offer ?? []).map((ch, index) => ({ index, label: choiceMeta(ch.id).label, emoji: choiceMeta(ch.id).emoji, desc: choiceMeta(ch.id).desc, detail: choiceDetail(ch.id, state.levels[ch.id]), lv: state.levels[ch.id], rarity: ch.rarity, bonusEmoji: ch.bonus ? choiceMeta(ch.bonus).emoji : null, isWeapon: isWeapon(ch.id) })),
    weapons, passives,
    weaponSlots: `${weapons.length}/${B.maxWeapons}`, passiveSlots: `${passives.length}/${B.maxPassives}`,
    damageShare: WEAPON_IDS.filter((w) => state.dmgByWeapon[w] > 0).map((w) => ({ emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, pct: totalDmg > 0 ? (state.dmgByWeapon[w] / totalDmg) * 100 : 0 })).sort((a, b) => b.pct - a.pct),
    damageMods: damageMods(state),
    meta: { appraiseLv: state.meta.appraise, appraiseCost: appraiseCost(state.meta.appraise), canAppraise: !appraiseCapped(state.meta.appraise) && state.coins >= appraiseCost(state.meta.appraise), appraiseMaxed: appraiseCapped(state.meta.appraise), rarePct: Math.round(rareChance(state.meta.appraise) * 100), epicPct: Math.round(epicChance(state.meta.appraise) * 100) },
    boost: { lv: state.boost, cost: boostCost(state.boost), can: state.coins >= boostCost(state.boost), pct: Math.round((boostMul(state.boost) - 1) * 100) },
    coinUps: COIN_UP_IDS.map((id) => {
      const def = COIN_UP_DEFS[id]; const cost = coinUpCost(id, state.coinUp);
      return { id, emoji: def.emoji, label: def.label, desc: def.desc, lv: state.coinUp[id], cost, can: state.coins >= cost, pct: Math.round(state.coinUp[id] * def.perLvl * 100) };
    }),
    autoEffPct: Math.round(autoEfficiency(state.perm.idle) * 100),
    idleBonusPct: Math.round(Math.min(B.timePowerCap, (state.time / 60000) * B.timePowerPerMin) * 100),
    idleBonusMaxed: (state.time / 60000) * B.timePowerPerMin >= B.timePowerCap,
  };
}

// ===== 転生パネル =====
export interface MineMatVM { readonly id: MaterialId; readonly emoji: string; readonly name: string; readonly count: number }
export interface MineRefineVM { readonly from: MaterialId; readonly fromEmoji: string; readonly toEmoji: string; readonly ratio: number; readonly can: boolean }
/** 武器ごとの恒久スキルツリー（武器別サブタブ・分岐グラフ）。 */
export interface MineSkillNodeVM {
  readonly index: number; readonly x: number; readonly y: number; readonly tier: number;
  readonly emoji: string; readonly label: string; readonly big: boolean; readonly root: boolean;
  readonly costs: readonly { readonly emoji: string; readonly amount: number; readonly enough: boolean }[]; // 必要素材（複数）
  readonly state: 'unlocked' | 'available' | 'locked'; readonly visible: boolean; readonly can: boolean;
}
/** ツリーで強化された累積内容（分かりやすい表示用）。 */
export interface MineTreeStatVM { readonly emoji: string; readonly label: string; readonly text: string }
/** 階層タブ1段ぶん（垂直タブ＝各階層が1グリッド）。 */
export interface MineTierVM { readonly tier: number; readonly size: number; readonly open: boolean; readonly bought: number; readonly total: number; readonly need: number }
export type SkillTreeTarget = WeaponId | 'main';
export interface MineWeaponTreeVM {
  readonly id: SkillTreeTarget; readonly emoji: string; readonly label: string; readonly isMain: boolean;
  readonly skillNodes: readonly MineSkillNodeVM[]; readonly tiers: readonly MineTierVM[]; readonly skillUnlocked: number; readonly skillTotal: number;
  readonly mastery: number; readonly masteryPct: number; readonly stats: readonly MineTreeStatVM[];
}
/** 放置ツリー（自動効率・素材=銀）。 */
export interface MineIdleVM { readonly lv: number; readonly maxLv: number; readonly autoEffPct: number; readonly cost: number | null; readonly matEmoji: string; readonly can: boolean; readonly maxed: boolean }
/** ★＝累計で全体ダメージが自動UP（消費しない）。 */
export interface MineStarVM { readonly earned: number; readonly mult: number }
/** 武器の解放状態（基本2種＋累計★で自動解放）。star=必要累計★。 */
export interface MineWeaponUnlockVM { readonly id: WeaponId; readonly emoji: string; readonly label: string; readonly status: 'base' | 'unlocked' | 'locked'; readonly star: number }
export interface MinePrestigeVM {
  readonly prestiges: number; readonly runPoints: number; readonly starEarned: number;
  readonly materials: readonly MineMatVM[]; readonly refines: readonly MineRefineVM[];
  readonly weaponTree: readonly MineWeaponTreeVM[]; readonly idle: MineIdleVM; readonly star: MineStarVM;
  readonly unlocks: readonly MineWeaponUnlockVM[]; readonly nextUnlock: { readonly emoji: string; readonly star: number } | null;
  readonly masteryGains: readonly { readonly id: WeaponId; readonly emoji: string; readonly from: number; readonly to: number }[];
}

/** スキルノードの表示文（amount を stat に応じて整形）。武器/メイン共通。 */
const skillNodeLabel = (stat: SkillStat, amount: number): string => {
  const def = skillStatDef(stat);
  const v = def.count ? `+${amount}` : `+${Math.round(amount * 100)}%`;
  return `${def.label} ${v}`;
};

export function buildPrestige(state: MineState): MinePrestigeVM {
  return {
    prestiges: state.prestiges,
    runPoints: state.runPoints,
    starEarned: state.perm.starEarned,
    unlocks: [...BASE_WEAPONS, ...WEAPON_UNLOCK_ORDER].map((w) => {
      const star = weaponUnlockStar(w);
      const status = BASE_WEAPONS.includes(w) ? 'base' as const : state.perm.starEarned >= star ? 'unlocked' as const : 'locked' as const;
      return { id: w, emoji: choiceMeta(w).emoji, label: choiceMeta(w).label, status, star };
    }),
    nextUnlock: (() => {
      const w = WEAPON_UNLOCK_ORDER.find((x) => state.perm.starEarned < weaponUnlockStar(x));
      return w ? { emoji: choiceMeta(w).emoji, star: weaponUnlockStar(w) } : null;
    })(),
    star: { earned: state.perm.starEarned, mult: Math.round(globalDamageMult(state.perm.starEarned) * 100) },
    masteryGains: WEAPON_IDS.filter((w) => state.dmgByWeapon[w] > 0).map((w) => ({ id: w, emoji: choiceMeta(w).emoji, from: state.perm.mastery[w] ?? 0, to: (state.perm.mastery[w] ?? 0) + 1 })),
    materials: MATERIAL_IDS.map((id) => ({ id, emoji: B.kinds[id].emoji, name: B.kinds[id].name, count: state.materials[id] })),
    refines: MATERIAL_IDS.slice(0, -1).map((from, i) => ({ from, fromEmoji: matEmoji(from), toEmoji: matEmoji(MATERIAL_IDS[i + 1]!), ratio: B.refineRatio, can: state.materials[from] >= B.refineRatio })),
    idle: (() => {
      const cost = idleCost(state.perm.idle); const maxLv = idleMaxLevel();
      return { lv: state.perm.idle, maxLv, autoEffPct: Math.round(autoEfficiency(state.perm.idle) * 100), cost, matEmoji: matEmoji(IDLE_MATERIAL), can: cost !== null && state.materials[IDLE_MATERIAL] >= cost, maxed: cost === null };
    })(),
    weaponTree: [...WEAPON_IDS.map((w) => buildTreeVM(state, w)), buildTreeVM(state, 'main')],
  };
}

/** 1ツリー（武器 orメイン）のVMを構築。 */
function buildTreeVM(state: MineState, target: SkillTreeTarget): MineWeaponTreeVM {
  const isMain = target === 'main';
  const nodes = isMain ? mainSkillNodes() : weaponSkillNodes(target);
  const unlocked = isMain ? state.perm.mainSkill : state.perm.weaponSkill[target];
  const mastery = isMain ? 0 : (state.perm.mastery[target] ?? 0);
  const acc = sumSkillStats(nodes, unlocked); // 解放済みの累積ステータス（武器/メイン共通）
  const statOrder = isMain ? MAIN_STATS : WEAPON_STATS;
  const stats: MineTreeStatVM[] = statOrder.filter((s) => (acc[s] ?? 0) > 0).map((s) => {
    const def = skillStatDef(s); const v = acc[s] ?? 0;
    return { emoji: def.emoji, label: def.label, text: def.count ? `+${v}` : `+${Math.round(v * 100)}%` };
  });
  const skillNodes = nodes.map((n, i) => {
    const isUnlocked = unlocked.includes(i);
    const available = skillNodeUnlockable(target, unlocked, i);
    return {
      index: i, x: n.x, y: n.y, tier: n.tier, emoji: skillStatDef(n.stat).emoji, label: skillNodeLabel(n.stat, n.amount),
      costs: n.matCosts.map((c) => ({ emoji: matEmoji(c.matId), amount: c.amount, enough: state.materials[c.matId] >= c.amount })),
      big: !!n.big, root: !!n.root,
      state: isUnlocked ? 'unlocked' as const : available ? 'available' as const : 'locked' as const,
      visible: isUnlocked || available,
      can: available && n.matCosts.every((c) => state.materials[c.matId] >= c.amount),
    };
  });
  const tiers: MineTierVM[] = Array.from({ length: SKILL_TIERS }, (_, tier) => {
    const inTier = nodes.filter((n) => n.tier === tier).length;
    const bought = unlocked.filter((i) => nodes[i]?.tier === tier).length;
    return { tier, size: skillGridSize(tier), open: skillGridOpen(target, unlocked, tier), bought, total: inTier, need: tier < SKILL_TIERS - 1 ? skillGridUnlockNeed(tier) : 0 };
  });
  return {
    id: target, isMain, emoji: isMain ? '🌐' : choiceMeta(target).emoji, label: isMain ? '全体強化' : choiceMeta(target).label, tiers,
    skillUnlocked: unlocked.length, skillTotal: nodes.length,
    mastery, masteryPct: Math.round(mastery * B.masteryPerLvl * 100), stats, skillNodes,
  };
}

// ===== フック =====
export const useMineView = (): MineViewVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildMineView(s), [s]); };
export const useMineHud = (): MineHudVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildMineHud(s), [s]); };
export const useMinePrestige = (): MinePrestigeVM => { const s = useMiningStore((x) => x.state); return useMemo(() => buildPrestige(s), [s]); };
export const useMineChoose = (): ((index: number) => void) => useMiningStore((s) => s.chooseOffer);
export const useMineToggleAuto = (): (() => void) => useMiningStore((s) => s.toggleAuto);
export const useMineBuyAppraise = (): (() => void) => useMiningStore((s) => s.buyAppraise);
export const useMineBuyBoost = (): (() => void) => useMiningStore((s) => s.buyBoost);
export const useMinePrestigeAct = (): (() => void) => useMiningStore((s) => s.prestige);
export const useMineBuyCoinUp = (): ((id: CoinUpId) => void) => useMiningStore((s) => s.buyCoinUp);
export const useMineBuyWeaponSkill = (): ((target: SkillTreeTarget, nodeIndex: number) => void) => useMiningStore((s) => s.buyWeaponSkill);
export const useMineBuyWeaponSkillMax = (): ((target: SkillTreeTarget) => void) => useMiningStore((s) => s.buyWeaponSkillMax);
export const useMineBuyIdle = (): (() => void) => useMiningStore((s) => s.buyIdle);
export const useMineSetTarget = (): ((cell: { x: number; y: number }) => void) => useMiningStore((s) => s.setTarget);
export const useMineRefine = (): ((from: MaterialId) => void) => useMiningStore((s) => s.refine);
export const useMineSave = (): (() => void) => useMiningStore((s) => s.save);
export const useMineResetData = (): (() => void) => useMiningStore((s) => s.resetData);
export const useMineExportSave = (): (() => string) => useMiningStore((s) => s.exportSave);
export const useMineImportSave = (): ((text: string) => boolean) => useMiningStore((s) => s.importSave);
