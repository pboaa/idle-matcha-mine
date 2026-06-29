import type { Cell } from '@domain/grid/position';
import { cellKey, sameCell } from '@domain/grid/position';
import { createRng, type Rng } from '@shared/rng';
import type { MiningBalance, WeaponId } from '@domain/mining/balance';
import { defaultMiningBalance, WEAPON_DEFS, WEAPON_IDS, COIN_UP_DEFS } from '@domain/mining/balance';
import { baseOf, totalTilesOf, inBounds, kindAt, tileHardness, tileDist, tileValue } from '@domain/mining/tile';
import { type MineState, type Levels, type WeaponStatLevels } from '@application/mining/mineState';
import { weaponSkillStats, autoEfficiency, allowedWeapons, globalDamageMult } from '@application/mining/prestige';
import { xpForNext, makeOffer, autoPick, boostMul } from '@application/mining/upgrades';
import { passiveTotals, weaponDmg, weaponRange, weaponMult, type EffectTotals } from '@application/mining/weapons';

export const MINE_STEP_MS = 100;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIRS_H = [[1, 0], [-1, 0]] as const;                 // 2方向（横）
const DIRS_8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const; // 8方向

const isDug = (dug: ReadonlySet<string>, c: Cell): boolean => dug.has(cellKey(c));
const isSolid = (dug: ReadonlySet<string>, c: Cell, b: MiningBalance): boolean => inBounds(c, b) && !dug.has(cellKey(c));

/** カメラ追従（デッドゾーン）: 猫が中央±dz内なら世界を固定、外に出たら最小限だけ追従。猫スプライトが滑らかに動く。 */
function followCam(cam: Cell, pos: Cell, dz: number): Cell {
  const fx = pos.x - cam.x, fy = pos.y - cam.y;
  return { x: cam.x + (fx > dz ? fx - dz : fx < -dz ? fx + dz : 0), y: cam.y + (fy > dz ? fy - dz : fy < -dz ? fy + dz : 0) };
}

function stepToward(from: Cell, target: Cell): Cell {
  const dx = target.x - from.x; const dy = target.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: from.x + Math.sign(dx), y: from.y };
  if (dy !== 0) return { x: from.x, y: from.y + Math.sign(dy) };
  return from;
}
const dirToward = (from: Cell, target: Cell): Cell => { const n = stepToward(from, target); return { x: Math.sign(n.x - from.x), y: Math.sign(n.y - from.y) }; };

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

export function nearestSolid(dug: ReadonlySet<string>, from: Cell, range: number, b: MiningBalance = defaultMiningBalance): Cell | null {
  for (let r = 1; r <= range; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: from.x + dx, y: from.y + dy };
      if (isSolid(dug, c, b)) return c;
    }
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
    switch (def.pattern) {
      case 'front': { // ツルハシ: 前方1マス。範囲(area)で1マスずつ右→左→右…と横に広がる（spread2で前方+右+左=3方向）。
        if (target) { const f = stepToward(pos, target); if (!sameCell(f, pos)) {
          const d = dirToward(pos, target); const perp = { x: d.y, y: d.x };
          deal(f, dmg, id);
          for (let s = 1; s <= spread; s++) { const k = Math.ceil(s / 2); const sign = s % 2 === 1 ? 1 : -1; deal({ x: f.x + perp.x * sign * k, y: f.y + perp.y * sign * k }, dmg, id); }
        } } break; }
      case 'nearest': { // 弾: 固有特性で「targets」点を同時に撃つ（最寄りから順に）。
        let hit = 0;
        for (let r = 1; r <= range && hit < targets; r++) for (let dy = -r; dy <= r && hit < targets; dy++) for (let dx = -r; dx <= r && hit < targets; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: pos.x + dx, y: pos.y + dy };
          if (isSolid(dug, c, b)) { deal(c, dmg, id); hit++; }
        }
        break; }
      case 'burst': { const c = nearestSolid(dug, pos, range, b); if (c) { const br = 1 + Math.floor(spread / 2); for (let dy = -br; dy <= br; dy++) for (let dx = -br; dx <= br; dx++) deal({ x: c.x + dx, y: c.y + dy }, dmg, id); } break; }
      case 'cross': { // ビーム: spreadで 2方向→4方向→8方向。方向が増えるほど1方向は弱く＝総DPSは一定で被覆だけ広がる（化け防止）。
        const dirs = spread <= 0 ? DIRS_H : spread === 1 ? DIRS : DIRS_8;
        const dmgDir = dmg * (2 / dirs.length);
        for (const [dx, dy] of dirs) for (let r = 1; r <= lineRange; r++) deal({ x: pos.x + dx * r, y: pos.y + dy * r }, dmgDir, id); break; }
      case 'forward': { // ドリル: 直線、spreadで横幅が増える。横幅は被覆用＝総DPSは一定（化け防止）。
        const d = target ? dirToward(pos, target) : { x: 1, y: 0 }; const perp = { x: d.y, y: d.x }; const hw = Math.floor(spread / 2);
        const dmgW = dmg / (1 + 2 * hw);
        for (let r = 1; r <= lineRange; r++) { deal({ x: pos.x + d.x * r, y: pos.y + d.y * r }, dmgW, id); for (let k = 1; k <= hw; k++) { deal({ x: pos.x + d.x * r + perp.x * k, y: pos.y + d.y * r + perp.y * k }, dmgW, id); deal({ x: pos.x + d.x * r - perp.x * k, y: pos.y + d.y * r - perp.y * k }, dmgW, id); } } break; }
      case 'around': { // オーラ: 半径が増えても総DPSは一定（範囲は被覆用・射程投資で爆発しない）。
        const baseTiles = (2 * def.rangeBase + 1) ** 2, tiles = (2 * range + 1) ** 2; const dmgA = dmg * baseTiles / tiles;
        for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) deal({ x: pos.x + dx, y: pos.y + dy }, dmgA, id); break; }
      case 'ring': { // リング: 外周。半径が増えても総DPSは一定。
        const dmgR = dmg * def.rangeBase / Math.max(1, range);
        for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === range) deal({ x: pos.x + dx, y: pos.y + dy }, dmgR, id); break; }
    }
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
    cat: { pos, gauge, target }, cam: followCam(state.cam, pos, b.camDeadzone),
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
