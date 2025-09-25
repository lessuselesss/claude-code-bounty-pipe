#!/usr/bin/env -S deno run --allow-all

/**
 * Spec-Driven Command Executor
 *
 * Executes spec-driven slash commands programmatically, similar to
 * the slash-command-executor for standard pipeline commands
 */

import type { Bounty } from '../../schemas/bounty-schema.ts';
import type { BountySpec, SpecAnalysisResult, ImplementationResult, SubmissionResult } from '../types.ts';
import { getCachedRepository, extractRepoInfo } from '../../evaluation-framework.ts';

export interface SpecCommandOptions {
  timeout?: number;
  workingDir?: string;
  captureOutput?: boolean;
  useRepoCache?: boolean;
  org?: string;
  repo?: string;
  outputDir?: string;
  format?: 'json' | 'markdown';
  autoImplement?: boolean;
  workspaceDir?: string;
  coverageThreshold?: number;
}

export class SpecCommandExecutor {

  /**
   * Execute spec-driven slash command programmatically
   */
  async executeSpecCommand(
    command: string,
    args: string[],
    options: SpecCommandOptions = {}
  ): Promise<string> {
    const {
      timeout = 300000, // 5 minutes default
      workingDir,
      captureOutput = true,
      useRepoCache = true
    } = options;

    let actualWorkingDir = workingDir;

    // If we need repository cache, set it up
    if (useRepoCache && options.org && options.repo) {
      try {
        actualWorkingDir = await getCachedRepository(options.org, options.repo, {
          maxAgeHours: 168, // 1 week cache
          forEvaluation: true
        });
        console.log(`📁 Using cached repository: ${actualWorkingDir}`);
      } catch (error) {
        console.warn(`⚠️ Repository cache failed, using temp directory: ${error instanceof Error ? error.message : String(error)}`);
        actualWorkingDir = `/tmp/${options.org}-${options.repo}-spec-fallback`;
      }
    }

    console.log(`🎯 Executing spec-driven command: ${command} ${args.join(' ')}`);

    // Build the claude command with slash command as prompt argument
    const claudeArgs = [
      'code',
      '--print', // Non-interactive mode - print response and exit
      `${command} ${args.join(' ')}` // Slash command with args as prompt
    ];

    console.log(`📋 Full command: claude ${claudeArgs.join(' ')}`);
    console.log(`📂 Working directory: ${actualWorkingDir || Deno.cwd()}`);

    const process = new Deno.Command('claude', {
      args: claudeArgs,
      cwd: actualWorkingDir || Deno.cwd(), // Use repository directory if available
      stdout: captureOutput ? 'piped' : 'inherit',
      stderr: captureOutput ? 'piped' : 'inherit'
    });

    try {
      const { code, stdout, stderr } = await process.output();

      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`Spec command failed with code ${code}: ${errorText}`);
      }

      const result = new TextDecoder().decode(stdout);
      console.log(`✅ Spec command completed successfully`);

      // Debug: Log the actual output for troubleshooting
      console.log(`🔍 Command output (first 500 chars): ${result.slice(0, 500)}`);
      if (result.length > 500) {
        console.log(`   ... (${result.length - 500} more characters)`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Spec command execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Analyze bounty using spec-driven slash command
   */
  async analyzeBountyWithCommand(bounty: Bounty, options: SpecCommandOptions = {}): Promise<SpecAnalysisResult> {
    const repoInfo = extractRepoInfo(bounty.task.url);
    if (!repoInfo) {
      throw new Error(`Could not extract repository info from URL: ${bounty.task.url}`);
    }

    const args = [
      `${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`
    ];

    if (options.outputDir) {
      args.push(`--output-dir=${options.outputDir}`);
    }

    if (options.format) {
      args.push(`--format=${options.format}`);
    }

    const commandOptions: SpecCommandOptions = {
      ...options,
      org: repoInfo.org,
      repo: repoInfo.repo,
      useRepoCache: true
    };

    const result = await this.executeSpecCommand(
      '/spec-driven:analyze',
      args,
      commandOptions
    );

    // Parse the result to extract the specification
    const spec = this.parseSpecFromCommandOutput(result, bounty);

    return {
      spec,
      repositoryContext: {
        org: repoInfo.org,
        repo: repoInfo.repo,
        path: commandOptions.workingDir || `/tmp/${repoInfo.org}-${repoInfo.repo}`,
        analyzedFiles: [] // TODO: Extract from command output
      }
    };
  }

  /**
   * Implement bounty using spec-driven slash command
   */
  async implementBountyWithCommand(
    specId: string,
    options: SpecCommandOptions = {}
  ): Promise<ImplementationResult> {
    const args = [specId];

    if (options.workspaceDir) {
      args.push(`--workspace-dir=${options.workspaceDir}`);
    }

    const result = await this.executeSpecCommand(
      '/spec-driven:implement',
      args,
      options
    );

    return this.parseImplementationResult(result);
  }

  /**
   * Run complete spec-driven pipeline using slash command
   */
  async runSpecDrivenPipeline(
    bounty: Bounty,
    options: SpecCommandOptions = {}
  ): Promise<{ spec: BountySpec; implementation?: ImplementationResult }> {
    const repoInfo = extractRepoInfo(bounty.task.url);
    if (!repoInfo) {
      throw new Error(`Could not extract repository info from URL: ${bounty.task.url}`);
    }

    const args = [
      `${repoInfo.org}/${repoInfo.repo}#${bounty.task.number}`
    ];

    if (options.autoImplement) {
      args.push('--auto-implement');
    }

    if (options.workspaceDir) {
      args.push(`--workspace-dir=${options.workspaceDir}`);
    }

    const commandOptions: SpecCommandOptions = {
      ...options,
      org: repoInfo.org,
      repo: repoInfo.repo,
      useRepoCache: true,
      timeout: options.autoImplement ? 1800000 : 300000 // 30 min for implementation, 5 min for analysis only
    };

    const result = await this.executeSpecCommand(
      '/spec-driven:pipeline',
      args,
      commandOptions
    );

    return this.parsePipelineResult(result, bounty);
  }

  /**
   * Validate implementation using spec-driven slash command
   */
  async validateImplementation(
    specId: string,
    options: SpecCommandOptions = {}
  ): Promise<{ passed: boolean; report: any }> {
    const args = [specId];

    if (options.workspaceDir) {
      args.push(`--workspace-dir=${options.workspaceDir}`);
    }

    if (options.coverageThreshold) {
      args.push(`--coverage-threshold=${options.coverageThreshold}`);
    }

    const result = await this.executeSpecCommand(
      '/spec-driven:validate',
      args,
      options
    );

    return this.parseValidationResult(result);
  }

  /**
   * Parse specification from command output
   */
  private parseSpecFromCommandOutput(output: string, bounty: Bounty): BountySpec {
    try {
      // Try to extract JSON from command output
      const jsonMatch = output.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          bounty_id: bounty.id,
          title: bounty.task.title,
          amount: bounty.reward.amount / 100,
          ...parsed
        };
      }

      // Try to find JSON block in output
      const lines = output.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.includes('bounty_id')) {
          // Try to parse multi-line JSON
          let jsonStr = line;
          for (let j = i + 1; j < lines.length; j++) {
            jsonStr += '\n' + lines[j];
            try {
              const parsed = JSON.parse(jsonStr);
              return {
                bounty_id: bounty.id,
                title: bounty.task.title,
                amount: bounty.reward.amount / 100,
                ...parsed
              };
            } catch {
              // Continue building JSON string
            }
          }
        }
      }

      throw new Error('No valid JSON specification found in command output');

    } catch (error) {
      console.warn(`⚠️ Failed to parse spec from command output: ${error instanceof Error ? error.message : String(error)}`);
      return this.createFallbackSpec(bounty, 'Command output parsing failed');
    }
  }

  /**
   * Parse implementation result from command output
   */
  private parseImplementationResult(output: string): ImplementationResult {
    try {
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1]);
        return {
          success: result.implementation_status === 'completed',
          completedTasks: result.completed_tasks || [],
          failedTasks: result.failed_tasks || [],
          testsPassing: result.test_results?.failing_tests === 0,
          qualityValidated: result.quality_checks?.linting_passed === true,
          rollbackRequired: false
        };
      }

      // Fallback parsing from text output
      return {
        success: output.includes('implementation_status": "completed"') || output.includes('✅'),
        completedTasks: [],
        failedTasks: [],
        testsPassing: !output.includes('failing') && !output.includes('❌'),
        qualityValidated: output.includes('quality') && output.includes('passed'),
        rollbackRequired: output.includes('rollback') || output.includes('failed')
      };

    } catch (error) {
      console.warn(`⚠️ Failed to parse implementation result: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        completedTasks: [],
        failedTasks: ['parse-error'],
        testsPassing: false,
        qualityValidated: false,
        rollbackRequired: true
      };
    }
  }

  /**
   * Parse pipeline result from command output
   */
  private parsePipelineResult(
    output: string,
    bounty: Bounty
  ): { spec: BountySpec; implementation?: ImplementationResult } {
    const spec = this.parseSpecFromCommandOutput(output, bounty);

    let implementation: ImplementationResult | undefined;

    if (output.includes('implementation_results') || output.includes('auto-implement')) {
      implementation = this.parseImplementationResult(output);
    }

    return { spec, implementation };
  }

  /**
   * Parse validation result from command output
   */
  private parseValidationResult(output: string): { passed: boolean; report: any } {
    try {
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[1]);
        return {
          passed: report.validation_status === 'passed',
          report
        };
      }

      // Fallback validation
      const passed = output.includes('validation_status": "passed"') ||
                    (output.includes('✅') && !output.includes('❌'));

      return {
        passed,
        report: { validation_status: passed ? 'passed' : 'failed' }
      };

    } catch (error) {
      console.warn(`⚠️ Failed to parse validation result: ${error instanceof Error ? error.message : String(error)}`);
      return {
        passed: false,
        report: { validation_status: 'failed', error: 'Parse error' }
      };
    }
  }

  /**
   * Create fallback specification when parsing fails
   */
  private createFallbackSpec(bounty: Bounty, errorMessage: string): BountySpec {
    return {
      bounty_id: bounty.id,
      title: bounty.task.title,
      amount: bounty.reward.amount / 100,

      requirements: {
        primary: [`Implement: ${bounty.task.title}`],
        acceptance_criteria: ['Command parsing failed - manual analysis required'],
        constraints: ['Slash command execution issue'],
        assumptions: [`Error occurred: ${errorMessage}`]
      },

      system_design: {
        approach: 'Manual analysis required',
        architecture_changes: [],
        integration_points: [],
        data_flow: 'Unknown - command execution failed'
      },

      discrete_tasks: [{
        id: 'command-failure',
        description: 'Resolve command execution issue and rerun analysis',
        priority: 'high',
        estimated_effort: '15-30 minutes',
        dependencies: [],
        implementation_notes: 'Spec-driven slash command failed'
      }],

      implementation_reasoning: {
        technical_approach: 'Fix command execution then retry',
        risk_assessment: 'High - command infrastructure issue',
        success_indicators: ['Command executes successfully'],
        potential_blockers: ['Slash command configuration issue']
      },

      viability: {
        score: 2,
        category: 'skip',
        reasoning: 'Command execution failed - infrastructure issue',
        time_estimate: 'Unknown'
      }
    };
  }
}