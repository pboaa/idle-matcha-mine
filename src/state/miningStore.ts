import { create } from 'zustand';
import { type MineState } from '@application/mining/mineState';
import { stepMine, MINE_STEP_MS } from '@application/mining/step';
import { applyOfferChoice, buyAppraise, buyBoost } from '@application/mining/upgrades';
import { prestige, buyPerm, buyCoinUp, buyWeaponSkill, buyIdle, buyStarDamage, refine, type PermId } from '@application/mining/prestige';
import type { MaterialId, WeaponId, CoinUpId } from '@domain/mining/balance';
import type { Cell } from '@domain/grid/position';
import { loadState, saveState, clearSave, freshState } from '@state/persistence';

interface MiningStore {
  readonly state: MineState;
  tick: (realDtMs: number) => void;
  chooseOffer: (index: number) => void;
  toggleAuto: () => void;
  buyAppraise: () => void;
  buyBoost: () => void;
  prestige: () => void;
  buyPerm: (id: PermId) => void;
  buyCoinUp: (id: CoinUpId) => void;
  buyWeaponSkill: (weapon: WeaponId, nodeIndex: number) => void;
  buyIdle: () => void;
  buyStarDamage: () => void;
  setTarget: (cell: Cell) => void; // 手動モードで猫の目標を設定
  refine: (from: MaterialId) => void;
  save: () => void;       // 即時セーブ（離脱時など）
  resetData: () => void;  // セーブ削除して最初から
}

let accumulatorMs = 0;
let lastSaveMs = 0;
const AUTOSAVE_MS = 3000;

export const useMiningStore = create<MiningStore>((set, get) => ({
  state: loadState() ?? freshState(), // 保存済みがあれば続きから、なければ新規
  tick: (realDtMs) => {
    accumulatorMs += realDtMs;
    const maxBatch = MINE_STEP_MS * 20;
    if (accumulatorMs > maxBatch) accumulatorMs = maxBatch;
    if (accumulatorMs < MINE_STEP_MS) return;
    const steps = Math.floor(accumulatorMs / MINE_STEP_MS);
    accumulatorMs -= steps * MINE_STEP_MS;
    const state = stepMine(get().state, steps * MINE_STEP_MS);
    set({ state });
    const now = Date.now();
    if (now - lastSaveMs > AUTOSAVE_MS) { lastSaveMs = now; saveState(state); } // 自動セーブ（3秒ごと）
  },
  chooseOffer: (index) => {
    const s = get().state;
    const choice = s.offer?.[index];
    if (choice) set({ state: applyOfferChoice(s, choice) });
  },
  toggleAuto: () => set((st) => ({ state: { ...st.state, autoMode: !st.state.autoMode } })),
  buyAppraise: () => set((st) => ({ state: buyAppraise(st.state) })),
  buyBoost: () => set((st) => ({ state: buyBoost(st.state) })),
  prestige: () => set((st) => ({ state: { ...prestige(st.state), autoMode: st.state.autoMode } })), // 自動/手動の設定は引き継ぐ
  buyPerm: (id) => set((st) => ({ state: buyPerm(st.state, id) })),
  buyCoinUp: (id) => set((st) => ({ state: buyCoinUp(st.state, id) })),
  buyWeaponSkill: (weapon, nodeIndex) => set((st) => ({ state: buyWeaponSkill(st.state, weapon, nodeIndex) })),
  buyIdle: () => set((st) => ({ state: buyIdle(st.state) })),
  buyStarDamage: () => set((st) => ({ state: buyStarDamage(st.state) })),
  setTarget: (cell) => set((st) => (st.state.autoMode ? {} : { state: { ...st.state, cat: { ...st.state.cat, target: cell } } })),
  refine: (from) => set((st) => ({ state: refine(st.state, from) })),
  save: () => saveState(get().state),
  resetData: () => { clearSave(); lastSaveMs = Date.now(); set({ state: freshState() }); },
}));
