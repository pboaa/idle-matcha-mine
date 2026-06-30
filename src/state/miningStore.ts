import { create } from 'zustand';
import { type MineState } from '@application/mining/mineState';
import { stepMine, MINE_STEP_MS } from '@application/mining/step';
import { buyRunUnlock, buyRunBulk, rerollRun } from '@application/mining/upgrades';
import { prestige, startRun, unlockWeapon, buySkill, buySkillMax, buyCapUpgrade, buyTreasurePower } from '@application/mining/prestige';
import type { WeaponId } from '@domain/mining/balance';
type SkillTreeTarget = WeaponId | 'main';
import type { Cell } from '@domain/grid/position';
import { loadState, saveState, clearSave, freshState, exportSave, importSave } from '@state/persistence';

interface MiningStore {
  readonly state: MineState;
  tick: (realDtMs: number) => void;
  catchUp: (realMs: number) => void; // 離席/オフラインぶんを一括で進める（バックグラウンド処理）
  toggleAuto: () => void;
  buyRunUnlock: (index: number) => void;   // 走行グリッド: コインで解放（お宝+1）
  buyRunBulk: () => void;                  // 走行グリッド: コインで一括解放
  rerollRun: () => void;                   // 走行グリッド: コインで未解放マスを再抽選
  prestige: () => void;
  startRun: (w: WeaponId) => void;         // 開始武器を選んで走行をやり直す
  unlockWeapon: (w: WeaponId) => void;     // ★で武器を解放
  buyCapUpgrade: () => void;               // お宝で走行グリッド上限+
  buyTreasurePower: () => void;            // お宝で永続全体火力+
  buyWeaponSkill: (target: SkillTreeTarget, nodeIndex: number) => void;
  buyWeaponSkillMax: (target: SkillTreeTarget) => void;
  setTarget: (cell: Cell) => void; // 手動モードで猫の目標を設定
  save: () => void;       // 即時セーブ（離脱時など）
  resetData: () => void;  // セーブ削除して最初から
  exportSave: () => string;          // セーブを文字列で書き出し
  importSave: (text: string) => boolean; // 文字列からセーブを読み込み（成功でtrue）
}

let accumulatorMs = 0;
let lastSaveMs = 0;
const AUTOSAVE_MS = 3000;
const MAX_CATCHUP_MS = 8 * 60 * 60 * 1000; // 離席/オフラインの追いつき上限（8時間ぶんまで一括計算）

export const useMiningStore = create<MiningStore>((set, get) => ({
  state: loadState() ?? freshState(), // 保存済みがあれば続きから、なければ新規
  tick: (realDtMs) => {
    accumulatorMs += realDtMs;
    const maxBatch = MINE_STEP_MS * 20; // ライブ描画は1フレーム最大2秒ぶん（カクつき防止）。離席ぶんは catchUp 側で処理。
    if (accumulatorMs > maxBatch) accumulatorMs = maxBatch;
    if (accumulatorMs < MINE_STEP_MS) return;
    const steps = Math.floor(accumulatorMs / MINE_STEP_MS);
    accumulatorMs -= steps * MINE_STEP_MS;
    const state = stepMine(get().state, steps * MINE_STEP_MS);
    set({ state });
    const now = Date.now();
    if (now - lastSaveMs > AUTOSAVE_MS) { lastSaveMs = now; saveState(state); } // 自動セーブ（3秒ごと）
  },
  catchUp: (realMs) => { // タブを閉じていた/隠れていたぶんをまとめて進める（バックグラウンド処理）。
    const ms = Math.min(Math.max(0, realMs), MAX_CATCHUP_MS);
    if (ms < MINE_STEP_MS) return;
    const steps = Math.floor(ms / MINE_STEP_MS);
    const state = stepMine(get().state, steps * MINE_STEP_MS);
    set({ state }); lastSaveMs = Date.now(); saveState(state);
  },
  toggleAuto: () => set((st) => ({ state: { ...st.state, autoMode: !st.state.autoMode } })),
  buyRunUnlock: (index) => set((st) => ({ state: buyRunUnlock(st.state, index) })),
  buyRunBulk: () => set((st) => ({ state: buyRunBulk(st.state) })),
  rerollRun: () => set((st) => ({ state: rerollRun(st.state) })),
  prestige: () => set((st) => ({ state: { ...prestige(st.state), autoMode: st.state.autoMode } })), // 自動/手動の設定は引き継ぐ
  startRun: (w) => set((st) => ({ state: { ...startRun(st.state, w), autoMode: st.state.autoMode } })),
  unlockWeapon: (w) => set((st) => ({ state: unlockWeapon(st.state, w) })),
  buyCapUpgrade: () => set((st) => ({ state: buyCapUpgrade(st.state) })),
  buyTreasurePower: () => set((st) => ({ state: buyTreasurePower(st.state) })),
  buyWeaponSkill: (target, nodeIndex) => set((st) => ({ state: buySkill(st.state, target, nodeIndex) })),
  buyWeaponSkillMax: (target) => set((st) => ({ state: buySkillMax(st.state, target) })),
  setTarget: (cell) => set((st) => (st.state.autoMode ? {} : { state: { ...st.state, cat: { ...st.state.cat, target: cell } } })),
  save: () => saveState(get().state),
  resetData: () => { clearSave(); lastSaveMs = Date.now(); set({ state: freshState() }); },
  exportSave: () => exportSave(get().state),
  importSave: (text) => { const s = importSave(text); if (!s) return false; lastSaveMs = Date.now(); saveState(s); set({ state: s }); return true; },
}));
