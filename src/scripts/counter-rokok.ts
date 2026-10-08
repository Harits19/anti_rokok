/**
 * Counter sekali jalan: cari post yang membela rokok, susun balasan, lalu balas.
 *
 * Pakai:
 *   bun run counter:rokok
 *   bun run counter:rokok --keyword rokok --scan 25 --max-replies 2
 *   bun run counter:rokok --headed --json
 *
 * Balasan disusun LLM kalau AI_API_KEY diisi di .env; kalau tidak, pakai template.
 * DRY_RUN=true (default) → balasan tidak dikirim.
 */
import { closeContext, setHeadless } from "../browser/launcher";
import { bootstrapCookiesFromEnv, ensureLoggedIn } from "../browser/session";
import { counterProSmokingPosts } from "../modules/threads/counter";
import { Logger } from "../shared/logger";

const logger = new Logger("CounterRokok");

function parseArgs(argv: string[]) {
  const out = { keyword: "rokok", scan: 20, maxReplies: 2, json: false, headed: false, headless: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keyword") out.keyword = argv[++i] ?? out.keyword;
    else if (a === "--scan") out.scan = Number(argv[++i] ?? out.scan);
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

  const report = await counterProSmokingPosts(page, {
    keyword: args.keyword,
    scanLimit: args.scan,
    maxReplies: args.maxReplies,
  });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nkeyword       : ${report.keyword}`);
    console.log(`dry-run       : ${report.dryRun}`);
    console.log(`LLM aktif     : ${report.aiEnabled}`);
    console.log(`di-scan       : ${report.scanned}`);
    console.log(`ditolak       : ${report.rejected.length}`);
    console.log(`sudah proses  : ${report.alreadyProcessed.length}`);
    console.log(`aksi/jam      : ${report.actionsLastHour}/${report.maxPerHour}`);
    if (report.stoppedBecause) console.log(`berhenti      : ${report.stoppedBecause}`);

    console.log(`\n=== ${report.plans.length} rencana balasan ===`);
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
      console.log(`  data   : ${p.reply.facts.length} fakta bersumber`);
      for (const f of p.reply.facts) {
        console.log(`    - [${f.source}/${f.lang}] ${f.claim.slice(0, 110)}`);
        console.log(`      ${f.url}`);
      }
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
