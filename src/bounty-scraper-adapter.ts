#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-run

/**
 * Bounty Scraper Adapter
 *
 * Transforms scraped bounty data from the bounty-crawl repository
 * into the formal bounty schema used by the pipeline. Includes assignment
 * detection integration during transformation.
 */

import type { Bounty, BountyIndex, OrganizationBounties } from '../schemas/bounty-schema.ts';
import { checkComprehensiveAssignment } from './algora-api-client.ts'; // Now GitHub-only

/**
 * Scraper output interfaces (different from our formal schema)
 */
interface ScraperBounty {
  id: string;
  title: string;
  amount_usd: number;
  amount_formatted: string;
  status: string;
  updated_at: string;
  url: string;
  tags: string[];
  repository: {
    owner: string;
    name: string;
    url: string;
  };
  issue_number: number;
  difficulty: string;
}

interface ScraperOrganization {
  display_name: string;
  url: string;
  bounty_count: number;
  total_value_usd: number;
  last_updated: string;
  scrape_duration_ms: number;
  bounties: ScraperBounty[];
}

interface ScraperIndex {
  generated_at: string;
  total_organizations: number;
  total_bounties: number;
  total_value_usd: number;
  version: string;
  organizations: Record<string, ScraperOrganization>;
}

/**
 * Transform a scraper bounty into formal schema format
 */
function transformScraperBounty(scraperBounty: ScraperBounty, orgHandle: string): Bounty {
  // Parse GitHub URL to extract repo information
  const urlMatch = scraperBounty.url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!urlMatch) {
    throw new Error(`Invalid GitHub URL format: ${scraperBounty.url}`);
  }

  const [, repoOwner, repoName, issueNumber] = urlMatch;

  return {
    id: scraperBounty.id,
    status: scraperBounty.status as 'open' | 'paid' | 'claimed' | 'closed',
    type: 'standard', // Default, scraper doesn't provide this
    kind: 'dev', // Default, scraper doesn't provide this
    visibility: 'public', // Default for open bounties

    reward: {
      currency: 'USD', // Scraper uses USD
      amount: scraperBounty.amount_usd * 100, // Convert dollars to cents
      formatted: scraperBounty.amount_formatted,
      tiers: [], // Scraper doesn't provide tiers
      type: 'cash' // Default
    },

    task: {
      id: `${orgHandle}-${scraperBounty.id}`,
      title: scraperBounty.title,
      body: '', // Scraper doesn't provide body, will need to fetch from GitHub if needed
      url: scraperBounty.url,
      number: scraperBounty.issue_number,
      repo_name: repoName,
      repo_owner: repoOwner,
      forge: 'github' as const,
      labels: scraperBounty.tags,
      difficulty: scraperBounty.difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
      estimated_duration: undefined, // Not provided by scraper
      tech_stack: scraperBounty.tags // Use tags as tech stack approximation
    },

    org: {
      handle: orgHandle.toLowerCase(),
      name: orgHandle, // Scraper uses display_name but we'll use handle for consistency
      github_handle: repoOwner, // Derive from repository owner
      algora_url: `https://algora.io/${orgHandle}/bounties?status=open`,
      website: scraperBounty.repository.url,
      description: `${orgHandle} organization on Algora`,
      location: undefined,
      tier: 'community' as const // Default tier
    },

    created_at: scraperBounty.updated_at, // Scraper doesn't have created_at, use updated_at
    updated_at: scraperBounty.updated_at,
    attempt_count: 0, // Not provided by scraper, would need GitHub API to get actual count

    // Internal tracking starts empty, will be populated by assignment checking
    internal: {}
  };
}

/**
 * Transform scraper organization to formal schema format
 */
function transformScraperOrganization(
  orgHandle: string,
  scraperOrg: ScraperOrganization,
  includeAssignmentChecking: boolean = true
): Promise<OrganizationBounties> {
  return new Promise(async (resolve) => {
    console.log(`🔄 Transforming organization: ${orgHandle}`);
    console.log(`   📊 ${scraperOrg.bounties.length} bounties from scraper`);

    const transformedBounties: Bounty[] = [];
    let assignedCount = 0;
    let errorCount = 0;

    for (const scraperBounty of scraperOrg.bounties) {
      try {
        const bounty = transformScraperBounty(scraperBounty, orgHandle);

        // Assignment checking integration (if enabled)
        if (includeAssignmentChecking) {
          try {
            const assignmentResult = await checkComprehensiveAssignment(bounty);

            // Store assignment data in internal tracking
            bounty.internal = {
              ...bounty.internal,
              is_available: assignmentResult.is_available,
              github_assignment: assignmentResult.github_assignees.length > 0 ? {
                assignees: assignmentResult.github_assignees.map(username => ({
                  id: 0, // Would need GitHub API call to get real ID
                  login: username,
                  name: username,
                  location: '',
                  company: '',
                  avatar_url: '',
                  twitter_username: '',
                  html_url: `https://github.com/${username}`
                })),
                labels: [], // Would need GitHub API call to get real labels
                state: 'open', // Assume open from scraper
                last_checked: new Date().toISOString(),
                is_bounty: true, // From scraper, so it's a bounty
                bounty_labels: []
              } : undefined,
              algora_assignment: {
                claimed: assignmentResult.algora_claimed,
                claimant: assignmentResult.algora_claimant || undefined,
                claim_date: undefined, // Not provided by current assignment check
                last_checked: new Date().toISOString(),
                bids: [],
                manual_assignments: false
              }
            };

            // Filter out assigned bounties
            if (assignmentResult.is_available) {
              transformedBounties.push(bounty);
            } else {
              assignedCount++;
              console.log(`      ⚠️  Filtered assigned bounty: ${bounty.task.title} (${bounty.id})`);
              if (assignmentResult.github_assignees.length > 0) {
                console.log(`         GitHub assignees: ${assignmentResult.github_assignees.join(', ')}`);
              }
            }
          } catch (error) {
            errorCount++;
            console.log(`      ❌ Assignment check failed for ${bounty.id}: ${error.message}`);
            // On error, assume available but log the issue
            bounty.internal = {
              ...bounty.internal,
              is_available: true // Default to available if check fails
            };
            transformedBounties.push(bounty);
          }

          // Add small delay between assignment checks
          if (scraperOrg.bounties.indexOf(scraperBounty) < scraperOrg.bounties.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          // No assignment checking, include all bounties
          bounty.internal = {
            is_available: true // Assume available if not checking
          };
          transformedBounties.push(bounty);
        }
      } catch (error) {
        console.log(`   ❌ Failed to transform bounty ${scraperBounty.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`   ✅ Transformation complete: ${transformedBounties.length} available bounties`);
    if (includeAssignmentChecking) {
      console.log(`      ${assignedCount} assigned/claimed bounties filtered out`);
      console.log(`      ${errorCount} transformation/assignment errors`);
    }

    resolve({
      organization: orgHandle,
      bounties: transformedBounties,
      total_bounties: transformedBounties.length,
      total_amount: transformedBounties.reduce((sum, b) => sum + b.reward.amount, 0),
      last_updated: scraperOrg.last_updated,
      error: errorCount > 0 ? `${errorCount} transformation errors` : undefined
    });
  });
}

/**
 * Transform complete scraper index to formal schema format
 */
export async function transformScraperIndex(
  scraperIndex: ScraperIndex,
  includeAssignmentChecking: boolean = true
): Promise<BountyIndex> {
  console.log(`🔄 Transforming scraper index to formal schema`);
  console.log(`   📊 ${scraperIndex.total_organizations} organizations, ${scraperIndex.total_bounties} bounties`);
  console.log(`   🛡️  Assignment checking: ${includeAssignmentChecking ? 'ENABLED' : 'DISABLED'}`);

  const organizations: OrganizationBounties[] = [];

  // Transform each organization
  for (const [orgHandle, scraperOrg] of Object.entries(scraperIndex.organizations)) {
    const transformedOrg = await transformScraperOrganization(
      orgHandle,
      scraperOrg,
      includeAssignmentChecking
    );
    organizations.push(transformedOrg);
  }

  // Calculate totals from transformed data
  const totalBounties = organizations.reduce((sum, org) => sum + org.total_bounties, 0);
  const totalAmount = organizations.reduce((sum, org) => sum + org.total_amount, 0);

  // Generate summary statistics
  const orgsWithBounties = organizations.filter(org => org.total_bounties > 0);
  const orgsWithErrors = organizations.filter(org => org.error);

  // Find largest bounty
  let largestBounty: BountyIndex['summary']['largest_bounty'] = null;
  for (const org of organizations) {
    for (const bounty of org.bounties) {
      if (!largestBounty || bounty.reward.amount > largestBounty.amount) {
        largestBounty = {
          amount: bounty.reward.amount,
          organization: org.organization,
          title: bounty.task.title,
          url: bounty.task.url
        };
      }
    }
  }

  // Find most active organization
  const mostActiveOrg = orgsWithBounties.length > 0
    ? orgsWithBounties.sort((a, b) => b.total_bounties - a.total_bounties)[0]
    : null;

  const transformedIndex: BountyIndex = {
    generated_at: new Date().toISOString(),
    last_full_scan: scraperIndex.generated_at,
    update_mode: 'scraper_import' as 'full' | 'incremental',
    total_organizations: organizations.length,
    total_bounties: totalBounties,
    total_amount: totalAmount,
    organizations,
    summary: {
      organizations_with_bounties: orgsWithBounties.length,
      organizations_with_errors: orgsWithErrors.length,
      evaluated_bounties: 0, // New data, no evaluations yet
      go_recommendations: 0,
      no_go_recommendations: 0,
      caution_recommendations: 0,
      prepped_bounties: 0,
      implemented_bounties: 0,
      submitted_bounties: 0,
      largest_bounty: largestBounty,
      most_active_organization: mostActiveOrg ? {
        name: mostActiveOrg.organization,
        bounty_count: mostActiveOrg.total_bounties
      } : null
    }
  };

  console.log(`✅ Scraper index transformation complete`);
  console.log(`   📊 Result: ${totalBounties} available bounties from ${organizations.length} organizations`);
  console.log(`   💰 Total value: $${(totalAmount / 100).toFixed(2)}`);

  return transformedIndex;
}

/**
 * Load and transform scraper data from file
 */
export async function loadScraperData(filePath: string, includeAssignmentChecking: boolean = true): Promise<BountyIndex> {
  try {
    console.log(`📖 Loading scraper data from: ${filePath}`);
    const content = await Deno.readTextFile(filePath);
    const scraperIndex: ScraperIndex = JSON.parse(content);

    console.log(`📊 Scraper data loaded: v${scraperIndex.version} from ${scraperIndex.generated_at}`);

    return await transformScraperIndex(scraperIndex, includeAssignmentChecking);
  } catch (error) {
    console.error(`❌ Failed to load scraper data: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch latest scraper data from GitHub repository
 */
export async function fetchLatestScraperData(includeAssignmentChecking: boolean = true): Promise<BountyIndex> {
  const scraperDataUrl = 'https://raw.githubusercontent.com/lessuselesss/bounty-crawl/main/data/bounty-index.json';

  try {
    console.log(`🌐 Fetching latest scraper data from GitHub...`);
    const response = await fetch(scraperDataUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const scraperIndex: ScraperIndex = await response.json();
    console.log(`📊 Latest scraper data fetched: v${scraperIndex.version} from ${scraperIndex.generated_at}`);

    return await transformScraperIndex(scraperIndex, includeAssignmentChecking);
  } catch (error) {
    console.error(`❌ Failed to fetch scraper data: ${error.message}`);
    throw error;
  }
}

// CLI usage if run directly
if (import.meta.main) {
  const args = Deno.args;
  const includeAssignmentChecking = !args.includes('--no-assignment-check');
  const useLocal = args.includes('--local');
  const filePath = args.find(arg => arg.startsWith('--file='))?.split('=')[1];

  try {
    let bountyIndex: BountyIndex;

    if (filePath) {
      bountyIndex = await loadScraperData(filePath, includeAssignmentChecking);
    } else if (useLocal) {
      bountyIndex = await loadScraperData('/tmp/bounty-crawl/data/bounty-index.json', includeAssignmentChecking);
    } else {
      bountyIndex = await fetchLatestScraperData(includeAssignmentChecking);
    }

    // Save transformed data
    const outputPath = './output/scraper-transformed-index.json';
    await Deno.mkdir('./output', { recursive: true });
    await Deno.writeTextFile(outputPath, JSON.stringify(bountyIndex, null, 2));

    console.log(`💾 Transformed index saved to: ${outputPath}`);
    console.log(`\n🔧 Usage examples:`);
    console.log(`   # Fetch latest from GitHub with assignment checking:`);
    console.log(`   deno run --allow-all src/bounty-scraper-adapter.ts`);
    console.log(`   # Use local bounty-crawl file without assignment checking:`);
    console.log(`   deno run --allow-all src/bounty-scraper-adapter.ts --local --no-assignment-check`);
    console.log(`   # Use specific file:`);
    console.log(`   deno run --allow-all src/bounty-scraper-adapter.ts --file=/path/to/bounty-index.json`);

  } catch (error) {
    console.error(`❌ Transformation failed: ${error.message}`);
    Deno.exit(1);
  }
}