#!/usr/bin/env -S deno run --allow-all

/**
 * Project Context Analyzer
 *
 * Analyzes target repositories to understand tech stack, patterns, conventions,
 * and project structure to generate context-aware CLAUDE.md files.
 */

import { join, extname, basename } from "https://deno.land/std@0.208.0/path/mod.ts";
import { walk, exists } from "https://deno.land/std@0.208.0/fs/mod.ts";

export interface ProjectContext {
  // Tech Stack Detection
  primaryLanguage: string;
  secondaryLanguages: string[];
  frameworks: string[];
  buildTools: string[];
  testingFrameworks: string[];
  lintingTools: string[];

  // Project Structure
  projectType: 'web-frontend' | 'web-backend' | 'library' | 'cli' | 'monorepo' | 'unknown';
  hasDocumentation: boolean;
  hasTests: boolean;
  hasCI: boolean;

  // Patterns and Conventions
  namingConvention: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'mixed';
  fileOrganization: 'flat' | 'feature-based' | 'layer-based' | 'domain-driven';
  testStrategy: 'unit-only' | 'integration-heavy' | 'e2e-focused' | 'comprehensive' | 'minimal';

  // Key Files and Directories
  configFiles: string[];
  entryPoints: string[];
  testDirectories: string[];

  // Analysis Metadata
  totalFiles: number;
  analyzedFiles: number;
  analysisConfidence: number; // 0-100
  analysisTimestamp: string;
}

export class ProjectContextAnalyzer {

  /**
   * Analyze a repository to extract project context
   */
  async analyzeRepository(repoPath: string): Promise<ProjectContext> {
    console.log(`🔍 Analyzing repository context at: ${repoPath}`);

    if (!await exists(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    const context: ProjectContext = {
      // Initialize with defaults
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

    try {
      // Collect all files for analysis
      const files: string[] = [];
      const maxFiles = 1000; // Limit analysis scope for performance

      for await (const entry of walk(repoPath, {
        maxDepth: 5, // Reasonable depth limit
        skip: [/node_modules/, /target/, /dist/, /build/, /.git/, /vendor/]
      })) {
        if (entry.isFile && files.length < maxFiles) {
          files.push(entry.path);
        }
      }

      context.totalFiles = files.length;
      context.analyzedFiles = Math.min(files.length, maxFiles);

      // Phase 1: Language and Framework Detection
      await this.detectTechStack(files, context);

      // Phase 2: Project Structure Analysis
      await this.analyzeProjectStructure(files, context);

      // Phase 3: Pattern and Convention Detection
      await this.detectPatterns(files, context);

      // Phase 4: Calculate confidence score
      context.analysisConfidence = this.calculateConfidence(context);

      console.log(`   📊 Analysis complete: ${context.primaryLanguage} (${context.analysisConfidence}% confidence)`);
      console.log(`   🏗️  Project type: ${context.projectType}`);
      console.log(`   🧪 Testing: ${context.testStrategy}`);
      console.log(`   📁 Organization: ${context.fileOrganization}`);

      return context;

    } catch (error) {
      console.error(`❌ Repository analysis failed: ${error instanceof Error ? error.message : String(error)}`);

      // Return minimal context on failure
      context.analysisConfidence = 0;
      return context;
    }
  }

  /**
   * Detect primary language, frameworks, and build tools
   */
  private async detectTechStack(files: string[], context: ProjectContext): Promise<void> {
    const languageStats = new Map<string, number>();
    const frameworks = new Set<string>();
    const buildTools = new Set<string>();
    const testingFrameworks = new Set<string>();
    const lintingTools = new Set<string>();

    // Config file patterns for framework/tool detection
    const configPatterns = {
      // JavaScript/TypeScript
      'package.json': ['buildTools', 'testingFrameworks'],
      'tsconfig.json': ['buildTools'],
      'deno.json': ['buildTools'],
      'eslint.config.js': ['lintingTools'],
      '.eslintrc.json': ['lintingTools'],
      'prettier.config.js': ['lintingTools'],
      'jest.config.js': ['testingFrameworks'],
      'vitest.config.ts': ['testingFrameworks'],

      // Rust
      'Cargo.toml': ['buildTools'],
      'Cargo.lock': ['buildTools'],

      // Go
      'go.mod': ['buildTools'],
      'go.sum': ['buildTools'],

      // Java
      'pom.xml': ['buildTools'],
      'build.gradle': ['buildTools'],
      'build.gradle.kts': ['buildTools'],

      // Python
      'requirements.txt': ['buildTools'],
      'pyproject.toml': ['buildTools'],
      'setup.py': ['buildTools'],

      // CI/CD
      '.github/workflows': ['hasCI'],
      '.gitlab-ci.yml': ['hasCI'],
      'Dockerfile': ['buildTools']
    };

    for (const filePath of files) {
      const fileName = basename(filePath);
      const ext = extname(filePath);

      // Count file extensions for language detection
      if (ext) {
        const count = languageStats.get(ext) || 0;
        languageStats.set(ext, count + 1);
      }

      // Check for specific config files
      context.configFiles.push(...Object.keys(configPatterns).filter(pattern =>
        fileName === pattern || filePath.includes(pattern)
      ));

      // Detect specific frameworks and tools by filename
      await this.analyzeSpecificFile(filePath, frameworks, buildTools, testingFrameworks, lintingTools);
    }

    // Determine primary language from file extensions
    const sortedLanguages = Array.from(languageStats.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([ext, count]) => ({ ext, count, lang: this.extensionToLanguage(ext) }))
      .filter(item => item.lang !== 'unknown');

    if (sortedLanguages.length > 0) {
      context.primaryLanguage = sortedLanguages[0].lang;
      context.secondaryLanguages = sortedLanguages.slice(1, 4).map(item => item.lang);
    }

    context.frameworks = Array.from(frameworks);
    context.buildTools = Array.from(buildTools);
    context.testingFrameworks = Array.from(testingFrameworks);
    context.lintingTools = Array.from(lintingTools);

    // Remove duplicates and clean up
    context.configFiles = [...new Set(context.configFiles)];
  }

  /**
   * Analyze project structure and organization
   */
  private async analyzeProjectStructure(files: string[], context: ProjectContext): Promise<void> {
    const directories = new Set<string>();
    const testPatterns = [/test/, /spec/, /__tests__/, /\.test\./, /\.spec\./];
    const docPatterns = [/readme/i, /docs?/, /documentation/];

    let hasTests = false;
    let hasDocumentation = false;

    for (const filePath of files) {
      const fileName = basename(filePath).toLowerCase();
      const dirPath = filePath.replace(basename(filePath), '');

      directories.add(dirPath);

      // Check for tests
      if (testPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
        hasTests = true;
        context.testDirectories.push(dirPath);
      }

      // Check for documentation
      if (docPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
        hasDocumentation = true;
      }

      // Identify entry points
      if (this.isEntryPoint(fileName)) {
        context.entryPoints.push(filePath);
      }
    }

    context.hasTests = hasTests;
    context.hasDocumentation = hasDocumentation;
    context.testDirectories = [...new Set(context.testDirectories)];

    // Determine project type based on structure and files
    context.projectType = this.inferProjectType(context, Array.from(directories));

    // Analyze file organization
    context.fileOrganization = this.analyzeFileOrganization(Array.from(directories));

    // Determine test strategy
    context.testStrategy = this.analyzeTestStrategy(context.testDirectories, files);
  }

  /**
   * Detect naming conventions and code patterns
   */
  private async detectPatterns(files: string[], context: ProjectContext): Promise<void> {
    const namingPatterns = {
      camelCase: 0,
      snake_case: 0,
      'kebab-case': 0,
      PascalCase: 0
    };

    // Sample subset of files for pattern detection
    const sampleFiles = files.slice(0, Math.min(100, files.length));

    for (const filePath of sampleFiles) {
      const fileName = basename(filePath, extname(filePath));

      if (/^[a-z][a-zA-Z0-9]*$/.test(fileName)) namingPatterns.camelCase++;
      if (/^[a-z][a-z0-9_]*$/.test(fileName)) namingPatterns.snake_case++;
      if (/^[a-z][a-z0-9-]*$/.test(fileName)) namingPatterns['kebab-case']++;
      if (/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) namingPatterns.PascalCase++;
    }

    // Determine dominant naming convention
    const dominantPattern = Object.entries(namingPatterns)
      .sort(([,a], [,b]) => b - a)[0];

    context.namingConvention = (dominantPattern[0] as any) || 'mixed';
  }

  /**
   * Analyze specific files for framework and tool detection
   */
  private async analyzeSpecificFile(
    filePath: string,
    frameworks: Set<string>,
    buildTools: Set<string>,
    testingFrameworks: Set<string>,
    lintingTools: Set<string>
  ): Promise<void> {
    const fileName = basename(filePath);

    try {
      // Only analyze key configuration files
      if (['package.json', 'Cargo.toml', 'go.mod', 'pom.xml'].includes(fileName)) {
        const content = await Deno.readTextFile(filePath);

        // Parse package.json for detailed framework detection
        if (fileName === 'package.json') {
          try {
            const pkg = JSON.parse(content);

            // Frameworks
            const deps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})};
            if (deps.react) frameworks.add('React');
            if (deps.next) frameworks.add('Next.js');
            if (deps.express) frameworks.add('Express');
            if (deps.fastify) frameworks.add('Fastify');
            if (deps['@nestjs/core']) frameworks.add('NestJS');
            if (deps.vue) frameworks.add('Vue.js');
            if (deps.angular) frameworks.add('Angular');

            // Testing frameworks
            if (deps.jest) testingFrameworks.add('Jest');
            if (deps.vitest) testingFrameworks.add('Vitest');
            if (deps.mocha) testingFrameworks.add('Mocha');
            if (deps.cypress) testingFrameworks.add('Cypress');
            if (deps.playwright) testingFrameworks.add('Playwright');

            // Linting tools
            if (deps.eslint) lintingTools.add('ESLint');
            if (deps.prettier) lintingTools.add('Prettier');
            if (deps.typescript) lintingTools.add('TypeScript');

            // Build tools
            if (deps.webpack) buildTools.add('Webpack');
            if (deps.vite) buildTools.add('Vite');
            if (deps.rollup) buildTools.add('Rollup');
            if (pkg.scripts?.build) buildTools.add('npm scripts');

          } catch {
            // Invalid JSON, skip
          }
        }

        // Parse Cargo.toml for Rust frameworks
        if (fileName === 'Cargo.toml') {
          if (content.includes('axum')) frameworks.add('Axum');
          if (content.includes('actix-web')) frameworks.add('Actix Web');
          if (content.includes('warp')) frameworks.add('Warp');
          if (content.includes('tokio')) frameworks.add('Tokio');
          buildTools.add('Cargo');
        }

        // Parse go.mod for Go frameworks
        if (fileName === 'go.mod') {
          if (content.includes('gin-gonic')) frameworks.add('Gin');
          if (content.includes('gorilla/mux')) frameworks.add('Gorilla Mux');
          if (content.includes('labstack/echo')) frameworks.add('Echo');
          buildTools.add('Go modules');
        }
      }

    } catch {
      // File read error, skip
    }
  }

  /**
   * Convert file extension to programming language
   */
  private extensionToLanguage(ext: string): string {
    const mapping: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.tsx': 'TypeScript',
      '.jsx': 'JavaScript',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.py': 'Python',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.dart': 'Dart',
      '.sh': 'Shell',
      '.sql': 'SQL',
      '.md': 'Markdown',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.json': 'JSON',
      '.toml': 'TOML'
    };

    return mapping[ext.toLowerCase()] || 'unknown';
  }

  /**
   * Determine if filename indicates an entry point
   */
  private isEntryPoint(fileName: string): boolean {
    const entryPointNames = [
      'main.ts', 'main.js', 'index.ts', 'index.js', 'app.ts', 'app.js',
      'main.rs', 'lib.rs', 'main.go', 'main.py', 'App.java', 'Main.java'
    ];

    return entryPointNames.includes(fileName) || fileName === 'mod.rs';
  }

  /**
   * Infer project type from context and structure
   */
  private inferProjectType(context: ProjectContext, directories: string[]): ProjectContext['projectType'] {
    const { primaryLanguage, frameworks, configFiles } = context;

    // Check for monorepo indicators
    if (configFiles.some(f => f.includes('lerna') || f.includes('nx') || f.includes('rush'))) {
      return 'monorepo';
    }

    // Web frontend indicators
    if (frameworks.some(f => ['React', 'Vue.js', 'Angular', 'Next.js'].includes(f))) {
      return 'web-frontend';
    }

    // Web backend indicators
    if (frameworks.some(f => ['Express', 'Fastify', 'NestJS', 'Axum', 'Actix Web', 'Gin', 'Echo'].includes(f))) {
      return 'web-backend';
    }

    // CLI tool indicators
    if (primaryLanguage === 'Go' && directories.some(d => d.includes('cmd'))) {
      return 'cli';
    }

    if (primaryLanguage === 'Rust' && configFiles.some(f => f.includes('Cargo.toml'))) {
      // Check for binary vs library in Cargo.toml if needed
      return 'cli'; // Default for Rust projects
    }

    // Library indicators
    if (configFiles.some(f => f.includes('lib') || f.includes('package.json'))) {
      return 'library';
    }

    return 'unknown';
  }

  /**
   * Analyze file organization pattern
   */
  private analyzeFileOrganization(directories: string[]): ProjectContext['fileOrganization'] {
    const featurePatterns = ['features', 'modules', 'components'];
    const layerPatterns = ['controllers', 'services', 'models', 'views', 'handlers'];
    const domainPatterns = ['domain', 'entities', 'repositories', 'use-cases'];

    const hasFeatureStructure = featurePatterns.some(pattern =>
      directories.some(dir => dir.includes(pattern))
    );

    const hasLayerStructure = layerPatterns.some(pattern =>
      directories.some(dir => dir.includes(pattern))
    );

    const hasDomainStructure = domainPatterns.some(pattern =>
      directories.some(dir => dir.includes(pattern))
    );

    if (hasDomainStructure) return 'domain-driven';
    if (hasFeatureStructure) return 'feature-based';
    if (hasLayerStructure) return 'layer-based';

    return 'flat';
  }

  /**
   * Analyze testing strategy from test files
   */
  private analyzeTestStrategy(testDirectories: string[], files: string[]): ProjectContext['testStrategy'] {
    const testFiles = files.filter(f =>
      /\.(test|spec)\.(ts|js|rs|go|java|py)$/.test(f)
    );

    const unitTests = testFiles.filter(f => f.includes('unit') || f.includes('test')).length;
    const integrationTests = testFiles.filter(f => f.includes('integration')).length;
    const e2eTests = testFiles.filter(f => f.includes('e2e') || f.includes('cypress') || f.includes('playwright')).length;

    if (testFiles.length === 0) return 'minimal';
    if (e2eTests > unitTests) return 'e2e-focused';
    if (integrationTests > unitTests) return 'integration-heavy';
    if (unitTests > 0 && integrationTests > 0 && e2eTests > 0) return 'comprehensive';

    return 'unit-only';
  }

  /**
   * Calculate analysis confidence score based on detected patterns
   */
  private calculateConfidence(context: ProjectContext): number {
    let score = 0;

    // Primary language detection confidence
    if (context.primaryLanguage !== 'unknown') score += 30;

    // Framework detection confidence
    if (context.frameworks.length > 0) score += 20;

    // Build tool detection confidence
    if (context.buildTools.length > 0) score += 15;

    // Project structure analysis confidence
    if (context.projectType !== 'unknown') score += 15;

    // Pattern detection confidence
    if (context.namingConvention !== 'mixed') score += 10;

    // Testing analysis confidence
    if (context.hasTests) score += 10;

    return Math.min(100, score);
  }
}