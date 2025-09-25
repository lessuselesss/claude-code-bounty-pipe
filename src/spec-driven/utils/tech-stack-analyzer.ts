#!/usr/bin/env -S deno run --allow-all

/**
 * Tech Stack Analyzer
 *
 * Analyzes repository structure and files to detect programming languages,
 * frameworks, build tools, and other technologies in use.
 */

import { walk } from "jsr:@std/fs";
import type {
  TechStackAnalysis,
  FileAnalysisResult,
  TemplateDiscoveryConfig
} from '../types/template-types.ts';

export class TechStackAnalyzer {
  private config: TemplateDiscoveryConfig['analysisConfig'];

  constructor(config: TemplateDiscoveryConfig['analysisConfig']) {
    this.config = config;
  }

  /**
   * Analyze repository for tech stack identification
   */
  async analyzeRepository(repositoryPath: string): Promise<TechStackAnalysis> {
    const startTime = performance.now();

    console.log(`🔍 Analyzing tech stack for repository: ${repositoryPath}`);

    try {
      // Scan repository files
      const fileAnalysisResults = await this.scanRepositoryFiles(repositoryPath);

      // Aggregate tech stack information
      const techStack = this.aggregateTechStackData(fileAnalysisResults);

      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(fileAnalysisResults, techStack);

      const analysisTime = performance.now() - startTime;

      return {
        primaryLanguage: techStack.primaryLanguage,
        secondaryLanguages: techStack.secondaryLanguages,
        buildTools: techStack.buildTools,
        frameworks: techStack.frameworks,
        packageManagers: techStack.packageManagers,
        devTools: techStack.devTools,
        infrastructure: techStack.infrastructure,
        confidence,
        analysisMetadata: {
          filesAnalyzed: fileAnalysisResults.length,
          scanDuration: analysisTime,
          detectionPatterns: this.getDetectionPatterns()
        }
      };

    } catch (error) {
      console.error(`❌ Tech stack analysis failed: ${error instanceof Error ? error.message : String(error)}`);

      // Return minimal analysis on failure
      return {
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
          scanDuration: performance.now() - startTime,
          detectionPatterns: []
        }
      };
    }
  }

  /**
   * Scan repository files and analyze each for tech indicators
   */
  private async scanRepositoryFiles(repositoryPath: string): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
    let filesScanned = 0;

    try {
      for await (const entry of walk(repositoryPath, {
        maxDepth: 4,
        includeDirs: false,
        skip: this.config.ignorePaths.map(path => new RegExp(path))
      })) {

        if (filesScanned >= this.config.maxFilesToScan) {
          console.log(`⚠️ Reached max file scan limit: ${this.config.maxFilesToScan}`);
          break;
        }

        const relativePath = entry.path.replace(repositoryPath + '/', '');

        // Check if file extension should be analyzed
        const fileExtension = this.getFileExtension(entry.path);
        if (fileExtension && this.config.fileExtensionsToAnalyze.includes(fileExtension)) {
          const analysisResult = await this.analyzeFile(entry.path, relativePath);
          if (analysisResult) {
            results.push(analysisResult);
          }
        }

        // Always analyze known configuration files regardless of extension filter
        if (this.isConfigurationFile(relativePath)) {
          const analysisResult = await this.analyzeFile(entry.path, relativePath);
          if (analysisResult) {
            results.push(analysisResult);
          }
        }

        filesScanned++;
      }
    } catch (error) {
      console.warn(`⚠️ Error during file scanning: ${error instanceof Error ? error.message : String(error)}`);
    }

    return results;
  }

  /**
   * Analyze individual file for tech indicators
   */
  private async analyzeFile(filePath: string, relativePath: string): Promise<FileAnalysisResult | null> {
    try {
      const stat = await Deno.stat(filePath);

      // Skip large files to avoid performance issues
      if (stat.size > 1024 * 1024) { // 1MB limit
        return null;
      }

      let content = '';
      try {
        content = await Deno.readTextFile(filePath);
      } catch {
        // Skip files that can't be read as text
        return null;
      }

      const detectedTech = this.detectTechnologiesInFile(relativePath, content);
      const confidence = this.calculateFileConfidence(relativePath, content, detectedTech);
      const isConfigFile = this.isConfigurationFile(relativePath);
      const keyIndicators = this.extractKeyIndicators(relativePath, content);

      return {
        filePath: relativePath,
        detectedTech,
        confidence,
        fileSize: stat.size,
        isConfigFile,
        keyIndicators
      };

    } catch (error) {
      console.warn(`⚠️ Failed to analyze file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Detect technologies based on file path and content
   */
  private detectTechnologiesInFile(filePath: string, content: string): string[] {
    const technologies = new Set<string>();

    // Language detection by file extension
    const extension = this.getFileExtension(filePath);
    const languageByExtension = this.getLanguageByExtension(extension || '');
    if (languageByExtension) {
      technologies.add(languageByExtension);
    }

    // Framework detection by file name patterns
    const frameworks = this.detectFrameworksByFileName(filePath);
    frameworks.forEach(fw => technologies.add(fw));

    // Content-based detection
    const contentTechnologies = this.detectTechnologiesByContent(content);
    contentTechnologies.forEach(tech => technologies.add(tech));

    // Package manager detection
    const packageManagers = this.detectPackageManagers(filePath);
    packageManagers.forEach(pm => technologies.add(pm));

    return Array.from(technologies);
  }

  /**
   * Get language by file extension
   */
  private getLanguageByExtension(extension: string): string | null {
    const extensionMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'rs': 'rust',
      'go': 'go',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'kt': 'kotlin',
      'swift': 'swift',
      'cpp': 'cpp',
      'cxx': 'cpp',
      'cc': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'fs': 'fsharp',
      'php': 'php',
      'dart': 'dart',
      'lua': 'lua',
      'nim': 'nim',
      'zig': 'zig',
      'v': 'vlang',
      'cr': 'crystal'
    };

    return extensionMap[extension.toLowerCase()] || null;
  }

  /**
   * Detect frameworks by file name patterns
   */
  private detectFrameworksByFileName(filePath: string): string[] {
    const frameworks: string[] = [];
    const fileName = filePath.toLowerCase();

    // Web frameworks
    if (fileName.includes('package.json')) {
      frameworks.push('npm-ecosystem');
    }
    if (fileName.includes('deno.json') || fileName.includes('deno.jsonc')) {
      frameworks.push('deno');
    }
    if (fileName.includes('cargo.toml')) {
      frameworks.push('rust-cargo');
    }
    if (fileName.includes('go.mod')) {
      frameworks.push('go-modules');
    }
    if (fileName.includes('pom.xml') || fileName.includes('build.gradle')) {
      frameworks.push('jvm-build');
    }
    if (fileName.includes('docker') || fileName.includes('dockerfile')) {
      frameworks.push('docker');
    }
    if (fileName.includes('k8s') || fileName.includes('kubernetes')) {
      frameworks.push('kubernetes');
    }
    if (fileName.includes('terraform')) {
      frameworks.push('terraform');
    }
    if (fileName.includes('ansible')) {
      frameworks.push('ansible');
    }

    // Build systems
    if (fileName.includes('makefile')) {
      frameworks.push('make');
    }
    if (fileName.includes('cmake')) {
      frameworks.push('cmake');
    }
    if (fileName.includes('meson.build')) {
      frameworks.push('meson');
    }
    if (fileName.includes('nix')) {
      frameworks.push('nix');
    }

    return frameworks;
  }

  /**
   * Detect technologies by content analysis
   */
  private detectTechnologiesByContent(content: string): string[] {
    const technologies: string[] = [];
    const lowerContent = content.toLowerCase();

    // Framework detection by imports/dependencies
    if (lowerContent.includes('react') || lowerContent.includes('@types/react')) {
      technologies.push('react');
    }
    if (lowerContent.includes('vue') || lowerContent.includes('@vue')) {
      technologies.push('vue');
    }
    if (lowerContent.includes('angular') || lowerContent.includes('@angular')) {
      technologies.push('angular');
    }
    if (lowerContent.includes('svelte')) {
      technologies.push('svelte');
    }
    if (lowerContent.includes('fresh') || lowerContent.includes('$fresh')) {
      technologies.push('deno-fresh');
    }
    if (lowerContent.includes('next') || lowerContent.includes('nextjs')) {
      technologies.push('nextjs');
    }
    if (lowerContent.includes('nuxt')) {
      technologies.push('nuxt');
    }
    if (lowerContent.includes('astro')) {
      technologies.push('astro');
    }

    // Backend frameworks
    if (lowerContent.includes('express')) {
      technologies.push('express');
    }
    if (lowerContent.includes('axum')) {
      technologies.push('axum');
    }
    if (lowerContent.includes('actix')) {
      technologies.push('actix');
    }
    if (lowerContent.includes('gin-gonic') || lowerContent.includes('gorilla/mux')) {
      technologies.push('go-web');
    }
    if (lowerContent.includes('spring')) {
      technologies.push('spring');
    }
    if (lowerContent.includes('quarkus')) {
      technologies.push('quarkus');
    }

    // Databases
    if (lowerContent.includes('postgres') || lowerContent.includes('postgresql')) {
      technologies.push('postgresql');
    }
    if (lowerContent.includes('mysql')) {
      technologies.push('mysql');
    }
    if (lowerContent.includes('sqlite')) {
      technologies.push('sqlite');
    }
    if (lowerContent.includes('redis')) {
      technologies.push('redis');
    }
    if (lowerContent.includes('mongodb')) {
      technologies.push('mongodb');
    }

    // Testing frameworks
    if (lowerContent.includes('jest')) {
      technologies.push('jest');
    }
    if (lowerContent.includes('vitest')) {
      technologies.push('vitest');
    }
    if (lowerContent.includes('deno test') || lowerContent.includes('std/testing')) {
      technologies.push('deno-test');
    }
    if (lowerContent.includes('cargo test')) {
      technologies.push('rust-test');
    }

    return technologies;
  }

  /**
   * Detect package managers
   */
  private detectPackageManagers(filePath: string): string[] {
    const managers: string[] = [];
    const fileName = filePath.toLowerCase();

    if (fileName.includes('package.json') || fileName.includes('package-lock.json')) {
      managers.push('npm');
    }
    if (fileName.includes('yarn.lock')) {
      managers.push('yarn');
    }
    if (fileName.includes('pnpm-lock.yaml')) {
      managers.push('pnpm');
    }
    if (fileName.includes('deno.lock')) {
      managers.push('deno');
    }
    if (fileName.includes('cargo.toml') || fileName.includes('cargo.lock')) {
      managers.push('cargo');
    }
    if (fileName.includes('go.mod') || fileName.includes('go.sum')) {
      managers.push('go-mod');
    }
    if (fileName.includes('requirements.txt') || fileName.includes('pyproject.toml')) {
      managers.push('pip');
    }
    if (fileName.includes('gemfile')) {
      managers.push('bundler');
    }

    return managers;
  }

  /**
   * Aggregate tech stack data from all file analyses
   */
  private aggregateTechStackData(results: FileAnalysisResult[]): {
    primaryLanguage: string;
    secondaryLanguages: string[];
    buildTools: string[];
    frameworks: string[];
    packageManagers: string[];
    devTools: string[];
    infrastructure: string[];
  } {
    const languageFreq: Record<string, number> = {};
    const buildTools = new Set<string>();
    const frameworks = new Set<string>();
    const packageManagers = new Set<string>();
    const devTools = new Set<string>();
    const infrastructure = new Set<string>();

    // Process all detected technologies
    for (const result of results) {
      for (const tech of result.detectedTech) {
        const confidence = result.confidence[tech] || 0.5;

        if (this.isLanguage(tech)) {
          languageFreq[tech] = (languageFreq[tech] || 0) + confidence;
        } else if (this.isBuildTool(tech)) {
          buildTools.add(tech);
        } else if (this.isFramework(tech)) {
          frameworks.add(tech);
        } else if (this.isPackageManager(tech)) {
          packageManagers.add(tech);
        } else if (this.isDevTool(tech)) {
          devTools.add(tech);
        } else if (this.isInfrastructure(tech)) {
          infrastructure.add(tech);
        }
      }
    }

    // Determine primary and secondary languages
    const languageEntries = Object.entries(languageFreq).sort((a, b) => b[1] - a[1]);
    const primaryLanguage = languageEntries[0]?.[0] || 'unknown';
    const secondaryLanguages = languageEntries.slice(1).map(([lang]) => lang);

    return {
      primaryLanguage,
      secondaryLanguages,
      buildTools: Array.from(buildTools),
      frameworks: Array.from(frameworks),
      packageManagers: Array.from(packageManagers),
      devTools: Array.from(devTools),
      infrastructure: Array.from(infrastructure)
    };
  }

  /**
   * Technology classification helpers
   */
  private isLanguage(tech: string): boolean {
    const languages = ['typescript', 'javascript', 'rust', 'go', 'python', 'java', 'cpp', 'c', 'csharp', 'ruby', 'php', 'dart', 'kotlin', 'swift', 'lua', 'nim', 'zig', 'vlang', 'crystal'];
    return languages.includes(tech);
  }

  private isBuildTool(tech: string): boolean {
    const buildTools = ['make', 'cmake', 'meson', 'nix', 'rust-cargo', 'go-modules', 'jvm-build'];
    return buildTools.includes(tech);
  }

  private isFramework(tech: string): boolean {
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'deno-fresh', 'nextjs', 'nuxt', 'astro', 'express', 'axum', 'actix', 'go-web', 'spring', 'quarkus'];
    return frameworks.includes(tech);
  }

  private isPackageManager(tech: string): boolean {
    const packageManagers = ['npm', 'yarn', 'pnpm', 'deno', 'cargo', 'go-mod', 'pip', 'bundler'];
    return packageManagers.includes(tech);
  }

  private isDevTool(tech: string): boolean {
    const devTools = ['jest', 'vitest', 'deno-test', 'rust-test'];
    return devTools.includes(tech);
  }

  private isInfrastructure(tech: string): boolean {
    const infrastructure = ['docker', 'kubernetes', 'terraform', 'ansible', 'postgresql', 'mysql', 'sqlite', 'redis', 'mongodb'];
    return infrastructure.includes(tech);
  }

  /**
   * Calculate confidence score for file analysis
   */
  private calculateFileConfidence(filePath: string, content: string, detectedTech: string[]): Record<string, number> {
    const confidence: Record<string, number> = {};

    for (const tech of detectedTech) {
      let score = 0.5; // Base score

      // Higher confidence for configuration files
      if (this.isConfigurationFile(filePath)) {
        score += 0.3;
      }

      // Higher confidence for multiple indicators
      const indicators = this.countTechIndicators(tech, content);
      score += Math.min(indicators * 0.1, 0.3);

      // Ensure score is between 0 and 1
      confidence[tech] = Math.min(Math.max(score, 0), 1);
    }

    return confidence;
  }

  /**
   * Calculate overall confidence score for the analysis
   */
  private calculateConfidenceScore(results: FileAnalysisResult[], techStack: any): number {
    if (results.length === 0) return 0;

    let totalConfidence = 0;
    let totalTechs = 0;

    // Calculate average confidence across all technologies
    for (const result of results) {
      for (const [tech, confidence] of Object.entries(result.confidence)) {
        totalConfidence += confidence;
        totalTechs++;
      }
    }

    const averageConfidence = totalTechs > 0 ? totalConfidence / totalTechs : 0;

    // Boost confidence if we have a clear primary language
    if (techStack.primaryLanguage !== 'unknown') {
      return Math.min(averageConfidence + 0.2, 1);
    }

    return averageConfidence;
  }

  /**
   * Helper methods
   */
  private getFileExtension(filePath: string): string | null {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1] : null;
  }

  private isConfigurationFile(filePath: string): boolean {
    const configFiles = [
      'package.json', 'deno.json', 'deno.jsonc', 'cargo.toml', 'go.mod',
      'pom.xml', 'build.gradle', 'makefile', 'cmake', 'meson.build',
      'dockerfile', 'docker-compose', '.gitignore', 'flake.nix',
      'tsconfig.json', 'tailwind.config', 'vite.config', 'webpack.config'
    ];

    const fileName = filePath.toLowerCase();
    return configFiles.some(configFile => fileName.includes(configFile));
  }

  private countTechIndicators(tech: string, content: string): number {
    const lowerContent = content.toLowerCase();
    const techLower = tech.toLowerCase();

    // Count occurrences (simple implementation)
    const regex = new RegExp(techLower, 'gi');
    const matches = content.match(regex);
    return matches ? Math.min(matches.length, 10) : 0;
  }

  private extractKeyIndicators(filePath: string, content: string): string[] {
    const indicators: string[] = [];

    // Add file name as indicator if it's a config file
    if (this.isConfigurationFile(filePath)) {
      indicators.push(`config_file:${filePath}`);
    }

    // Extract import/require statements (simple regex)
    const importMatches = content.match(/(?:import|require|use)\s+[^\n]+/gi);
    if (importMatches) {
      indicators.push(...importMatches.slice(0, 5).map(match => `import:${match.trim()}`));
    }

    return indicators;
  }

  private getDetectionPatterns(): string[] {
    return [
      'file_extensions',
      'configuration_files',
      'import_statements',
      'package_managers',
      'framework_signatures',
      'build_tools'
    ];
  }
}