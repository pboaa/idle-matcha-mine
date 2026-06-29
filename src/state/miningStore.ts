import { create } from 'zustand';
import { initialMineState, type MineState } from '@application/mining/mineState';
import { defaultMiningBalance } from '@domain/mining/balance';
import { stepMine, MINE_STEP_MS } from '@application/mining/step';
import { applyOfferChoice, buyAppraise, buyBoost } from '@application/mining/upgrades';
import { prestige, buyPerm, buyRunUp, buyWeaponSkill, refine, type PermId } from '@application/mining/prestige';
import type { MaterialId, WeaponId, WeaponStat } from '@domain/mining/balance';

interface MiningStore {
  readonly state: MineState;
  tick: (realDtMs: number) => void;
  chooseOffer: (index: number) => void;
  toggleAuto: () => void;
  buyAppraise: () => void;
  buyBoost: () => void;
  prestige: () => void;
  buyPerm: (id: PermId) => void;
  buyRunUp: (weapon: WeaponId, stat: WeaponStat) => void;
  buyWeaponSkill: (weapon: WeaponId, nodeIndex: number) => void;
  refine: (from: MaterialId) => void;
}

let accumulatorMs = 0;

export const useMiningStore = create<MiningStore>((set, get) => ({
  state: { ...initialMineState(defaultMiningBalance, (Math.random() * 0x7fffffff) | 0), autoMode: false }, // 序盤は手動で3択を選ぶ楽しみ
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
  prestige: () => set((st) => ({ state: { ...prestige(st.state), autoMode: st.state.autoMode } })), // 自動/手動の設定は引き継ぐ
  buyPerm: (id) => set((st) => ({ state: buyPerm(st.state, id) })),
  buyRunUp: (weapon, stat) => set((st) => ({ state: buyRunUp(st.state, weapon, stat) })),
  buyWeaponSkill: (weapon, nodeIndex) => set((st) => ({ state: buyWeaponSkill(st.state, weapon, nodeIndex) })),
  refine: (from) => set((st) => ({ state: refine(st.state, from) })),
}));
