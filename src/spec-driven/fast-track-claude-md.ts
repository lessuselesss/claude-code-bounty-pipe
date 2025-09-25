#!/usr/bin/env -S deno run --allow-all

/**
 * Fast-Track CLAUDE.md Generation CLI
 *
 * Focused pipeline for generating project-specific CLAUDE.md files with minimal overhead
 */

import { FastTrackOrchestrator } from './fast-track-orchestrator.ts';
import { loadScraperData } from '../bounty-scraper-adapter.ts';

async function main() {
  console.log(`🚀 Fast-Track CLAUDE.md Generation Pipeline`);
  console.log(`=`.repeat(50));

  const args = Deno.args;
  const maxBounties = parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1] || '3');
  const disableTimeouts = args.includes('--no-timeouts');
  const scraperFile = args.find(arg => arg.startsWith('--scraper-file='))?.split('=')[1];

  try {
    // Load bounty data
    console.log(`📖 Loading bounty data...`);
    let bountyIndex;

    if (scraperFile) {
      bountyIndex = await loadScraperData(scraperFile, false); // Skip assignment checking for speed
    } else {
      // Try to load from existing generated index
      try {
        const indexContent = await Deno.readTextFile('./output/indices/bounty-index-2025-09-25.json');
        bountyIndex = JSON.parse(indexContent);
        console.log(`📊 Loaded cached bounty index with ${bountyIndex.total_bounties} bounties`);
      } catch {
        console.log(`📁 No cached index found, loading from scraper...`);
        const { loadScraperData, fetchLatestScraperData } = await import('../bounty-scraper-adapter.ts');
        bountyIndex = await fetchLatestScraperData(false); // Skip assignment checking
      }
    }

    // Filter viable bounties
    console.log(`🔍 Filtering viable bounties...`);
    const allBounties = bountyIndex.organizations.flatMap(org => org.bounties);
    const viableBounties = FastTrackOrchestrator.filterViableBounties(allBounties, maxBounties * 2);

    console.log(`📊 Found ${viableBounties.length} viable bounties from ${allBounties.length} total`);

    if (viableBounties.length === 0) {
      console.log(`❌ No viable bounties found for processing`);
      Deno.exit(1);
    }

    // Run fast-track processing
    const orchestrator = new FastTrackOrchestrator();
    const result = await orchestrator.processBountiesForClaudeMarkdown(viableBounties, {
      enableTimeouts: !disableTimeouts,
      claudeMarkdownOnly: true,
      skipValidation: true,
      maxBounties
    });

    console.log(`\n🏁 Fast-Track Pipeline Complete`);
    console.log(`=`.repeat(50));

    if (result.success) {
      console.log(`✅ Successfully processed ${result.processedBounties} bounties`);
      console.log(`📝 Generated ${result.claudeMarkdownGenerated} CLAUDE.md files`);

      if (result.claudeMarkdownGenerated > 0) {
        console.log(`\n📁 Generated CLAUDE.md files can be found in:`);
        console.log(`   ~/.cache/bounty-pipe/spec-workspaces/*/CLAUDE.md`);
        console.log(`\n🔍 View generated files with:`);
        console.log(`   find ~/.cache/bounty-pipe/spec-workspaces -name "CLAUDE.md" -type f -newermt "5 minutes ago"`);
      }
    } else {
      console.log(`❌ Pipeline failed to process any bounties`);
      if (result.errors.length > 0) {
        console.log(`\n🐛 Errors encountered:`);
        for (const error of result.errors) {
          console.log(`   • ${error}`);
        }
      }
    }

    if (result.timeouts > 0) {
      console.log(`⏱️ ${result.timeouts} timeouts occurred - consider using --no-timeouts for testing`);
    }

    console.log(`⏰ Total execution time: ${(result.executionTime / 1000).toFixed(1)} seconds`);

    console.log(`\n🔧 Usage examples:`);
    console.log(`   # Fast generation with 3 bounties (default):`);
    console.log(`   deno task pipeline:claude-md-fast`);
    console.log(`   # Process more bounties:`);
    console.log(`   deno run --allow-all src/spec-driven/fast-track-claude-md.ts --max=5`);
    console.log(`   # Disable timeouts for debugging:`);
    console.log(`   deno run --allow-all src/spec-driven/fast-track-claude-md.ts --no-timeouts`);
    console.log(`   # Use specific scraper file:`);
    console.log(`   deno run --allow-all src/spec-driven/fast-track-claude-md.ts --scraper-file=data.json`);

  } catch (error) {
    console.error(`❌ Pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace:\n${error.stack}`);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}