#!/usr/bin/env -S deno run --allow-all

/**
 * Auto Implementation Decision Engine
 *
 * Intelligent decision system for automatically determining which bounties
 * should be implemented based on dynamic thresholds, risk assessment,
 * value analysis, and historical success patterns.
 */

import type { Bounty, BountyIndex } from '../../schemas/bounty-schema.ts';

export interface AutoImplementationDecision {
  shouldImplement: boolean;
  confidence: number; // 0-100
  reasoning: string[];
  thresholdUsed: number;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedSuccessRate: number; // 0-100
  decisionFactors: {
    valueScore: number;
    complexityScore: number;
    organizationHistoryScore: number;
    evaluationScore: number;
    overallScore: number;
  };
}

export interface OrganizationHistory {
  name: string;
  totalAttempts: number;
  successfulImplementations: number;
  successRate: number; // 0-100
  averageComplexity: number;
  totalValue: number;
  lastSuccessDate?: string;
}

export interface DecisionEngineConfig {
  // Base thresholds by value tiers
  valueThresholds: {
    tier1: { minValue: number; threshold: number }; // $500-$1000: 60%
    tier2: { minValue: number; threshold: number }; // $1000-$2500: 55%
    tier3: { minValue: number; threshold: number }; // $2500+: 50%
  };

  // Complexity adjustments
  complexityAdjustments: {
    low: { maxComplexity: number; bonusPoints: number }; // ≤4: +5 points
    medium: { maxComplexity: number; bonusPoints: number }; // 5-7: 0 points
    high: { maxComplexity: number; penaltyPoints: number }; // 8+: -10 points
  };

  // Organization history weighting
  historyWeighting: {
    minAttempts: number; // Minimum attempts before history matters
    successRateMultiplier: number; // How much to weight historical success
    maxAdjustment: number; // Maximum ±adjustment from history
  };

  // Risk tolerance
  riskTolerance: {
    conservative: number; // +15 points required
    moderate: number; // Base scoring
    aggressive: number; // -10 points allowed
  };

  // Quality gates
  minimumRequirements: {
    evaluationStatus: string; // Must be 'evaluated'
    goNoGoStatus: string; // Must be 'go'
    minConfidence: number; // Minimum evaluation confidence
  };
}

export class AutoImplementationDecisionEngine {
  private config: DecisionEngineConfig;
  private organizationHistory: Map<string, OrganizationHistory> = new Map();

  constructor(config?: Partial<DecisionEngineConfig>) {
    this.config = {
      valueThresholds: {
        tier1: { minValue: 50000, threshold: 60 }, // $500+
        tier2: { minValue: 100000, threshold: 55 }, // $1000+
        tier3: { minValue: 250000, threshold: 50 }, // $2500+
      },
      complexityAdjustments: {
        low: { maxComplexity: 4, bonusPoints: 5 },
        medium: { maxComplexity: 7, bonusPoints: 0 },
        high: { maxComplexity: 10, penaltyPoints: 10 },
      },
      historyWeighting: {
        minAttempts: 3,
        successRateMultiplier: 0.2, // 20% weight on historical success
        maxAdjustment: 10, // ±10 points max from history
      },
      riskTolerance: {
        conservative: 15, // +15 points required (more cautious)
        moderate: 0, // Base scoring
        aggressive: -10, // -10 points allowed (more risk-taking)
      },
      minimumRequirements: {
        evaluationStatus: 'evaluated',
        goNoGoStatus: 'go',
        minConfidence: 50, // Minimum 50% evaluation confidence
      },
      ...config,
    };
  }

  /**
   * Initialize organization history from bounty index
   */
  initializeOrganizationHistory(bountyIndex: BountyIndex): void {
    console.log('📊 Initializing organization history...');

    for (const org of bountyIndex.organizations) {
      const history: OrganizationHistory = {
        name: org.name,
        totalAttempts: 0,
        successfulImplementations: 0,
        successRate: 0,
        averageComplexity: 0,
        totalValue: 0,
      };

      let totalComplexity = 0;
      let complexityCount = 0;

      for (const bounty of org.bounties) {
        history.totalValue += bounty.reward.amount;

        if (bounty.internal?.implementation_status) {
          history.totalAttempts++;

          if (bounty.internal.implementation_status === 'completed' &&
              bounty.internal.implementation_result?.ready_for_submission) {
            history.successfulImplementations++;

            if (bounty.internal.implementation_completed_at) {
              history.lastSuccessDate = bounty.internal.implementation_completed_at;
            }
          }
        }

        if (bounty.internal?.complexity_score) {
          totalComplexity += bounty.internal.complexity_score;
          complexityCount++;
        }
      }

      history.successRate = history.totalAttempts > 0
        ? (history.successfulImplementations / history.totalAttempts) * 100
        : 0;

      history.averageComplexity = complexityCount > 0
        ? totalComplexity / complexityCount
        : 5; // Default to medium complexity

      this.organizationHistory.set(org.name, history);

      console.log(`   ${org.name}: ${history.totalAttempts} attempts, ${history.successRate.toFixed(1)}% success`);
    }
  }

  /**
   * Main decision method - determines if bounty should be auto-implemented
   */
  shouldAutoImplement(bounty: Bounty, riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'): AutoImplementationDecision {
    const reasoning: string[] = [];

    // Phase 1: Check minimum requirements
    const meetsMinimum = this.checkMinimumRequirements(bounty, reasoning);
    if (!meetsMinimum) {
      return {
        shouldImplement: false,
        confidence: 0,
        reasoning,
        thresholdUsed: 0,
        riskLevel: 'high',
        estimatedSuccessRate: 0,
        decisionFactors: {
          valueScore: 0,
          complexityScore: 0,
          organizationHistoryScore: 0,
          evaluationScore: 0,
          overallScore: 0,
        },
      };
    }

    // Phase 2: Calculate individual scores
    const valueScore = this.calculateValueScore(bounty, reasoning);
    const complexityScore = this.calculateComplexityScore(bounty, reasoning);
    const organizationHistoryScore = this.calculateOrganizationHistoryScore(bounty, reasoning);
    const evaluationScore = this.calculateEvaluationScore(bounty, reasoning);

    // Phase 3: Calculate overall score
    const baseScore = (valueScore + complexityScore + organizationHistoryScore + evaluationScore) / 4;
    const riskAdjustment = this.config.riskTolerance[riskTolerance];
    const overallScore = Math.max(0, Math.min(100, baseScore + riskAdjustment));

    // Phase 4: Determine threshold based on value tier
    const threshold = this.getValueBasedThreshold(bounty);

    // Phase 5: Make final decision
    const shouldImplement = overallScore >= threshold;
    const confidence = Math.min(100, overallScore);
    const riskLevel = this.calculateRiskLevel(bounty, overallScore);
    const estimatedSuccessRate = this.estimateSuccessRate(bounty, overallScore);

    if (shouldImplement) {
      reasoning.push(`✅ Decision: IMPLEMENT (score: ${overallScore.toFixed(1)} ≥ threshold: ${threshold})`);
    } else {
      reasoning.push(`❌ Decision: SKIP (score: ${overallScore.toFixed(1)} < threshold: ${threshold})`);
    }

    return {
      shouldImplement,
      confidence,
      reasoning,
      thresholdUsed: threshold,
      riskLevel,
      estimatedSuccessRate,
      decisionFactors: {
        valueScore,
        complexityScore,
        organizationHistoryScore,
        evaluationScore,
        overallScore,
      },
    };
  }

  /**
   * Check if bounty meets minimum requirements for consideration
   */
  private checkMinimumRequirements(bounty: Bounty, reasoning: string[]): boolean {
    const reqs = this.config.minimumRequirements;

    if (bounty.internal?.evaluation_status !== reqs.evaluationStatus) {
      reasoning.push(`❌ Not evaluated (status: ${bounty.internal?.evaluation_status || 'unknown'})`);
      return false;
    }

    if (bounty.internal?.go_no_go !== reqs.goNoGoStatus) {
      reasoning.push(`❌ Not GO-rated (rating: ${bounty.internal?.go_no_go || 'unknown'})`);
      return false;
    }

    const confidence = bounty.internal?.evaluation_confidence || 0;
    if (confidence < reqs.minConfidence) {
      reasoning.push(`❌ Low evaluation confidence (${confidence}% < ${reqs.minConfidence}%)`);
      return false;
    }

    // Check if already implemented
    if (bounty.internal?.implementation_status === 'completed') {
      reasoning.push(`❌ Already implemented`);
      return false;
    }

    reasoning.push(`✅ Meets minimum requirements`);
    return true;
  }

  /**
   * Calculate score based on bounty value
   */
  private calculateValueScore(bounty: Bounty, reasoning: string[]): number {
    const value = bounty.reward.amount;
    const valueDollars = value / 100; // Convert cents to dollars

    let score = 50; // Base score

    if (value >= this.config.valueThresholds.tier3.minValue) {
      score = 85; // High value
      reasoning.push(`💰 High value bounty: $${valueDollars} (score: 85)`);
    } else if (value >= this.config.valueThresholds.tier2.minValue) {
      score = 70; // Medium value
      reasoning.push(`💰 Medium value bounty: $${valueDollars} (score: 70)`);
    } else if (value >= this.config.valueThresholds.tier1.minValue) {
      score = 60; // Lower value but still viable
      reasoning.push(`💰 Lower value bounty: $${valueDollars} (score: 60)`);
    } else {
      score = 30; // Very low value
      reasoning.push(`💰 Very low value bounty: $${valueDollars} (score: 30)`);
    }

    return score;
  }

  /**
   * Calculate score based on complexity
   */
  private calculateComplexityScore(bounty: Bounty, reasoning: string[]): number {
    const complexity = bounty.internal?.complexity_score || 5;
    let score = 50; // Base score

    if (complexity <= this.config.complexityAdjustments.low.maxComplexity) {
      score = 70 + this.config.complexityAdjustments.low.bonusPoints;
      reasoning.push(`🎯 Low complexity (${complexity}): +${this.config.complexityAdjustments.low.bonusPoints} bonus (score: ${score})`);
    } else if (complexity <= this.config.complexityAdjustments.medium.maxComplexity) {
      score = 60 + this.config.complexityAdjustments.medium.bonusPoints;
      reasoning.push(`⚖️ Medium complexity (${complexity}): no adjustment (score: ${score})`);
    } else {
      score = 50 - this.config.complexityAdjustments.high.penaltyPoints;
      reasoning.push(`🔥 High complexity (${complexity}): -${this.config.complexityAdjustments.high.penaltyPoints} penalty (score: ${score})`);
    }

    return Math.max(0, score);
  }

  /**
   * Calculate score based on organization's historical success
   */
  private calculateOrganizationHistoryScore(bounty: Bounty, reasoning: string[]): number {
    const orgName = bounty.org?.name || 'unknown';
    const history = this.organizationHistory.get(orgName);

    let score = 50; // Default for no history

    if (!history || history.totalAttempts < this.config.historyWeighting.minAttempts) {
      reasoning.push(`📊 No significant history for ${orgName} (score: ${score})`);
      return score;
    }

    // Calculate adjustment based on success rate
    const successRateAdjustment = (history.successRate - 50) * this.config.historyWeighting.successRateMultiplier;
    const cappedAdjustment = Math.max(
      -this.config.historyWeighting.maxAdjustment,
      Math.min(this.config.historyWeighting.maxAdjustment, successRateAdjustment)
    );

    score = 50 + cappedAdjustment;

    reasoning.push(`📊 ${orgName} history: ${history.successRate.toFixed(1)}% success rate (${cappedAdjustment >= 0 ? '+' : ''}${cappedAdjustment.toFixed(1)} adjustment, score: ${score.toFixed(1)})`);

    return score;
  }

  /**
   * Calculate score based on evaluation quality
   */
  private calculateEvaluationScore(bounty: Bounty, reasoning: string[]): number {
    const successProbability = bounty.internal?.success_probability || 0;
    const evaluationConfidence = bounty.internal?.evaluation_confidence || 0;

    // Weight success probability more heavily than confidence
    const score = (successProbability * 0.7) + (evaluationConfidence * 0.3);

    reasoning.push(`📈 Evaluation: ${successProbability}% success probability, ${evaluationConfidence}% confidence (score: ${score.toFixed(1)})`);

    return score;
  }

  /**
   * Get value-based threshold for decision
   */
  private getValueBasedThreshold(bounty: Bounty): number {
    const value = bounty.reward.amount;

    if (value >= this.config.valueThresholds.tier3.minValue) {
      return this.config.valueThresholds.tier3.threshold;
    } else if (value >= this.config.valueThresholds.tier2.minValue) {
      return this.config.valueThresholds.tier2.threshold;
    } else {
      return this.config.valueThresholds.tier1.threshold;
    }
  }

  /**
   * Calculate risk level based on bounty characteristics
   */
  private calculateRiskLevel(bounty: Bounty, overallScore: number): 'low' | 'medium' | 'high' {
    const complexity = bounty.internal?.complexity_score || 5;
    const redFlags = bounty.internal?.red_flags?.length || 0;

    if (overallScore >= 75 && complexity <= 5 && redFlags === 0) {
      return 'low';
    } else if (overallScore >= 60 && complexity <= 7 && redFlags <= 2) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Estimate success rate based on all factors
   */
  private estimateSuccessRate(bounty: Bounty, overallScore: number): number {
    // Start with evaluation success probability
    let successRate = bounty.internal?.success_probability || 50;

    // Adjust based on organization history
    const orgName = bounty.org?.name || 'unknown';
    const history = this.organizationHistory.get(orgName);

    if (history && history.totalAttempts >= this.config.historyWeighting.minAttempts) {
      // Weight historical success rate
      successRate = (successRate * 0.7) + (history.successRate * 0.3);
    }

    // Adjust based on overall decision score
    const scoreAdjustment = (overallScore - 60) * 0.2; // Each point above/below 60 = ±0.2% success rate
    successRate += scoreAdjustment;

    return Math.max(0, Math.min(100, successRate));
  }

  /**
   * Get organization history for debugging
   */
  getOrganizationHistory(): Map<string, OrganizationHistory> {
    return this.organizationHistory;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }
}