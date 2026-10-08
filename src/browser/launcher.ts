import { chromium, type BrowserContext, type Page } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env";
import { conflict, serviceUnavailable } from "../shared/errors";
import { Logger } from "../shared/logger";

const logger = new Logger("BrowserLauncher");

let context: BrowserContext | null = null;
let launching: Promise<BrowserContext> | null = null;
/** Override headless per-perintah (flag CLI), menang atas BROWSER_HEADLESS di .env. */
let headlessOverride: boolean | null = null;

export function setHeadless(value: boolean): void {
  headlessOverride = value;
}

export function isHeadless(): boolean {
  return headlessOverride ?? env.BROWSER_HEADLESS;
}

export function profileDir(): string {
  return resolve(process.cwd(), env.THREADS_PROFILE_DIR);
}

/**
 * Context singleton. Aksi UI dijalankan serial, jadi satu context cukup —
 * dan memang seharusnya begitu (paralel = cepat kena rate limit/ban).
 */
export async function getContext(): Promise<BrowserContext> {
  if (context) return context;
  if (launching) return launching;

  launching = (async () => {
    const dir = profileDir();
    mkdirSync(dir, { recursive: true });

    logger.info(`launching chromium (channel=${env.BROWSER_CHANNEL}, headless=${isHeadless()})`, { dir });

    let ctx: BrowserContext;
    try {
      ctx = await chromium.launchPersistentContext(dir, {
        channel: env.BROWSER_CHANNEL,
        headless: isHeadless(),
        slowMo: env.BROWSER_SLOWMO_MS,
        viewport: { width: 1280, height: 900 },
        locale: "id-ID",
        timezoneId: "Asia/Jakarta",
        args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
      });
    } catch (err) {
      launching = null;
      const message = err instanceof Error ? err.message : String(err);
      // Profil Chromium hanya bisa dipegang satu proses sekaligus.
      if (/already in use|existing browser session|SingletonLock/i.test(message)) {
        throw conflict(
          `Profil Chromium sedang dipakai proses lain (${dir}). Tutup browser/diagram bot yang masih jalan, lalu coba lagi.`,
        );
      }
      throw serviceUnavailable(`Gagal membuka Chromium: ${message}`);
    }

    ctx.setDefaultTimeout(30_000);

    ctx.on("close", () => {
      logger.warn("chromium context tertutup");
      context = null;
      launching = null;
    });

    context = ctx;
    launching = null;
    return ctx;
  })();

  return launching;
}

/** Halaman pertama dari context (persistent context selalu punya 1 page). */
export async function getPage(): Promise<Page> {
  const ctx = await getContext();
  const existing = ctx.pages();
  const page = existing[0] ?? (await ctx.newPage());
  return page;
}

export async function closeContext(): Promise<void> {
  if (!context) {
    launching = null;
    return;
  }
  const ctx = context;
  context = null;
  launching = null;
  try {
    await ctx.close();
    logger.info("chromium context ditutup");
  } catch (err) {
    logger.error("gagal menutup chromium context", err instanceof Error ? err.message : String(err));
  }
}
