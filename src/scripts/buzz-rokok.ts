/**
 * Buzz sekali jalan: cari keyword, nilai opini, like yang mendukung bahaya rokok.
 *
 * Pakai:
 *   bun run buzz:rokok
 *   bun run buzz:rokok --keyword "bahaya rokok" --scan 25 --max-likes 3
 *   bun run buzz:rokok --headed          (lihat UI-nya)
 *   bun run buzz:rokok --json            (output JSON penuh)
 *
 * DRY_RUN=true di .env (default) → klik like tidak dijalankan.
 */
import { closeContext, setHeadless } from "../browser/launcher";
import { bootstrapCookiesFromEnv, ensureLoggedIn } from "../browser/session";
import { buzzRokokPosts } from "../modules/threads/buzz";
import { Logger } from "../shared/logger";

const logger = new Logger("BuzzRokok");

function parseArgs(argv: string[]) {
  const out = { keyword: "rokok", scan: 20, maxLikes: 3, json: false, headed: false, headless: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keyword") out.keyword = argv[++i] ?? out.keyword;
    else if (a === "--scan") out.scan = Number(argv[++i] ?? out.scan);
    else if (a === "--max-likes") out.maxLikes = Number(argv[++i] ?? out.maxLikes);
    else if (a === "--json") out.json = true;
    else if (a === "--headed") out.headed = true;
    else if (a === "--headless") out.headless = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.headed) setHeadless(false);
  if (args.headless) setHeadless(true);

  await bootstrapCookiesFromEnv();
  const page = await ensureLoggedIn();

  const report = await buzzRokokPosts(page, {
    keyword: args.keyword,
    scanLimit: args.scan,
    maxLikes: args.maxLikes,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nkeyword      : ${report.keyword}`);
    console.log(`dry-run      : ${report.dryRun}`);
    console.log(`di-scan      : ${report.scanned}`);
    console.log(`sudah di-like: ${report.alreadyLiked.length}`);
    console.log(`sudah proses : ${report.alreadyProcessed.length}`);
    console.log(`ditolak      : ${report.rejected.length}`);
    console.log(`aksi/jam     : ${report.actionsLastHour}/${report.maxPerHour}`);
    if (report.stoppedBecause) console.log(`berhenti     : ${report.stoppedBecause}`);

    console.log(`\n=== ${report.liked.length} post di-like ===`);
    for (const r of report.liked) {
      console.log(`- [${r.status}] ${r.permalink} ${r.message ?? r.error ?? ""}`);
    }

    console.log(`\n=== ${report.rejected.length} post ditolak (bukan pro kesehatan) ===`);
    for (const r of report.rejected.slice(0, 8)) {
      console.log(`- @${r.author}: ${r.reason}`);
      console.log(`  ${r.text.slice(0, 110)}`);
    }
  }

  await closeContext();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error("buzz gagal", err instanceof Error ? err.message : String(err));
  await closeContext();
  process.exit(1);
});
