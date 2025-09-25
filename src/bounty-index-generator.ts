#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read
/**
 * Bounty Index Generator
 *
 * Core bounty discovery system that fetches and indexes bounties from Algora API
 * across 128+ organizations. Supports both full scans and incremental updates.
 */

interface Bounty {
  id: string;
  status: string;
  type: string;
  kind: string;
  reward: {
    currency: string;
    amount: number;
  };
  reward_formatted: string;
  task: {
    id: string;
    title: string;
    body: string;
    url: string;
    number: number;
    repo_name: string;
    repo_owner: string;
  };
  org: {
    handle: string;
    name: string;
    github_handle: string;
  };
  created_at: string;
  updated_at: string;
  attempt_count?: number;
  internal?: {
    evaluation_status: 'not_evaluated' | 'in_progress' | 'evaluated' | 'evaluation_failed';
    go_no_go: 'go' | 'no-go' | 'caution' | 'pending';
    complexity_score?: number;
    success_probability?: number;
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
    evaluation_file?: string;
    last_evaluated?: string;
    red_flags?: string[];
    estimated_timeline?: string;
    notes?: string;
    claude_code_evaluated?: boolean;
    prep_status?: 'not_prepped' | 'in_progress' | 'completed' | 'failed';
    prep_file?: string;
    environment_validated?: boolean;
    test_suite_passing?: boolean;
  };
}

interface OrganizationBounties {
  organization: string;
  bounties: Bounty[];
  total_bounties: number;
  total_amount: number;
  last_updated: string;
  error?: string;
}

interface BountyIndex {
  generated_at: string;
  last_full_scan?: string;
  update_mode: 'full' | 'incremental';
  total_organizations: number;
  total_bounties: number;
  total_amount: number;
  organizations: OrganizationBounties[];
  summary: {
    organizations_with_bounties: number;
    organizations_with_errors: number;
    evaluated_bounties: number;
    go_recommendations: number;
    no_go_recommendations: number;
    caution_recommendations: number;
    prepped_bounties: number;
    largest_bounty: {
      amount: number;
      organization: string;
      title: string;
      url: string;
    } | null;
    most_active_organization: {
      name: string;
      bounty_count: number;
    } | null;
  };
}

// Default organizations list (can be overridden by config file)
const DEFAULT_ORGANIZATIONS = [
  "tscircuit", "zio", "twentyhq", "triggerdotdev", "golem-cloud", "mudlet", "cal", "twenty",
  "activepieces", "akello-io", "algora-io", "aqualinkorg", "arakoodev", "archestra-ai",
  "AscendEngineering", "tryabby", "batteries-included", "TypeCellOS", "capofficial", "Cap-go",
  "chakra-ui", "clickvote", "ClaperCo", "codemod-com", "coder", "comet-ml", "cometchat",
  "calcom", "coollabsio", "CrowdDotDev", "DataLinx", "deskflow", "devzero-inc", "different-ai",
  "dimagi", "dittofeed", "documenso", "Dokploy", "getdozer", "drifting-in-space", "e2b-dev",
  "endlessm", "encoredev", "eronka", "fastrepl", "flydelabs", "garden-co", "framer", "go-gitea",
  "golemcloud", "getgrit", "gyroflow", "teamhanko", "highlight", "infinyon", "getkyo",
  "kaizen-solutions", "keephq", "keygen-sh", "lovablelabs", "Magnet-wtf", "maybe-finance",
  "meteor", "moonrepo", "Mudlet", "nonsense-engineering", "omnigres", "onyx-dot-app",
  "OpenAdaptAI", "openapi-json-schema-tools", "opral", "oramasearch", "outerbase", "panoratech",
  "parseablehq", "Permify", "permitio", "PHPOffice", "udecode", "polarsource", "potpie-ai",
  "prequel-co", "projectdiscovery", "PX4", "qdrant", "RaspAP", "smallcloudai", "remotion-dev",
  "reorproject", "revertinc", "rinsed-org", "rosenpass", "SearchApi", "shelfio", "shuttle-hq",
  "SigNoz", "skytable", "softwaremill", "speakers-in-tech", "mediar-ai", "scratchdata",
  "supadata-ai", "Superset-Community-Partners", "tailcallhq", "TabbyML", "tellerhq", "tembo-io",
  "tensorzero", "terrastruct", "thecompaniesapi", "timeplus-io", "tigrisdata", "tolgee",
  "traceloop", "devflowinc", "trpc", "tuist", "tursodatabase", "dottxt-ai", "unkeyed",
  "upstash", "WFP-VAM", "wasmerio", "weaviate", "windmill-labs", "zbdpay", "zeta-chain",
  "Brand-Boosting-GmbH"
];

/**
 * Load organizations from config file or use defaults
 */
async function loadOrganizations(): Promise<string[]> {
  try {
    const configPath = '../config/organizations.json';
    const configText = await Deno.readTextFile(configPath);
    const config = JSON.parse(configText);
    return config.organizations || DEFAULT_ORGANIZATIONS;
  } catch {
    return DEFAULT_ORGANIZATIONS;
  }
}

/**
 * Fetch bounties for a single organization from Algora API
 */
async function fetchOrganizationBounties(orgName: string): Promise<OrganizationBounties> {
  const url = `https://console.algora.io/api/trpc/bounty.list?input=${encodeURIComponent(JSON.stringify({
    "json": {
      "cursor": null,
      "where": {
        "org": {
          "handle": orgName
        }
      }
    }
  }))}`;

  try {
    console.log(`  🔍 Fetching ${orgName}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();

    // Handle tRPC response format
    const tRPCResult = Array.isArray(responseData) ? responseData[0] : responseData;
    if (!tRPCResult?.result?.data?.json) {
      throw new Error('Invalid tRPC response structure');
    }

    const data = tRPCResult.result.data.json;
    const bounties: Bounty[] = data.bounties || [];

    // Extract attempt counts from comments if available
    for (const bounty of bounties) {
      bounty.attempt_count = 0; // Default, would need GitHub API to get actual count
    }

    const totalAmount = bounties.reduce((sum, bounty) => sum + (bounty.reward?.amount || 0), 0);

    return {
      organization: orgName,
      bounties,
      total_bounties: bounties.length,
      total_amount: totalAmount,
      last_updated: new Date().toISOString()
    };

  } catch (error) {
    console.log(`    ❌ Failed to fetch ${orgName}: ${error.message}`);
    return {
      organization: orgName,
      bounties: [],
      total_bounties: 0,
      total_amount: 0,
      last_updated: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Check if organization needs update based on age
 */
function needsUpdate(orgData: OrganizationBounties, maxAgeHours: number): boolean {
  if (!orgData.last_updated) return true;

  const lastUpdate = new Date(orgData.last_updated);
  const hoursOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

  return hoursOld >= maxAgeHours;
}

/**
 * Load existing bounty index
 */
async function loadExistingIndex(): Promise<BountyIndex | null> {
  try {
    const files = [];
    for await (const dirEntry of Deno.readDir('../output/indices')) {
      if (dirEntry.name.startsWith('bounty-index-') && dirEntry.name.endsWith('.json')) {
        files.push(dirEntry.name);
      }
    }

    if (files.length === 0) return null;

    files.sort().reverse();
    const latestFile = files[0];
    const filePath = `../output/indices/${latestFile}`;

    console.log(`📖 Loading existing index: ${latestFile}`);
    const content = await Deno.readTextFile(filePath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

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
    largest_bounty: largestBounty,
    most_active_organization: mostActiveOrg
  };
}

/**
 * Generate bounty index with smart incremental updates
 */
async function generateBountyIndex(options: {
  fullScan?: boolean;
  maxAgeHours?: number;
  organizations?: string[];
} = {}): Promise<BountyIndex> {

  const {
    fullScan = false,
    maxAgeHours = 24,
    organizations: targetOrgs
  } = options;

  console.log("🔗 Bounty Index Generator");
  console.log("=".repeat(50));

  // Load organizations
  const allOrganizations = await loadOrganizations();
  const organizations = targetOrgs || allOrganizations;

  console.log(`🎯 Target organizations: ${organizations.length}`);

  // Load existing index for incremental updates
  const existingIndex = fullScan ? null : await loadExistingIndex();
  const updateMode = fullScan ? 'full' : 'incremental';

  if (existingIndex && !fullScan) {
    console.log(`📊 Existing index: ${existingIndex.total_bounties} bounties from ${existingIndex.organizations.length} orgs`);
    console.log(`🔄 Incremental update mode (max age: ${maxAgeHours}h)`);
  } else {
    console.log(`🔍 Full scan mode`);
  }

  // Create organization map from existing data
  const existingOrgMap = new Map<string, OrganizationBounties>();
  if (existingIndex) {
    for (const org of existingIndex.organizations) {
      existingOrgMap.set(org.organization, org);
    }
  }

  const updatedOrganizations: OrganizationBounties[] = [];
  let fetchCount = 0;
  let skipCount = 0;

  for (const orgName of organizations) {
    const existingOrgData = existingOrgMap.get(orgName);

    if (!fullScan && existingOrgData && !needsUpdate(existingOrgData, maxAgeHours)) {
      console.log(`  ⏭️  Skipping ${orgName} (updated ${new Date(existingOrgData.last_updated).toLocaleString()})`);
      updatedOrganizations.push(existingOrgData);
      skipCount++;
    } else {
      const orgData = await fetchOrganizationBounties(orgName);

      // Preserve existing evaluation and prep data if available
      if (existingOrgData) {
        for (const bounty of orgData.bounties) {
          const existingBounty = existingOrgData.bounties.find(b => b.id === bounty.id);
          if (existingBounty?.internal) {
            bounty.internal = existingBounty.internal;
          }
        }
      }

      updatedOrganizations.push(orgData);
      fetchCount++;

      // Add delay between requests to be nice to the API
      if (fetchCount < organizations.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  // Calculate totals
  const totalBounties = updatedOrganizations.reduce((sum, org) => sum + org.total_bounties, 0);
  const totalAmount = updatedOrganizations.reduce((sum, org) => sum + org.total_amount, 0);

  const index: BountyIndex = {
    generated_at: new Date().toISOString(),
    last_full_scan: fullScan ? new Date().toISOString() : existingIndex?.last_full_scan,
    update_mode: updateMode,
    total_organizations: updatedOrganizations.length,
    total_bounties: totalBounties,
    total_amount: totalAmount,
    organizations: updatedOrganizations,
    summary: generateSummary(updatedOrganizations)
  };

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Index generated successfully`);
  console.log(`   Organizations: ${updatedOrganizations.length}`);
  console.log(`   Bounties: ${totalBounties}`);
  console.log(`   Total value: $${(totalAmount / 100).toFixed(2)}`);
  console.log(`   Fetched: ${fetchCount}, Skipped: ${skipCount}`);
  console.log(`   Evaluated: ${index.summary.evaluated_bounties}`);
  console.log(`   Prepped: ${index.summary.prepped_bounties}`);

  return index;
}

/**
 * Save bounty index to file
 */
async function saveBountyIndex(index: BountyIndex): Promise<string> {
  // Ensure output directory exists
  try {
    await Deno.mkdir('../output/indices', { recursive: true });
  } catch {
    // Directory already exists
  }

  const filename = `../output/indices/bounty-index-${new Date().toISOString().split('T')[0]}.json`;
  await Deno.writeTextFile(filename, JSON.stringify(index, null, 2));
  console.log(`💾 Index saved: ${filename}`);
  return filename;
}

/**
 * Main execution function
 */
async function main() {
  const args = Deno.args;
  const fullScan = args.includes('--full-scan') || args.includes('--full');
  const maxAgeHours = parseInt(args.find(arg => arg.startsWith('--max-age='))?.split('=')[1] || '24');
  const organizations = args.find(arg => arg.startsWith('--orgs='))?.split('=')[1]?.split(',');

  try {
    const index = await generateBountyIndex({
      fullScan,
      maxAgeHours,
      organizations
    });

    const filename = await saveBountyIndex(index);

    console.log("\n🔧 Usage examples:");
    console.log("   # Full scan of all organizations:");
    console.log("   deno run --allow-all src/bounty-index-generator.ts --full-scan");
    console.log("   # Incremental update (6 hour max age):");
    console.log("   deno run --allow-all src/bounty-index-generator.ts --max-age=6");
    console.log("   # Specific organizations only:");
    console.log("   deno run --allow-all src/bounty-index-generator.ts --orgs=tscircuit,zio,twentyhq");

  } catch (error) {
    console.error(`❌ Failed to generate index: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}