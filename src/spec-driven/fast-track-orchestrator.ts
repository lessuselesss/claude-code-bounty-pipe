#!/usr/bin/env -S deno run --allow-all

/**
 * Fast-Track Spec-Driven Orchestrator
 *
 * Optimized version focused on CLAUDE.md generation with minimal overhead
 */

import type { Bounty } from '../schemas/bounty-schema.ts';
import type { BountySpec } from './types.ts';
import { SpecAnalysisPhase } from './phases/spec-analysis-phase.ts';
import { EnvironmentSetupPhase } from './phases/environment-setup-phase.ts';
import { SpecParser } from './utils/spec-parser.ts';
import { TimeoutManager, type TimeoutConfig } from './utils/timeout-manager.ts';
import { getBountyPipePaths } from '../repository-cache.ts';

export interface FastTrackOptions {
  enableTimeouts: boolean;
  claudeMarkdownOnly: boolean;
  skipValidation: boolean;
  maxBounties: number;
}

export interface FastTrackResult {
  success: boolean;
  processedBounties: number;
  claudeMarkdownGenerated: number;
  timeouts: number;
  errors: string[];
  executionTime: number;
}

export class FastTrackOrchestrator {
  private specAnalysisPhase = new SpecAnalysisPhase();
  private environmentSetupPhase = new EnvironmentSetupPhase();

  /**
   * Fast-track processing focused on CLAUDE.md generation
   */
  async processBountiesForClaudeMarkdown(
    bounties: Bounty[],
    options: FastTrackOptions = {
      enableTimeouts: true,
      claudeMarkdownOnly: true,
      skipValidation: true,
      maxBounties: 3
    }
  ): Promise<FastTrackResult> {
    console.log(`🚀 Fast-Track CLAUDE.md Generation`);
    console.log(`📊 Processing ${Math.min(bounties.length, options.maxBounties)} bounties`);

    const startTime = Date.now();
    let processedBounties = 0;
    let claudeMarkdownGenerated = 0;
    let timeouts = 0;
    const errors: string[] = [];

    for (const bounty of bounties.slice(0, options.maxBounties)) {
      console.log(`\n🎯 [${processedBounties + 1}/${options.maxBounties}] ${bounty.task.title}`);

      try {
        // Phase 1: Quick spec analysis with timeout
        const specResult = await this.generateSpecWithTimeout(bounty, options.enableTimeouts);

        if (!specResult.success) {
          if (specResult.timedOut) timeouts++;
          errors.push(`Spec generation failed for ${bounty.task.title}: ${specResult.timedOut ? 'timeout' : 'error'}`);
          continue;
        }

        const spec = specResult.result!;

        // Skip non-viable specs
        if (spec.viability.category === 'skip') {
          console.log(`   ⏭️ Skipping non-viable bounty`);
          continue;
        }

        // Phase 2: Environment setup with CLAUDE.md generation
        const setupResult = await this.setupEnvironmentWithTimeout(
          spec,
          specResult.repositoryPath!,
          options.enableTimeouts
        );

        if (!setupResult.success) {
          if (setupResult.timedOut) timeouts++;
          errors.push(`Environment setup failed for ${bounty.task.title}: ${setupResult.timedOut ? 'timeout' : 'error'}`);
          continue;
        }

        if (setupResult.result?.claudeMarkdownGenerated) {
          claudeMarkdownGenerated++;
          console.log(`   ✅ CLAUDE.md generated successfully`);
        }

        processedBounties++;

      } catch (error) {
        errors.push(`Unexpected error processing ${bounty.task.title}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Brief pause between bounties
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const executionTime = Date.now() - startTime;

    console.log(`\n📊 Fast-Track Results:`);
    console.log(`   ✅ Processed: ${processedBounties}/${options.maxBounties} bounties`);
    console.log(`   📝 CLAUDE.md generated: ${claudeMarkdownGenerated}`);
    console.log(`   ⏱️ Timeouts: ${timeouts}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log(`   ⏰ Execution time: ${(executionTime / 1000).toFixed(1)}s`);

    return {
      success: processedBounties > 0,
      processedBounties,
      claudeMarkdownGenerated,
      timeouts,
      errors,
      executionTime
    };
  }

  /**
   * Generate spec with timeout management
   */
  private async generateSpecWithTimeout(bounty: Bounty, enableTimeouts: boolean): Promise<{
    success: boolean;
    result?: BountySpec;
    repositoryPath?: string;
    timedOut: boolean;
  }> {
    const operation = async () => {
      const result = await this.specAnalysisPhase.analyzeWithRepositoryContext(bounty);
      return {
        spec: result.spec,
        repositoryPath: result.repositoryContext.path
      };
    };

    if (enableTimeouts) {
      const config = TimeoutManager.getPhaseConfig('spec-analysis');
      const result = await TimeoutManager.executeWithTimeout(operation, config);

      return {
        success: result.success,
        result: result.result?.spec,
        repositoryPath: result.result?.repositoryPath,
        timedOut: result.timedOut
      };
    } else {
      try {
        const result = await operation();
        return {
          success: true,
          result: result.spec,
          repositoryPath: result.repositoryPath,
          timedOut: false
        };
      } catch (error) {
        console.error(`Spec generation error: ${error}`);
        return {
          success: false,
          timedOut: false
        };
      }
    }
  }

  /**
   * Setup environment with timeout management
   */
  private async setupEnvironmentWithTimeout(
    spec: BountySpec,
    repositoryPath: string,
    enableTimeouts: boolean
  ): Promise<{
    success: boolean;
    result?: any;
    timedOut: boolean;
  }> {
    const operation = async () => {
      return await this.environmentSetupPhase.setupEnvironment(spec, repositoryPath);
    };

    if (enableTimeouts) {
      const config = TimeoutManager.getPhaseConfig('environment-setup');
      const result = await TimeoutManager.executeWithTimeout(operation, config);

      return {
        success: result.success,
        result: result.result,
        timedOut: result.timedOut
      };
    } else {
      try {
        const result = await operation();
        return {
          success: result.success,
          result,
          timedOut: false
        };
      } catch (error) {
        console.error(`Environment setup error: ${error}`);
        return {
          success: false,
          timedOut: false
        };
      }
    }
  }

  /**
   * Quick bounty filtering for fast processing
   */
  static filterViableBounties(bounties: Bounty[], maxBounties = 5): Bounty[] {
    return bounties
      .filter(bounty => {
        // Basic viability checks (more lenient)
        const hasTitle = bounty.task?.title && bounty.task.title.length > 5;
        const hasRepo = bounty.task?.repo_name && bounty.task?.repo_owner;
        const hasAmount = bounty.reward?.amount && bounty.reward.amount > 0;

        return hasTitle && hasRepo && hasAmount;
      })
      .sort((a, b) => (b.reward?.amount || 0) - (a.reward?.amount || 0)) // Sort by amount descending
      .slice(0, maxBounties);
  }
}

// CLI usage if run directly
if (import.meta.main) {
  // This would need to import bounty data, but shows the usage pattern
  console.log(`🚀 Fast-Track CLAUDE.md Generation CLI`);
  console.log(`Usage: deno run --allow-all fast-track-orchestrator.ts`);
  console.log(`Note: This requires bounty data input from the main pipeline`);
}