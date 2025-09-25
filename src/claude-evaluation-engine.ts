#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run
/**
 * Claude Code Evaluation Engine
 *
 * Automated bounty evaluation system using Claude Code SDK and the proven
 * 5-phase evaluation methodology. Detects qualifying bounties and spawns
 * Claude Code instances for comprehensive evaluation.
 */

import { claude } from 'npm:@instantlyeasy/claude-code-sdk-ts@^0.3.0';

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

/**
 * Load the latest bounty index
 */
async function loadLatestIndex(): Promise<BountyIndex | null> {
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

    console.log(`📖 Loading latest index: ${latestFile}`);
    const content = await Deno.readTextFile(`../output/indices/${latestFile}`);
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to load index: ${error.message}`);
    return null;
  }
}

/**
 * Load the evaluation framework
 */
async function loadEvaluationFramework(): Promise<string> {
  try {
    const framework = await Deno.readTextFile('../frameworks/CLAUDE-EVALUATE-BOUNTY.md');
    return framework;
  } catch (error) {
    console.error(`❌ Failed to load evaluation framework: ${error.message}`);
    throw new Error('Could not load CLAUDE-EVALUATE-BOUNTY.md framework');
  }
}

/**
 * Extract GitHub org and repo from bounty task URL
 */
function extractRepoInfo(url: string): { org: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/\d+/);
  if (match) {
    return { org: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Check if a bounty should be evaluated automatically
 */
function shouldEvaluateBounty(bounty: Bounty, options: {
  minAmount?: number;
  maxAttempts?: number;
  skipExisting?: boolean;
}): boolean {
  const { minAmount = 5000, maxAttempts = 0, skipExisting = true } = options;

  // Skip if below minimum amount
  if (bounty.reward.amount < minAmount) {
    return false;
  }

  // Skip if already evaluated by Claude Code (unless skipExisting is false)
  if (skipExisting && bounty.internal?.claude_code_evaluated) {
    return false;
  }

  // Skip if too many attempts (indicates problematic bounty)
  if (bounty.attempt_count !== undefined && bounty.attempt_count > maxAttempts) {
    return false;
  }

  // Skip if internal evaluation is already populated and up to date
  if (skipExisting && bounty.internal?.evaluation_status === 'evaluated' &&
      bounty.internal?.last_evaluated) {
    const lastEvaluated = new Date(bounty.internal.last_evaluated);
    const daysSinceEvaluation = (Date.now() - lastEvaluated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEvaluation < 7) { // Skip if evaluated within last week
      return false;
    }
  }

  return true;
}

/**
 * Parse Claude Code evaluation result to extract structured data
 */
function parseEvaluationResult(
  evaluationText: string,
  repoInfo: { org: string; repo: string },
  bounty: Bounty
): {
  go_no_go: 'go' | 'no-go' | 'caution';
  complexity_score: number;
  success_probability: number;
  risk_level: 'low' | 'medium' | 'high';
  red_flags: string[];
  estimated_timeline: string;
  notes: string;
} {

  // Try to extract JSON summary from the evaluation
  const jsonMatch = evaluationText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        go_no_go: parsed.go_no_go || 'caution',
        complexity_score: parsed.complexity_score || 5,
        success_probability: parsed.success_probability || 50,
        risk_level: parsed.risk_level || 'medium',
        red_flags: parsed.red_flags || [],
        estimated_timeline: parsed.estimated_timeline || 'Unknown',
        notes: parsed.decision_rationale || 'Automated evaluation via Claude Code'
      };
    } catch (jsonError) {
      console.log(`    ⚠️ Failed to parse JSON summary, using text analysis...`);
    }
  }

  // Fallback to text pattern matching
  const goNoGoMatch = evaluationText.match(/(?:decision|recommendation|status).*?:\s*(go|no-go|caution)/i);
  const complexityMatch = evaluationText.match(/complexity.*?(\d+)\/10/i);
  const probabilityMatch = evaluationText.match(/(?:success|probability).*?(\d+)%/i);
  const riskMatch = evaluationText.match(/risk.*?level.*?:\s*(low|medium|high)/i);
  const timelineMatch = evaluationText.match(/(?:timeline|estimate).*?:\s*([^\n]+)/i);

  return {
    go_no_go: goNoGoMatch?.[1]?.toLowerCase() as 'go' | 'no-go' | 'caution' || 'caution',
    complexity_score: parseInt(complexityMatch?.[1] || '5'),
    success_probability: parseInt(probabilityMatch?.[1] || '50'),
    risk_level: riskMatch?.[1]?.toLowerCase() as 'low' | 'medium' | 'high' || 'medium',
    red_flags: extractRedFlags(evaluationText),
    estimated_timeline: timelineMatch?.[1]?.trim() || 'Unknown',
    notes: 'Automated evaluation via Claude Code SDK'
  };
}

/**
 * Extract red flags from evaluation text
 */
function extractRedFlags(text: string): string[] {
  const redFlags: string[] = [];

  // Look for common red flag patterns
  const patterns = [
    /red flag[s]?.*?:?\s*([^\n]+)/gi,
    /warning[s]?.*?:?\s*([^\n]+)/gi,
    /risk[s]?.*?:?\s*([^\n]+)/gi,
    /concern[s]?.*?:?\s*([^\n]+)/gi
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 10) {
        redFlags.push(match[1].trim());
      }
    }
  }

  return redFlags.slice(0, 5); // Limit to top 5 red flags
}

/**
 * Ensure evaluations directory exists
 */
async function ensureEvaluationDirectory(): Promise<void> {
  try {
    await Deno.mkdir('../output/evaluations', { recursive: true });
  } catch {
    // Directory already exists
  }
}

/**
 * Evaluate a bounty using Claude Code SDK with the 5-phase framework
 */
async function evaluateBountyWithClaudeCode(bounty: Bounty, framework: string): Promise<Bounty> {
  const repoInfo = extractRepoInfo(bounty.task.url);
  if (!repoInfo) {
    console.log(`  ❌ Could not extract repo info from URL: ${bounty.task.url}`);
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'evaluation_failed',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false,
      notes: 'Could not extract repository information from URL'
    };
    return bounty;
  }

  try {
    console.log(`  🤖 Claude Code evaluating: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    // Mark as in progress
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'in_progress',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false
    };

    // Prepare the evaluation prompt with bounty context
    const evaluationPrompt = `
Using the 5-phase bounty evaluation framework provided, please evaluate this bounty:

**Bounty Details:**
- Organization: ${repoInfo.org}
- Repository: ${repoInfo.repo}
- Issue Number: ${bounty.task.number}
- Amount: ${bounty.reward_formatted} ($${bounty.reward.amount/100})
- Title: ${bounty.task.title}
- URL: ${bounty.task.url}
- Description: ${bounty.task.body}

**Instructions:**
1. Follow the complete 5-phase evaluation methodology from the framework
2. Use GitHub CLI research methods as specified in the framework
3. Generate a systematic evaluation with scoring and risk assessment
4. Create a structured markdown report
5. Provide a final JSON summary with the key evaluation metrics

Please execute the full evaluation following all phases and provide both:
1. A detailed markdown evaluation report
2. A JSON summary with: go_no_go, complexity_score, success_probability, risk_level, red_flags, estimated_timeline, decision_rationale

Focus on identifying "trap bounties" and providing accurate complexity assessment.
`;

    // Execute Claude Code evaluation with the framework as context
    const evaluationResult = await claude()
      .withModel('sonnet')
      .allowTools('Read', 'Grep', 'Glob', 'Bash', 'WebFetch')
      .inDirectory('.') // Use current directory context
      .withTimeout(300000) // 5 minute timeout for thorough evaluation
      .debug(false) // Disable debug to reduce noise
      .onToolUse(tool => console.log(`    🔧 Using tool: ${tool.name}`))
      .query(`${framework}\n\n---\n\n${evaluationPrompt}`)
      .asText();

    console.log(`    📝 Evaluation completed, parsing results...`);

    // Parse the evaluation result to extract structured data
    const structuredResult = parseEvaluationResult(evaluationResult, repoInfo, bounty);

    // Generate markdown file with the full evaluation
    const evaluationFile = `../output/evaluations/${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}.md`;
    await ensureEvaluationDirectory();
    await Deno.writeTextFile(evaluationFile, evaluationResult);

    // Update internal fields with Claude Code evaluation results
    bounty.internal = {
      evaluation_status: 'evaluated',
      go_no_go: structuredResult.go_no_go,
      complexity_score: structuredResult.complexity_score,
      success_probability: structuredResult.success_probability,
      risk_level: structuredResult.risk_level,
      evaluation_file: evaluationFile,
      last_evaluated: new Date().toISOString(),
      red_flags: structuredResult.red_flags,
      estimated_timeline: structuredResult.estimated_timeline,
      notes: structuredResult.notes,
      claude_code_evaluated: true
    };

    console.log(`    ✅ Claude Code evaluation complete: ${structuredResult.go_no_go.toUpperCase()} (${structuredResult.success_probability}% success)`);

  } catch (error) {
    console.log(`    ❌ Claude Code evaluation failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'evaluation_failed',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false,
      notes: `Claude Code evaluation failed: ${error.message}`
    };
  }

  return bounty;
}

/**
 * Auto-evaluate bounties using Claude Code
 */
async function autoEvaluateWithClaudeCode(
  index: BountyIndex,
  options: {
    maxEvaluations?: number;
    minAmount?: number;
    maxAttempts?: number;
    skipExisting?: boolean;
    organizations?: string[];
  } = {}
): Promise<BountyIndex> {

  const {
    maxEvaluations = 5,
    minAmount = 5000, // $50 minimum
    maxAttempts = 0, // Only evaluate bounties with 0 attempts
    skipExisting = true,
    organizations = []
  } = options;

  console.log(`🤖 Claude Code auto-evaluation (max: ${maxEvaluations}, min: $${minAmount/100}, max attempts: ${maxAttempts})`);

  // Load the evaluation framework
  let framework: string;
  try {
    framework = await loadEvaluationFramework();
    console.log(`📋 Loaded evaluation framework (${framework.length} characters)`);
  } catch (error) {
    console.error(`❌ Cannot proceed without evaluation framework: ${error.message}`);
    return index;
  }

  let evaluationsPerformed = 0;
  let totalCandidates = 0;

  for (const orgData of index.organizations) {
    if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
      continue;
    }

    console.log(`\n📋 Processing ${orgData.organization} (${orgData.bounties.length} bounties)`);

    for (let i = 0; i < orgData.bounties.length && evaluationsPerformed < maxEvaluations; i++) {
      const bounty = orgData.bounties[i];

      // Check if this bounty should be evaluated
      if (shouldEvaluateBounty(bounty, { minAmount, maxAttempts, skipExisting })) {
        totalCandidates++;
        console.log(`  📊 Candidate: ${bounty.task.title} ($${bounty.reward.amount/100}, ${bounty.attempt_count || 0} attempts)`);

        // Evaluate the bounty with Claude Code
        orgData.bounties[i] = await evaluateBountyWithClaudeCode(bounty, framework);
        evaluationsPerformed++;

        // Add delay between evaluations to be nice to APIs and prevent overwhelming Claude Code
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }
    }
  }

  console.log(`\n✅ Claude Code auto-evaluation complete: ${evaluationsPerformed} bounties evaluated out of ${totalCandidates} candidates`);

  // Regenerate summary with updated evaluation data
  index.summary = generateEnhancedSummary(index.organizations);
  index.generated_at = new Date().toISOString();

  return index;
}

/**
 * Generate enhanced summary with evaluation metrics
 */
function generateEnhancedSummary(organizations: OrganizationBounties[]): BountyIndex['summary'] {
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
 * Main execution function
 */
async function main() {
  const args = Deno.args;
  const maxEvaluations = parseInt(args.find(arg => arg.startsWith('--max-evaluations='))?.split('=')[1] || '5');
  const minAmount = parseInt(args.find(arg => arg.startsWith('--min-amount='))?.split('=')[1] || '5000');
  const maxAttempts = parseInt(args.find(arg => arg.startsWith('--max-attempts='))?.split('=')[1] || '0');
  const skipExisting = !args.includes('--reevaluate');
  const organizations = args.find(arg => arg.startsWith('--orgs='))?.split('=')[1]?.split(',') || [];

  console.log("🤖 Claude Code Evaluation Engine");
  console.log("=".repeat(50));

  // Load latest index
  const index = await loadLatestIndex();
  if (!index) {
    console.log("❌ No bounty index found. Please run the bounty index generator first.");
    console.log("   deno run --allow-all src/bounty-index-generator.ts");
    Deno.exit(1);
  }

  console.log(`📊 Loaded index with ${index.total_bounties} bounties from ${index.organizations.length} organizations`);
  console.log(`📈 Current evaluation status: ${index.summary.evaluated_bounties} evaluated`);

  // Auto-evaluate bounties with Claude Code
  const updatedIndex = await autoEvaluateWithClaudeCode(index, {
    maxEvaluations,
    minAmount,
    maxAttempts,
    skipExisting,
    organizations
  });

  // Save updated index
  const filename = `../output/indices/bounty-index-${new Date().toISOString().split('T')[0]}.json`;
  await Deno.writeTextFile(filename, JSON.stringify(updatedIndex, null, 2));
  console.log(`💾 Updated index saved: ${filename}`);

  // Print final summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 EVALUATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`🎯 Total bounties: ${updatedIndex.total_bounties}`);
  console.log(`💰 Total value: $${(updatedIndex.total_amount / 100).toFixed(2)}`);
  console.log(`🧪 Evaluated: ${updatedIndex.summary.evaluated_bounties}`);
  console.log(`✅ Go recommendations: ${updatedIndex.summary.go_recommendations}`);
  console.log(`⚠️  Caution recommendations: ${updatedIndex.summary.caution_recommendations}`);
  console.log(`❌ No-go recommendations: ${updatedIndex.summary.no_go_recommendations}`);

  if (updatedIndex.summary.largest_bounty) {
    console.log(`🏆 Largest bounty: $${(updatedIndex.summary.largest_bounty.amount / 100).toFixed(2)} (${updatedIndex.summary.largest_bounty.organization})`);
  }

  console.log("\n🔧 Usage examples:");
  console.log("   # Evaluate up to 3 new bounties with 0 attempts:");
  console.log("   deno run --allow-all src/claude-evaluation-engine.ts --max-evaluations=3");
  console.log("   # Evaluate specific organizations only:");
  console.log("   deno run --allow-all src/claude-evaluation-engine.ts --orgs=tscircuit,zio --max-evaluations=5");
  console.log("   # Allow bounties with up to 2 attempts:");
  console.log("   deno run --allow-all src/claude-evaluation-engine.ts --max-attempts=2 --max-evaluations=5");
  console.log("   # Re-evaluate existing evaluations:");
  console.log("   deno run --allow-all src/claude-evaluation-engine.ts --reevaluate --max-evaluations=2");
}

if (import.meta.main) {
  main().catch(console.error);
}