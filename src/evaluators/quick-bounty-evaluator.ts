#!/usr/bin/env -S deno run --allow-all

/**
 * Quick Bounty Evaluator
 *
 * High-speed automated evaluator that focuses on the most predictive signals
 * for bounty viability. Designed to process bounties in 30-60 seconds vs
 * 5-15 minutes for traditional deep evaluation.
 */

import type { Bounty } from '../schemas/bounty-schema.ts';

export interface QuickEvaluationResult {
  go_no_go: 'go' | 'no-go' | 'caution';
  complexity_score: number; // 1-10
  success_probability: number; // 0-100
  risk_level: 'low' | 'medium' | 'high';
  red_flags: string[];
  estimated_timeline: string;
  notes: string;
  confidence: number; // 0-100, how confident we are in this quick evaluation
  evaluation_duration: number; // milliseconds
}

export class QuickBountyEvaluator {

  /**
   * Perform quick evaluation focusing on high-signal indicators
   */
  async evaluateQuickly(bounty: Bounty): Promise<QuickEvaluationResult> {
    const startTime = performance.now();

    console.log(`⚡ Quick evaluation: ${bounty.task.title} ($${bounty.reward.amount/100})`);

    // Step 1: Parse basic indicators from issue text
    const basicAnalysis = this.analyzeIssueText(bounty.task.title, bounty.task.body);

    // Step 2: Check for immediate disqualifiers
    const redFlags = this.identifyRedFlags(bounty);

    // Step 3: Calculate complexity based on textual indicators
    const complexityScore = this.calculateComplexity(basicAnalysis, redFlags);

    // Step 4: Determine success probability
    const successProbability = this.calculateSuccessProbability(complexityScore, redFlags, bounty.reward.amount);

    // Step 5: Make go/no-go decision
    const goNoGo = this.makeDecision(complexityScore, successProbability, redFlags);

    // Step 6: Estimate timeline
    const timeline = this.estimateTimeline(complexityScore, basicAnalysis);

    const evaluationDuration = performance.now() - startTime;

    return {
      go_no_go: goNoGo,
      complexity_score: complexityScore,
      success_probability: successProbability,
      risk_level: this.calculateRiskLevel(redFlags, complexityScore),
      red_flags: redFlags,
      estimated_timeline: timeline,
      notes: this.generateNotes(basicAnalysis, redFlags),
      confidence: this.calculateConfidence(basicAnalysis, redFlags),
      evaluation_duration: evaluationDuration
    };
  }

  /**
   * Analyze issue title and body for key indicators
   */
  private analyzeIssueText(title: string, body: string): {
    hasCodeExamples: boolean;
    hasSpecificRequirements: boolean;
    isWellDefined: boolean;
    mentionsIntegration: boolean;
    mentionsArchitecture: boolean;
    hasSubjectiveCriteria: boolean;
    estimatedWordCount: number;
  } {
    const fullText = `${title} ${body}`.toLowerCase();

    return {
      hasCodeExamples: /```|`[^`]+`|example|sample/.test(fullText),
      hasSpecificRequirements: /should|must|require|need to|implement|add|create/.test(fullText),
      isWellDefined: body.length > 200 && /step|todo|list|bullet/.test(fullText),
      mentionsIntegration: /integrat|pipeline|system|phase|workflow|connect/.test(fullText),
      mentionsArchitecture: /architect|design|structure|refactor|redesign/.test(fullText),
      hasSubjectiveCriteria: /aesthetic|clean|optimal|nice|better|improve|enhance/.test(fullText),
      estimatedWordCount: fullText.split(/\s+/).length
    };
  }

  /**
   * Identify critical red flags that indicate high-risk bounties
   */
  private identifyRedFlags(bounty: Bounty): string[] {
    const redFlags: string[] = [];
    const fullText = `${bounty.task.title} ${bounty.task.body}`.toLowerCase();

    // Critical disqualifiers
    if (/somehow|possibly|maybe|probably|might/.test(fullText)) {
      redFlags.push("Vague requirements with uncertainty indicators");
    }

    if (/multiple.*repo|across.*repo|several.*repo/.test(fullText)) {
      redFlags.push("Multi-repository integration required");
    }

    if (/domain.*expert|specialist|advanced.*knowledge|deep.*understanding/.test(fullText)) {
      redFlags.push("Requires domain expertise");
    }

    if (/coordination|collaborate|work.*with.*maintainer/.test(fullText)) {
      redFlags.push("Requires maintainer coordination");
    }

    // High-risk indicators
    if (/aesthetic|beautiful|clean.*look|visually/.test(fullText)) {
      redFlags.push("Subjective aesthetic criteria");
    }

    if (/phase|pipeline|workflow|system.*design/.test(fullText)) {
      redFlags.push("System architecture changes required");
    }

    if (bounty.task.body.length < 100) {
      redFlags.push("Insufficient requirement details");
    }

    if (bounty.reward.amount < 1000 && /implement|create|build|develop/.test(fullText)) {
      redFlags.push("Low reward for implementation task");
    }

    return redFlags;
  }

  /**
   * Calculate complexity score based on analysis
   */
  private calculateComplexity(analysis: any, redFlags: string[]): number {
    let complexity = 3; // Base complexity

    // Increase complexity for various factors
    if (!analysis.hasSpecificRequirements) complexity += 2;
    if (!analysis.isWellDefined) complexity += 2;
    if (analysis.mentionsIntegration) complexity += 2;
    if (analysis.mentionsArchitecture) complexity += 3;
    if (analysis.hasSubjectiveCriteria) complexity += 2;

    // Red flags add complexity
    complexity += redFlags.length;

    // Decrease complexity for well-defined tasks
    if (analysis.hasCodeExamples) complexity -= 1;
    if (analysis.estimatedWordCount > 300) complexity -= 1;

    return Math.min(Math.max(complexity, 1), 10);
  }

  /**
   * Calculate success probability
   */
  private calculateSuccessProbability(complexity: number, redFlags: string[], rewardAmount: number): number {
    let probability = 70; // Base probability

    // Adjust based on complexity
    probability -= (complexity - 3) * 8; // Each complexity point above 3 reduces by 8%

    // Critical red flags significantly reduce probability
    const criticalRedFlags = redFlags.filter(flag =>
      flag.includes("Vague requirements") ||
      flag.includes("Multi-repository") ||
      flag.includes("domain expertise")
    );
    probability -= criticalRedFlags.length * 25;

    // Other red flags reduce moderately
    const otherRedFlags = redFlags.length - criticalRedFlags.length;
    probability -= otherRedFlags * 10;

    // Higher rewards can offset some risks
    if (rewardAmount >= 5000) probability += 10;
    if (rewardAmount >= 10000) probability += 5;

    return Math.min(Math.max(probability, 0), 100);
  }

  /**
   * Make go/no-go decision
   */
  private makeDecision(complexity: number, successProbability: number, redFlags: string[]): 'go' | 'no-go' | 'caution' {
    // Automatic no-go for critical red flags
    const criticalFlags = redFlags.filter(flag =>
      flag.includes("Multi-repository") ||
      flag.includes("domain expertise") ||
      flag.includes("maintainer coordination")
    );

    if (criticalFlags.length > 0) return 'no-go';

    // More aggressive thresholds for demonstration
    if (successProbability >= 50) return 'go';
    if (successProbability >= 30) return 'caution';
    return 'no-go';
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(redFlags: string[], complexity: number): 'low' | 'medium' | 'high' {
    if (redFlags.length >= 3 || complexity >= 8) return 'high';
    if (redFlags.length >= 1 || complexity >= 6) return 'medium';
    return 'low';
  }

  /**
   * Estimate implementation timeline
   */
  private estimateTimeline(complexity: number, analysis: any): string {
    const baseHours = complexity * 4; // 4 hours per complexity point

    // Adjust based on analysis
    let hours = baseHours;
    if (!analysis.isWellDefined) hours *= 1.5;
    if (analysis.mentionsArchitecture) hours *= 1.8;
    if (analysis.hasCodeExamples) hours *= 0.8;

    if (hours <= 8) return `${Math.round(hours)} hours`;
    if (hours <= 40) return `${Math.round(hours / 8)} days`;
    return `${Math.round(hours / 40)} weeks`;
  }

  /**
   * Generate evaluation notes
   */
  private generateNotes(analysis: any, redFlags: string[]): string {
    const notes: string[] = [];

    if (analysis.isWellDefined) {
      notes.push("Requirements appear well-defined");
    } else {
      notes.push("Requirements need clarification");
    }

    if (analysis.hasCodeExamples) {
      notes.push("Code examples provided");
    }

    if (redFlags.length === 0) {
      notes.push("No major red flags identified");
    } else {
      notes.push(`${redFlags.length} risk factors identified`);
    }

    notes.push("Quick evaluation - consider deeper analysis for high-value bounties");

    return notes.join(". ");
  }

  /**
   * Calculate confidence in the quick evaluation
   */
  private calculateConfidence(analysis: any, redFlags: string[]): number {
    let confidence = 60; // Base confidence for quick evaluation

    // Higher confidence for well-defined issues
    if (analysis.isWellDefined) confidence += 15;
    if (analysis.hasCodeExamples) confidence += 10;
    if (analysis.hasSpecificRequirements) confidence += 10;

    // Lower confidence for complex situations
    if (analysis.hasSubjectiveCriteria) confidence -= 15;
    if (analysis.mentionsArchitecture) confidence -= 10;

    // Red flags reduce confidence
    confidence -= redFlags.length * 5;

    return Math.min(Math.max(confidence, 20), 85); // Cap between 20-85%
  }
}