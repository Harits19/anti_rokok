/**
 * Cari post Threads berdasarkan keyword lewat UI (Chromium headless).
 *
 * Pakai:
 *   bun run search:threads rokok
 *   bun run search:threads "bahaya rokok" --limit 15 --json
 */
import { closeContext } from "../browser/launcher";
import { bootstrapCookiesFromEnv, ensureLoggedIn } from "../browser/session";
import { scrapeSearch } from "../modules/threads/ui/feed";
import { Logger } from "../shared/logger";

const logger = new Logger("ThreadsSearch");

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let limit = 10;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") limit = Number(argv[++i] ?? limit);
    else if (a === "--json") json = true;
    else if (a) positional.push(a);
  }

  return { keyword: positional.join(" ").trim(), limit, json };
}

async function main() {
  const { keyword, limit, json } = parseArgs(process.argv.slice(2));

  if (!keyword) {
    logger.error('keyword wajib. contoh: bun run search:threads "bahaya rokok" --limit 10');
    process.exit(1);
  }

  await bootstrapCookiesFromEnv();
  const page = await ensureLoggedIn();

  const posts = await scrapeSearch(page, keyword, { limit });

  if (json) {
    console.log(JSON.stringify({ keyword, count: posts.length, posts }, null, 2));
  } else {
    logger.info(`keyword "${keyword}": ${posts.length} post`);
    for (const [i, p] of posts.entries()) {
      console.log(`\n${i + 1}. @${p.author}  (${p.postId})  ${p.postedAt}`);
      console.log(`   suka=${p.likeCount} balas=${p.replyCount} repost=${p.repostCount} sudahLike=${p.hasLiked}`);
      console.log(`   ${p.permalink}`);
      console.log(`   ${p.text.slice(0, 160)}${p.text.length > 160 ? "..." : ""}`);
    }
  }

  await closeContext();
  process.exit(0);
}

main().catch((err) => {
  logger.error("pencarian gagal", err instanceof Error ? err.message : String(err));
  void closeContext().finally(() => process.exit(1));
});
