import type { Cell } from '@domain/grid/position';
import { cellKey, sameCell } from '@domain/grid/position';
import { createRng, type Rng } from '@shared/rng';
import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_DEFS, WEAPON_IDS, COIN_UP_DEFS } from '@domain/mining/balance';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileDist, tileValue } from '@domain/mining/tile';
import { stepToward, patternHits } from '@domain/mining/patterns';
import { type MineState, type Levels, type WeaponStatLevels } from '@application/mining/mineState';
import { weaponSkillStats, autoEfficiency, allowedWeapons, globalDamageMult } from '@application/mining/prestige';
import { xpForNext, makeOffer, autoPick, boostMul } from '@application/mining/upgrades';
import { passiveTotals, weaponDmg, weaponRange, weaponMult, type EffectTotals } from '@application/mining/weapons';

export const MINE_STEP_MS = 100;

const isDug = (dug: ReadonlySet<string>, c: Cell): boolean => dug.has(cellKey(c));
const isSolid = (dug: ReadonlySet<string>, c: Cell, b: MiningBalance): boolean => inBounds(c, b) && !dug.has(cellKey(c));

function pickTarget(dug: ReadonlySet<string>, from: Cell, rng: Rng, b: MiningBalance): Cell | null {
  for (let R = 4; R <= b.worldSize * 2; R *= 2) {
    const cands: Cell[] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const c = { x: from.x + dx, y: from.y + dy };
      if (isSolid(dug, c, b)) cands.push(c);
    }
    if (cands.length > 0) return cands[Math.floor(rng.next() * cands.length)] ?? null;
  }
  return null;
}

export function miningFront(state: MineState, b: MiningBalance = defaultMiningBalance): Cell | null {
  const { cat } = state;
  if (!cat.target || sameCell(cat.pos, cat.target)) return null;
  const next = stepToward(cat.pos, cat.target);
  return isSolid(state.dug, next, b) ? next : null;
}

/** 武器発射に必要な文脈（1tick分・読み取り専用）。 */
interface FireCtx {
  readonly dug: ReadonlySet<string>;
  readonly pos: Cell;
  readonly target: Cell | null;
  readonly levels: Levels;
  readonly totals: EffectTotals;
  readonly skillStats: Record<WeaponId, WeaponStatLevels>; // 恒久スキルツリーの累積ステータス（amount）
  readonly mastery: Record<WeaponId, number>; // 武器ごとの熟練度（恒久・転生で使った武器が伸びる）
  readonly globalMul: number; // 採掘ブースト（走行限定・全武器共通）
  readonly dtMs: number;
  readonly cd: Record<WeaponId, number>; // 武器ごとの攻撃クールダウン蓄積（この場で加算・消費）
  readonly rangeBonus: number;
  readonly pierceBonus: number;
  readonly b: MiningBalance;
}

/** 所持する全武器を「攻撃間隔ごと」に発射し、当たったマスへ deal でダメージを与える（命中判定は deal 側）。 */
function fireWeapons(ctx: FireCtx, deal: (cell: Cell, amt: number, w: WeaponId) => void): void {
  const { dug, pos, target, levels: L, totals: t, skillStats, mastery, globalMul, dtMs, cd, rangeBonus, pierceBonus, b } = ctx;
  for (const id of WEAPON_IDS) {
    const lvl = L[id];
    if (lvl <= 0) continue;
    const def = WEAPON_DEFS[id];
    const sk = skillStats[id];
    // 強化は恒久スキルツリー(skill amount)から。特殊効果(貫通/範囲)もすべてツリー。
    const damageBonus = sk.damage;
    const speedBonus = sk.speed;
    const uniqueBonus = sk.unique;
    const rangeAdd = sk.range;
    const pierceAdd = sk.pierce;
    const areaAdd = sk.area; // 範囲: 前方/爆発/ビーム/ドリル=spread+、弾=同時対象+
    // 攻撃速度強化: 実効間隔を縮める（1ヒットの威力は基準間隔のままなので手数=DPSが増える）。
    const interval = def.attackIntervalMs / (1 + speedBonus);
    cd[id] += dtMs;
    if (cd[id] < interval) continue; // まだクールダウン中
    cd[id] -= interval;              // 1回攻撃（位相を保つ）
    const upDmg = (1 + damageBonus) * (1 + uniqueBonus);                 // スキルツリー(ダメージ/固有)
    const masteryUp = 1 + (mastery[id] ?? 0) * b.masteryPerLvl;          // 熟練度(恒久・線形)
    const dmg = weaponDmg(def, lvl) * weaponMult(def, t) * upDmg * masteryUp * globalMul * (def.attackIntervalMs / 1000); // 1ヒット=基準間隔ぶんの塊
    const range = weaponRange(def, lvl, rangeBonus + rangeAdd);
    const lineRange = range + pierceBonus + pierceAdd;                   // 直線系の長さ（貫通はツリー）
    // 範囲段階(方向/横幅): レベル(areaPerLvls段ごと)＋ツリーの範囲投資。弾は同時対象に回す。
    const spread = Math.floor((lvl - 1) / b.areaPerLvls) + (def.pattern === 'nearest' ? 0 : areaAdd);
    const targets = 1 + (def.pattern === 'nearest' ? areaAdd : 0); // 弾はツリーの範囲で多点同時
    // 範囲（当たるマス＋威力係数）は patterns.ts に分離。ここは「dmg×factor を与える」だけ。
    const hits = patternHits(def.pattern, { pos, target, range, lineRange, spread, targets, rangeBase: def.rangeBase, isSolid: (c) => isSolid(dug, c, b) });
    for (const h of hits) deal(h.cell, dmg * h.factor, id);
  }
}

function descend(state: MineState, b: MiningBalance): MineState {
  const base = baseOf(b);
  return { ...state, floor: state.floor + 1, dug: new Set([cellKey(base)]), damage: new Map(), drops: [], cat: { pos: { ...base }, gauge: 0, target: null }, cam: { ...base } };
}

function stepOnce(state: MineState, dtMs: number, b: MiningBalance): MineState {
  const dug = state.dug;
  const damage = state.damage;
  const dt = dtMs / 1000;
  const now = state.time + dtMs;
  const rng = createRng(state.rngState);
  const L = state.levels;
  const t = passiveTotals(L);
  let pos = state.cat.pos;
  const cu = state.coinUp; // コインで買う全体強化（走行限定）: 移動/素材/コイン。
  const moveCost = b.moveCost / (1 + t.move + cu.haste * COIN_UP_DEFS.haste.perLvl);
  // 繰り越す移動ゲージは1マスぶんに制限。壁の手前で詰まっている間に溜め込み、壊れた瞬間に大量ワープするのを防ぐ。
  let gauge = Math.min(state.cat.gauge, moveCost) + b.baseRate * (1 + t.rate) * dt;
  let target = state.cat.target;
  let coins = state.coins;
  let xpGain = 0;
  let seq = state.seq;
  let drops = state.drops;
  let cleared = false;
  const materials = { ...state.materials };
  const dmgAcc = { ...state.dmgByWeapon };
  const hits = new Map<WeaponId, Cell[]>(); // このtickで武器が当てたマス（エフェクト用）
  const total = totalTilesOf(b);
  const coinMult = 1 + t.coin + cu.luck * COIN_UP_DEFS.luck.perLvl;
  const matChance = t.material + cu.greed * COIN_UP_DEFS.greed.perLvl;
  const rangeBonus = Math.floor(t.range);
  const pierceBonus = Math.floor(t.pierce); // 貫通: ビーム/ドリル(直線)が奥まで届く

  const applyDmg = (cell: Cell, baseAmt: number, w: WeaponId): void => {
    if (cleared || !isSolid(dug, cell, b)) return;
    const amt = rng.next() < t.crit ? baseAmt * b.critMult : baseAmt; // 会心
    let hc = hits.get(w); if (!hc) { hc = []; hits.set(w, hc); } hc.push(cell); // 命中マスを記録（演出）
    const k = cellKey(cell);
    const kind = kindAt(cell, state.floor, b);
    const HP = tileHardness(state.floor, tileDist(cell, b), kind.hardMult, b); // 距離＋種類で固さが変わる
    const prev = damage.get(k) ?? 0;
    dmgAcc[w] += Math.min(amt, HP - prev); // 寄与はブロックのHPを超えた分(オーバーキル)を含めない
    const d = prev + amt;
    if (d < HP) { damage.set(k, d); return; }
    damage.delete(k);
    dug.add(k);
    coins += tileValue(kind, state.floor, coinMult, b);
    materials[kind.id] += 1 + (rng.next() < matChance ? 1 : 0); // 強欲
    xpGain += 1 + t.xp;
    seq += 1;
    drops = [...drops, { id: seq, x: cell.x, y: cell.y, emoji: kind.emoji, value: tileValue(kind, state.floor, coinMult, b), bornAt: now }];
    if (dug.size >= total) cleared = true;
  };

  // 移動: ターゲットへ空洞を歩く（壁の手前で止まり武器で削る）。
  if (state.autoMode) {
    if (!target || !isSolid(dug, target, b)) target = pickTarget(dug, pos, rng, b); // 自動は最寄りを自分で選ぶ
  } else if (target && (sameCell(pos, target) || !inBounds(target, b))) {
    target = null; // 手動: 到達/圏外で解除（次のクリック待ち）。プレイヤーがcat.targetを設定する。
  }
  if (target) {
    let guard = 0;
    while (gauge >= moveCost && !sameCell(pos, target) && guard++ < 64) {
      const next = stepToward(pos, target);
      if (sameCell(next, pos) || !isDug(dug, next)) break;
      gauge -= moveCost; pos = next;
    }
  }

  // 武器発射（武器ごとの攻撃間隔で発射）。採掘ブースト(コイン)＋★全体ダメージ(恒久)＋自動効率(自動は火力減・放置ツリーで回復)。
  const globalMul = boostMul(state.boost, b) * globalDamageMult(state.perm.starEarned, b) * (state.autoMode ? autoEfficiency(state.perm.idle, b) : 1);
  const weaponCd = { ...state.weaponCd };
  const skillStats = Object.fromEntries(WEAPON_IDS.map((w) => [w, weaponSkillStats(w, state.perm.weaponSkill[w])])) as Record<WeaponId, WeaponStatLevels>;
  fireWeapons({ dug, pos, target, levels: L, totals: t, skillStats, mastery: state.perm.mastery, globalMul, dtMs, cd: weaponCd, rangeBonus, pierceBonus, b }, applyDmg);

  // 階クリアで降下。獲得予定★(runPoints)は「進行」で貯まる: 階を降りるごとに pointsPerFloor×新しい階。
  if (cleared) return descend({ ...state, rngState: rng.state(), coins, xp: state.xp + xpGain, seq, dmgByWeapon: dmgAcc, weaponCd, materials, runPoints: state.runPoints + b.pointsPerFloor * (state.floor + 1) }, b);

  // 武器の命中演出を追加（武器ごとに当たったマス）。古いものは寿命で消す。
  let fx = state.fx;
  if (hits.size > 0) {
    const fresh = [...hits].map(([w, cells]) => ({ id: now * 8 + WEAPON_IDS.indexOf(w), weapon: w, origin: pos, cells, bornAt: now }));
    fx = [...fx, ...fresh];
  }
  if (fx.length > 0) { const keep = fx.filter((f) => now - f.bornAt < b.fxVisualMs); if (keep.length !== fx.length) fx = keep; }

  // 演出ドロップは一定時間で消す（回収は済み）。
  if (drops.length > 0) { const keep = drops.filter((d) => now - d.bornAt < b.dropVisualMs); if (keep.length !== drops.length) drops = keep; }

  // コイン強化(目利き/ブースト)は手動購入のみ（自動購入はしない）。
  const meta = state.meta;
  const boost = state.boost;

  // レベルアップ解決（3択・レア度つき）。★は1レベルごとに pointsPerLevel。
  let xp = state.xp + xpGain;
  let level = state.level;
  let levels = state.levels;
  let offer = state.offer;
  let offerAt = state.offerAt;
  let runPoints = state.runPoints;
  // 三択は特殊効果を持たない（レア=+2Lv / エピック=+1Lv＋既存1つ+1）。特殊強化は転生ツリーへ。
  const applyChoice = (ch: ReturnType<typeof autoPick>): void => {
    levels = { ...levels, [ch.id]: levels[ch.id] + (ch.rarity === 'rare' ? 2 : 1) };
    if (ch.rarity === 'epic' && ch.bonus) levels = { ...levels, [ch.bonus]: levels[ch.bonus] + 1 };
  };
  // 保留中の3択を一定時間放置したら自動選択（手動が基本・なにもしなければ自動）。
  if (offer && offerAt !== null && now - offerAt >= b.offerAutoMs) {
    applyChoice(autoPick(offer, rng));
    offer = null; offerAt = null;
  }
  const allowed = allowedWeapons(state.perm); // 序盤は2種のみ、★で解放
  while (!offer && xp >= xpForNext(level, b)) {
    xp -= xpForNext(level, b);
    level += 1;
    runPoints += b.pointsPerLevel; // 進行で獲得予定★が貯まる（転生でもらえる）
    const choices = makeOffer(rng, levels, meta.appraise, allowed, b);
    if (state.autoMode) applyChoice(autoPick(choices, rng));
    else { offer = choices; offerAt = now; } // 手動: 3択を提示して待つ
  }

  return {
    ...state,
    time: now, coins, rev: state.rev + 1, seq, rngState: rng.state(), drops, fx,
    cat: { pos, gauge, target }, cam: pos, // 猫は常に画面中央（カメラ＝猫の位置に固定）
    xp, level, levels, offer, offerAt, meta, boost, dmgByWeapon: dmgAcc, weaponCd, materials, runPoints,
  };
}

export function stepMine(state: MineState, dtMs: number, b: MiningBalance = defaultMiningBalance): MineState {
  let s = state;
  let remaining = dtMs;
  while (remaining > 0.0001) {
    const dt = Math.min(MINE_STEP_MS, remaining);
    s = stepOnce(s, dt, b);
    remaining -= dt;
  }
  return s;
}
