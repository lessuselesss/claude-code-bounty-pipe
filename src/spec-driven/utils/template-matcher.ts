#!/usr/bin/env -S deno run --allow-all

/**
 * Template Matcher
 *
 * Uses Claude SDK to intelligently match repository tech stacks to optimal
 * development templates from the nix-flake-dev-templates repository.
 */

import { query } from 'npm:@anthropic-ai/claude-code@latest';
import type {
  TechStackAnalysis,
  Template,
  TemplateMatch,
  TemplateMatchReason,
  MatchingAlgorithmConfig,
  TemplateDiscoveryConfig
} from '../types/template-types.ts';

export class TemplateMatcher {
  private config: TemplateDiscoveryConfig;
  private matchingConfig: MatchingAlgorithmConfig;

  constructor(config: TemplateDiscoveryConfig) {
    this.config = config;
    this.matchingConfig = this.getDefaultMatchingConfig();
  }

  /**
   * Find the best template matches for a given tech stack using Claude SDK
   */
  async findTemplateMatches(
    techStackAnalysis: TechStackAnalysis,
    availableTemplates: Template[],
    repositoryContext?: string
  ): Promise<TemplateMatch[]> {

    console.log(`🎯 Finding template matches for: ${techStackAnalysis.primaryLanguage} (${techStackAnalysis.confidence}% confidence)`);

    try {
      // Use Claude SDK for intelligent template matching
      const matches = await this.performIntelligentMatching(
        techStackAnalysis,
        availableTemplates,
        repositoryContext
      );

      // Apply algorithmic ranking and validation
      const rankedMatches = this.rankAndValidateMatches(matches, techStackAnalysis);

      // Limit to configured maximum
      const finalMatches = rankedMatches.slice(0, this.config.maxMatches);

      console.log(`✅ Found ${finalMatches.length} viable template matches`);
      finalMatches.forEach(match => {
        console.log(`   🎯 ${match.template.name} (${match.score}/100) - ${match.matchType}`);
      });

      return finalMatches;

    } catch (error) {
      console.error(`❌ Template matching failed: ${error instanceof Error ? error.message : String(error)}`);

      // Fallback to algorithmic matching if Claude SDK fails
      return this.performFallbackMatching(techStackAnalysis, availableTemplates);
    }
  }

  /**
   * Use Claude SDK for intelligent template analysis and matching
   */
  private async performIntelligentMatching(
    techStackAnalysis: TechStackAnalysis,
    availableTemplates: Template[],
    repositoryContext?: string
  ): Promise<TemplateMatch[]> {

    const matchingPrompt = `
You are a development environment expert specializing in template selection for optimal developer experience.

REPOSITORY TECH STACK ANALYSIS:
- Primary Language: ${techStackAnalysis.primaryLanguage} (${techStackAnalysis.confidence}% confidence)
- Secondary Languages: ${techStackAnalysis.secondaryLanguages.join(', ') || 'None'}
- Frameworks: ${techStackAnalysis.frameworks.join(', ') || 'None detected'}
- Build Tools: ${techStackAnalysis.buildTools.join(', ') || 'None detected'}
- Package Managers: ${techStackAnalysis.packageManagers.join(', ') || 'None detected'}
- Dev Tools: ${techStackAnalysis.devTools.join(', ') || 'None detected'}
- Infrastructure: ${techStackAnalysis.infrastructure.join(', ') || 'None detected'}

${repositoryContext ? `REPOSITORY CONTEXT:\n${repositoryContext}\n` : ''}

AVAILABLE TEMPLATES:
${availableTemplates.map((template, idx) => `
${idx + 1}. ${template.name}
   Path: ${template.path}
   Description: ${template.description}
   Languages: ${template.techStack.languages.join(', ')}
   Frameworks: ${template.techStack.frameworks.join(', ')}
   Build Tools: ${template.techStack.buildTools.join(', ')}
   Package Managers: ${template.techStack.packageManagers.join(', ')}
   Complexity: ${template.complexity}
   Tags: ${template.tags.join(', ')}
`).join('')}

TEMPLATE MATCHING REQUIREMENTS:

1. ANALYZE COMPATIBILITY
   - Match primary language requirements
   - Consider framework and build tool alignment
   - Evaluate complexity appropriateness
   - Assess infrastructure compatibility

2. SCORE EACH TEMPLATE (0-100)
   - 90-100: Perfect match (language + framework + build system)
   - 75-89: Excellent match (language + most requirements)
   - 60-74: Good match (language + some requirements)
   - 45-59: Fair match (language compatible, missing features)
   - 30-44: Poor match (major gaps or incompatibilities)
   - 0-29: Incompatible

3. CLASSIFY MATCH TYPE
   - "exact": Perfect alignment of language, framework, and build tools
   - "close": Good language match with mostly compatible tooling
   - "fallback": Basic language support but missing specific requirements

4. PROVIDE MATCH REASONING
   For each viable template (score ≥ ${this.config.minimumMatchScore}), explain:
   - Why this template matches the tech stack
   - What specific technologies align
   - Any gaps or limitations
   - Recommended customizations

RETURN ANALYSIS:
Return a structured analysis with template matches ranked by compatibility score.
Focus on templates that will provide the best developer experience for this specific tech stack.

Prioritize templates that match:
- Primary programming language
- Key frameworks and build tools
- Development workflow patterns
- Infrastructure requirements

Be specific about match reasoning and highlight any potential issues or missing capabilities.
`;

    let response = '';
    for await (const message of query({
      prompt: matchingPrompt,
      options: {
        model: 'claude-3-5-sonnet-20241022',
        allowedTools: [],
        maxTurns: 1
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

    // Parse Claude's response into structured TemplateMatch objects
    return this.parseClaudeMatchingResponse(response, availableTemplates, techStackAnalysis);
  }

  /**
   * Parse Claude's template matching response into structured data
   */
  private parseClaudeMatchingResponse(
    response: string,
    availableTemplates: Template[],
    techStackAnalysis: TechStackAnalysis
  ): TemplateMatch[] {
    const matches: TemplateMatch[] = [];

    try {
      // Extract template matches from Claude's response using regex patterns
      const templateMatches = this.extractTemplateMatchesFromResponse(response, availableTemplates);

      for (const matchData of templateMatches) {
        const template = availableTemplates.find(t =>
          t.name.toLowerCase().includes(matchData.templateName.toLowerCase()) ||
          matchData.templateName.toLowerCase().includes(t.name.toLowerCase())
        );

        if (template) {
          const match: TemplateMatch = {
            template,
            score: matchData.score,
            matchReasons: matchData.reasons,
            matchType: this.determineMatchType(matchData.score),
            confidence: this.calculateMatchConfidence(matchData.score, techStackAnalysis.confidence)
          };

          matches.push(match);
        }
      }

      return matches.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.warn(`⚠️ Failed to parse Claude response, falling back to algorithmic matching: ${error instanceof Error ? error.message : String(error)}`);
      return this.performFallbackMatching(techStackAnalysis, availableTemplates);
    }
  }

  /**
   * Extract template match data from Claude's response
   */
  private extractTemplateMatchesFromResponse(response: string, availableTemplates: Template[]): Array<{
    templateName: string;
    score: number;
    reasons: TemplateMatchReason[];
  }> {
    const matches: Array<{
      templateName: string;
      score: number;
      reasons: TemplateMatchReason[];
    }> = [];

    // Look for score patterns like "85/100", "Score: 92", etc.
    const scorePattern = /(?:score[:\s]*|rating[:\s]*)?(\d{1,3})(?:\/100|%)?/gi;
    const templateNamePattern = /(?:template|match)[:\s]*([^.\n]+)/gi;

    // Split response into sections for each template
    const sections = response.split(/\d+\.\s+/).filter(section => section.trim().length > 0);

    for (const section of sections) {
      // Extract template name
      const templateNameMatch = section.match(/^([^:\n]+)/);
      const templateName = templateNameMatch?.[1]?.trim() || '';

      if (!templateName) continue;

      // Extract score
      const scoreMatch = section.match(scorePattern);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

      // Skip low scores
      if (score < this.config.minimumMatchScore) continue;

      // Extract reasons (simple implementation)
      const reasons = this.extractMatchReasons(section, templateName);

      matches.push({
        templateName,
        score: Math.min(score, 100),
        reasons
      });
    }

    return matches;
  }

  /**
   * Extract match reasons from section text
   */
  private extractMatchReasons(sectionText: string, templateName: string): TemplateMatchReason[] {
    const reasons: TemplateMatchReason[] = [];
    const lowerText = sectionText.toLowerCase();

    // Common reason patterns
    const reasonPatterns = [
      { pattern: /language.*match/i, type: 'language' as const, weight: 0.4 },
      { pattern: /framework.*compatible/i, type: 'framework' as const, weight: 0.3 },
      { pattern: /build.*tool/i, type: 'build-tool' as const, weight: 0.2 },
      { pattern: /complexity.*appropriate/i, type: 'complexity' as const, weight: 0.1 }
    ];

    for (const { pattern, type, weight } of reasonPatterns) {
      if (pattern.test(sectionText)) {
        reasons.push({
          type,
          value: templateName,
          weight,
          explanation: `Template ${templateName} provides ${type} compatibility`
        });
      }
    }

    // Ensure at least one reason exists
    if (reasons.length === 0) {
      reasons.push({
        type: 'tag',
        value: templateName,
        weight: 0.5,
        explanation: `Template ${templateName} identified as compatible by analysis`
      });
    }

    return reasons;
  }

  /**
   * Fallback algorithmic matching when Claude SDK is unavailable
   */
  private performFallbackMatching(
    techStackAnalysis: TechStackAnalysis,
    availableTemplates: Template[]
  ): TemplateMatch[] {
    console.log(`⚠️ Using fallback algorithmic template matching`);

    const matches: TemplateMatch[] = [];

    for (const template of availableTemplates) {
      const score = this.calculateAlgorithmicScore(techStackAnalysis, template);

      if (score >= this.config.minimumMatchScore) {
        const match: TemplateMatch = {
          template,
          score,
          matchReasons: this.generateAlgorithmicReasons(techStackAnalysis, template),
          matchType: this.determineMatchType(score),
          confidence: this.calculateMatchConfidence(score, techStackAnalysis.confidence)
        };

        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, this.config.maxMatches);
  }

  /**
   * Calculate algorithmic compatibility score
   */
  private calculateAlgorithmicScore(techStack: TechStackAnalysis, template: Template): number {
    let score = 0;

    // Primary language match (40% weight)
    if (template.techStack.languages.includes(techStack.primaryLanguage)) {
      score += 40;
    } else if (techStack.secondaryLanguages.some(lang => template.techStack.languages.includes(lang))) {
      score += 20;
    }

    // Framework matches (30% weight)
    const frameworkMatches = techStack.frameworks.filter(fw =>
      template.techStack.frameworks.includes(fw)
    ).length;
    score += Math.min(frameworkMatches * 10, 30);

    // Build tool matches (20% weight)
    const buildToolMatches = techStack.buildTools.filter(tool =>
      template.techStack.buildTools.includes(tool)
    ).length;
    score += Math.min(buildToolMatches * 10, 20);

    // Package manager matches (10% weight)
    const packageManagerMatches = techStack.packageManagers.filter(pm =>
      template.techStack.packageManagers.includes(pm)
    ).length;
    score += Math.min(packageManagerMatches * 5, 10);

    // Apply tech stack confidence factor
    score = score * (techStack.confidence / 100);

    return Math.round(Math.min(score, 100));
  }

  /**
   * Generate algorithmic match reasons
   */
  private generateAlgorithmicReasons(techStack: TechStackAnalysis, template: Template): TemplateMatchReason[] {
    const reasons: TemplateMatchReason[] = [];

    // Language match
    if (template.techStack.languages.includes(techStack.primaryLanguage)) {
      reasons.push({
        type: 'language',
        value: techStack.primaryLanguage,
        weight: 0.4,
        explanation: `Primary language ${techStack.primaryLanguage} is supported`
      });
    }

    // Framework matches
    const frameworkMatches = techStack.frameworks.filter(fw =>
      template.techStack.frameworks.includes(fw)
    );
    for (const framework of frameworkMatches.slice(0, 2)) {
      reasons.push({
        type: 'framework',
        value: framework,
        weight: 0.15,
        explanation: `Framework ${framework} is supported`
      });
    }

    // Build tool matches
    const buildToolMatches = techStack.buildTools.filter(tool =>
      template.techStack.buildTools.includes(tool)
    );
    for (const tool of buildToolMatches.slice(0, 2)) {
      reasons.push({
        type: 'build-tool',
        value: tool,
        weight: 0.1,
        explanation: `Build tool ${tool} is supported`
      });
    }

    return reasons;
  }

  /**
   * Rank and validate template matches
   */
  private rankAndValidateMatches(
    matches: TemplateMatch[],
    techStackAnalysis: TechStackAnalysis
  ): TemplateMatch[] {
    // Sort by score and confidence
    return matches
      .filter(match => match.score >= this.config.minimumMatchScore)
      .sort((a, b) => {
        // Primary sort by score
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Secondary sort by confidence
        return b.confidence - a.confidence;
      });
  }

  /**
   * Determine match type based on score
   */
  private determineMatchType(score: number): 'exact' | 'close' | 'fallback' {
    if (score >= this.matchingConfig.thresholds.exactMatch) return 'exact';
    if (score >= this.matchingConfig.thresholds.closeMatch) return 'close';
    return 'fallback';
  }

  /**
   * Calculate match confidence combining score and tech stack confidence
   */
  private calculateMatchConfidence(score: number, techStackConfidence: number): number {
    return Math.round((score / 100) * (techStackConfidence / 100) * 100);
  }

  /**
   * Get default matching algorithm configuration
   */
  private getDefaultMatchingConfig(): MatchingAlgorithmConfig {
    return {
      weights: {
        primaryLanguage: 0.4,
        secondaryLanguages: 0.1,
        frameworks: 0.3,
        buildTools: 0.2,
        complexity: 0.05,
        tags: 0.05
      },
      thresholds: {
        exactMatch: 85,
        closeMatch: 65,
        fallbackMatch: 45,
        noMatch: 30
      },
      penalties: {
        languageMismatch: -20,
        complexityMismatch: -10,
        missingFramework: -15
      }
    };
  }
}