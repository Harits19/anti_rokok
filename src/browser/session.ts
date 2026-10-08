import type { BrowserContext, Page } from "playwright-core";
import { getContext, getPage } from "./launcher";
import { selectors } from "../modules/threads/ui/selectors";
import { unauthorized } from "../shared/errors";
import { Logger } from "../shared/logger";

export const THREADS_HOME = "https://www.threads.com";
export const THREADS_SEARCH_URL = (keyword: string) =>
  `${THREADS_HOME}/search?q=${encodeURIComponent(keyword)}`;

const logger = new Logger("ThreadsSession");

/**
 * Cek login. Indikator paling andal: kalau URL balik ke /login atau tombol
 * "Log in" masih terlihat, berarti belum login.
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto(THREADS_HOME, { waitUntil: "domcontentloaded" });

  try {
    await Promise.race([
      page.locator('a[href^="/@"]').first().waitFor({ state: "visible", timeout: 20_000 }),
      selectors.loginLink(page).first().waitFor({ state: "visible", timeout: 20_000 }),
    ]);
  } catch {
    logger.warn("tidak ada indikator login/profil yang muncul dalam 20s");
  }

  if (page.url().includes("/login")) return false;

  // Indikator paling andal: link profil sendiri dgn href "/@username".
  const hasProfileLink = await page
    .locator('a[href^="/@"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasComposer = await selectors.composerEntry(page).first().isVisible().catch(() => false);
  const hasLogin = await selectors.loginLink(page).first().isVisible().catch(() => false);

  logger.info("status login", { url: page.url(), hasProfileLink, hasComposer, hasLogin });

  if (hasLogin && !hasProfileLink) return false;
  return hasProfileLink || hasComposer;
}

export async function ensureLoggedIn(page?: Page): Promise<Page> {
  const p = page ?? (await getPage());
  if (!(await isLoggedIn(p))) {
    throw unauthorized(
      "Belum login ke Threads. Jalankan `bun run login:threads` sekali (manual), lalu coba lagi.",
    );
  }
  return p;
}

/**
 * Bootstrap session dari cookie lama di .env (opsional).
 * Berguna supaya tidak perlu login manual; tapi cookie bisa kedaluwarsa —
 * kalau gagal, tetap harus `bun run login:threads`.
 *
 * Nilai cookie TIDAK pernah di-log.
 */
export async function bootstrapCookiesFromEnv(ctx?: BrowserContext): Promise<number> {
  const raw = process.env.THREADS_COOKIE?.trim();
  if (!raw) return 0;

  const context = ctx ?? (await getContext());
  const cookies = raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((pair) => {
      const idx = pair.indexOf("=");
      if (idx <= 0) return [];
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name || !value) return [];
      return [
        {
          name,
          value,
          domain: ".threads.com",
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "Lax" as const,
        },
      ];
    });

  if (cookies.length === 0) return 0;

  await context.addCookies(cookies);
  logger.info(`bootstrap ${cookies.length} cookie dari THREADS_COOKIE (nilai tidak di-log)`);
  return cookies.length;
}
