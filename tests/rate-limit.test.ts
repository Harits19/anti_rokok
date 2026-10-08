import { test, expect } from "bun:test";
import {
  nextDelayMs,
  canActNow,
  windowExpired,
  msUntilWindowReset,
} from "../src/browser/rate-limit";

test("delay selalu dalam rentang min..max", () => {
  for (const r of [0, 0.5, 0.999, 1]) {
    const d = nextDelayMs({ min: 1000, max: 5000, rand: () => r });
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThanOrEqual(5000);
  }
});

test("delay deterministik saat rand di-inject", () => {
  expect(nextDelayMs({ min: 1000, max: 5000, rand: () => 0 })).toBe(1000);
  expect(nextDelayMs({ min: 1000, max: 5000, rand: () => 0.5 })).toBe(3000);
});

test("min >= max tidak error, balik min", () => {
  expect(nextDelayMs({ min: 5000, max: 1000, rand: () => 0.9 })).toBe(5000);
  expect(nextDelayMs({ min: 5000, max: 5000 })).toBe(5000);
});

test("cap per jam memblokir aksi ke-21", () => {
  expect(canActNow(19, 20)).toBe(true);
  expect(canActNow(20, 20)).toBe(false);
  expect(canActNow(21, 20)).toBe(false);
});

test("window dianggap kadaluarsa setelah 1 jam", () => {
  const start = 1_000_000;
  expect(windowExpired(start, start + 59 * 60 * 1000)).toBe(false);
  expect(windowExpired(start, start + 60 * 60 * 1000)).toBe(true);
  expect(msUntilWindowReset(start, start + 59 * 60 * 1000)).toBe(60 * 1000);
  expect(msUntilWindowReset(start, start + 61 * 60 * 1000)).toBe(0);
});
