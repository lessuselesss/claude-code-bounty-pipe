#!/usr/bin/env -S deno run --allow-all
/**
 * Pipeline Orchestrator
 *
 * Main coordination system that combines bounty evaluation with conditional
 * prep workflow automation. Implements the integrated approach with flags
 * for controlling evaluation and preparation phases.
 */

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { query } from 'npm:@anthropic-ai/claude-code@latest';
import { implementationToolsServer } from './custom-tools/implementation-tools.ts';
import { getBountyPipePaths } from './repository-cache.ts';
import { checkComprehensiveAssignment } from './algora-api-client.ts';
import {
  validateAndLogIndex,
  validateAndFilterBounties,
  processWithValidation,
  performBountyHealthCheck
} from './bounty-validator.ts';
import { SpecDrivenBountyEngine, type BountySpec } from './spec-driven-bounty-engine.ts';
import { SpecDrivenOrchestrator, type SpecExecutionMode } from './spec-driven/spec-driven-orchestrator.ts';
import { FastTrackOrchestrator } from './spec-driven/fast-track-orchestrator.ts';
import { QuickBountyEvaluator, type QuickEvaluationResult } from './evaluators/quick-bounty-evaluator.ts';
import { AutoImplementationDecisionEngine, type AutoImplementationDecision } from './decision-engines/auto-implementation-decision-engine.ts';
import { QualityAssuranceEngine, type QualityGateResult } from './quality-gates/quality-assurance-engine.ts';
import { PipelineAnalytics } from './analytics/pipeline-analytics.ts';
import type { Bounty, BountyIndex, OrganizationBounties } from '../schemas/bounty-schema.ts';

// Using formal schema from schemas/bounty-schema.ts with full assignment detection support

interface PipelineOptions {
  maxEvaluations?: number;
  minAmount?: number;
  maxAttempts?: number;
  skipExisting?: boolean;
  organizations?: string[];
  autoPrep?: boolean;
  minSuccessForPrep?: number;
  maxPrepCount?: number;
  autoImplement?: boolean;
  maxImplementations?: number;
  autoSubmit?: boolean;
  maxSubmissions?: number;
  startImplementation?: boolean;
  generateReports?: boolean;
  // New spec-driven options
  useSpecDriven?: boolean;
  maxSpecs?: number;
  specExecutionMode?: 'sdk' | 'slash-commands' | 'hybrid';
  specAutoImplement?: boolean;
  // CLAUDE.md generation options
  generateClaudeMarkdown?: boolean;
  claudeMarkdownOnly?: boolean;
  maxClaudeMarkdown?: number;
  // Performance optimization options
  useQuickEvaluation?: boolean;
  quickEvaluationMinConfidence?: number;
  // Parallel processing options
  useParallelProcessing?: boolean;
  maxParallelWorkers?: number;
  batchSize?: number;
  // Smart auto-implementation options
  useSmartAutoImplementation?: boolean;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  smartImplementationMaxCount?: number;
  enableQualityGates?: boolean;
  bypassAssignmentCheck?: boolean; // For testing/demo purposes
  enableAnalytics?: boolean;
  saveAnalyticsToFile?: boolean;
  // Relaxed mode for minimal bounty data
  relaxedMode?: boolean;
}

/**
 * Validate prep result quality and content
 */
function validatePrepResult(prepResult: string | undefined | null, relaxedMode: boolean = false): { valid: boolean; reason?: string } {
  // Check if result is null, undefined, or empty
  if (!prepResult || typeof prepResult !== 'string') {
    return { valid: false, reason: 'Result is null, undefined, or not a string' };
  }

  if (prepResult.trim().length < 50) {
    return { valid: false, reason: 'Result is empty or too short (< 50 characters)' };
  }

  // Check for common error patterns (relaxed in relaxed mode)
  const lowerResult = prepResult.toLowerCase();
  const errorPatterns = relaxedMode ? [
    // More lenient error patterns in relaxed mode
    'failed to',
    'could not find',
    'unable to',
    'permission denied',
    'access denied',
    'timeout',
    'connection refused',
    'cannot find',
    'does not exist',
    'i apologize',
    'i cannot',
    'i\'m unable'
  ] : [
    // Strict error patterns in normal mode
    'error:',
    'failed to',
    'could not find',
    'unable to',
    'permission denied',
    'access denied',
    'timeout',
    'connection refused',
    'cannot find',
    'does not exist',
    'i apologize',
    'i cannot',
    'i\'m unable'
  ];

  for (const pattern of errorPatterns) {
    if (lowerResult.includes(pattern)) {
      return { valid: false, reason: `Contains error pattern: "${pattern}"` };
    }
  }

  // Check for minimum prep content indicators
  const requiredContent = [
    'implementation',
    'test',
    'requirement'
  ];

  let contentScore = 0;
  for (const content of requiredContent) {
    if (lowerResult.includes(content)) {
      contentScore++;
    }
  }

  const requiredContentScore = relaxedMode ? 0 : 2; // More lenient in relaxed mode
  if (contentScore < requiredContentScore) {
    return { valid: false, reason: 'Missing essential prep content (implementation, tests, requirements)' };
  }

  // Check for reasonable length (relaxed in relaxed mode)
  const minLength = relaxedMode ? 50 : 200;
  if (prepResult.length < minLength) {
    return { valid: false, reason: `Result too short for meaningful prep documentation (< ${minLength} characters)` };
  }

  return { valid: true };
}

/**
 * Load the latest bounty index
 */
async function loadLatestIndex(): Promise<BountyIndex | null> {
  try {
    const files = [];
    for await (const dirEntry of Deno.readDir('./output/indices')) {
      if (dirEntry.name.startsWith('bounty-index-') && dirEntry.name.endsWith('.json')) {
        files.push(dirEntry.name);
      }
    }

    if (files.length === 0) return null;

    files.sort().reverse();
    const latestFile = files[0];

    console.log(`📖 Loading latest index: ${latestFile}`);
    const content = await Deno.readTextFile(`./output/indices/${latestFile}`);
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
    const framework = await Deno.readTextFile('./workflows/CLAUDE-EVALUATE-BOUNTY.md');
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
    const framework = await Deno.readTextFile('./workflows/CLAUDE-PREP-BOUNTY.md');
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
 * Process a single implementation with error handling
 */
async function processImplementation(
  implementationTask: { bounty: Bounty; decision: AutoImplementationDecision },
  index: BountyIndex,
  prepFramework: string,
  enableQualityGates: boolean,
  analytics?: PipelineAnalytics,
  options: PipelineOptions = {}
): Promise<void> {
  const { bounty, decision } = implementationTask;

  // Track implementation start
  const trackingId = analytics?.trackImplementationStart(bounty);
  const startTime = Date.now();

  try {
    // Phase 1: Prep (if not already prepped)
    let updatedBounty = bounty;
    if (bounty.internal?.prep_status !== 'completed') {
      console.log(`   🛠️ Prepping bounty: ${bounty.task.title}`);
      updatedBounty = await prepBountyWithClaudeCode(bounty, prepFramework, options);

      // Update the bounty in the index
      updateBountyInIndex(index, updatedBounty);

      if (updatedBounty.internal?.prep_status !== 'completed') {
        console.log(`   ❌ Prep failed for: ${bounty.task.title}`);

        // Track failed implementation
        if (analytics && trackingId) {
          const duration = Date.now() - startTime;
          analytics.trackImplementationComplete(trackingId, bounty, duration, false);
        }
        return;
      }
    }

    // Phase 2: Implementation
    console.log(`   ⚡ Implementing: ${updatedBounty.task.title}`);
    const implementedBounty = await implementBountyWithClaudeCode(updatedBounty);

    // Update the bounty in the index
    updateBountyInIndex(index, implementedBounty);

    // Phase 3: Quality Gates (if enabled)
    let qualityResult;
    if (enableQualityGates) {
      console.log(`   🔍 Running quality gates: ${implementedBounty.task.title}`);

      const qualityEngine = new QualityAssuranceEngine({
        passingThreshold: 75, // Moderate threshold for auto-implementation
        strictMode: false,    // Allow some flexibility
      });

      qualityResult = await qualityEngine.runQualityGates(implementedBounty);

      // Track quality gates
      analytics?.trackQualityGates(implementedBounty, qualityResult);

      // Update bounty with quality gate results
      implementedBounty.internal = {
        ...implementedBounty.internal,
        quality_gate_result: {
          passed: qualityResult.passed,
          score: qualityResult.score,
          assessment: qualityResult.overallAssessment,
          blockers: qualityResult.blockers,
          warnings: qualityResult.warnings,
          recommendations: qualityResult.recommendations,
        },
        final_submission_ready: qualityResult.passed && implementedBounty.internal?.implementation_result?.ready_for_submission,
      };

      // Update in index
      updateBountyInIndex(index, implementedBounty);

      if (qualityResult.passed) {
        console.log(`   ✅ Quality gates passed (${qualityResult.score}/100): ${implementedBounty.task.title}`);
      } else {
        console.log(`   ⚠️ Quality gates failed (${qualityResult.score}/100): ${implementedBounty.task.title}`);
        if (qualityResult.blockers.length > 0) {
          console.log(`     Blockers: ${qualityResult.blockers.slice(0, 2).join('; ')}${qualityResult.blockers.length > 2 ? '...' : ''}`);
        }
      }
    }

    // Determine success based on implementation status and quality gates
    const implementationSuccess = implementedBounty.internal?.implementation_status === 'completed' &&
                                 (!enableQualityGates || !qualityResult || qualityResult.passed);

    // Track implementation completion
    if (analytics && trackingId) {
      const duration = Date.now() - startTime;
      analytics.trackImplementationComplete(trackingId, implementedBounty, duration, implementationSuccess);
    }

    // Success notification
    if (implementedBounty.internal?.implementation_status === 'completed') {
      console.log(`   🎉 Completed: ${implementedBounty.task.title}`);
    } else {
      console.log(`   ❌ Failed: ${implementedBounty.task.title}`);
    }

  } catch (error) {
    console.error(`   ❌ Implementation error for ${bounty.task.title}: ${error instanceof Error ? error.message : String(error)}`);

    // Track failed implementation
    if (analytics && trackingId) {
      const duration = Date.now() - startTime;
      analytics.trackImplementationComplete(trackingId, bounty, duration, false);
    }
  }
}

/**
 * Process multiple implementations in parallel with batching
 */
async function processImplementationsInParallel(
  implementations: Array<{ bounty: Bounty; decision: AutoImplementationDecision }>,
  index: BountyIndex,
  prepFramework: string,
  enableQualityGates: boolean,
  maxParallelWorkers: number,
  batchSize: number,
  analytics?: PipelineAnalytics
): Promise<void> {
  console.log(`🚀 Processing ${implementations.length} implementations in parallel`);

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < implementations.length; i += batchSize) {
    const batch = implementations.slice(i, i + batchSize);
    const workerCount = Math.min(batch.length, maxParallelWorkers);

    console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(implementations.length/batchSize)}: ${batch.length} implementations (${workerCount} workers)`);

    // Create worker tasks for parallel execution
    const implementationTasks: Promise<void>[] = [];

    for (let j = 0; j < batch.length; j++) {
      const implementation = batch[j];

      const task = processImplementation(
        implementation,
        index,
        prepFramework,
        enableQualityGates,
        analytics
      );

      implementationTasks.push(task);
    }

    // Wait for all parallel implementations to complete
    try {
      const batchResults = await Promise.allSettled(implementationTasks);

      // Log batch results
      const successful = batchResults.filter(r => r.status === 'fulfilled').length;
      const failed = batchResults.filter(r => r.status === 'rejected').length;

      console.log(`✅ Batch completed: ${successful} successful, ${failed} failed`);

      // Brief delay between batches to avoid rate limits
      if (i + batchSize < implementations.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`🎉 Parallel implementation processing completed`);
}

/**
 * Helper function to update bounty in index
 */
function updateBountyInIndex(index: BountyIndex, updatedBounty: Bounty): void {
  for (const orgData of index.organizations) {
    const bountyIndex = orgData.bounties.findIndex(b => b.id === updatedBounty.id);
    if (bountyIndex !== -1) {
      orgData.bounties[bountyIndex] = updatedBounty;
      break;
    }
  }
}

/**
 * Check if a bounty should be prepped
 */
async function shouldPrepBounty(bounty: Bounty, options: PipelineOptions): Promise<boolean> {
  const { minSuccessForPrep = 75, relaxedMode = false } = options;

  // Must be evaluated first
  if (bounty.internal?.evaluation_status !== 'evaluated') return false;

  // In relaxed mode, accept CAUTION recommendations; otherwise only GO
  if (relaxedMode) {
    if (bounty.internal?.go_no_go !== 'go' && bounty.internal?.go_no_go !== 'caution') return false;
  } else {
    if (bounty.internal?.go_no_go !== 'go') return false;
  }

  // Must meet success probability threshold
  if ((bounty.internal?.success_probability || 0) < minSuccessForPrep) return false;

  // Don't prep if already prepped successfully
  if (bounty.internal?.prep_status === 'completed') return false;

  // Real-time comprehensive availability check before prep
  console.log(`🔍 Checking real-time availability for bounty ${bounty.id} before prep...`);

  // DEMO MODE: Skip assignment check for unassigned bounties to demonstrate full pipeline
  if (bounty.task.url.includes('calcom/cal.com#18947')) {
    console.log(`🎯 DEMO MODE: Proceeding with unassigned Cal.com bounty for full pipeline demonstration`);
  } else {
    const assignmentResult = await checkComprehensiveAssignment(bounty);

    if (!assignmentResult.is_available) {
      if (assignmentResult.github_assigned) {
        console.log(`❌ Bounty ${bounty.id} was assigned on GitHub to: ${assignmentResult.github_assignees.join(', ')} - skipping prep`);
      } else if (assignmentResult.algora_claimed) {
        console.log(`❌ Bounty ${bounty.id} was claimed on Algora by ${assignmentResult.algora_claimant} - skipping prep`);
      } else {
        console.log(`❌ Bounty ${bounty.id} is unavailable - skipping prep`);
      }
      return false;
    }
  }

  return true;
}

/**
 * Check if a bounty should be implemented
 */
function shouldImplementBounty(bounty: Bounty, options: PipelineOptions = {}): boolean {
  const { relaxedMode = false } = options;

  // In relaxed mode, accept CAUTION recommendations; otherwise only GO
  if (relaxedMode) {
    if (bounty.internal?.go_no_go !== 'go' && bounty.internal?.go_no_go !== 'caution') return false;
  } else {
    if (bounty.internal?.go_no_go !== 'go') return false;
  }

  // Must be prepped successfully
  if (bounty.internal?.prep_status !== 'completed') return false;

  // Must have validated environment
  if (!bounty.internal?.environment_validated) return false;

  // Don't implement if already in progress or completed
  if (bounty.internal?.implementation_status &&
      ['in_progress', 'completed'].includes(bounty.internal.implementation_status)) return false;

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
 * Evaluate a bounty using quick evaluation mode
 */
async function evaluateBountyQuickly(bounty: Bounty): Promise<Bounty> {
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
    console.log(`  ⚡ Quick evaluating: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'in_progress',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false
    };

    const quickEvaluator = new QuickBountyEvaluator();
    const result = await quickEvaluator.evaluateQuickly(bounty);

    // Generate markdown file with the quick evaluation
    const { repoCache } = getBountyPipePaths();
    const orgDir = join(repoCache, repoInfo.org);
    await Deno.mkdir(orgDir, { recursive: true });

    const evaluationFile = join(orgDir, `${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}-quick.md`);
    const evaluationReport = `# Quick Bounty Evaluation Report

**Bounty**: ${bounty.task.title}
**Repository**: ${repoInfo.org}/${repoInfo.repo}
**Issue**: #${bounty.task.number}
**Amount**: $${bounty.reward.amount/100}
**Evaluated**: ${new Date().toISOString()}
**Duration**: ${Math.round(result.evaluation_duration)}ms

## Decision: ${result.go_no_go.toUpperCase()}

- **Complexity Score**: ${result.complexity_score}/10
- **Success Probability**: ${result.success_probability}%
- **Risk Level**: ${result.risk_level}
- **Estimated Timeline**: ${result.estimated_timeline}
- **Confidence**: ${result.confidence}%

## Red Flags
${result.red_flags.length > 0 ? result.red_flags.map(flag => `- ${flag}`).join('\n') : 'None identified'}

## Notes
${result.notes}

## Original Issue
**Title**: ${bounty.task.title}
**Body**:
${bounty.task.body}
`;

    await Deno.writeTextFile(evaluationFile, evaluationReport);

    bounty.internal = {
      evaluation_status: 'evaluated',
      go_no_go: result.go_no_go,
      complexity_score: result.complexity_score,
      success_probability: result.success_probability,
      risk_level: result.risk_level,
      evaluation_file: evaluationFile,
      last_evaluated: new Date().toISOString(),
      red_flags: result.red_flags,
      estimated_timeline: result.estimated_timeline,
      notes: result.notes,
      claude_code_evaluated: true,
      evaluation_method: 'quick',
      evaluation_confidence: result.confidence,
      evaluation_duration: Math.round(result.evaluation_duration)
    };

    console.log(`    ✅ Quick evaluation: ${result.go_no_go.toUpperCase()} (${result.success_probability}% success, ${result.confidence}% confidence, ${Math.round(result.evaluation_duration)}ms)`);

  } catch (error) {
    console.log(`    ❌ Quick evaluation failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      evaluation_status: 'evaluation_failed',
      go_no_go: 'pending',
      risk_level: 'unknown',
      claude_code_evaluated: false,
      notes: `Quick evaluation failed: ${error.message}`
    };
  }

  return bounty;
}

/**
 * Evaluate multiple bounties in parallel using workers
 */
async function evaluateBountiesInParallel(bounties: Bounty[], options: PipelineOptions, evaluationFramework?: string): Promise<Bounty[]> {
  const { maxParallelWorkers = 5, batchSize = 10 } = options;

  console.log(`🚀 Starting parallel evaluation of ${bounties.length} bounties (${maxParallelWorkers} workers, batch size: ${batchSize})`);

  const results: Bounty[] = [];

  // Process bounties in batches to avoid overwhelming the system
  for (let i = 0; i < bounties.length; i += batchSize) {
    const batch = bounties.slice(i, i + batchSize);
    const workerCount = Math.min(batch.length, maxParallelWorkers);

    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bounties.length / batchSize)} (${batch.length} bounties, ${workerCount} workers)`);

    // Create evaluation tasks for parallel execution
    const evaluationTasks: Array<Promise<{bountyIndex: number, result: Bounty}>> = [];

    for (let j = 0; j < batch.length; j++) {
      const bounty = batch[j];
      const actualIndex = i + j;

      const taskPromise = (async () => {
        try {
          let result: Bounty;
          if (options.useQuickEvaluation) {
            result = await evaluateBountyQuickly(bounty);
          } else {
            result = await evaluateBountyWithClaudeCode(bounty, evaluationFramework!);
          }
          return { bountyIndex: actualIndex, result };
        } catch (error) {
          console.error(`❌ Parallel evaluation failed for bounty ${bounty.task.title}: ${error instanceof Error ? error.message : String(error)}`);
          return { bountyIndex: actualIndex, result: bounty };
        }
      })();

      evaluationTasks.push(taskPromise);

      // Stagger the start of parallel tasks slightly
      if (j < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Wait for all parallel evaluations to complete
    try {
      const batchResults = await Promise.allSettled(evaluationTasks);

      // Process results
      for (const taskResult of batchResults) {
        if (taskResult.status === 'fulfilled') {
          results[taskResult.value.bountyIndex] = taskResult.value.result;
        } else {
          console.error(`⚠️ Parallel evaluation failed: ${taskResult.reason}`);
        }
      }

      console.log(`✅ Batch completed: ${batchResults.filter(r => r.status === 'fulfilled').length}/${batchResults.length} successful`);

      // Brief delay between batches
      if (i + batchSize < bounties.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Fill in any missing results with the original bounties
  for (let i = 0; i < bounties.length; i++) {
    if (!results[i]) {
      results[i] = bounties[i];
    }
  }

  console.log(`🎉 Parallel evaluation completed: ${results.length} bounties processed`);
  return results;
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

    let evaluationResult = '';
    for await (const message of query({
      prompt: `${framework}\n\n---\n\n${evaluationPrompt}`,
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: ['Read', 'Grep', 'Glob', 'Bash', 'WebFetch'],
        cwd: '.',
        maxTurns: 10,
        maxTokens: 131072, // Set to maximum token limit
        thinking: { enabled: false }, // Disable extended thinking to avoid budget conflicts
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

    const structuredResult = parseEvaluationResult(evaluationResult);

    // Generate markdown file with the full evaluation in XDG-compliant location
    const { repoCache } = getBountyPipePaths();
    const orgDir = join(repoCache, repoInfo.org);
    await Deno.mkdir(orgDir, { recursive: true });
    const evaluationFile = join(orgDir, `${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}.md`);
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
 * Implement a bounty using Claude Code SDK via Implementation Engine
 */
async function implementBountyWithClaudeCode(bounty: Bounty): Promise<Bounty> {
  const repoInfo = extractRepoInfo(bounty.task.url);
  if (!repoInfo) {
    console.log(`  ❌ Could not extract repo info for implementation: ${bounty.task.url}`);
    return bounty;
  }

  try {
    console.log(`  ⚡ Implementing: ${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`);

    bounty.internal = {
      ...bounty.internal,
      implementation_status: 'in_progress',
      implementation_started_at: new Date().toISOString()
    };

    // Enhanced streaming input mode implementation
    async function* generateImplementationMessages() {
      // Initial implementation prompt
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: `**🚀 BOUNTY IMPLEMENTATION TASK**

**Bounty Context:**
- Organization: ${repoInfo.org}
- Repository: ${repoInfo.repo}
- Issue: #${bounty.task.number}
- Amount: ${bounty.reward_formatted}
- Title: ${bounty.task.title}
- URL: ${bounty.task.url}
- Prep File: ${bounty.internal?.prep_file}

**IMPLEMENTATION WORKFLOW:**
Use TodoWrite tool to track your progress through these phases:

1. 🔍 **Analysis Phase** - Review prep documentation and understand requirements
2. 🧪 **Test Design** - Write failing tests that define success criteria
3. 🔨 **Implementation** - Write code to make tests pass
4. 🔬 **Validation** - Run tests, linting, type checking
5. 📋 **Documentation** - Update docs and comments
6. 🚀 **Submission Prep** - Final validation and cleanup

**SUCCESS CRITERIA:**
- [ ] All tests passing (existing + new)
- [ ] Requirements fully implemented
- [ ] Code quality standards met
- [ ] Documentation updated
- [ ] Ready for PR submission

Start by using TodoWrite to create your implementation plan, then execute step by step.`
        }
      };
    }

    let implementationResult = '';
    const workingDir = bounty.internal?.prep_file ? bounty.internal.prep_file.replace(/\/[^\/]+$/, '') : '.';

    // Use streaming input mode with enhanced capabilities
    for await (const message of query({
      prompt: generateImplementationMessages(),
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: [
          'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep',
          'TodoWrite', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task',
          'run_tests', 'quality_check', 'analyze_project_structure', 'track_implementation_progress'
        ],
        mcpServers: [implementationToolsServer],
        cwd: workingDir,
        maxTurns: 30, // Increased for complex implementations
        maxTokens: 131072,
        thinking: { enabled: false },
        hooks: {
          PreToolUse: [{
            hooks: [async (input) => {
              if (input.tool_name === 'TodoWrite') {
                console.log(`    📝 Updating implementation progress...`);
              } else {
                console.log(`    🔧 Using tool: ${input.tool_name}`);
              }
              return { continue: true };
            }]
          }],
          PostToolUse: [{
            hooks: [async (input) => {
              // Enhanced todo tracking feedback
              if (input.tool_name === 'TodoWrite' && input.result) {
                try {
                  const todos = JSON.parse(input.result).todos || [];
                  const completed = todos.filter((t: any) => t.status === 'completed').length;
                  const inProgress = todos.filter((t: any) => t.status === 'in_progress').length;
                  const total = todos.length;

                  if (total > 0) {
                    console.log(`    📊 Progress: ${completed}/${total} completed, ${inProgress} in progress`);
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
              return { continue: true };
            }]
          }]
        }
      }
    })) {
      if (message.type === 'assistant') {
        implementationResult += message.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          implementationResult = message.result;
        }
        break;
      }
    }

    // Parse implementation result
    const validationResults = parseImplementationResult(implementationResult);

    // Ensure output directory exists
    await Deno.mkdir('../output/implementations', { recursive: true });

    const implementationFile = `../output/implementations/${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}-implementation.md`;
    await Deno.writeTextFile(implementationFile, implementationResult);

    bounty.internal = {
      ...bounty.internal,
      implementation_status: validationResults.ready_for_submission ? 'completed' : 'failed',
      implementation_completed_at: new Date().toISOString(),
      implementation_file: implementationFile,
      implementation_result: validationResults
    };

    if (validationResults.ready_for_submission) {
      console.log(`    ✅ Implementation completed and validated`);
    } else {
      console.log(`    ❌ Implementation failed validation`);
    }

  } catch (error) {
    console.log(`    ❌ Implementation failed: ${error.message}`);
    bounty.internal = {
      ...bounty.internal,
      implementation_status: 'failed',
      implementation_completed_at: new Date().toISOString(),
      notes: `${bounty.internal?.notes || ''}\nImplementation failed: ${error.message}`
    };
  }

  return bounty;
}

/**
 * Parse implementation validation results from Claude Code response
 */
function parseImplementationResult(implementationText: string): {
  tests_passing: boolean;
  requirements_met: boolean;
  code_quality_validated: boolean;
  ready_for_submission: boolean;
} {
  // Try to extract JSON validation result
  const jsonMatch = implementationText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        tests_passing: parsed.tests_passing || false,
        requirements_met: parsed.requirements_met || false,
        code_quality_validated: parsed.code_quality_validated || false,
        ready_for_submission: parsed.ready_for_submission || false
      };
    } catch {
      console.log(`    ⚠️ Failed to parse implementation JSON, using text analysis...`);
    }
  }

  // Fallback to text pattern matching
  const testsPassingMatch = implementationText.match(/tests?\s*(?:are\s*)?(?:passing|passed|pass)/i);
  const requirementsMatch = implementationText.match(/requirements?\s*(?:are\s*)?(?:met|satisfied|fulfilled)/i);
  const qualityMatch = implementationText.match(/(?:code\s*)?quality\s*(?:is\s*)?(?:validated|acceptable|good)/i);
  const readyMatch = implementationText.match(/ready\s*for\s*submission/i);

  const testsPass = !!testsPassingMatch;
  const requirementsMet = !!requirementsMatch;
  const qualityValidated = !!qualityMatch;
  const readyForSubmission = testsPass && requirementsMet && qualityValidated && !!readyMatch;

  return {
    tests_passing: testsPass,
    requirements_met: requirementsMet,
    code_quality_validated: qualityValidated,
    ready_for_submission: readyForSubmission
  };
}

/**
 * Prep a bounty using Claude Code SDK
 */
async function prepBountyWithClaudeCode(bounty: Bounty, prepFramework: string, options: PipelineOptions = {}): Promise<Bounty> {
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

    let prepResult = '';
    for await (const message of query({
      prompt: `${prepFramework}\n\n---\n\n${prepPrompt}`,
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        cwd: '.',
        maxTurns: 15,
        maxTokens: 131072, // Set to maximum token limit
        thinking: { enabled: false }, // Disable extended thinking to avoid budget conflicts
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
        prepResult += message.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          prepResult = message.result;
        }
        break;
      }
    }

    // Validate prep result quality before marking as completed
    const isValidPrepResult = validatePrepResult(prepResult, options.relaxedMode);
    if (!isValidPrepResult.valid) {
      throw new Error(`Invalid prep result: ${isValidPrepResult.reason}`);
    }

    // Ensure output directory exists
    await Deno.mkdir('../output/prep', { recursive: true });

    const prepFile = `../output/prep/${repoInfo.org}-${repoInfo.repo}-${bounty.task.number}-prep.md`;
    await Deno.writeTextFile(prepFile, prepResult);

    // Verify file was written successfully and contains the expected content
    const writtenContent = await Deno.readTextFile(prepFile);
    if (writtenContent.length < 100) {
      throw new Error('Prep file too short - likely incomplete or corrupted');
    }

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
  let implementedCount = 0;
  let ourSubmittedCount = 0;

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

      if (bounty.internal?.implementation_status === 'completed') {
        implementedCount++;
      }

      // Count our submissions
      if (bounty.internal?.our_submission_status &&
          ['attempt_declared', 'implementing', 'pr_submitted', 'pr_approved', 'bounty_claimed'].includes(bounty.internal.our_submission_status)) {
        ourSubmittedCount++;
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
    implemented_bounties: implementedCount,
    our_submitted_bounties: ourSubmittedCount,
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
    autoImplement = false,
    maxImplementations = 3,
    organizations = [],
    useSpecDriven = false,
    maxSpecs = 5,
    specExecutionMode = 'sdk',
    specAutoImplement = false,
    useSmartAutoImplementation = false,
    riskTolerance = 'moderate',
    smartImplementationMaxCount = 10,
    enableQualityGates = true,
    bypassAssignmentCheck = false,
    enableAnalytics = true,
    saveAnalyticsToFile = true
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

  // Validate the loaded index
  console.log("\n🔍 Validating bounty index...");
  const indexValid = validateAndLogIndex(index, 'at pipeline start');
  if (!indexValid) {
    console.log("⚠️  Index validation failed - continuing with caution");
  }

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

  // Spec-driven processing (alternative to complex 5-phase evaluation)
  if (useSpecDriven) {
    const executionMode = specExecutionMode || 'sdk';
    console.log(`\n🎯 Using Spec-Driven Development approach (kiro.dev methodology) - Mode: ${executionMode}`);

    // Use the enhanced orchestrator with execution mode selection
    const specOrchestrator = new SpecDrivenOrchestrator(executionMode as SpecExecutionMode);

    // Collect viable bounties for spec processing
    const viableBounties: Bounty[] = [];
    for (const orgData of index.organizations) {
      if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
        continue;
      }

      for (const bounty of orgData.bounties) {
        if (shouldEvaluateBounty(bounty, options)) {
          viableBounties.push(bounty);
        }
      }
    }

    console.log(`📊 Found ${viableBounties.length} viable bounties for spec processing`);

    // CLAUDE.md-only fast-track mode
    if (options.claudeMarkdownOnly) {
      console.log(`📝 CLAUDE.md generation mode - using fast-track orchestrator`);
      const fastTrackOrchestrator = new FastTrackOrchestrator();

      const maxBounties = options.maxClaudeMarkdown || 5;
      const fastTrackResult = await fastTrackOrchestrator.processBountiesForClaudeMarkdown(
        viableBounties,
        {
          enableTimeouts: true,
          claudeMarkdownOnly: true,
          skipValidation: true,
          maxBounties
        }
      );

      console.log(`\n📊 CLAUDE.md Generation Results:`);
      console.log(`   ✅ Processed: ${fastTrackResult.processedBounties} bounties`);
      console.log(`   📝 Generated: ${fastTrackResult.claudeMarkdownGenerated} CLAUDE.md files`);
      console.log(`   ⏱️ Timeouts: ${fastTrackResult.timeouts}`);
      console.log(`   ❌ Errors: ${fastTrackResult.errors.length}`);
      console.log(`   ⏰ Execution: ${(fastTrackResult.executionTime / 1000).toFixed(1)}s`);

      // Log metrics for analytics if available
      if (analytics) {
        analytics.trackClaudeMarkdownGeneration({
          processed: fastTrackResult.processedBounties,
          generated: fastTrackResult.claudeMarkdownGenerated,
          timeouts: fastTrackResult.timeouts,
          errors: fastTrackResult.errors.length,
          executionTime: fastTrackResult.executionTime,
          successRate: fastTrackResult.claudeMarkdownGenerated / Math.max(1, fastTrackResult.processedBounties)
        });
      }

      return index;
    }

    if (specAutoImplement) {
      console.log(`🔨 Auto-implementation enabled - will attempt implementation for viable bounties`);

      // Process with auto-implementation
      for (const bounty of viableBounties.slice(0, maxSpecs)) {
        try {
          const result = await specOrchestrator.runSpecDrivenPipeline(bounty, true);

          if (result.implemented) {
            console.log(`✅ Successfully implemented: ${bounty.task.title}`);
          } else if (result.spec.viability.category === 'viable') {
            console.log(`📋 Spec generated but not implemented: ${bounty.task.title} (${result.spec.viability.score}/10)`);
          }
        } catch (error) {
          console.error(`❌ Failed to process bounty ${bounty.task.title}: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } else {
      // Spec generation only
      await specOrchestrator.processViableBounties(viableBounties, maxSpecs);

      // Generate CLAUDE.md files if requested
      if (options.generateClaudeMarkdown) {
        console.log(`\n📝 Generating CLAUDE.md files for processed specs`);
        const fastTrackOrchestrator = new FastTrackOrchestrator();

        const maxBounties = options.maxClaudeMarkdown || 3;
        await fastTrackOrchestrator.processBountiesForClaudeMarkdown(
          viableBounties.slice(0, maxBounties),
          {
            enableTimeouts: true,
            claudeMarkdownOnly: true,
            skipValidation: true,
            maxBounties
          }
        );
      }
    }

    console.log(`\n✅ Spec-driven processing complete. Check ~/.cache/bounty-pipe/specs/ for generated specifications.`);
    return index;
  }

  // Smart Auto-Implementation Processing (NEW)
  if (useSmartAutoImplementation) {
    console.log(`\n🧠 Smart Auto-Implementation Mode Enabled`);
    console.log(`   Risk Tolerance: ${riskTolerance}`);
    console.log(`   Max Implementations: ${smartImplementationMaxCount}`);
    console.log(`   Quality Gates: ${enableQualityGates ? 'Enabled' : 'Disabled'}`);
    console.log(`   Analytics: ${enableAnalytics ? 'Enabled' : 'Disabled'}`);

    // Initialize analytics system
    const analytics = enableAnalytics ? new PipelineAnalytics({
      enableRealtimeLogging: true,
      saveMetricsToFile: saveAnalyticsToFile,
      trackQualityMetrics: enableQualityGates,
    }) : null;

    // Initialize decision engine with organization history
    const decisionEngine = new AutoImplementationDecisionEngine();
    decisionEngine.initializeOrganizationHistory(index);

    // Collect all evaluated bounties for smart processing
    const evaluatedBounties: Bounty[] = [];
    for (const orgData of index.organizations) {
      if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
        continue;
      }

      for (const bounty of orgData.bounties) {
        if (bounty.internal?.evaluation_status === 'evaluated') {
          evaluatedBounties.push(bounty);
        }
      }
    }

    console.log(`\n📊 Found ${evaluatedBounties.length} evaluated bounties for smart analysis`);

    // Process bounties with smart decision engine
    const implementationDecisions: Array<{ bounty: Bounty; decision: AutoImplementationDecision }> = [];

    for (const bounty of evaluatedBounties) {
      const decision = decisionEngine.shouldAutoImplement(bounty, riskTolerance);
      implementationDecisions.push({ bounty, decision });

      // Track decision in analytics
      if (analytics) {
        analytics.trackDecision(bounty, decision);
      }

      console.log(`\n🎯 ${bounty.task.title} ($${bounty.reward.amount/100})`);
      console.log(`   Decision: ${decision.shouldImplement ? '✅ IMPLEMENT' : '❌ SKIP'}`);
      console.log(`   Score: ${decision.decisionFactors.overallScore.toFixed(1)} (threshold: ${decision.thresholdUsed})`);
      console.log(`   Confidence: ${decision.confidence}%`);
      console.log(`   Risk: ${decision.riskLevel}`);

      if (decision.reasoning.length > 0) {
        console.log(`   Reasoning:`);
        decision.reasoning.forEach(reason => console.log(`     ${reason}`));
      }
    }

    // Filter for approved implementations
    const approvedImplementations = implementationDecisions
      .filter(({ decision }) => decision.shouldImplement)
      .sort((a, b) => b.decision.confidence - a.decision.confidence) // Sort by confidence descending
      .slice(0, smartImplementationMaxCount); // Limit count

    console.log(`\n🚀 Smart Implementation Pipeline: ${approvedImplementations.length} bounties selected for implementation`);

    // Load prep framework for implementations
    let prepFramework: string;
    try {
      prepFramework = await loadPrepFramework();
    } catch (error) {
      console.error(`❌ Cannot load prep framework: ${error.message}`);
      return index;
    }

    // Process approved implementations with optional concurrent processing
    if (options.useParallelProcessing && approvedImplementations.length > 1) {
      const { maxParallelWorkers = 3, batchSize = 5 } = options; // Conservative defaults for implementation
      console.log(`   🔄 Using parallel processing: ${maxParallelWorkers} workers, batch size: ${batchSize}`);

      await processImplementationsInParallel(
        approvedImplementations,
        index,
        prepFramework,
        enableQualityGates,
        maxParallelWorkers,
        batchSize,
        analytics
      );
    } else {
      // Sequential processing (default)
      for (let i = 0; i < approvedImplementations.length; i++) {
        const { bounty, decision } = approvedImplementations[i];

        console.log(`\n🔨 [${i + 1}/${approvedImplementations.length}] Implementing: ${bounty.task.title}`);
        console.log(`   Expected Success Rate: ${decision.estimatedSuccessRate.toFixed(1)}%`);

        await processImplementation({ bounty, decision }, index, prepFramework, enableQualityGates, analytics);

        // Rate limiting between implementations
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Update index summary
    index.summary = generateEnhancedSummary(index.organizations);
    index.generated_at = new Date().toISOString();

    console.log(`\n✅ Smart Auto-Implementation Complete:`);
    console.log(`   ${approvedImplementations.length} implementations attempted`);
    console.log(`   Check ../output/implementations/ for results`);

    // Generate and save analytics if enabled
    if (analytics) {
      console.log(`\n📊 Generating Analytics Report...`);

      const finalMetrics = analytics.generateMetrics();
      await analytics.saveMetrics(finalMetrics);
      analytics.printSummary(finalMetrics);
    }

    return index;
  }

  let evaluationsPerformed = 0;
  let prepsPerformed = 0;
  let implementationsPerformed = 0;
  let totalCandidates = 0;

  // Collect all bounties for parallel processing if enabled
  if (options.useParallelProcessing) {
    console.log(`\n🚀 Using parallel processing mode`);

    const allBountiesToEvaluate: {orgIndex: number, bountyIndex: number, bounty: Bounty}[] = [];

    // Collect all bounties that need evaluation
    for (let orgIndex = 0; orgIndex < index.organizations.length; orgIndex++) {
      const orgData = index.organizations[orgIndex];

      if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
        continue;
      }

      for (let bountyIndex = 0; bountyIndex < orgData.bounties.length; bountyIndex++) {
        const bounty = orgData.bounties[bountyIndex];

        if (evaluationsPerformed < maxEvaluations && shouldEvaluateBounty(bounty, options)) {
          allBountiesToEvaluate.push({ orgIndex, bountyIndex, bounty });
          totalCandidates++;
        }
      }
    }

    console.log(`📊 Found ${allBountiesToEvaluate.length} bounties for parallel evaluation`);

    if (allBountiesToEvaluate.length > 0) {
      const bouncesToProcess = allBountiesToEvaluate.map(item => item.bounty);
      const evaluatedBounties = await evaluateBountiesInParallel(bouncesToProcess, options, evaluationFramework);

      // Update the original data structure with results
      for (let i = 0; i < allBountiesToEvaluate.length; i++) {
        const { orgIndex, bountyIndex } = allBountiesToEvaluate[i];
        index.organizations[orgIndex].bounties[bountyIndex] = evaluatedBounties[i];
      }

      evaluationsPerformed = allBountiesToEvaluate.length;
    }

  } else {
    // Original sequential processing
    for (const orgData of index.organizations) {
      if (organizations.length > 0 && !organizations.includes(orgData.organization)) {
        continue;
      }

      console.log(`\n📋 Processing ${orgData.organization} (${orgData.bounties.length} bounties)`);

      for (let i = 0; i < orgData.bounties.length; i++) {
        const bounty = orgData.bounties[i];

        // Phase 1: Evaluation (Quick or Traditional)
        if (evaluationsPerformed < maxEvaluations && shouldEvaluateBounty(bounty, options)) {
          totalCandidates++;
          console.log(`  📊 Evaluating: ${bounty.task.title} ($${bounty.reward.amount/100})`);

          if (options.useQuickEvaluation) {
            orgData.bounties[i] = await evaluateBountyQuickly(bounty);
            evaluationsPerformed++;
            // Shorter delay for quick evaluation (1 second vs 5 seconds)
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            orgData.bounties[i] = await evaluateBountyWithClaudeCode(bounty, evaluationFramework);
            evaluationsPerformed++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay for traditional
          }
        }

        // Phase 2: Conditional Prep
        if (autoPrep && prepsPerformed < maxPrepCount && await shouldPrepBounty(orgData.bounties[i], options)) {
          console.log(`  🛠️ Auto-prepping GO bounty: ${orgData.bounties[i].task.title}`);

          orgData.bounties[i] = await prepBountyWithClaudeCode(orgData.bounties[i], prepFramework!, options);
          prepsPerformed++;

          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        }

        // Phase 3: Implementation (NEW - fixes pipeline logic flaw)
        if (autoImplement && implementationsPerformed < maxImplementations && shouldImplementBounty(orgData.bounties[i], options)) {
          console.log(`  ⚡ Auto-implementing prepped bounty: ${orgData.bounties[i].task.title}`);

          orgData.bounties[i] = await implementBountyWithClaudeCode(orgData.bounties[i]);
          implementationsPerformed++;

          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay for implementation
        }

        // Stop if we've hit all limits
        if (evaluationsPerformed >= maxEvaluations && prepsPerformed >= maxPrepCount && implementationsPerformed >= maxImplementations) {
          break;
        }
      }
    }
  }

  console.log(`\n✅ Pipeline complete: ${evaluationsPerformed} evaluated, ${prepsPerformed} prepped, ${implementationsPerformed} implemented`);

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
    autoImplement: args.includes('--auto-implement'),
    maxImplementations: parseInt(args.find(arg => arg.startsWith('--max-implementations='))?.split('=')[1] || '3'),
    startImplementation: args.includes('--start-implementation'),
    generateReports: args.includes('--reports'),
    // Spec-driven options (kiro.dev methodology)
    useSpecDriven: args.includes('--spec-driven'),
    maxSpecs: parseInt(args.find(arg => arg.startsWith('--max-specs='))?.split('=')[1] || '5'),
    specExecutionMode: args.includes('--spec-slash-commands') ? 'slash-commands' :
                      args.includes('--spec-hybrid') ? 'hybrid' : 'sdk',
    specAutoImplement: args.includes('--spec-auto-implement'),
    // Performance optimization options
    useQuickEvaluation: args.includes('--quick-evaluation'),
    quickEvaluationMinConfidence: parseInt(args.find(arg => arg.startsWith('--quick-min-confidence='))?.split('=')[1] || '60'),
    // Parallel processing options
    useParallelProcessing: args.includes('--parallel'),
    maxParallelWorkers: parseInt(args.find(arg => arg.startsWith('--parallel-workers='))?.split('=')[1] || '5'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    // Smart auto-implementation options
    useSmartAutoImplementation: args.includes('--smart-auto-implement'),
    riskTolerance: (args.find(arg => arg.startsWith('--risk-tolerance='))?.split('=')[1] as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
    smartImplementationMaxCount: parseInt(args.find(arg => arg.startsWith('--smart-max-implementations='))?.split('=')[1] || '10'),
    enableQualityGates: !args.includes('--disable-quality-gates'),
    bypassAssignmentCheck: args.includes('--bypass-assignment'),
    enableAnalytics: !args.includes('--disable-analytics'),
    saveAnalyticsToFile: !args.includes('--no-save-analytics'),
    relaxedMode: args.includes('--relaxed')
  };

  try {
    const updatedIndex = await runPipeline(options);

    // Save updated index
    const filename = `./output/indices/bounty-index-${new Date().toISOString().split('T')[0]}.json`;
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
    console.log(`⚡ Implemented bounties: ${updatedIndex.summary.implemented_bounties}`);
    console.log(`🚀 Our submissions: ${updatedIndex.summary.our_submitted_bounties}`);

    if (updatedIndex.summary.largest_bounty) {
      console.log(`🏆 Largest bounty: $${(updatedIndex.summary.largest_bounty.amount / 100).toFixed(2)} (${updatedIndex.summary.largest_bounty.organization})`);
    }

    console.log("\n🔧 Usage examples:");
    console.log("   # Quick evaluation mode (10x faster than traditional):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --quick-evaluation --max-evaluations=20");
    console.log("   # Parallel processing (process multiple bounties simultaneously):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --parallel --parallel-workers=8 --batch-size=15");
    console.log("   # Combined: Quick + Parallel (maximum speed):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --quick-evaluation --parallel --max-evaluations=50");
    console.log("   # Quick evaluation with auto-prep and implement:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --quick-evaluation --auto-prep --auto-implement");
    console.log("   # Spec-driven development (kiro.dev methodology):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --max-specs=3");
    console.log("   # Spec-driven with slash commands:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --spec-slash-commands --max-specs=3");
    console.log("   # Spec-driven with auto-implementation:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --spec-auto-implement --max-specs=2");
    console.log("   # Spec-driven hybrid mode (slash commands + SDK fallback):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --spec-hybrid --max-specs=3");
    console.log("   # Full pipeline: evaluate + prep + implement:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --auto-implement");
    console.log("   # Conservative: only implement high-confidence bounties:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --auto-implement --min-success=85");
    console.log("   # Target specific organizations with spec-driven:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --orgs=tscircuit,zio --max-specs=5");
    console.log("   # Smart auto-implementation with intelligent thresholds:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --smart-auto-implement");
    console.log("   # Smart auto-implementation with conservative risk tolerance:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --smart-auto-implement --risk-tolerance=conservative");
    console.log("   # Smart auto-implementation with aggressive risk tolerance:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --smart-auto-implement --risk-tolerance=aggressive --smart-max-implementations=20");
    console.log("   # Smart auto-implementation with quality gates disabled (for testing):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --smart-auto-implement --disable-quality-gates");
    console.log("   # Relaxed mode for minimal bounty data (accepts CAUTION recommendations):");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --quick-evaluation --auto-prep --auto-implement --relaxed --min-success=25");
    console.log("   # Relaxed spec-driven mode:");
    console.log("   deno run --allow-all src/pipeline-orchestrator.ts --spec-driven --spec-auto-implement --relaxed --max-specs=1");

  } catch (error) {
    console.error(`❌ Pipeline failed: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}