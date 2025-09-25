#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run
/**
 * Claude Code Evaluation Engine
 *
 * Automated bounty evaluation system using Claude Code SDK and the proven
 * 5-phase evaluation methodology. Detects qualifying bounties and spawns
 * Claude Code instances for comprehensive evaluation.
 */

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { query } from 'npm:@anthropic-ai/claude-code@latest';
import { evaluateBountyStructured } from './slash-command-executor.ts';
import { getBountyPipePaths } from './repository-cache.ts';
import {
  loadEvaluationFramework,
  extractRepoInfo,
  buildEvaluationPrompt,
  parseEvaluationResult,
  getCachedRepository
} from './evaluation-framework.ts';
import { checkComprehensiveAssignment } from './algora-api-client.ts';
import type { Bounty, BountyIndex, OrganizationBounties } from '../schemas/bounty-schema.ts';

// Using formal schema from schemas/bounty-schema.ts with comprehensive assignment detection

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

  // Skip if bounty is not available (assigned on GitHub or claimed on Algora)
  if (bounty.internal?.is_available === false) {
    const githubAssigned = bounty.internal.github_assignment?.assignees?.length > 0;
    const algoraClaimed = bounty.internal.algora_assignment?.claimed;

    if (githubAssigned) {
      const assignees = bounty.internal.github_assignment.assignees.map(a => a.login).join(', ');
      console.log(`⏭️  Skipping bounty ${bounty.id} - assigned on GitHub to: ${assignees}`);
    } else if (algoraClaimed) {
      console.log(`⏭️  Skipping bounty ${bounty.id} - claimed on Algora by ${bounty.internal.algora_assignment.claimant || 'unknown'}`);
    } else {
      console.log(`⏭️  Skipping bounty ${bounty.id} - marked as unavailable`);
    }
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
 * Evaluate a bounty using native slash command
 */
async function evaluateBountyWithSlashCommand(bounty: Bounty): Promise<Bounty> {
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
    console.log(`  ⚡ Slash command evaluating: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    // Mark as in progress
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'in_progress',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false
    };

    // Execute slash command evaluation
    const result = await evaluateBountyStructured(
      repoInfo.org,
      repoInfo.repo,
      bounty.task.number,
      {
        minReward: bounty.reward.amount / 100, // Convert cents to dollars
        timeout: 300000 // 5 minutes
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Slash command evaluation failed');
    }

    // Parse the evaluation result
    const structuredResult = result.evaluation || parseEvaluationResult(result.fullOutput, repoInfo, bounty);

    // Generate markdown file with the full evaluation in XDG-compliant location
    const { repoCache } = getBountyPipePaths();
    const orgDir = join(repoCache, repoInfo.org);
    await Deno.mkdir(orgDir, { recursive: true });
    const evaluationFile = join(orgDir, `${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}.md`);
    await Deno.writeTextFile(evaluationFile, result.fullOutput);

    // Update internal fields with evaluation results
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

    console.log(`    ✅ Slash command evaluation complete: ${structuredResult.go_no_go.toUpperCase()} (${structuredResult.success_probability}% success)`);

  } catch (error) {
    console.log(`    ❌ Slash command evaluation failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'evaluation_failed',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false,
      notes: `Slash command evaluation failed: ${error.message}`
    };
  }

  return bounty;
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

    // Get cached repository for evaluation (preserves across sessions)
    console.log(`    📁 Getting cached repository for evaluation...`);
    const cachedRepoPath = await getCachedRepository(repoInfo.org, repoInfo.repo, {
      maxAgeHours: 168, // 1 week cache for evaluations
      forEvaluation: true
    });

    // Prepare the evaluation prompt with bounty context and repo cache info
    const evaluationPrompt = buildEvaluationPrompt(bounty) + `

**Repository Cache Information:**
- Cached repository available at: ${cachedRepoPath}
- Use this path for any file analysis or repository exploration
- Repository is kept fresh and reused across evaluations for efficiency
`;

    // Execute Claude Code evaluation with the framework as context
    let evaluationResult = '';
    for await (const message of query({
      prompt: `${framework}\n\n---\n\n${evaluationPrompt}`,
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: ['Read', 'Grep', 'Glob', 'Bash', 'WebFetch'],
        cwd: cachedRepoPath,
        maxTurns: 10,
        hooks: {
          PreToolUse: [{
            hooks: [async (input) => {
              console.log(`    🔧 Using tool: ${input.tool_name}`);
              return { continue: true };
            }]
          }]
        }
      }
    })) {
      if (message.type === 'assistant') {
        evaluationResult += message.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          evaluationResult = message.result;
        }
        break;
      }
    }

    console.log(`    📝 Evaluation completed, parsing results...`);

    // Parse the evaluation result to extract structured data
    const structuredResult = parseEvaluationResult(evaluationResult, repoInfo, bounty);

    // Generate markdown file with the full evaluation in XDG-compliant location
    const { repoCache } = getBountyPipePaths();
    const orgDir = join(repoCache, repoInfo.org);
    await Deno.mkdir(orgDir, { recursive: true });
    const evaluationFile = join(orgDir, `${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}.md`);
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
    evaluationMethod?: 'sdk' | 'slash-command';
  } = {}
): Promise<BountyIndex> {

  const {
    maxEvaluations = 5,
    minAmount = 5000, // $50 minimum
    maxAttempts = 0, // Only evaluate bounties with 0 attempts
    skipExisting = true,
    organizations = [],
    evaluationMethod = 'sdk' // Default to SDK for performance
  } = options;

  console.log(`🤖 Claude Code auto-evaluation (method: ${evaluationMethod}, max: ${maxEvaluations}, min: $${minAmount/100}, max attempts: ${maxAttempts})`);

  // Load the evaluation framework (only needed for SDK method)
  let framework: string | undefined;
  if (evaluationMethod === 'sdk') {
    try {
      framework = await loadEvaluationFramework();
      console.log(`📋 Loaded evaluation framework (${framework.length} characters)`);
    } catch (error) {
      console.error(`❌ Cannot proceed without evaluation framework: ${error.message}`);
      return index;
    }
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

        // Evaluate the bounty with selected method
        if (evaluationMethod === 'slash-command') {
          orgData.bounties[i] = await evaluateBountyWithSlashCommand(bounty);
        } else {
          orgData.bounties[i] = await evaluateBountyWithClaudeCode(bounty, framework!);
        }
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
  const evaluationMethod = args.includes('--slash-command') ? 'slash-command' : 'sdk';

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
    organizations,
    evaluationMethod
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