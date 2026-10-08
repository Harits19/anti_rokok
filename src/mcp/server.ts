/**
 * Contoh paling sederhana MCP server untuk proyek ini.
 *
 * Sekadar membungkus kemampuan Chromium yang sudah ada (scrapeSearch) jadi
 * "tool" yang bisa dipanggil klien AI (Claude Desktop, Cursor, Hermes, dll)
 * lewat protokol MCP.
 *
 * Jalankan:  bun run mcp:threads     (transport stdio)
 *
 * Prinsipnya: project ini tetap bot Chromium biasa. MCP cuma lapisan tipis
 * di atasnya — bukan menggantikan apa pun.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { closeContext } from "../browser/launcher";
import { bootstrapCookiesFromEnv, ensureLoggedIn } from "../browser/session";
import { buzzRokokPosts } from "../modules/threads/buzz";
import { counterProSmokingPosts } from "../modules/threads/counter";
import { scrapeSearch } from "../modules/threads/ui/feed";
import { Logger } from "../shared/logger";

// Transport stdio = JSON-RPC lewat stdout. Logger proyek ini menulis ke stderr,
// jadi stdout tetap bersih untuk protokol. Jangan pernah pakai console.log di
// jalur yang dieksekusi server ini.
const logger = new Logger("ThreadsMcp");

const server = new McpServer({ name: "anti-rokok-threads", version: "0.1.0" });

server.registerTool(
  "search_threads",
  {
    title: "Cari post Threads",
    description:
      "Cari post Threads berdasarkan keyword lewat Chromium headless. Mengembalikan JSON daftar post " +
      "(postId, permalink, penulis, teks, jumlah suka/balasan/repost).",
    inputSchema: {
      keyword: z.string().min(1).describe("Kata kunci pencarian, mis. 'bahaya rokok'"),
      limit: z.number().int().min(1).max(25).default(5).describe("Jumlah post maksimal"),
    },
  },
  async ({ keyword, limit }) => {
    logger.info(`tool search_threads dipanggil: keyword="${keyword}" limit=${limit}`);
    try {
      await bootstrapCookiesFromEnv();
      const page = await ensureLoggedIn();
      const posts = await scrapeSearch(page, keyword, { limit });
      return { content: [{ type: "text" as const, text: JSON.stringify(posts, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("tool search_threads gagal", message);
      return { content: [{ type: "text" as const, text: `Gagal: ${message}` }], isError: true };
    } finally {
      // Profil Chromium hanya bisa dipegang satu proses. Lepaskan tiap selesai
      // supaya perintah lain (search:threads, browser:open) tidak terkunci.
      await closeContext();
    }
  },
);

server.registerTool(
  "like_pro_health_rokok",
  {
    title: "Like post yang mendukung bahaya rokok",
    description:
      "Cari post Threads dengan keyword (default 'rokok'), nilai opini tiap post, lalu LIKE post yang " +
      "positif terhadap bahaya rokok (anti merokok / mendukung berhenti merokok). Hanya like — tidak " +
      "membalas, tidak repost. Idempotent (post yang sudah di-like/sudah diproses dilewati) dan dibatasi " +
      "rate limit per jam. Kalau DRY_RUN=true, seluruh alur jalan tetapi like tidak diklik. " +
      "Balikannya JSON: post yang di-like, ditolak (dengan skor + kata kunci pemicu), dan alasan berhenti.",
    inputSchema: {
      keyword: z.string().min(1).default("rokok").describe("Kata kunci pencarian"),
      scanLimit: z.number().int().min(1).max(50).default(20).describe("Jumlah post yang di-scan"),
      maxLikes: z.number().int().min(1).max(20).default(3).describe("Maksimal like dalam satu panggilan"),
    },
  },
  async ({ keyword, scanLimit, maxLikes }) => {
    logger.info(
      `tool like_pro_health_rokok dipanggil: keyword="${keyword}" scanLimit=${scanLimit} maxLikes=${maxLikes}`,
    );
    try {
      await bootstrapCookiesFromEnv();
      const page = await ensureLoggedIn();
      const report = await buzzRokokPosts(page, { keyword, scanLimit, maxLikes });
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("tool like_pro_health_rokok gagal", message);
      return { content: [{ type: "text" as const, text: `Gagal: ${message}` }], isError: true };
    } finally {
      await closeContext();
    }
  },
);

server.registerTool(
  "reply_pro_smoking_posts",
  {
    title: "Balas argumen yang membela rokok",
    description:
      "Cari post Threads dengan keyword (default 'rokok'), deteksi post yang membela/menormalkan rokok " +
      "dengan argumen keliru, lalu BALAS dengan koreksi faktual. Balasan SELALU disusun LLM dan wajib " +
      "memakai data bersumber dari internet (WHO/Wikipedia + URL). Bahasa dan gaya balasan mengikuti post " +
      "yang dibalas (santai/formal). Kalau LLM gagal atau data tidak ada, post itu DILEWATI (tidak ada " +
      "balasan template). Idempotent + rate limited. Kalau DRY_RUN=true, balasan hanya disusun dan " +
      "dilaporkan (tidak dikirim).",
    inputSchema: {
      keyword: z.string().min(1).default("rokok").describe("Kata kunci pencarian"),
      scanLimit: z.number().int().min(1).max(50).default(20).describe("Jumlah post yang di-scan"),
      maxReplies: z.number().int().min(1).max(10).default(2).describe("Maksimal balasan dalam satu panggilan"),
    },
  },
  async ({ keyword, scanLimit, maxReplies }) => {
    logger.info(
      `tool reply_pro_smoking_posts dipanggil: keyword="${keyword}" scanLimit=${scanLimit} maxReplies=${maxReplies}`,
    );
    try {
      await bootstrapCookiesFromEnv();
      const page = await ensureLoggedIn();
      const report = await counterProSmokingPosts(page, { keyword, scanLimit, maxReplies });
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("tool reply_pro_smoking_posts gagal", message);
      return { content: [{ type: "text" as const, text: `Gagal: ${message}` }], isError: true };
    } finally {
      await closeContext();
    }
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void closeContext().finally(() => process.exit(0));
  });
}

await server.connect(new StdioServerTransport());
logger.info("MCP server siap (stdio). Menunggu klien MCP...");
