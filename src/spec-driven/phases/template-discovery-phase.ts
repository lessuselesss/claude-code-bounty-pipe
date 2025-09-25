#!/usr/bin/env -S deno run --allow-all

/**
 * Template Discovery Phase (Phase 1.5)
 *
 * Discovers optimal development templates by analyzing repository tech stacks
 * and matching them to nix-flake-dev-templates using Claude SDK intelligence.
 *
 * This phase runs between Spec Analysis (Phase 1) and Environment Setup (Phase 2)
 * to enhance environment setup with template-driven development environments.
 */

import { query } from 'npm:@anthropic-ai/claude-code@latest';
import { walk } from "jsr:@std/fs";
import type { BountySpec } from '../types.ts';
import type {
  TemplateDiscoveryConfig,
  TemplateDiscoveryResult,
  Template,
  NixFlakeTemplate,
  TechStackAnalysis
} from '../types/template-types.ts';
import { TechStackAnalyzer } from '../utils/tech-stack-analyzer.ts';
import { TemplateMatcher } from '../utils/template-matcher.ts';
import { getBountyPipePaths } from '../../repository-cache.ts';

export class TemplateDiscoveryPhase {
  private config: TemplateDiscoveryConfig;
  private techStackAnalyzer: TechStackAnalyzer;
  private templateMatcher: TemplateMatcher;

  constructor(config?: Partial<TemplateDiscoveryConfig>) {
    this.config = this.getDefaultConfig(config);
    this.techStackAnalyzer = new TechStackAnalyzer(this.config.analysisConfig);
    this.templateMatcher = new TemplateMatcher(this.config);
  }

  /**
   * Execute template discovery for a bounty specification
   */
  async discoverTemplate(spec: BountySpec, cachedRepoPath: string): Promise<TemplateDiscoveryResult> {
    const startTime = performance.now();
    console.log(`🔍 Phase 1.5: Template Discovery for "${spec.title}"`);

    try {
      // Step 1: Ensure template repository is available
      const templatesAvailable = await this.ensureTemplateRepository();
      if (!templatesAvailable) {
        return this.createFailureResult(
          spec,
          "Failed to access template repository",
          performance.now() - startTime
        );
      }

      // Step 2: Analyze repository tech stack
      console.log(`📊 Analyzing tech stack for ${spec.organization}/${spec.repository}`);
      const techStackAnalysis = await this.techStackAnalyzer.analyzeRepository(cachedRepoPath);

      // Step 3: Load available templates
      const availableTemplates = await this.loadAvailableTemplates();
      console.log(`📚 Loaded ${availableTemplates.length} available templates`);

      // Step 4: Find template matches using Claude SDK
      const templateMatches = await this.templateMatcher.findTemplateMatches(
        techStackAnalysis,
        availableTemplates,
        `Repository: ${spec.organization}/${spec.repository}\nBounty: ${spec.title}`
      );

      // Step 5: Select recommended template
      const recommendedTemplate = templateMatches[0]?.template;
      const fallbackTemplate = this.selectFallbackTemplate(availableTemplates, techStackAnalysis);

      const executionTime = performance.now() - startTime;

      const result: TemplateDiscoveryResult = {
        success: templateMatches.length > 0,
        techStackAnalysis,
        templateMatches,
        recommendedTemplate,
        fallbackTemplate,
        discoveryMetadata: {
          executionTime,
          templatesEvaluated: availableTemplates.length,
          cacheHit: await this.isCacheValid(),
          discoveryTimestamp: new Date().toISOString()
        },
        warnings: this.generateWarnings(techStackAnalysis, templateMatches)
      };

      console.log(`✅ Template discovery completed in ${Math.round(executionTime)}ms`);
      if (recommendedTemplate) {
        console.log(`🎯 Recommended template: ${recommendedTemplate.name} (${templateMatches[0].score}/100)`);
      }

      return result;

    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`❌ Template discovery failed: ${error instanceof Error ? error.message : String(error)}`);

      return this.createFailureResult(
        spec,
        error instanceof Error ? error.message : String(error),
        executionTime
      );
    }
  }

  /**
   * Validate repository URL exists and is accessible
   */
  private async validateRepositoryUrl(repoUrl: string): Promise<boolean> {
    try {
      // Convert git URL to HTTP for validation
      const httpUrl = repoUrl.replace('.git', '').replace('git@github.com:', 'https://github.com/');
      const response = await fetch(`${httpUrl}/blob/main/README.md`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback template repositories
   */
  private getFallbackTemplateUrls(): string[] {
    return [
      'https://github.com/nixos/templates.git',
      'https://github.com/the-nix-way/dev-templates.git'
    ];
  }

  /**
   * Ensure template repository is cloned and up-to-date
   */
  private async ensureTemplateRepository(): Promise<boolean> {
    try {
      const templateRepoPath = `${this.config.cacheDirectory}/nix-flake-dev-templates`;

      // Check if repository exists
      let repoExists = false;
      try {
        const stat = await Deno.stat(templateRepoPath);
        repoExists = stat.isDirectory;
      } catch {
        repoExists = false;
      }

      if (!repoExists) {
        console.log(`📥 Cloning template repository: ${this.config.templateRepository}`);

        // Validate primary repository URL first
        const primaryRepoValid = await this.validateRepositoryUrl(this.config.templateRepository);
        let repoToClone = this.config.templateRepository;

        if (!primaryRepoValid) {
          console.warn(`⚠️ Primary template repository not accessible, trying fallbacks...`);

          // Try fallback repositories
          const fallbackUrls = this.getFallbackTemplateUrls();
          for (const fallbackUrl of fallbackUrls) {
            if (await this.validateRepositoryUrl(fallbackUrl)) {
              console.log(`✅ Using fallback repository: ${fallbackUrl}`);
              repoToClone = fallbackUrl;
              break;
            }
          }

          // If no repositories are accessible, return false but don't fail completely
          if (repoToClone === this.config.templateRepository && !primaryRepoValid) {
            console.warn(`⚠️ No accessible template repositories found, will use basic templates`);
            return false;
          }
        }

        // Create cache directory if it doesn't exist
        await Deno.mkdir(this.config.cacheDirectory, { recursive: true });

        // Clone template repository
        const cloneProcess = new Deno.Command('git', {
          args: ['clone', repoToClone, templateRepoPath],
          cwd: this.config.cacheDirectory,
          stdout: 'piped',
          stderr: 'piped'
        });

        const { success } = await cloneProcess.output();
        if (!success) {
          console.error(`❌ Failed to clone template repository`);
          return false;
        }
      } else {
        // Check if cache is expired and update if needed
        if (!(await this.isCacheValid())) {
          console.log(`🔄 Updating template repository cache`);

          const pullProcess = new Deno.Command('git', {
            args: ['pull', 'origin', 'main'],
            cwd: templateRepoPath,
            stdout: 'piped',
            stderr: 'piped'
          });

          await pullProcess.output();
        }
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to setup template repository: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Load and parse available templates from nix-flake-dev-templates
   */
  private async loadAvailableTemplates(): Promise<Template[]> {
    const templates: Template[] = [];
    const templateRepoPath = `${this.config.cacheDirectory}/nix-flake-dev-templates`;

    try {
      // Use Claude SDK to analyze the template repository structure
      const templateAnalysis = await this.analyzeTemplateRepository(templateRepoPath);

      // Parse the analysis to extract template definitions
      const parsedTemplates = await this.parseTemplateAnalysis(templateAnalysis, templateRepoPath);

      templates.push(...parsedTemplates);

    } catch (error) {
      console.warn(`⚠️ Failed to load templates via Claude SDK: ${error instanceof Error ? error.message : String(error)}`);

      // Fallback to basic directory scanning
      const fallbackTemplates = await this.loadTemplatesFallback(templateRepoPath);
      templates.push(...fallbackTemplates);
    }

    return templates;
  }

  /**
   * Use Claude SDK to analyze template repository structure
   */
  private async analyzeTemplateRepository(templateRepoPath: string): Promise<string> {
    const analysisPrompt = `
Analyze this nix-flake-dev-templates repository to extract development template information.

REPOSITORY PATH: ${templateRepoPath}

ANALYSIS REQUIREMENTS:

1. IDENTIFY TEMPLATES
   - Scan directory structure for templates
   - Look for flake.nix files and template configurations
   - Identify template names, paths, and descriptions

2. EXTRACT TECH STACK INFORMATION
   - Determine programming languages for each template
   - Identify frameworks and build tools supported
   - Extract package managers and development tools

3. CATEGORIZE BY COMPLEXITY
   - Simple: Basic language setup with minimal tooling
   - Intermediate: Language + framework + common tools
   - Advanced: Full stack with complex tooling and infrastructure

4. PROVIDE STRUCTURED OUTPUT
   For each template, provide:
   - Template name and path
   - Description and use case
   - Supported technologies (languages, frameworks, tools)
   - Complexity level
   - Any special features or requirements

Focus on extracting actionable template information that can be used for intelligent matching.
`;

    let response = '';
    for await (const message of query({
      prompt: analysisPrompt,
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: ['Read', 'Glob', 'Grep'],
        cwd: templateRepoPath,
        maxTurns: 8
      }
    })) {
      if (message.type === 'assistant') {
        response += message.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          response = message.result;
        }
        break;
      }
    }

    return response;
  }

  /**
   * Parse Claude's template analysis into structured Template objects
   */
  private async parseTemplateAnalysis(analysis: string, templateRepoPath: string): Promise<Template[]> {
    const templates: Template[] = [];

    try {
      // Extract template information using regex patterns
      const templateSections = analysis.split(/(?:\d+\.|\*\s*|\-\s*)[^\n]*template/i);

      for (const section of templateSections) {
        if (section.trim().length < 50) continue; // Skip short sections

        const template = await this.parseTemplateSection(section, templateRepoPath);
        if (template) {
          templates.push(template);
        }
      }

      // If parsing failed, generate basic templates
      if (templates.length === 0) {
        console.warn(`⚠️ Failed to parse Claude analysis, generating basic templates`);
        return await this.generateBasicTemplates(templateRepoPath);
      }

    } catch (error) {
      console.warn(`⚠️ Template parsing error: ${error instanceof Error ? error.message : String(error)}`);
      return await this.generateBasicTemplates(templateRepoPath);
    }

    return templates;
  }

  /**
   * Parse individual template section from Claude's analysis
   */
  private async parseTemplateSection(section: string, templateRepoPath: string): Promise<Template | null> {
    try {
      // Extract template name (first meaningful line)
      const nameMatch = section.match(/^([^:\n]+)(?::|$)/m);
      const name = nameMatch?.[1]?.trim() || 'Unknown Template';

      // Extract path
      const pathMatch = section.match(/path[:\s]*([^\n]+)/i);
      const path = pathMatch?.[1]?.trim() || name.toLowerCase().replace(/\s+/g, '-');

      // Extract description
      const descMatch = section.match(/description[:\s]*([^\n]+)/i);
      const description = descMatch?.[1]?.trim() || `Template for ${name}`;

      // Extract languages
      const langMatch = section.match(/languages?[:\s]*([^\n]+)/i);
      const languages = langMatch?.[1]?.split(/[,\s]+/).filter(l => l.trim().length > 0) || ['unknown'];

      // Extract complexity
      const complexityMatch = section.match(/complexity[:\s]*([^\n]+)/i);
      const complexityText = complexityMatch?.[1]?.toLowerCase() || 'simple';
      const complexity = complexityText.includes('advanced') ? 'advanced' :
                        complexityText.includes('intermediate') ? 'intermediate' : 'simple';

      // Generate template ID
      const id = `nix-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      return {
        id,
        name,
        description,
        path,
        techStack: {
          languages,
          frameworks: [], // TODO: Extract from analysis
          buildTools: ['nix'],
          packageManagers: ['nix']
        },
        complexity: complexity as 'simple' | 'intermediate' | 'advanced',
        tags: [name.toLowerCase(), 'nix', 'flake'],
        metadata: {
          lastUpdated: new Date().toISOString(),
          maintainer: 'nix-flake-dev-templates',
          documentation: `${this.config.templateRepository}/tree/main/${path}`
        }
      };

    } catch (error) {
      console.warn(`⚠️ Failed to parse template section: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Fallback template loading using directory scanning
   */
  private async loadTemplatesFallback(templateRepoPath: string): Promise<Template[]> {
    const templates: Template[] = [];

    try {
      for await (const entry of walk(templateRepoPath, {
        maxDepth: 2,
        includeDirs: true
      })) {
        if (entry.isDirectory && entry.name !== '.git') {
          const relativePath = entry.path.replace(templateRepoPath + '/', '');

          // Check if this looks like a template directory
          const hasFlake = await this.checkForFlakeFile(entry.path);

          if (hasFlake && relativePath !== '.') {
            templates.push({
              id: `nix-${entry.name}`,
              name: entry.name,
              description: `Nix flake template for ${entry.name}`,
              path: relativePath,
              techStack: {
                languages: [this.guessLanguageFromName(entry.name)],
                frameworks: [],
                buildTools: ['nix'],
                packageManagers: ['nix']
              },
              complexity: 'simple',
              tags: [entry.name, 'nix', 'flake'],
              metadata: {
                lastUpdated: new Date().toISOString(),
                maintainer: 'nix-flake-dev-templates'
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Fallback template loading failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return templates;
  }

  /**
   * Generate comprehensive basic templates if all else fails
   */
  private async generateBasicTemplates(templateRepoPath: string): Promise<Template[]> {
    const timestamp = new Date().toISOString();

    return [
      {
        id: 'nix-generic',
        name: 'Generic Development Environment',
        description: 'Basic Nix flake for general development',
        path: 'generic',
        techStack: {
          languages: ['unknown'],
          frameworks: [],
          buildTools: ['nix', 'git'],
          packageManagers: ['nix']
        },
        complexity: 'simple',
        tags: ['generic', 'nix', 'flake'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      },
      {
        id: 'nix-typescript',
        name: 'TypeScript/Deno Development',
        description: 'Nix environment for TypeScript and Deno projects',
        path: 'typescript',
        techStack: {
          languages: ['typescript', 'javascript'],
          frameworks: ['deno'],
          buildTools: ['nix', 'deno'],
          packageManagers: ['npm', 'deno']
        },
        complexity: 'simple',
        tags: ['typescript', 'deno', 'javascript', 'nix'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      },
      {
        id: 'nix-rust',
        name: 'Rust Development Environment',
        description: 'Nix environment optimized for Rust development',
        path: 'rust',
        techStack: {
          languages: ['rust'],
          frameworks: ['tokio', 'axum'],
          buildTools: ['cargo', 'nix'],
          packageManagers: ['cargo']
        },
        complexity: 'intermediate',
        tags: ['rust', 'cargo', 'nix'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      },
      {
        id: 'nix-go',
        name: 'Go Development Environment',
        description: 'Nix environment for Go applications',
        path: 'go',
        techStack: {
          languages: ['go'],
          frameworks: [],
          buildTools: ['go', 'nix'],
          packageManagers: ['go']
        },
        complexity: 'simple',
        tags: ['go', 'golang', 'nix'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      },
      {
        id: 'nix-python',
        name: 'Python Development Environment',
        description: 'Nix environment for Python projects with common tools',
        path: 'python',
        techStack: {
          languages: ['python'],
          frameworks: ['fastapi', 'flask'],
          buildTools: ['pip', 'nix'],
          packageManagers: ['pip', 'poetry']
        },
        complexity: 'simple',
        tags: ['python', 'pip', 'nix'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      },
      {
        id: 'nix-nodejs',
        name: 'Node.js Development Environment',
        description: 'Nix environment for Node.js applications',
        path: 'nodejs',
        techStack: {
          languages: ['javascript', 'typescript'],
          frameworks: ['express', 'react', 'next'],
          buildTools: ['webpack', 'vite', 'nix'],
          packageManagers: ['npm', 'yarn', 'pnpm']
        },
        complexity: 'intermediate',
        tags: ['nodejs', 'javascript', 'npm', 'nix'],
        metadata: {
          lastUpdated: timestamp,
          maintainer: 'fallback-generator'
        }
      }
    ];
  }

  /**
   * Select fallback template if no good matches found
   */
  private selectFallbackTemplate(templates: Template[], techStackAnalysis: TechStackAnalysis): Template | undefined {
    // Look for generic template first
    const genericTemplate = templates.find(t =>
      t.name.toLowerCase().includes('generic') ||
      t.tags.includes('generic')
    );

    if (genericTemplate) return genericTemplate;

    // Fallback to simplest template that supports the primary language
    const languageTemplate = templates.find(t =>
      t.techStack.languages.includes(techStackAnalysis.primaryLanguage)
    );

    return languageTemplate || templates[0];
  }

  /**
   * Helper methods
   */
  private async checkForFlakeFile(dirPath: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(`${dirPath}/flake.nix`);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  private guessLanguageFromName(templateName: string): string {
    const name = templateName.toLowerCase();

    if (name.includes('rust')) return 'rust';
    if (name.includes('go')) return 'go';
    if (name.includes('typescript') || name.includes('ts')) return 'typescript';
    if (name.includes('javascript') || name.includes('js')) return 'javascript';
    if (name.includes('python') || name.includes('py')) return 'python';
    if (name.includes('java')) return 'java';
    if (name.includes('cpp') || name.includes('c++')) return 'cpp';
    if (name.includes('c')) return 'c';

    return 'unknown';
  }

  private async isCacheValid(): Promise<boolean> {
    try {
      const templateRepoPath = `${this.config.cacheDirectory}/nix-flake-dev-templates`;
      const gitPath = `${templateRepoPath}/.git`;

      const stat = await Deno.stat(gitPath);
      const ageHours = (Date.now() - stat.mtime!.getTime()) / (1000 * 60 * 60);

      return ageHours < this.config.cacheExpiryHours;
    } catch {
      return false;
    }
  }

  private generateWarnings(techStackAnalysis: TechStackAnalysis, templateMatches: any[]): string[] {
    const warnings: string[] = [];

    if (techStackAnalysis.confidence < 50) {
      warnings.push(`Low confidence tech stack analysis (${techStackAnalysis.confidence}%)`);
    }

    if (templateMatches.length === 0) {
      warnings.push('No suitable templates found - falling back to generic template');
    }

    if (techStackAnalysis.primaryLanguage === 'unknown') {
      warnings.push('Could not determine primary programming language');
    }

    return warnings;
  }

  private createFailureResult(spec: BountySpec, error: string, executionTime: number): TemplateDiscoveryResult {
    return {
      success: false,
      techStackAnalysis: {
        primaryLanguage: 'unknown',
        secondaryLanguages: [],
        buildTools: [],
        frameworks: [],
        packageManagers: [],
        devTools: [],
        infrastructure: [],
        confidence: 0,
        analysisMetadata: {
          filesAnalyzed: 0,
          scanDuration: 0,
          detectionPatterns: []
        }
      },
      templateMatches: [],
      discoveryMetadata: {
        executionTime,
        templatesEvaluated: 0,
        cacheHit: false,
        discoveryTimestamp: new Date().toISOString()
      },
      warnings: [],
      error
    };
  }

  private getDefaultConfig(overrides?: Partial<TemplateDiscoveryConfig>): TemplateDiscoveryConfig {
    const paths = getBountyPipePaths();

    return {
      templateRepository: 'https://github.com/lessuselesss/nix-flake-dev-templates.git',
      cacheDirectory: `${paths.repoCache}/template-cache`,
      cacheExpiryHours: 24,
      minimumMatchScore: 45,
      maxMatches: 5,
      fallbackPreferences: {
        preferSimpleTemplates: true,
        fallbackToGeneric: true,
        genericTemplateId: 'nix-generic'
      },
      analysisConfig: {
        maxFilesToScan: 200,
        fileExtensionsToAnalyze: ['.ts', '.js', '.rs', '.go', '.py', '.java', '.cpp', '.c', '.h'],
        ignorePaths: [
          'node_modules',
          '.git',
          'target',
          'dist',
          'build',
          '__pycache__',
          '.next',
          '.nuxt'
        ],
        analysisTimeoutSeconds: 30
      },
      ...overrides
    };
  }
}