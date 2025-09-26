#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * Title Fixer - Updates existing bounty index with real GitHub issue titles
 *
 * Replaces placeholder "Bounty X" titles with actual GitHub issue titles
 * for dramatically improved user experience and bounty identification.
 */

import { fetchGitHubIssueTitle } from './github-issue-fetcher.ts';
import type { BountyIndex } from '../schemas/bounty-schema.ts';

/**
 * Fix titles in a BountyIndex object (in-memory version)
 */
export async function fixBountyIndexTitles(index: BountyIndex): Promise<{ fixedCount: number; totalBounties: number }> {
  console.log('🔧 Fixing bounty titles...');

  let fixedCount = 0;
  let totalBounties = 0;

  // Process each organization
  for (const orgData of index.organizations) {
    console.log(`📂 Fixing titles for: ${orgData.organization}`);

    for (let i = 0; i < orgData.bounties.length; i++) {
      const bounty = orgData.bounties[i];
      totalBounties++;

      // Check if this is a placeholder title
      if (bounty.task.title.match(/^Bounty \d+$/)) {
        console.log(`  🔄 Fixing: "${bounty.task.title}" -> GitHub issue ${bounty.task.url}`);

        try {
          const realTitle = await fetchGitHubIssueTitle(bounty.task.url);
          bounty.task.title = realTitle;
          fixedCount++;

          // Small delay to be respectful to GitHub API
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log(`    ❌ Failed to fix title: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  console.log(`✅ Title fixing complete: ${fixedCount}/${totalBounties} bounty titles fixed`);
  return { fixedCount, totalBounties };
}

/**
 * Fix titles in an existing bounty index by fetching real GitHub issue titles
 */
async function fixBountyTitles(indexPath: string): Promise<void> {
  console.log('🔧 Fixing bounty titles in index...');

  // Load existing index
  const indexContent = await Deno.readTextFile(indexPath);
  const index: BountyIndex = JSON.parse(indexContent);

  let fixedCount = 0;
  let totalBounties = 0;

  // Process each organization
  for (const orgData of index.organizations) {
    console.log(`\n📂 Organization: ${orgData.organization}`);

    for (let i = 0; i < orgData.bounties.length; i++) {
      const bounty = orgData.bounties[i];
      totalBounties++;

      // Check if this is a placeholder title
      if (bounty.task.title.match(/^Bounty \d+$/)) {
        console.log(`  🔄 Fixing: "${bounty.task.title}" -> GitHub issue ${bounty.task.url}`);

        try {
          const realTitle = await fetchGitHubIssueTitle(bounty.task.url);
          bounty.task.title = realTitle;
          fixedCount++;

          // Small delay to be respectful to GitHub API
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log(`    ❌ Failed to fix title: ${error.message}`);
        }
      } else {
        console.log(`  ✅ Already has real title: "${bounty.task.title}"`);
      }
    }
  }

  // Save updated index
  const updatedContent = JSON.stringify(index, null, 2);
  await Deno.writeTextFile(indexPath, updatedContent);

  console.log(`\n✅ Title fixing complete!`);
  console.log(`   📊 Fixed: ${fixedCount}/${totalBounties} bounty titles`);
  console.log(`   💾 Updated index: ${indexPath}`);
}

// CLI usage
if (import.meta.main) {
  const indexPath = Deno.args[0] || '/home/lessuseless/Projects/Orgs/output/indices/bounty-index-2025-09-25.json';

  if (!await Deno.stat(indexPath).catch(() => null)) {
    console.error(`❌ Index file not found: ${indexPath}`);
    Deno.exit(1);
  }

  await fixBountyTitles(indexPath);
}