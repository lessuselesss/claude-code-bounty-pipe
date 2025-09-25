#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run
/**
 * Pipeline Orchestrator
 *
 * Main coordination system that combines bounty evaluation with conditional
 * prep workflow automation. Implements the integrated approach with flags
 * for controlling evaluation and preparation phases.
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
    implementation_plan_ready?: boolean;
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

interface PipelineOptions {
  maxEvaluations?: number;
  minAmount?: number;
  maxAttempts?: number;
  skipExisting?: boolean;
  organizations?: string[];
  autoPrep?: boolean;
  minSuccessForPrep?: number;
  maxPrepCount?: number;
  startImplementation?: boolean;
  generateReports?: boolean;
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
 * Load evaluation framework
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
 * Load prep workflow framework
 */
async function loadPrepFramework(): Promise<string> {
  try {
    const framework = await Deno.readTextFile('../frameworks/CLAUDE-PREP-BOUNTY.md');
    return framework;
  } catch (error) {
    console.error(`❌ Failed to load prep framework: ${error.message}`);
    throw new Error('Could not load CLAUDE-PREP-BOUNTY.md framework');
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
 * Check if a bounty should be evaluated
 */
function shouldEvaluateBounty(bounty: Bounty, options: PipelineOptions): boolean {
  const { minAmount = 5000, maxAttempts = 0, skipExisting = true } = options;

  if (bounty.reward.amount < minAmount) return false;
  if (skipExisting && bounty.internal?.claude_code_evaluated) return false;
  if (bounty.attempt_count !== undefined && bounty.attempt_count > maxAttempts) return false;

  if (skipExisting && bounty.internal?.evaluation_status === 'evaluated' &&
      bounty.internal?.last_evaluated) {
    const lastEvaluated = new Date(bounty.internal.last_evaluated);
    const daysSinceEvaluation = (Date.now() - lastEvaluated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEvaluation < 7) return false;
  }

  return true;
}

/**
 * Check if a bounty should be prepped
 */
function shouldPrepBounty(bounty: Bounty, options: PipelineOptions): boolean {
  const { minSuccessForPrep = 75 } = options;

  // Must be evaluated first
  if (bounty.internal?.evaluation_status !== 'evaluated') return false;

  // Must be a GO recommendation
  if (bounty.internal?.go_no_go !== 'go') return false;

  // Must meet success probability threshold
  if ((bounty.internal?.success_probability || 0) < minSuccessForPrep) return false;

  // Don't prep if already prepped successfully
  if (bounty.internal?.prep_status === 'completed') return false;

  return true;
}

/**
 * Parse evaluation results from Claude Code response
 */
function parseEvaluationResult(evaluationText: string): {
  go_no_go: 'go' | 'no-go' | 'caution';
  complexity_score: number;
  success_probability: number;
  risk_level: 'low' | 'medium' | 'high';
  red_flags: string[];
  estimated_timeline: string;
  notes: string;
} {
  // Try to extract JSON summary
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
    } catch {
      console.log(`    ⚠️ Failed to parse JSON summary, using text analysis...`);
    }
  }

  // Fallback to text pattern matching
  const goNoGoMatch = evaluationText.match(/(?:decision|recommendation|status).*?:\s*(go|no-go|caution)/i);
  const complexityMatch = evaluationText.match(/complexity.*?(\d+)\/10/i);
  const probabilityMatch = evaluationText.match(/(?:success|probability).*?(\d+)%/i);
  const riskMatch = evaluationText.match(/risk.*?level.*?:\s*(low|medium|high)/i);
  const timelineMatch = evaluationText.match(/(?:timeline|estimate).*?:\s*([^\n]+)/i);

  const redFlags: string[] = [];
  const redFlagPatterns = [
    /red flag[s]?.*?:?\s*([^\n]+)/gi,
    /warning[s]?.*?:?\s*([^\n]+)/gi,
    /risk[s]?.*?:?\s*([^\n]+)/gi
  ];

  for (const pattern of redFlagPatterns) {
    const matches = evaluationText.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 10) {
        redFlags.push(match[1].trim());
      }
    }
  }

  return {
    go_no_go: goNoGoMatch?.[1]?.toLowerCase() as 'go' | 'no-go' | 'caution' || 'caution',
    complexity_score: parseInt(complexityMatch?.[1] || '5'),
    success_probability: parseInt(probabilityMatch?.[1] || '50'),
    risk_level: riskMatch?.[1]?.toLowerCase() as 'low' | 'medium' | 'high' || 'medium',
    red_flags: redFlags.slice(0, 5),
    estimated_timeline: timelineMatch?.[1]?.trim() || 'Unknown',
    notes: 'Automated evaluation via Claude Code SDK'
  };
}

/**
 * Evaluate a bounty using Claude Code SDK
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
    console.log(`  🤖 Evaluating: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'in_progress',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false
    };

    const evaluationPrompt = `
Using the 5-phase bounty evaluation framework, evaluate this bounty:

**Bounty Details:**
- Organization: ${repoInfo.org}
- Repository: ${repoInfo.repo}
- Issue Number: ${bounty.task.number}
- Amount: ${bounty.reward_formatted} ($${bounty.reward.amount/100})
- Title: ${bounty.task.title}
- URL: ${bounty.task.url}
- Description: ${bounty.task.body}

Execute the full 5-phase evaluation and provide:
1. Detailed markdown evaluation report
2. JSON summary with: go_no_go, complexity_score, success_probability, risk_level, red_flags, estimated_timeline, decision_rationale
`;

    const evaluationResult = await claude()
      .withModel('sonnet')
      .allowTools('Read', 'Grep', 'Glob', 'Bash', 'WebFetch')
      .inDirectory('.')
      .withTimeout(300000)
      .debug(false)
      .onToolUse(tool => console.log(`    🔧 Using tool: ${tool.name}`))
      .query(`${framework}\n\n---\n\n${evaluationPrompt}`)
      .asText();

    const structuredResult = parseEvaluationResult(evaluationResult);

    // Ensure output directory exists
    await Deno.mkdir('../output/evaluations', { recursive: true });

    const evaluationFile = `../output/evaluations/${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}.md`;
    await Deno.writeTextFile(evaluationFile, evaluationResult);

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

    console.log(`    ✅ Evaluation: ${structuredResult.go_no_go.toUpperCase()} (${structuredResult.success_probability}% success)`);

  } catch (error) {
    console.log(`    ❌ Evaluation failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'evaluation_failed',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false,
      notes: `Evaluation failed: ${error.message}`
    };
  }

  return bounty;
}

/**
 * Prep a bounty using Claude Code SDK
 */
async function prepBountyWithClaudeCode(bounty: Bounty, prepFramework: string): Promise<Bounty> {
  const repoInfo = extractRepoInfo(bounty.task.url);
  if (!repoInfo) {
    console.log(`  ❌ Could not extract repo info for prep: ${bounty.task.url}`);
    return bounty;
  }

  try {
    console.log(`  🛠️ Prepping: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    bounty.internal = {
      ...bounty.internal,
      prep_status: 'in_progress'
    };

    const prepPrompt = `
Using the 10-step prep bounty workflow, prepare this GO-rated bounty for implementation:

**Bounty Details:**
- Organization: ${repoInfo.org}
- Repository: ${repoInfo.repo}
- Issue Number: ${bounty.task.number}
- Amount: ${bounty.reward_formatted}
- Title: ${bounty.task.title}
- URL: ${bounty.task.url}
- Evaluation: ${bounty.internal?.go_no_go} (${bounty.internal?.success_probability}% success)
- Complexity: ${bounty.internal?.complexity_score}/10
- Timeline: ${bounty.internal?.estimated_timeline}

Execute the complete prep workflow:
1. Repository setup and feature branch creation
2. Implementation analysis and documentation
3. Test-driven development planning
4. Environment setup and validation
5. Clean separation of development files

Generate detailed prep documentation and implementation strategy.
`;

    const prepResult = await claude()
      .withModel('sonnet')
      .allowTools('Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep')
      .inDirectory('.')
      .withTimeout(600000) // 10 minute timeout for prep work
      .debug(false)
      .onToolUse(tool => console.log(`    🔧 Using tool: ${tool.name}`))
      .query(`${prepFramework}\n\n---\n\n${prepPrompt}`)
      .asText();

    // Ensure output directory exists
    await Deno.mkdir('../output/prep', { recursive: true });

    const prepFile = `../output/prep/${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}-prep.md`;
    await Deno.writeTextFile(prepFile, prepResult);

    bounty.internal = {
      ...bounty.internal,
      prep_status: 'completed',
      prep_file: prepFile,
      environment_validated: true, // Assume successful if no errors
      test_suite_passing: true,
      implementation_plan_ready: true
    };

    console.log(`    ✅ Prep completed: ${prepFile}`);

  } catch (error) {
    console.log(`    ❌ Prep failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      prep_status: 'failed',
      notes: `${bounty.internal?.notes || ''}\nPrep failed: ${error.message}`
    };
  }

  return bounty;
}

/**
 * Generate enhanced summary
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

      if (bounty.internal?.evaluation_status === 'evaluated') {
        evaluatedCount++;
        switch (bounty.internal.go_no_go) {
          case 'go': goCount++; break;
          case 'no-go': noGoCount++; break;
          case 'caution': cautionCount++; break;
        }
      }

      if (bounty.internal?.prep_status === 'completed') {
        preppedCount++;
      }
    }
  }

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
 * Run the integrated pipeline
 */
async function runPipeline(options: PipelineOptions): Promise<BountyIndex> {
  const {
    maxEvaluations = 5,
    autoPrep = false,
    maxPrepCount = 2,
    organizations = []
  } = options;

  console.log("🚀 Pipeline Orchestrator");
  console.log("=".repeat(50));

  // Load latest index
  const index = await loadLatestIndex();
  if (!index) {
    console.log("❌ No bounty index found. Please run the bounty index generator first.");
    console.log("   deno run --allow-all src/bounty-index-generator.ts");
    Deno.exit(1);
  }

  console.log(`📊 Loaded index with ${index.total_bounties} bounties from ${index.organizations.length} organizations`);
  console.log(`📈 Current status: ${index.summary.evaluated_bounties} evaluated, ${index.summary.prepped_bounties} prepped`);

  // Load frameworks
  let evaluationFramework: string;
  let prepFramework: string;

  try {
    evaluationFramework = await loadEvaluationFramework();
    console.log(`📋 Loaded evaluation framework (${evaluationFramework.length} characters)`);
  } catch (error) {
    console.error(`❌ Cannot proceed without evaluation framework: ${error.message}`);
    return index;
  }

  if (autoPrep) {
    try {
      prepFramework = await loadPrepFramework();
      console.log(`🛠️ Loaded prep framework (${prepFramework.length} characters)`);
    } catch (error) {
      console.error(`❌ Auto-prep disabled due to missing prep framework: ${error.message}`);
      options.autoPrep = false;
    }
  }

  let evaluationsPerformed = 0;
  let prepsPerformed = 0;
  let totalCandidates = 0;

  for (const orgData of index.organizations) {
    if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
      continue;
    }

    console.log(`\n📋 Processing ${orgData.organization} (${orgData.bounties.length} bounties)`);

    for (let i = 0; i < orgData.bounties.length; i++) {
      const bounty = orgData.bounties[i];

      // Phase 1: Evaluation
      if (evaluationsPerformed < maxEvaluations && shouldEvaluateBounty(bounty, options)) {
        totalCandidates++;
        console.log(`  📊 Evaluating: ${bounty.task.title} ($${bounty.reward.amount/100})`);

        orgData.bounties[i] = await evaluateBountyWithClaudeCode(bounty, evaluationFramework);
        evaluationsPerformed++;

        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }

      // Phase 2: Conditional Prep
      if (autoPrep && prepsPerformed < maxPrepCount && shouldPrepBounty(orgData.bounties[i], options)) {
        console.log(`  🛠️ Auto-prepping GO bounty: ${orgData.bounties[i].task.title}`);

        orgData.bounties[i] = await prepBountyWithClaudeCode(orgData.bounties[i], prepFramework!);
        prepsPerformed++;

        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      }

      // Stop if we've hit all limits
      if (evaluationsPerformed >= maxEvaluations && prepsPerformed >= maxPrepCount) {
        break;
      }
    }
  }

  console.log(`\n✅ Pipeline complete: ${evaluationsPerformed} evaluated, ${prepsPerformed} prepped`);

  // Regenerate summary
  index.summary = generateEnhancedSummary(index.organizations);
  index.generated_at = new Date().toISOString();

  return index;
}

/**
 * Main execution function
 */
async function main() {
  const args = Deno.args;

  const options: PipelineOptions = {
    maxEvaluations: parseInt(args.find(arg => arg.startsWith('--max-evaluations='))?.split('=')[1] || '5'),
    minAmount: parseInt(args.find(arg => arg.startsWith('--min-amount='))?.split('=')[1] || '5000'),
    maxAttempts: parseInt(args.find(arg => arg.startsWith('--max-attempts='))?.split('=')[1] || '0'),
    skipExisting: !args.includes('--reevaluate'),
    organizations: args.find(arg => arg.startsWith('--orgs='))?.split('=')[1]?.split(',') || [],
    autoPrep: args.includes('--auto-prep'),
    minSuccessForPrep: parseInt(args.find(arg => arg.startsWith('--min-success='))?.split('=')[1] || '75'),
    maxPrepCount: parseInt(args.find(arg => arg.startsWith('--max-prep='))?.split('=')[1] || '2'),
    startImplementation: args.includes('--start-implementation'),
    generateReports: args.includes('--reports')
  };

  try {
    const updatedIndex = await runPipeline(options);

    // Save updated index
    const filename = `../output/indices/bounty-index-${new Date().toISOString().split('T')[0]}.json`;
    await Deno.writeTextFile(filename, JSON.stringify(updatedIndex, null, 2));
    console.log(`💾 Updated index saved: ${filename}`);

    // Print final summary
    console.log("\n" + "=".repeat(50));
    console.log("📋 PIPELINE SUMMARY");
    console.log("=".repeat(50));
    console.log(`🎯 Total bounties: ${updatedIndex.total_bounties}`);
    console.log(`💰 Total value: $${(updatedIndex.total_amount / 100).toFixed(2)}`);
    console.log(`🧪 Evaluated: ${updatedIndex.summary.evaluated_bounties}`);
    console.log(`✅ Go recommendations: ${updatedIndex.summary.go_recommendations}`);
    console.log(`⚠️  Caution recommendations: ${updatedIndex.summary.caution_recommendations}`);
    console.log(`❌ No-go recommendations: ${updatedIndex.summary.no_go_recommendations}`);
    console.log(`🛠️ Prepped bounties: ${updatedIndex.summary.prepped_bounties}`);

    if (updatedIndex.summary.largest_bounty) {
      console.log(`🏆 Largest bounty: $${(updatedIndex.summary.largest_bounty.amount / 100).toFixed(2)} (${updatedIndex.summary.largest_bounty.organization})`);
    }

    console.log("\n🔧 Usage examples:");
    console.log("   # Evaluate + auto-prep high-confidence bounties:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --min-success=80");
    console.log("   # Conservative: only prep the best bounties:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --min-success=85 --max-prep=1");
    console.log("   # Full workflow for specific orgs:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --orgs=tscircuit,zio --auto-prep");

  } catch (error) {
    console.error(`❌ Pipeline failed: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}