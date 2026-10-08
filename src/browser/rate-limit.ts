/**
 * Rate limiter aksi tulis. Semua pure function supaya bisa diuji tanpa browser.
 * Aturan: delay manusiawi acak + cap per jam. Tidak ada retry agresif di sini.
 */

export function nextDelayMs(args: { min: number; max: number; rand?: () => number }): number {
  const { min, max, rand = Math.random } = args;
  if (max <= min) return min;
  return Math.round(min + rand() * (max - min));
}

export function canActNow(actionsInWindow: number, maxPerHour: number): boolean {
  return actionsInWindow < maxPerHour;
}

export function windowExpired(windowStart: number, now: number, windowMs = 60 * 60 * 1000): boolean {
  return now - windowStart >= windowMs;
}

/** Sisa waktu tunggu sebelum window reset (ms). 0 kalau sudah lewat. */
export function msUntilWindowReset(
  windowStart: number,
  now: number,
  windowMs = 60 * 60 * 1000,
): number {
  return Math.max(0, windowStart + windowMs - now);
}
