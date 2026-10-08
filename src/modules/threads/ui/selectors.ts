/**
 * Selector UI Threads — satu sumber kebenaran.
 *
 * Aturan:
 * - Utamakan role + accessible name; lebih tahan perubahan kelas CSS.
 * - Kalau terpaksa pakai indeks/nth(), tulis alasan di komentar.
 * - Setiap perubahan Threads → cukup perbaiki file ini.
 *
 * Diverifikasi terakhir: 2026-10-08 (desktop web www.threads.com, locale id-ID).
 */
import type { Page } from "playwright-core";

export const selectors = {
  // --- Auth / session ---
  /** Tombol login di halaman publik. Ada = belum login. */
  loginLink: (p: Page) => p.getByRole("link", { name: /^(log in|masuk)$/i }),
  loginButton: (p: Page) => p.getByRole("button", { name: /^(log in|masuk)$/i }),

  // --- Composer (posting) ---
  /** Entri composer di beranda. */
  composerEntry: (p: Page) =>
    p.getByRole("button", { name: /(mulai thread|start a thread|what'?s new|apa yang baru)/i }),
  composerBox: (p: Page) => p.getByRole("textbox").first(),
  publishButton: (p: Page) => p.getByRole("button", { name: /^(post|posting|kirim)$/i }),

  // --- Aksi pada post ---
  /** Tombol like. Label berubah jadi "Unlike"/"Batal suka" kalau sudah di-like. */
  likeButton: (p: Page) => p.getByRole("button", { name: /^(like|suka)(:|$)/i }),
  unlikeButton: (p: Page) => p.getByRole("button", { name: /^(unlike|batal suka)(:|$)/i }),
  replyButton: (p: Page) => p.getByRole("button", { name: /^(reply|balas)(:|$)/i }),
  repostButton: (p: Page) => p.getByRole("button", { name: /^(repost|reposting)(:|$)/i }),

  // --- Feed / search (scrape) ---
  /** Wrapper tiap post di feed & hasil pencarian. */
  postContainer: (p: Page) =>
    p.locator('div[data-pressable-container="true"], article').filter({ has: p.locator('a[href*="/post/"]') }),
  /** Anchor ke halaman post; href-nya sumber postId + permalink. */
  permalinkAnchor: (p: Page) => p.locator('a[href*="/post/"]'),
  searchBox: (p: Page) => p.getByRole("textbox", { name: /search|telusuri|cari/i }),
} as const;

export type Selectors = typeof selectors;
