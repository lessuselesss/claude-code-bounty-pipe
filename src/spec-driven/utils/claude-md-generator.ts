#!/usr/bin/env -S deno run --allow-all

/**
 * CLAUDE.md Generator
 *
 * Generates project-specific CLAUDE.md files by combining repository context
 * analysis with bounty specifications, using kiro.dev methodology concepts
 * adapted for our implementation.
 */

import type { BountySpec } from '../types.ts';
import type { ProjectContext } from './project-context-analyzer.ts';
import { ProjectContextAnalyzer } from './project-context-analyzer.ts';
import { join, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.208.0/fs/mod.ts";

export interface ClaudeMdGenerationOptions {
  includeGlobalContext?: boolean;
  includeBountyConstraints?: boolean;
  includeImplementationGuidance?: boolean;
  templateOverride?: string;
}

export interface ClaudeMdGenerationResult {
  success: boolean;
  filePath: string;
  template: string;
  projectContext: ProjectContext;
  generationLog: string[];
}

export class ClaudeMdGenerator {
  private contextAnalyzer = new ProjectContextAnalyzer();
  private templateCache = new Map<string, string>();

  /**
   * Generate project-specific CLAUDE.md file for a bounty workspace
   */
  async generateClaudeMarkdown(
    spec: BountySpec,
    workspacePath: string,
    repositoryPath: string,
    options: ClaudeMdGenerationOptions = {}
  ): Promise<ClaudeMdGenerationResult> {
    const {
      includeGlobalContext = true,
      includeBountyConstraints = true,
      includeImplementationGuidance = true,
      templateOverride
    } = options;

    console.log(`📝 Generating project-specific CLAUDE.md for: ${spec.title}`);

    const generationLog: string[] = [];

    try {
      // Phase 1: Analyze repository context
      console.log(`   🔍 Analyzing project context...`);
      generationLog.push('Starting project context analysis');

      const projectContext = await this.contextAnalyzer.analyzeRepository(repositoryPath);
      generationLog.push(`Context analysis complete: ${projectContext.primaryLanguage} project`);

      // Phase 2: Select appropriate template
      const templateName = templateOverride || this.selectTemplate(projectContext);
      console.log(`   📋 Using template: ${templateName}`);
      generationLog.push(`Selected template: ${templateName}`);

      const template = await this.loadTemplate(templateName);

      // Phase 3: Generate CLAUDE.md content
      const claudeMarkdownContent = await this.renderTemplate(
        template,
        spec,
        projectContext,
        {
          includeGlobalContext,
          includeBountyConstraints,
          includeImplementationGuidance
        }
      );

      // Phase 4: Write CLAUDE.md to workspace
      const claudeFilePath = join(workspacePath, 'CLAUDE.md');
      await Deno.writeTextFile(claudeFilePath, claudeMarkdownContent);

      console.log(`   ✅ CLAUDE.md generated: ${claudeFilePath}`);
      generationLog.push(`CLAUDE.md written to: ${claudeFilePath}`);

      return {
        success: true,
        filePath: claudeFilePath,
        template: templateName,
        projectContext,
        generationLog
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ CLAUDE.md generation failed: ${errorMessage}`);
      generationLog.push(`Generation failed: ${errorMessage}`);

      return {
        success: false,
        filePath: '',
        template: templateOverride || 'generic',
        projectContext: await this.getFallbackContext(),
        generationLog
      };
    }
  }

  /**
   * Select appropriate template based on project context
   */
  private selectTemplate(context: ProjectContext): string {
    const { primaryLanguage, frameworks, projectType } = context;

    // TypeScript/JavaScript projects
    if (['TypeScript', 'JavaScript'].includes(primaryLanguage)) {
      if (frameworks.some(f => ['React', 'Next.js', 'Vue.js'].includes(f))) {
        return 'typescript-react';
      }
      if (frameworks.some(f => ['Express', 'Fastify', 'NestJS'].includes(f))) {
        return 'typescript-backend';
      }
      if (projectType === 'web-frontend') return 'typescript-react';
      if (projectType === 'web-backend') return 'typescript-backend';
      return 'typescript-generic';
    }

    // Rust projects
    if (primaryLanguage === 'Rust') {
      if (frameworks.includes('Axum') || frameworks.includes('Actix Web')) {
        return 'rust-axum';
      }
      return 'rust-generic';
    }

    // Go projects
    if (primaryLanguage === 'Go') {
      if (frameworks.some(f => ['Gin', 'Echo', 'Gorilla Mux'].includes(f))) {
        return 'go-service';
      }
      return 'go-generic';
    }

    // Java projects
    if (primaryLanguage === 'Java') {
      return 'java-spring';
    }

    // Python projects
    if (primaryLanguage === 'Python') {
      return 'python-generic';
    }

    // Fallback to generic template
    return 'generic';
  }

  /**
   * Load template content from file system
   */
  private async loadTemplate(templateName: string): Promise<string> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = join(
      dirname(dirname(import.meta.url.replace('file://', ''))),
      'templates',
      'claude-md-templates',
      `${templateName}.md`
    );

    try {
      const content = await Deno.readTextFile(templatePath);
      this.templateCache.set(templateName, content);
      return content;
    } catch (error) {
      console.warn(`   ⚠️ Could not load template ${templateName}, falling back to generic`);

      // Fallback to generic template
      if (templateName !== 'generic') {
        return await this.loadTemplate('generic');
      }

      // If generic template also fails, return inline template
      return this.getInlineGenericTemplate();
    }
  }

  /**
   * Render template with context variables
   */
  private async renderTemplate(
    template: string,
    spec: BountySpec,
    context: ProjectContext,
    options: {
      includeGlobalContext: boolean;
      includeBountyConstraints: boolean;
      includeImplementationGuidance: boolean;
    }
  ): Promise<string> {
    const variables = {
      // Bounty information
      bounty_title: spec.title,
      bounty_id: spec.bounty_id,
      bounty_amount: `$${spec.amount}`,
      organization: spec.org?.name || 'Unknown Organization',
      repository: `${spec.org?.github_handle}/${spec.task?.repo_name}` || 'Unknown Repository',

      // Project context
      primary_language: context.primaryLanguage,
      secondary_languages: context.secondaryLanguages.join(', '),
      frameworks: context.frameworks.join(', '),
      build_tools: context.buildTools.join(', '),
      testing_frameworks: context.testingFrameworks.join(', '),
      linting_tools: context.lintingTools.join(', '),
      project_type: context.projectType.replace('-', ' '),
      naming_convention: context.namingConvention,
      file_organization: context.fileOrganization.replace('-', ' '),
      test_strategy: context.testStrategy.replace('-', ' '),

      // Requirements and constraints
      primary_requirements: this.formatList(spec.requirements.primary),
      acceptance_criteria: this.formatTaskList(spec.requirements.acceptance_criteria),
      constraints: this.formatList(spec.requirements.constraints),
      assumptions: this.formatList(spec.requirements.assumptions),

      // Implementation details
      technical_approach: spec.system_design.approach,
      architecture_changes: this.formatList(spec.system_design.architecture_changes),
      integration_points: this.formatList(spec.system_design.integration_points),
      data_flow: spec.system_design.data_flow,

      // Discrete tasks
      discrete_tasks: this.formatDiscreteTasks(spec.discrete_tasks),
      task_count: spec.discrete_tasks.length.toString(),
      high_priority_tasks: spec.discrete_tasks.filter(t => t.priority === 'high').length.toString(),

      // Risk assessment
      risk_assessment: spec.implementation_reasoning.risk_assessment,
      success_indicators: this.formatTaskList(spec.implementation_reasoning.success_indicators),
      potential_blockers: this.formatList(spec.implementation_reasoning.potential_blockers, '⚠️'),

      // Viability
      viability_score: `${spec.viability.score}/10`,
      viability_category: spec.viability.category.toUpperCase(),
      viability_reasoning: spec.viability.reasoning,
      time_estimate: spec.viability.time_estimate,

      // Entry points and test directories
      entry_points: context.entryPoints.length > 0 ? context.entryPoints.map(p => `- ${p}`).join('\n') : '- No entry points detected',
      test_directories: context.testDirectories.length > 0 ? context.testDirectories.map(d => `- ${d}`).join('\n') : '- No test directories detected',

      // Timestamps
      generated_at: new Date().toISOString(),
      generated_date: new Date().toLocaleDateString()
    };

    // Replace template variables
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replaceAll(placeholder, value);
    }

    // Conditional sections
    if (!options.includeGlobalContext) {
      rendered = this.removeSection(rendered, 'GLOBAL_CONTEXT');
    }
    if (!options.includeBountyConstraints) {
      rendered = this.removeSection(rendered, 'BOUNTY_CONSTRAINTS');
    }
    if (!options.includeImplementationGuidance) {
      rendered = this.removeSection(rendered, 'IMPLEMENTATION_GUIDANCE');
    }

    return rendered;
  }

  /**
   * Format array as markdown list
   */
  private formatList(items: string[], prefix = '-'): string {
    if (!items || items.length === 0) return '- None specified';
    return items.map(item => `${prefix} ${item}`).join('\n');
  }

  /**
   * Format array as task list with checkboxes
   */
  private formatTaskList(items: string[]): string {
    if (!items || items.length === 0) return '- [ ] None specified';
    return items.map(item => `- [ ] ${item}`).join('\n');
  }

  /**
   * Format discrete tasks as structured markdown
   */
  private formatDiscreteTasks(tasks: any[]): string {
    if (!tasks || tasks.length === 0) return '- No tasks specified';

    return tasks.map((task, index) => `
#### Task ${index + 1}: ${task.description}
- **Priority**: ${task.priority}
- **Effort**: ${task.estimated_effort}
- **Dependencies**: ${task.dependencies?.join(', ') || 'None'}
- **Implementation Notes**: ${task.implementation_notes || 'None'}
`).join('\n');
  }

  /**
   * Remove conditional sections from template
   */
  private removeSection(content: string, sectionName: string): string {
    const startMarker = `<!-- START_${sectionName} -->`;
    const endMarker = `<!-- END_${sectionName} -->`;

    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
      return content.substring(0, startIndex) +
             content.substring(endIndex + endMarker.length);
    }

    return content;
  }

  /**
   * Get fallback context for error scenarios
   */
  private async getFallbackContext(): Promise<ProjectContext> {
    return {
      primaryLanguage: 'unknown',
      secondaryLanguages: [],
      frameworks: [],
      buildTools: [],
      testingFrameworks: [],
      lintingTools: [],
      projectType: 'unknown',
      hasDocumentation: false,
      hasTests: false,
      hasCI: false,
      namingConvention: 'mixed',
      fileOrganization: 'flat',
      testStrategy: 'minimal',
      configFiles: [],
      entryPoints: [],
      testDirectories: [],
      totalFiles: 0,
      analyzedFiles: 0,
      analysisConfidence: 0,
      analysisTimestamp: new Date().toISOString()
    };
  }

  /**
   * Get inline generic template as fallback
   */
  private getInlineGenericTemplate(): string {
    return `# CLAUDE.md - {{bounty_title}}

Project-specific AI assistant guidelines for bounty implementation.

## Bounty Context

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Amount**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability**: {{viability_category}} ({{viability_score}})

## Project Analysis

**Primary Language**: {{primary_language}}
**Project Type**: {{project_type}}
**Frameworks**: {{frameworks}}
**Build Tools**: {{build_tools}}

## Requirements & Acceptance Criteria

### Primary Requirements
{{primary_requirements}}

### Acceptance Criteria
{{acceptance_criteria}}

### Constraints
{{constraints}}

## Implementation Tasks

{{discrete_tasks}}

## Technical Approach

**Architecture**: {{technical_approach}}
**Integration Points**: {{integration_points}}
**Data Flow**: {{data_flow}}

## Success Indicators
{{success_indicators}}

## Potential Blockers
{{potential_blockers}}

---
*Generated on {{generated_date}} using spec-driven development methodology*
`;
  }

  /**
   * Validate generated CLAUDE.md content
   */
  async validateGeneratedContent(filePath: string): Promise<{
    valid: boolean;
    issues: string[];
    size: number;
  }> {
    const issues: string[] = [];

    try {
      if (!await exists(filePath)) {
        issues.push('CLAUDE.md file does not exist');
        return { valid: false, issues, size: 0 };
      }

      const content = await Deno.readTextFile(filePath);
      const size = content.length;

      // Basic validation checks
      if (size < 500) issues.push('Content appears too short (< 500 characters)');
      if (size > 50000) issues.push('Content appears too long (> 50KB)');

      if (!content.includes('# CLAUDE.md')) issues.push('Missing main header');
      if (!content.includes('Bounty Context')) issues.push('Missing bounty context section');
      if (!content.includes('Requirements')) issues.push('Missing requirements section');

      // Check for unresolved template variables
      const unresolvedVars = content.match(/\{\{[^}]+\}\}/g);
      if (unresolvedVars) {
        issues.push(`Unresolved template variables: ${unresolvedVars.join(', ')}`);
      }

      return {
        valid: issues.length === 0,
        issues,
        size
      };

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, issues, size: 0 };
    }
  }
}