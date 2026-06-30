/**
 * 「強化（パッシブ特殊能力）」のマスターデータ（カタログから分離）。
 * 走行グリッド（その周だけ・ランダム）のマスに割り当てる一時バフ。集計は weapons.ts（passiveTotals）。
 */
import type { WeaponId } from '@domain/mining/balance';

export type PassiveId =
  | 'power' | 'speed' | 'haste' | 'luck' | 'xp' | 'range' | 'crit' | 'pierce' | 'bighit'
  | 'whet' | 'powder' | 'lens' | 'echo'
  | 'upick' | 'ubullet' | 'ubomb' | 'ubeam' | 'udrill' | 'uaura' | 'uring';

/** 強化（特殊能力）の効果種別。weaponDmg は targetWeapon 指定の固有強化に使う。 */
export type PassiveEffect = 'power' | 'rate' | 'move' | 'coin' | 'xp' | 'range' | 'pierce' | 'crit' | 'meleeDmg' | 'shotDmg' | 'beamDmg' | 'fieldDmg' | 'weaponDmg';
export interface PassiveDef {
  readonly id: PassiveId; readonly label: string; readonly emoji: string; readonly desc: string;
  readonly effect: PassiveEffect; readonly perLvl: number;
  readonly reqWeapon?: WeaponId;    // この武器を所持中のみ走行グリッドに出る（武器固有のユニーク強化）
  readonly targetWeapon?: WeaponId; // weaponDmg をこの武器だけに乗せる
  readonly special?: boolean;       // 走行グリッドで「特殊枠（少数・強め）」として配置する
}

export const PASSIVE_DEFS: Record<PassiveId, PassiveDef> = {
  // 汎用（全体）特殊能力
  power: { id: 'power', label: '威力', emoji: '💪', desc: '全武器のダメージ+', effect: 'power', perLvl: 0.10 },
  bighit: { id: 'bighit', label: '強撃', emoji: '💢', desc: '全武器のダメージ+（大）', effect: 'power', perLvl: 0.18, special: true },
  range: { id: 'range', label: '射程', emoji: '📏', desc: '武器の射程/範囲 +1', effect: 'range', perLvl: 0.5, special: true },
  pierce: { id: 'pierce', label: '貫通', emoji: '➡️', desc: 'ビーム/ドリルが奥まで貫通 +1', effect: 'pierce', perLvl: 1, special: true },
  crit: { id: 'crit', label: '会心', emoji: '✨', desc: 'たまに3倍ダメージ', effect: 'crit', perLvl: 0.05, special: true },
  speed: { id: 'speed', label: '速さ', emoji: '🏃', desc: '採掘/移動が速い', effect: 'rate', perLvl: 0.14 },
  haste: { id: 'haste', label: '俊足', emoji: '👟', desc: '移動が速い', effect: 'move', perLvl: 0.20 },
  luck: { id: 'luck', label: '幸運', emoji: '🍀', desc: 'コイン+', effect: 'coin', perLvl: 0.15 },
  xp: { id: 'xp', label: '修学', emoji: '📖', desc: '経験値+', effect: 'xp', perLvl: 0.18 },
  // 系統シナジー（特殊枠）
  whet: { id: 'whet', label: '砥石', emoji: '🪒', desc: '近接(ツルハシ)強化', effect: 'meleeDmg', perLvl: 0.25, special: true },
  powder: { id: 'powder', label: '火薬', emoji: '🧨', desc: '射撃(弾/爆弾)強化', effect: 'shotDmg', perLvl: 0.25, special: true },
  lens: { id: 'lens', label: 'レンズ', emoji: '🔬', desc: 'ビーム(ビーム/ドリル)強化', effect: 'beamDmg', perLvl: 0.25, special: true },
  echo: { id: 'echo', label: '共鳴', emoji: '🔊', desc: '範囲(オーラ/リング)強化', effect: 'fieldDmg', perLvl: 0.25, special: true },
  // 武器固有ユニーク（その武器を装備中のみ走行グリッドに出る・特殊枠）
  upick: { id: 'upick', label: '⛏️二刀流', emoji: '⛏️', desc: 'ツルハシ専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'pick', targetWeapon: 'pick', special: true },
  ubullet: { id: 'ubullet', label: '🔫速射', emoji: '🔫', desc: '弾 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'bullet', targetWeapon: 'bullet', special: true },
  ubomb: { id: 'ubomb', label: '💣大火力', emoji: '💣', desc: '爆弾 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'bomb', targetWeapon: 'bomb', special: true },
  ubeam: { id: 'ubeam', label: '⚡集束', emoji: '⚡', desc: 'ビーム 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'beam', targetWeapon: 'beam', special: true },
  udrill: { id: 'udrill', label: '🌀高速回転', emoji: '🌀', desc: 'ドリル 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'drill', targetWeapon: 'drill', special: true },
  uaura: { id: 'uaura', label: '💥増幅', emoji: '💥', desc: 'オーラ 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'aura', targetWeapon: 'aura', special: true },
  uring: { id: 'uring', label: '🪃軌道', emoji: '🪃', desc: 'リング 専用 ダメージ++', effect: 'weaponDmg', perLvl: 0.30, reqWeapon: 'ring', targetWeapon: 'ring', special: true },
};
export const PASSIVE_IDS = Object.keys(PASSIVE_DEFS) as PassiveId[];
