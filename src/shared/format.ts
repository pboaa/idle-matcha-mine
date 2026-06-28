const SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T'] as const;

/** 桁ティアごとのサフィックス。T を超えたら aa, ab, ... と続く（放置ゲーム慣習）。 */
function tierSuffix(tier: number): string {
  if (tier < SHORT_SUFFIXES.length) return SHORT_SUFFIXES[tier]!;
  const i = tier - SHORT_SUFFIXES.length;
  const first = Math.floor(i / 26);
  const second = i % 26;
  return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
}

const trimZeros = (s: string): string => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/**
 * 大きな数を読みやすく整形する（1.23K, 4.5M, 6.78aa ...）。
 * 1000未満は素直に表示。
 */
export function formatNumber(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return '-' + formatNumber(-n, digits);
  if (n < 1000) {
    return Number.isInteger(n) ? String(n) : trimZeros(n.toFixed(digits));
  }
  const tier = Math.floor(Math.log10(n) / 3);
  const scaled = n / Math.pow(1000, tier);
  return trimZeros(scaled.toFixed(digits)) + tierSuffix(tier);
}

/** ミリ秒を日本語の概算表記に（「1時間20分」「45秒」）。 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}時間`);
  if (m > 0) parts.push(`${m}分`);
  // 時間表示があるときは秒を省略してすっきりさせる
  if (h === 0 && s > 0) parts.push(`${s}秒`);
  if (parts.length === 0) parts.push('0秒');
  return parts.join('');
}
