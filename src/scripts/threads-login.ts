/**
 * Login manual sekali (headed). Sesudah ini profil Chromium di
 * THREADS_PROFILE_DIR sudah menyimpan session, jadi aksi headless bisa jalan.
 *
 * Jalankan: bun run login:threads
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env";
import { THREADS_HOME, isLoggedIn } from "../browser/session";
import { Logger } from "../shared/logger";

const logger = new Logger("ThreadsLogin");
const TIMEOUT_MS = 5 * 60 * 1000;

async function main() {
  const dir = resolve(process.cwd(), env.THREADS_PROFILE_DIR);
  mkdirSync(dir, { recursive: true });

  logger.info("membuka Chromium (headed). Login manual di window yang muncul.");
  logger.info(`profil: ${dir}`);

  const context = await chromium.launchPersistentContext(dir, {
    channel: env.BROWSER_CHANNEL,
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${THREADS_HOME}/login`, { waitUntil: "domcontentloaded" });

  const started = Date.now();
  let loggedIn = false;

  while (Date.now() - started < TIMEOUT_MS) {
    await page.waitForTimeout(2000);
    if (await isLoggedIn(page).catch(() => false)) {
      loggedIn = true;
      break;
    }
    const remaining = Math.round((TIMEOUT_MS - (Date.now() - started)) / 1000);
    if (remaining % 30 < 3) logger.info(`menunggu login manual... sisa ${remaining}s`);
  }

  if (!loggedIn) {
    logger.error("timeout: login tidak terdeteksi. Profil tidak dikunci, ulangi script ini.");
    await context.close();
    process.exit(1);
  }

  logger.info("Login terdeteksi, profil tersimpan.");
  await context.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error("login gagal", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
