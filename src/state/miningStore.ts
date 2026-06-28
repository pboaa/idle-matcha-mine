import { create } from 'zustand';
import { initialMineState, type MineState } from '@application/mining/mineState';
import { defaultMiningBalance } from '@domain/mining/balance';
import { stepMine, MINE_STEP_MS } from '@application/mining/step';
import { applyOfferChoice, buyAppraise, buyBoost, buyMasteryStartBoost } from '@application/mining/upgrades';
import { prestige, buyPerm, refine, type PermId } from '@application/mining/prestige';
import type { MaterialId } from '@domain/mining/balance';

interface MiningStore {
  readonly state: MineState;
  tick: (realDtMs: number) => void;
  chooseOffer: (index: number) => void;
  toggleAuto: () => void;
  buyAppraise: () => void;
  buyBoost: () => void;
  buyMasteryStartBoost: () => void;
  prestige: () => void;
  buyPerm: (id: PermId) => void;
  refine: (from: MaterialId) => void;
}

let accumulatorMs = 0;

export const useMiningStore = create<MiningStore>((set, get) => ({
  state: initialMineState(defaultMiningBalance, (Math.random() * 0x7fffffff) | 0), // 走行ごとに開始武器が変わる
  tick: (realDtMs) => {
    accumulatorMs += realDtMs;
    const maxBatch = MINE_STEP_MS * 20;
    if (accumulatorMs > maxBatch) accumulatorMs = maxBatch;
    if (accumulatorMs < MINE_STEP_MS) return;
    const steps = Math.floor(accumulatorMs / MINE_STEP_MS);
    accumulatorMs -= steps * MINE_STEP_MS;
    set({ state: stepMine(get().state, steps * MINE_STEP_MS) });
  },
  chooseOffer: (index) => {
    const s = get().state;
    const choice = s.offer?.[index];
    if (choice) set({ state: applyOfferChoice(s, choice) });
  },
  toggleAuto: () => set((st) => ({ state: { ...st.state, autoMode: !st.state.autoMode } })),
  buyAppraise: () => set((st) => ({ state: buyAppraise(st.state) })),
  buyBoost: () => set((st) => ({ state: buyBoost(st.state) })),
  buyMasteryStartBoost: () => set((st) => ({ state: buyMasteryStartBoost(st.state) })),
  prestige: () => set((st) => ({ state: prestige(st.state) })),
  buyPerm: (id) => set((st) => ({ state: buyPerm(st.state, id) })),
  refine: (from) => set((st) => ({ state: refine(st.state, from) })),
}));
