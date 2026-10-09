/**
 * Engage sekali jalan: satu kali scan → LLM menilai tiap post → like yang
 * pro kesehatan, balas yang pro rokok.
 *
 * Pakai:
 *   bun run counter:rokok
 *   bun run counter:rokok --keyword rokok --scan 25 --max-likes 3 --max-replies 2
 *   bun run counter:rokok --headed --json
 *
 * Klasifikasi, like, dan balasan semuanya dikendalikan LLM (butuh AI_API_KEY di .env).
 * DRY_RUN=true (default) → tidak ada klik.
 */
import { closeContext, setHeadless } from "../browser/launcher";
import { bootstrapCookiesFromEnv, ensureLoggedIn } from "../browser/session";
import { engageRokokPosts } from "../modules/threads/counter";
import { Logger } from "../shared/logger";

const logger = new Logger("CounterRokok");

function parseArgs(argv: string[]) {
  const out = {
    keyword: "rokok",
    scan: 20,
    maxLikes: 3,
    maxReplies: 2,
    json: false,
    headed: false,
    headless: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keyword") out.keyword = argv[++i] ?? out.keyword;
    else if (a === "--scan") out.scan = Number(argv[++i] ?? out.scan);
    else if (a === "--max-likes") out.maxLikes = Number(argv[++i] ?? out.maxLikes);
    else if (a === "--max-replies") out.maxReplies = Number(argv[++i] ?? out.maxReplies);
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

  const report = await engageRokokPosts(page, {
    keyword: args.keyword,
    scanLimit: args.scan,
    maxLikes: args.maxLikes,
    maxReplies: args.maxReplies,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nkeyword        : ${report.keyword}`);
    console.log(`dry-run        : ${report.dryRun}`);
    console.log(`LLM aktif      : ${report.aiEnabled}`);
    console.log(`di-scan        : ${report.scanned}`);
    console.log(
      `klasifikasi    : pro rokok ${report.classified.proRokok}, ` +
        `pro kesehatan ${report.classified.proHealth}, lain ${report.classified.lain}`,
    );
    console.log(`sudah proses   : ${report.alreadyProcessed.length}`);
    console.log(`aksi/jam       : ${report.actionsLastHour}/${report.maxPerHour}`);
    if (report.stoppedBecause) console.log(`berhenti       : ${report.stoppedBecause}`);

    console.log(`\n=== ${report.liked.length} post pro kesehatan (like) ===`);
    for (const l of report.liked) {
      console.log(`- [${l.status}] @${l.permalink} ${l.message ?? l.error ?? ""}`);
    }

    console.log(`\n=== ${report.plans.length} balasan counter (post pro rokok) ===`);
    for (const p of report.plans) {
      console.log(`\n- @${p.author} ${p.permalink}`);
      console.log(`  status : ${p.result?.status ?? "-"} ${p.result?.error ?? p.result?.message ?? ""}`);
      console.log(`  argumen: [${p.argumentHits.join(", ")}]`);
      console.log(`  post   : ${p.postText.slice(0, 120)}`);
      console.log(`  gaya   : ${p.reply.style.lang}/${p.reply.style.register}`);
      console.log(
        `  balas  (${p.reply.ok ? "llm" : "GAGAL"}${p.reply.model ? `/${p.reply.model}` : ""}): ${p.reply.text || "-"}`,
      );
      if (p.reply.error) console.log(`  catatan: ${p.reply.error}`);
    }

    console.log(`\n=== ${report.rejected.length} post lain (alasan LLM) ===`);
    for (const r of report.rejected.slice(0, 20)) {
      console.log(`- @${r.author} ${r.permalink}`);
      console.log(`  alasan: ${r.reason}`);
    }
  }

  await closeContext();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error("counter gagal", err instanceof Error ? err.message : String(err));
  await closeContext();
  process.exit(1);
});
