#!/usr/bin/env -S deno run --allow-all

/**
 * Template Discovery Phase Types
 *
 * Defines interfaces for tech stack detection, template matching,
 * and template-driven environment setup in the spec-driven pipeline.
 */

export interface TechStackAnalysis {
  /** Primary programming language detected (e.g., 'typescript', 'rust', 'go') */
  primaryLanguage: string;

  /** Secondary languages found in the repository */
  secondaryLanguages: string[];

  /** Build tools detected (e.g., 'deno', 'cargo', 'go-modules') */
  buildTools: string[];

  /** Frameworks and libraries identified */
  frameworks: string[];

  /** Package managers in use (e.g., 'npm', 'cargo', 'go-mod') */
  packageManagers: string[];

  /** Development tools found (e.g., 'prettier', 'eslint', 'clippy') */
  devTools: string[];

  /** Infrastructure-as-code detected (e.g., 'docker', 'k8s', 'terraform') */
  infrastructure: string[];

  /** Confidence score for the analysis (0-100) */
  confidence: number;

  /** Analysis metadata */
  analysisMetadata: {
    filesAnalyzed: number;
    scanDuration: number;
    detectionPatterns: string[];
  };
}

export interface Template {
  /** Unique template identifier */
  id: string;

  /** Human-readable template name */
  name: string;

  /** Template description and use cases */
  description: string;

  /** Path within the template repository */
  path: string;

  /** Technologies this template supports */
  techStack: {
    languages: string[];
    frameworks: string[];
    buildTools: string[];
    packageManagers: string[];
  };

  /** Template complexity level */
  complexity: 'simple' | 'intermediate' | 'advanced';

  /** Template tags for better matching */
  tags: string[];

  /** Template metadata */
  metadata: {
    lastUpdated: string;
    maintainer: string;
    documentation?: string;
  };
}

export interface TemplateMatch {
  /** The matched template */
  template: Template;

  /** Match score (0-100) */
  score: number;

  /** Reasons for the match */
  matchReasons: TemplateMatchReason[];

  /** Match type classification */
  matchType: 'exact' | 'close' | 'fallback';

  /** Confidence in this match */
  confidence: number;
}

export interface TemplateMatchReason {
  /** Type of match criterion */
  type: 'language' | 'framework' | 'build-tool' | 'complexity' | 'tag';

  /** Specific value that matched */
  value: string;

  /** Weight of this match factor */
  weight: number;

  /** Human-readable explanation */
  explanation: string;
}

export interface TemplateDiscoveryConfig {
  /** Template repository URL */
  templateRepository: string;

  /** Local cache directory for templates */
  cacheDirectory: string;

  /** Cache expiry time in hours */
  cacheExpiryHours: number;

  /** Minimum match score to consider viable */
  minimumMatchScore: number;

  /** Maximum number of template matches to return */
  maxMatches: number;

  /** Fallback template preferences */
  fallbackPreferences: {
    preferSimpleTemplates: boolean;
    fallbackToGeneric: boolean;
    genericTemplateId?: string;
  };

  /** Analysis configuration */
  analysisConfig: {
    maxFilesToScan: number;
    fileExtensionsToAnalyze: string[];
    ignorePaths: string[];
    analysisTimeoutSeconds: number;
  };
}

export interface TemplateDiscoveryResult {
  /** Whether template discovery was successful */
  success: boolean;

  /** Tech stack analysis results */
  techStackAnalysis: TechStackAnalysis;

  /** Template matches found */
  templateMatches: TemplateMatch[];

  /** Recommended template (best match) */
  recommendedTemplate?: Template;

  /** Fallback template if no good match */
  fallbackTemplate?: Template;

  /** Discovery execution metadata */
  discoveryMetadata: {
    executionTime: number;
    templatesEvaluated: number;
    cacheHit: boolean;
    discoveryTimestamp: string;
  };

  /** Any warnings or issues encountered */
  warnings: string[];

  /** Error details if discovery failed */
  error?: string;
}

export interface EnhancedEnvironmentSetup {
  /** Standard environment setup result */
  success: boolean;
  workspacePath: string;
  branchName: string;
  developmentReady: boolean;
  setupLog: string[];

  /** Template-enhanced setup details */
  templateSetup?: {
    templateUsed: Template;
    templateApplied: boolean;
    customizations: string[];
    additionalTools: string[];
    environmentEnhancements: string[];
  };
}

/**
 * Template repository structure for nix-flake-dev-templates
 */
export interface NixFlakeTemplate {
  /** Nix flake template name */
  name: string;

  /** Template description from flake.nix */
  description: string;

  /** Path to template directory */
  path: string;

  /** Nix flake outputs defined */
  outputs: string[];

  /** Development shell configuration */
  devShell: {
    packages: string[];
    environment: Record<string, string>;
    shellHook?: string;
  };

  /** Template-specific configuration */
  templateConfig?: {
    language: string;
    framework?: string;
    buildSystem: string;
    testFramework?: string;
  };
}

/**
 * Repository file analysis result for tech stack detection
 */
export interface FileAnalysisResult {
  /** File path relative to repository root */
  filePath: string;

  /** Detected language/technology from this file */
  detectedTech: string[];

  /** Confidence for each detection */
  confidence: Record<string, number>;

  /** File size in bytes */
  fileSize: number;

  /** Whether this file is likely a config/setup file */
  isConfigFile: boolean;

  /** Key indicators found in the file */
  keyIndicators: string[];
}

/**
 * Template matching algorithm configuration
 */
export interface MatchingAlgorithmConfig {
  /** Weights for different match criteria */
  weights: {
    primaryLanguage: number;
    secondaryLanguages: number;
    frameworks: number;
    buildTools: number;
    complexity: number;
    tags: number;
  };

  /** Scoring thresholds */
  thresholds: {
    exactMatch: number;      // 85-100
    closeMatch: number;      // 65-84
    fallbackMatch: number;   // 45-64
    noMatch: number;         // 0-44
  };

  /** Penalties for mismatches */
  penalties: {
    languageMismatch: number;
    complexityMismatch: number;
    missingFramework: number;
  };
}