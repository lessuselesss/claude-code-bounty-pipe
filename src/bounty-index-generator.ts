#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read
/**
 * Bounty Index Generator
 *
 * Core bounty discovery system that uses bounty-crawl scraped data exclusively.
 * Integrates assignment detection via GitHub API only (no Algora API dependencies).
 * Only indexes available bounties to prevent wasted effort on assigned/claimed bounties.
 */

import type { Bounty, BountyIndex, OrganizationBounties } from '../schemas/bounty-schema.ts';
import { fetchLatestScraperData, loadScraperData } from './bounty-scraper-adapter.ts';

/**
 * REMOVED: Organization lists and loading logic - now using bounty-crawl scraper data exclusively
 * Organizations are discovered by the scraper and included in scraped data
 */

/**
 * REMOVED: fetchOrganizationBounties() - Now using bounty-crawl scraper data exclusively
 * All bounty data comes from the scraper adapter which handles GitHub assignment checking
 */

/**
 * REMOVED: Incremental update logic - bounty-crawl provides fresh data on each run
 * No longer needed since scraper handles organization discovery and deduplication
 */

/**
 * Generate enhanced summary with evaluation and prep metrics
 */
function generateSummary(organizations: OrganizationBounties[]): BountyIndex['summary'] {
  const orgsWithBounties = organizations.filter(org => org.total_bounties > 0);
  const orgsWithErrors = organizations.filter(org => org.error);

  let largestBounty: BountyIndex['summary']['largest_bounty'] = null;
  let mostActiveOrg: BountyIndex['summary']['most_active_organization'] = null;

  let evaluatedCount = 0;
  let goCount = 0;
  let noGoCount = 0;
  let cautionCount = 0;
  let preppedCount = 0;
  let implementedCount = 0;
  let submittedCount = 0;

  // Analyze all bounties
  for (const org of organizations) {
    for (const bounty of org.bounties) {
      const bountyAmount = bounty.reward?.amount || 0;
      if (!largestBounty || bountyAmount > largestBounty.amount) {
        largestBounty = {
          amount: bountyAmount,
          organization: org.organization,
          title: bounty.task.title,
          url: bounty.task.url
        };
      }

      // Count evaluations
      if (bounty.internal?.evaluation_status === 'evaluated') {
        evaluatedCount++;
        switch (bounty.internal.go_no_go) {
          case 'go':
            goCount++;
            break;
          case 'no-go':
            noGoCount++;
            break;
          case 'caution':
            cautionCount++;
            break;
        }
      }

      // Count prep status
      if (bounty.internal?.prep_status === 'completed') {
        preppedCount++;
      }

      // Count implementation status
      if (bounty.internal?.implementation_status === 'completed') {
        implementedCount++;
      }

      // Count submission status
      if (bounty.internal?.submission_status &&
          ['attempt_declared', 'implementing', 'pr_submitted', 'pr_approved', 'bounty_claimed'].includes(bounty.internal.submission_status)) {
        submittedCount++;
      }
    }
  }

  // Find most active organization
  if (orgsWithBounties.length > 0) {
    const sorted = orgsWithBounties.sort((a, b) => b.total_bounties - a.total_bounties);
    mostActiveOrg = {
      name: sorted[0].organization,
      bounty_count: sorted[0].total_bounties
    };
  }

  return {
    organizations_with_bounties: orgsWithBounties.length,
    organizations_with_errors: orgsWithErrors.length,
    evaluated_bounties: evaluatedCount,
    go_recommendations: goCount,
    no_go_recommendations: noGoCount,
    caution_recommendations: cautionCount,
    prepped_bounties: preppedCount,
    implemented_bounties: implementedCount,
    submitted_bounties: submittedCount,
    largest_bounty: largestBounty,
    most_active_organization: mostActiveOrg
  };
}

/**
 * Generate bounty index using bounty-crawl scraper data exclusively
 */
async function generateBountyIndex(options: {
  scraperFile?: string;
  skipAssignmentCheck?: boolean;
} = {}): Promise<BountyIndex> {

  const {
    scraperFile,
    skipAssignmentCheck = false
  } = options;

  console.log("🔗 Bounty Index Generator (Scraper-Only Mode)");
  console.log("=".repeat(50));

  console.log(`🌐 Using bounty-crawl scraper data (assignment checking: ${!skipAssignmentCheck})`);

  try {
    let index: BountyIndex;

    if (scraperFile) {
      console.log(`📖 Loading scraper data from file: ${scraperFile}`);
      index = await loadScraperData(scraperFile, !skipAssignmentCheck);
    } else {
      console.log(`🌐 Fetching latest scraper data from GitHub repository`);
      index = await fetchLatestScraperData(!skipAssignmentCheck);
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Index generated successfully from scraper data`);
    console.log(`   Organizations: ${index.total_organizations}`);
    console.log(`   Bounties: ${index.total_bounties}`);
    console.log(`   Total value: $${(index.total_amount / 100).toFixed(2)}`);
    console.log(`   Assignment checking: ${!skipAssignmentCheck ? 'enabled' : 'disabled'}`);
    console.log(`   Evaluated: ${index.summary.evaluated_bounties}`);
    console.log(`   Prepped: ${index.summary.prepped_bounties}`);
    console.log(`   Submitted: ${index.summary.submitted_bounties}`);
    console.log(`   💡 Data sourced from bounty-crawl repository exclusively`);

    return index;

  } catch (error) {
    console.error(`❌ Failed to load scraper data: ${error.message}`);
    throw error;
  }
}

/**
 * Save bounty index to file
 */
async function saveBountyIndex(index: BountyIndex): Promise<string> {
  // Ensure output directory exists
  try {
    await Deno.mkdir('./output/indices', { recursive: true });
  } catch {
    // Directory already exists
  }

  const filename = `./output/indices/bounty-index-${new Date().toISOString().split('T')[0]}.json`;
  await Deno.writeTextFile(filename, JSON.stringify(index, null, 2));
  console.log(`💾 Index saved: ${filename}`);
  return filename;
}

/**
 * Main execution function
 */
async function main() {
  const args = Deno.args;
  const scraperFile = args.find(arg => arg.startsWith('--scraper-file='))?.split('=')[1];
  const skipAssignmentCheck = args.includes('--no-assignment-check');

  try {
    const index = await generateBountyIndex({
      scraperFile,
      skipAssignmentCheck
    });

    const filename = await saveBountyIndex(index);

    console.log("\n🔧 Usage examples:");
    console.log("   # Use latest scraper data with assignment checking (default):");
    console.log("   deno run --allow-all src/bounty-index-generator.ts");
    console.log("   # Use local scraper file without assignment checking:");
    console.log("   deno run --allow-all src/bounty-index-generator.ts --scraper-file=/path/to/data.json --no-assignment-check");
    console.log("   # Skip GitHub assignment checking for faster processing:");
    console.log("   deno run --allow-all src/bounty-index-generator.ts --no-assignment-check");

  } catch (error) {
    console.error(`❌ Failed to generate index: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}