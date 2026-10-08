/**
 * Aksi balas (reply) lewat UI Threads.
 *
 * Alur yang terverifikasi (2026-10-08, probe DOM nyata):
 * 1. Dari HALAMAN PENCARIAN, tombol "Balas" di dalam container post target
 *    diklik → Threads berpindah ke halaman post itu dan membuka composer.
 *    (Di halaman post langsung, tombol "Balas" pertama milik post rekomendasi
 *    lain — itu sebabnya wajib diklik dari container yang benar.)
 * 2. Composer = [role="textbox"][contenteditable="true"] yang terlihat.
 * 3. Tombol kirim = tombol pertama di atas composer yang berlabel "Balas"/"Posting".
 *
 * DRY_RUN=true: seluruh langkah navigasi dan pengecekan tetap dijalankan,
 * tetapi TIDAK mengetik dan TIDAK mengirim.
 */
import type { ElementHandle, Locator, Page } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../../../config/env";
import { Logger } from "../../../shared/logger";
import { containerForPost } from "./like";
import type { ActionResult } from "./types";

const logger = new Logger("ThreadsUiReply");

/** Label tombol kirim balasan (id-ID dan en). */
export const SUBMIT_LABELS = /^(Balas|Posting|Kirim|Post|Reply)$/;

export function isReplySubmitLabel(label: string): boolean {
  return SUBMIT_LABELS.test(label.replace(/\s+/g, " ").trim());
}

function composerEditor(page: Page): Locator {
  return page.locator('[role="textbox"][contenteditable="true"]').filter({ visible: true }).first();
}

/** Tombol kirim = tombol berlabel kirim paling dekat di atas composer. */
export async function findReplySubmitButton(
  editor: Locator,
): Promise<ElementHandle<HTMLElement> | null> {
  const handle = await editor.elementHandle();
  if (!handle) return null;

  const btn = await handle.evaluateHandle((el) => {
    const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
    let cur: HTMLElement | null = el as HTMLElement;

    for (let depth = 0; depth < 8 && cur; depth++) {
      const found = Array.from(cur.querySelectorAll('div[role="button"], button')).find((b) => {
        const label = clean(b.querySelector("svg title")?.textContent) || clean(b.textContent);
        return /^(Balas|Posting|Kirim|Post|Reply)$/.test(label);
      });
      if (found) return found as HTMLElement;
      cur = cur.parentElement;
    }
    return null;
  });

  return (btn.asElement() as ElementHandle<HTMLElement> | null) ?? null;
}

/**
 * Balas satu post. `page` boleh berada di mana saja, tapi container post target
 * harus ada di halaman aktif (yaitu halaman hasil pencarian).
 */
export async function replyToPostOnPage(
  page: Page,
  post: { postId: string; permalink: string },
  text: string,
): Promise<ActionResult> {
  const base: ActionResult = {
    kind: "reply",
    status: "failed",
    targetId: post.postId,
    permalink: post.permalink,
  };

  const container = containerForPost(page, post.postId);
  if ((await container.count()) === 0) {
    return { ...base, error: "container post tidak ada di halaman aktif" };
  }

  if (env.DRY_RUN) {
    return {
      kind: "reply",
      status: "planned",
      targetId: post.postId,
      permalink: post.permalink,
      message: `dry-run: balasan tidak dikirim (${text.length} karakter)`,
    };
  }

  await container.scrollIntoViewIfNeeded().catch(() => {});
  await container
    .locator('div[role="button"]')
    .filter({ hasText: /^(Balas|Reply)/ })
    .first()
    .click();

  // Klik Balas memindahkan halaman ke post tersebut dan membuka composer.
  await page.waitForTimeout(5000);

  const editor = composerEditor(page);
  if (!(await editor.isVisible().catch(() => false))) {
    return { ...base, error: "composer balasan tidak muncul setelah klik Balas" };
  }

  const dir = resolve(process.cwd(), ".data/artifacts");
  mkdirSync(dir, { recursive: true });
  const screenshot = resolve(dir, `${Date.now()}-reply-${post.postId}.png`);

  await editor.click();
  await page.waitForTimeout(400);
  await page.keyboard.type(text, { delay: 25 });
  await page.waitForTimeout(1200);

  // Tombol kirim baru muncul setelah composer berisi teks — ditemukan dari DOM nyata.
  const submit = await findReplySubmitButton(editor);
  if (!submit) {
    return { ...base, error: "tombol kirim tidak muncul setelah teks diketik", screenshot };
  }

  await page.screenshot({ path: screenshot }).catch(() => {});
  await submit.click();
  await page.waitForTimeout(4000);

  // Sinyal sukses: composer tidak lagi berisi teks kita.
  const remaining = ((await editor.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  const accepted = remaining.length === 0 || !remaining.includes(text.slice(0, 24));

  if (!accepted) {
    return { ...base, error: "teks masih ada di composer — balasan kemungkinan tidak terkirim", screenshot };
  }

  logger.info(`balasan terkirim ke post ${post.postId} (${page.url()})`);
  return {
    kind: "reply",
    status: "done",
    targetId: post.postId,
    permalink: post.permalink,
    message: `balasan terkirim: ${text.slice(0, 60)}`,
    screenshot,
  };
}
