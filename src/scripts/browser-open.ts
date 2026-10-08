/**
 * Buka Chromium secara terlihat (headed) di Threads dan biarkan terbuka.
 * Untuk inspeksi UI/selector secara manual, dan untuk melihat apa yang
 * sebenarnya dilakukan bot.
 *
 * Pakai:
 *   bun run browser:open
 *   bun run browser:open "https://www.threads.com/search?q=rokok"
 *
 * Headless dikendalikan BROWSER_HEADLESS di .env (false = UI muncul).
 */
import { closeContext, getPage, isHeadless, setHeadless } from "../browser/launcher";
import { bootstrapCookiesFromEnv, THREADS_HOME, isLoggedIn } from "../browser/session";
import { Logger } from "../shared/logger";

const logger = new Logger("BrowserOpen");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--headless")) setHeadless(true);
  const target = args.find((a) => !a.startsWith("--")) ?? THREADS_HOME;

  if (isHeadless()) {
    logger.warn("headless=true — UI Chromium TIDAK akan muncul.");
    logger.warn("Jalankan tanpa --headless, atau set BROWSER_HEADLESS=false di .env.");
  }

  await bootstrapCookiesFromEnv();
  const page = await getPage();

  // Cek login dulu (fungsi ini membuka beranda), baru pindah ke target,
  // supaya halaman yang terlihat di window = halaman yang diminta.
  const loggedIn = await isLoggedIn(page).catch(() => false);
  logger.info(`login: ${loggedIn}`);

  logger.info(`membuka ${target}`);
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  logger.info(`judul halaman: ${await page.title()}`);
  logger.info(`url: ${page.url()}`);
  logger.info("Browser terbuka. Tekan Ctrl+C untuk menutup.");

  let closing = false;
  const shutdown = async () => {
    if (closing) return; // sinyal bisa datang dua kali (SIGINT + SIGTERM)
    closing = true;
    logger.info("menutup browser...");
    await closeContext();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  // Tahan proses tetap hidup.
  await new Promise<void>(() => {});
}

main().catch(async (err) => {
  logger.error("gagal membuka browser", err instanceof Error ? err.message : String(err));
  await closeContext();
  process.exit(1);
});
