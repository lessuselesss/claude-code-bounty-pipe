#!/usr/bin/env -S deno run --allow-all

/**
 * Spec-Driven Development Orchestrator
 *
 * Coordinates the complete spec-driven development pipeline using kiro.dev methodology
 */

import type { Bounty } from '../../schemas/bounty-schema.ts';
import type { BountySpec, SpecAnalysisResult } from './types.ts';
import { SpecAnalysisPhase } from './phases/spec-analysis-phase.ts';
import { TemplateDiscoveryPhase } from './phases/template-discovery-phase.ts';
import { EnvironmentSetupPhase, type EnvironmentSetupResult } from './phases/environment-setup-phase.ts';
import { TDDImplementationPhase, type TDDImplementationResult } from './phases/tdd-implementation-phase.ts';
import { ValidationPhase, type ValidationResult } from './phases/validation-phase.ts';
import { SpecParser } from './utils/spec-parser.ts';
import { SpecCommandExecutor, type SpecCommandOptions } from './utils/spec-command-executor.ts';
import { getBountyPipePaths } from '../repository-cache.ts';

export type SpecExecutionMode = 'sdk' | 'slash-commands' | 'hybrid';

export class SpecDrivenOrchestrator {
  private specAnalysisPhase = new SpecAnalysisPhase();
  private templateDiscoveryPhase = new TemplateDiscoveryPhase();
  private environmentSetupPhase = new EnvironmentSetupPhase();
  private tddImplementationPhase = new TDDImplementationPhase();
  private validationPhase = new ValidationPhase();
  private specCommandExecutor = new SpecCommandExecutor();
  private executionMode: SpecExecutionMode = 'sdk';

  constructor(executionMode: SpecExecutionMode = 'sdk') {
    this.executionMode = executionMode;
  }

  /**
   * Phase 1: Analyze bounty and generate specification with repository context
   */
  async analyzeAndGenerateSpec(bounty: Bounty, options?: SpecCommandOptions): Promise<SpecAnalysisResult> {
    console.log(`🎯 [Phase 1] Spec Analysis: ${bounty.task.title} (Mode: ${this.executionMode})`);

    let result: SpecAnalysisResult;

    try {
      switch (this.executionMode) {
        case 'sdk':
          result = await this.specAnalysisPhase.analyzeWithRepositoryContext(bounty);
          break;

        case 'slash-commands':
          console.warn(`⚠️ Slash commands temporarily disabled - falling back to SDK`);
          result = await this.specAnalysisPhase.analyzeWithRepositoryContext(bounty);
          break;

        case 'hybrid':
          // Try slash commands first, fallback to SDK
          try {
            console.log(`   🔄 Attempting slash command execution...`);
            result = await this.specCommandExecutor.analyzeBountyWithCommand(bounty, options);
            console.log(`   ✅ Slash command execution successful`);
          } catch (error) {
            console.warn(`   ⚠️ Slash command failed, falling back to SDK: ${error instanceof Error ? error.message : String(error)}`);
            result = await this.specAnalysisPhase.analyzeWithRepositoryContext(bounty);
            console.log(`   ✅ SDK execution successful`);
          }
          break;

        default:
          throw new Error(`Unknown execution mode: ${this.executionMode}`);
      }

      // Validate the generated spec
      const validation = SpecParser.validateSpec(result.spec);
      if (!validation.valid) {
        console.warn(`⚠️ Spec validation issues: ${validation.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Spec analysis failed in all attempted modes: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate implementation plan from spec
   */
  async generateImplementationPlan(spec: BountySpec): Promise<string> {
    console.log(`📋 Generating implementation plan for: ${spec.title}`);

    const plan = SpecParser.generateImplementationPlan(spec);
    const summary = SpecParser.generateTaskSummary(spec);

    console.log(`   📊 Plan Summary: ${summary.totalTasks} tasks (${summary.highPriorityTasks} high priority)`);
    console.log(`   ⏱️  Estimated effort: ${summary.estimatedEffort}`);
    console.log(`   🎯 Complexity score: ${summary.complexityScore}/10`);

    return plan;
  }

  /**
   * Sanitize bounty ID for safe filesystem usage
   */
  private sanitizeBountyId(bountyId: string): string {
    return bountyId
      .replace(/\//g, '-')         // Replace / with -
      .replace(/#/g, '-')          // Replace # with -
      .replace(/[<>:"|?*\\]/g, '_')  // Replace other unsafe chars
      .slice(0, 100);              // Limit length for filesystem
  }

  /**
   * Save specification and plan using XDG-compliant storage
   */
  async saveSpecAndPlan(spec: BountySpec, plan: string): Promise<void> {
    const paths = getBountyPipePaths();
    const specDir = `${paths.repoCache}/specs`;

    // Ensure spec directory exists (XDG-compliant)
    try {
      await Deno.mkdir(specDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    // Sanitize bounty ID for safe file names
    const sanitizedId = this.sanitizeBountyId(spec.bounty_id);

    // Save spec as JSON
    const specFile = `${specDir}/${sanitizedId}-spec.json`;
    await Deno.writeTextFile(specFile, JSON.stringify(spec, null, 2));

    // Save plan as Markdown
    const planFile = `${specDir}/${sanitizedId}-plan.md`;
    await Deno.writeTextFile(planFile, plan);

    console.log(`   💾 Saved spec: ${specFile}`);
    console.log(`   💾 Saved plan: ${planFile}`);

    // Also maintain backward compatibility with output/specs for now
    const legacyDir = 'output/specs';
    try {
      await Deno.mkdir(legacyDir, { recursive: true });
      const legacySpecFile = `${legacyDir}/${sanitizedId}-spec.json`;
      const legacyPlanFile = `${legacyDir}/${sanitizedId}-plan.md`;
      await Deno.writeTextFile(legacySpecFile, JSON.stringify(spec, null, 2));
      await Deno.writeTextFile(legacyPlanFile, plan);
    } catch (error) {
      // Legacy directory creation is optional
      console.warn(`⚠️ Could not create legacy output directory: ${error.message}`);
    }
  }

  /**
   * Process multiple bounties with spec-driven methodology
   */
  async processViableBounties(bounties: Bounty[], maxSpecs = 5, options?: SpecCommandOptions): Promise<void> {
    console.log(`\n🎯 Spec-Driven Bounty Processing (Mode: ${this.executionMode})`);
    console.log(`📊 Processing ${Math.min(bounties.length, maxSpecs)} bounties with spec-driven methodology`);

    let processedCount = 0;

    for (const bounty of bounties) {
      if (processedCount >= maxSpecs) {
        console.log(`🎯 Reached max specs limit (${maxSpecs})`);
        break;
      }

      console.log(`\n📝 [${processedCount + 1}/${maxSpecs}] Processing: ${bounty.task.title}`);

      try {
        // Phase 1: Analyze and generate spec
        const analysisResult = await this.analyzeAndGenerateSpec(bounty, options);

        // Skip non-viable bounties
        if (analysisResult.spec.viability.category === 'skip') {
          console.log(`⏭️  Skipping - ${analysisResult.spec.viability.reasoning}`);
          continue;
        }

        // Generate implementation plan
        const plan = await this.generateImplementationPlan(analysisResult.spec);

        // Save spec and plan
        await this.saveSpecAndPlan(analysisResult.spec, plan);

        processedCount++;

        console.log(`✅ Spec generated: ${analysisResult.spec.viability.category} (${analysisResult.spec.viability.score}/10)`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Failed to process bounty ${bounty.task.title}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with next bounty
      }
    }

    console.log(`\n📊 Spec Processing Summary:`);
    console.log(`   📝 Specs generated: ${processedCount}`);
    console.log(`   🎯 Ready for implementation: ${processedCount}`);
  }

  /**
   * Run complete spec-driven pipeline (analysis + optional implementation)
   */
  async runSpecDrivenPipeline(
    bounty: Bounty,
    autoImplement = false,
    options?: SpecCommandOptions
  ): Promise<{ spec: BountySpec; implemented: boolean }> {
    console.log(`\n🎯 Spec-Driven Pipeline: ${bounty.task.title} (Auto-implement: ${autoImplement})`);

    if (this.executionMode === 'slash-commands' || this.executionMode === 'hybrid') {
      try {
        // Use pipeline slash command for complete workflow
        const result = await this.specCommandExecutor.runSpecDrivenPipeline(bounty, {
          ...options,
          autoImplement
        });

        return {
          spec: result.spec,
          implemented: !!result.implementation?.success
        };

      } catch (error) {
        if (this.executionMode === 'hybrid') {
          console.warn(`⚠️ Pipeline slash command failed, falling back to SDK approach: ${error instanceof Error ? error.message : String(error)}`);
          // Fall through to SDK approach
        } else {
          throw error;
        }
      }
    }

    // SDK approach: Full 4-stage pipeline
    console.log(`🎯 Executing SDK-based spec-driven pipeline`);

    // Stage 1: Spec Analysis
    const analysisResult = await this.analyzeAndGenerateSpec(bounty, options);

    if (analysisResult.spec.viability.category === 'skip') {
      console.log(`⏭️  Skipping pipeline - ${analysisResult.spec.viability.reasoning}`);
      return { spec: analysisResult.spec, implemented: false };
    }

    // Generate and save plan
    const plan = await this.generateImplementationPlan(analysisResult.spec);
    await this.saveSpecAndPlan(analysisResult.spec, plan);

    let implemented = false;

    if (autoImplement && analysisResult.spec.viability.category === 'viable') {
      console.log(`🔨 Starting auto-implementation for viable bounty...`);

      try {
        // Phase 1.5: Template Discovery
        console.log(`\n🔍 Phase 1.5: Template Discovery`);
        const templateDiscoveryResult = await this.templateDiscoveryPhase.discoverTemplate(
          analysisResult.spec,
          analysisResult.repositoryContext.path
        );

        if (templateDiscoveryResult.recommendedTemplate) {
          console.log(`🎯 Discovered template: ${templateDiscoveryResult.recommendedTemplate.name}`);
          console.log(`   📊 Tech stack detected: ${templateDiscoveryResult.techStackAnalysis.primaryLanguage} (${templateDiscoveryResult.techStackAnalysis.confidence}% confidence)`);
        } else if (templateDiscoveryResult.warnings.length > 0) {
          console.log(`⚠️ Template discovery warnings:`);
          templateDiscoveryResult.warnings.forEach(warning => console.log(`   • ${warning}`));
        }

        // Stage 2: Environment Setup
        console.log(`\n🏗️  Stage 2: Environment Setup`);
        const setupResult = await this.environmentSetupPhase.setupEnvironment(
          analysisResult.spec,
          analysisResult.repositoryContext.path
        );

        if (!setupResult.success || !setupResult.developmentReady) {
          console.log(`❌ Environment setup failed - cannot proceed with implementation`);
          return { spec: analysisResult.spec, implemented: false };
        }

        console.log(`✅ Environment ready at: ${setupResult.workspacePath}`);
        console.log(`🌿 Branch created: ${setupResult.branchName}`);

        // Stage 3: TDD Implementation
        console.log(`\n🔨 Stage 3: TDD Implementation`);
        const implementationResult = await this.tddImplementationPhase.implementWithTDD(
          analysisResult.spec,
          setupResult.workspacePath,
          setupResult.branchName
        );

        if (!implementationResult.success) {
          console.log(`❌ Implementation failed - completed ${implementationResult.completedTasks.length}/${implementationResult.totalTasks} tasks`);
          return { spec: analysisResult.spec, implemented: false };
        }

        console.log(`✅ Implementation completed - all ${implementationResult.totalTasks} tasks finished`);

        // Stage 4: Validation
        console.log(`\n🔍 Stage 4: Validation & Quality Gates`);
        const validationResult = await this.validationPhase.validateImplementation(
          analysisResult.spec,
          implementationResult,
          setupResult.workspacePath
        );

        if (!validationResult.success || validationResult.readinessScore < 80) {
          console.log(`⚠️  Validation incomplete - readiness score: ${validationResult.readinessScore}/100`);
          console.log(`📋 Next steps:`);
          for (const step of validationResult.nextSteps) {
            console.log(`   • ${step}`);
          }
          return { spec: analysisResult.spec, implemented: false };
        }

        console.log(`✅ Validation passed - readiness score: ${validationResult.readinessScore}/100`);
        console.log(`🎯 Implementation ready for submission`);
        implemented = true;

      } catch (error) {
        console.error(`❌ SDK implementation pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
        return { spec: analysisResult.spec, implemented: false };
      }
    } else if (autoImplement) {
      console.log(`⏭️  Skipping implementation - bounty not viable for auto-implementation`);
    }

    return { spec: analysisResult.spec, implemented };
  }

  /**
   * Note: SDK implementation now includes all 5 stages:
   * ✅ Phase 1: Spec Analysis - Complete
   * ✅ Phase 1.5: Template Discovery - Complete (NEW: nix-flake-dev-templates integration)
   * ✅ Stage 2: Environment Setup - Complete
   * ✅ Stage 3: TDD Implementation - Complete
   * ✅ Stage 4: Validation - Complete
   *
   * TODO: Stage 5: Automated Submission (future enhancement)
   */
}