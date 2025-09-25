#!/usr/bin/env -S deno run --allow-all

/**
 * Pipeline Analytics Engine
 *
 * Real-time monitoring and analytics system for the auto-implementation
 * pipeline. Tracks performance metrics, success rates, bottlenecks,
 * cost analysis, and provides optimization recommendations.
 */

import type { Bounty, BountyIndex } from '../../schemas/bounty-schema.ts';
import type { AutoImplementationDecision } from '../decision-engines/auto-implementation-decision-engine.ts';
import type { QualityGateResult } from '../quality-gates/quality-assurance-engine.ts';

export interface PipelineMetrics {
  timestamp: string;
  session_id: string;
  total_runtime: number; // milliseconds
  bounties_processed: number;

  // Decision metrics
  decisions: {
    total_evaluated: number;
    go_decisions: number;
    caution_decisions: number;
    no_go_decisions: number;
    average_confidence: number;
    average_threshold_used: number;
  };

  // Implementation metrics
  implementations: {
    attempted: number;
    successful: number;
    failed: number;
    success_rate: number;
    average_duration: number; // milliseconds per implementation
    total_cost_estimate: number; // Claude Code SDK usage estimate
  };

  // Quality metrics
  quality_gates: {
    enabled: boolean;
    total_checked: number;
    passed: number;
    failed: number;
    average_score: number;
    common_blockers: string[];
  };

  // Performance metrics
  performance: {
    evaluations_per_minute: number;
    implementations_per_hour: number;
    parallel_efficiency: number; // 0-100%
    bottlenecks: string[];
  };

  // Value metrics
  value_analysis: {
    total_bounty_value: number;
    successfully_implemented_value: number;
    roi_estimate: number; // Return on investment estimate
    average_bounty_value: number;
    value_distribution: {
      low: number;    // < $500
      medium: number; // $500-$2500
      high: number;   // > $2500
    };
  };

  // CLAUDE.md generation metrics
  claude_markdown_generation?: {
    processed: number;
    generated: number;
    success_rate: number;
    timeouts: number;
    errors: number;
    execution_time: number;
  };
}

export interface AnalyticsConfig {
  trackPerformance: boolean;
  trackCosts: boolean;
  trackQualityMetrics: boolean;
  enableRealtimeLogging: boolean;
  saveMetricsToFile: boolean;
  metricsOutputPath: string;
}

export class PipelineAnalytics {
  private config: AnalyticsConfig;
  private sessionId: string;
  private sessionStartTime: number;
  private metrics: Partial<PipelineMetrics> = {};

  // Real-time tracking arrays
  private decisions: AutoImplementationDecision[] = [];
  private implementationTimes: number[] = [];
  private qualityResults: QualityGateResult[] = [];
  private processedBounties: Bounty[] = [];

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      trackPerformance: true,
      trackCosts: true,
      trackQualityMetrics: true,
      enableRealtimeLogging: true,
      saveMetricsToFile: true,
      metricsOutputPath: '../output/analytics/',
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();

    console.log(`📊 Analytics enabled - Session ID: ${this.sessionId}`);
  }

  /**
   * Track a bounty decision
   */
  trackDecision(bounty: Bounty, decision: AutoImplementationDecision): void {
    this.decisions.push(decision);
    this.processedBounties.push(bounty);

    if (this.config.enableRealtimeLogging) {
      console.log(`📈 Decision tracked: ${bounty.task.title} -> ${decision.shouldImplement ? 'IMPLEMENT' : 'SKIP'} (${decision.confidence}%)`);
    }
  }

  /**
   * Track implementation start
   */
  trackImplementationStart(bounty: Bounty): string {
    const trackingId = `impl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (this.config.enableRealtimeLogging) {
      console.log(`🚀 Implementation started: ${bounty.task.title} [${trackingId}]`);
    }

    return trackingId;
  }

  /**
   * Track implementation completion
   */
  trackImplementationComplete(trackingId: string, bounty: Bounty, duration: number, success: boolean): void {
    this.implementationTimes.push(duration);

    if (this.config.enableRealtimeLogging) {
      const status = success ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`📊 Implementation complete: ${bounty.task.title} -> ${status} (${Math.round(duration/1000)}s) [${trackingId}]`);
    }
  }

  /**
   * Track quality gate results
   */
  trackQualityGates(bounty: Bounty, qualityResult: QualityGateResult): void {
    if (!this.config.trackQualityMetrics) return;

    this.qualityResults.push(qualityResult);

    if (this.config.enableRealtimeLogging) {
      const status = qualityResult.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`🔍 Quality gates: ${bounty.task.title} -> ${status} (${qualityResult.score}/100)`);
    }
  }

  /**
   * Track CLAUDE.md generation results
   */
  trackClaudeMarkdownGeneration(metrics: {
    processed: number;
    generated: number;
    timeouts: number;
    errors: number;
    executionTime: number;
    successRate: number;
  }): void {
    if (this.config.enableRealtimeLogging) {
      console.log(`📝 CLAUDE.md Analytics: ${metrics.generated}/${metrics.processed} generated (${(metrics.successRate * 100).toFixed(1)}%) in ${(metrics.executionTime / 1000).toFixed(1)}s`);
      if (metrics.timeouts > 0) {
        console.log(`⏱️ CLAUDE.md Timeouts: ${metrics.timeouts} operations timed out`);
      }
      if (metrics.errors > 0) {
        console.log(`❌ CLAUDE.md Errors: ${metrics.errors} generation failures`);
      }
    }

    // Store metrics for reporting
    this.sessionMetrics.claude_markdown_generation = {
      processed: metrics.processed,
      generated: metrics.generated,
      success_rate: metrics.successRate,
      timeouts: metrics.timeouts,
      errors: metrics.errors,
      execution_time: metrics.executionTime
    };
  }

  /**
   * Generate comprehensive metrics report
   */
  generateMetrics(): PipelineMetrics {
    const runtime = Date.now() - this.sessionStartTime;
    const runtimeMinutes = runtime / 60000;

    // Decision metrics
    const goDecisions = this.decisions.filter(d => d.shouldImplement).length;
    const cautionDecisions = this.decisions.filter(d => !d.shouldImplement && d.confidence >= 30).length;
    const noGoDecisions = this.decisions.filter(d => !d.shouldImplement && d.confidence < 30).length;
    const avgConfidence = this.decisions.length > 0
      ? this.decisions.reduce((sum, d) => sum + d.confidence, 0) / this.decisions.length
      : 0;
    const avgThreshold = this.decisions.length > 0
      ? this.decisions.reduce((sum, d) => sum + d.thresholdUsed, 0) / this.decisions.length
      : 0;

    // Implementation metrics
    const successfulImplementations = this.processedBounties.filter(
      b => b.internal?.implementation_status === 'completed' &&
           b.internal?.implementation_result?.ready_for_submission
    ).length;

    const failedImplementations = this.processedBounties.filter(
      b => b.internal?.implementation_status === 'failed'
    ).length;

    const attemptedImplementations = successfulImplementations + failedImplementations;
    const successRate = attemptedImplementations > 0 ? (successfulImplementations / attemptedImplementations) * 100 : 0;
    const avgImplementationDuration = this.implementationTimes.length > 0
      ? this.implementationTimes.reduce((sum, time) => sum + time, 0) / this.implementationTimes.length
      : 0;

    // Quality metrics
    const qualityPassed = this.qualityResults.filter(q => q.passed).length;
    const qualityFailed = this.qualityResults.filter(q => !q.passed).length;
    const avgQualityScore = this.qualityResults.length > 0
      ? this.qualityResults.reduce((sum, q) => sum + q.score, 0) / this.qualityResults.length
      : 0;

    // Extract common blockers
    const allBlockers = this.qualityResults.flatMap(q => q.blockers);
    const blockerCounts = allBlockers.reduce((counts, blocker) => {
      counts[blocker] = (counts[blocker] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const commonBlockers = Object.entries(blockerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([blocker]) => blocker);

    // Value analysis
    const totalValue = this.processedBounties.reduce((sum, b) => sum + b.reward.amount, 0);
    const successfulValue = this.processedBounties
      .filter(b => b.internal?.implementation_status === 'completed' &&
                   b.internal?.implementation_result?.ready_for_submission)
      .reduce((sum, b) => sum + b.reward.amount, 0);

    const avgBountyValue = this.processedBounties.length > 0 ? totalValue / this.processedBounties.length : 0;

    const valueDistribution = {
      low: this.processedBounties.filter(b => b.reward.amount < 50000).length,
      medium: this.processedBounties.filter(b => b.reward.amount >= 50000 && b.reward.amount < 250000).length,
      high: this.processedBounties.filter(b => b.reward.amount >= 250000).length,
    };

    // Performance analysis
    const evaluationsPerMinute = runtimeMinutes > 0 ? this.decisions.length / runtimeMinutes : 0;
    const implementationsPerHour = runtimeMinutes > 0 ? (attemptedImplementations / runtimeMinutes) * 60 : 0;

    // Estimate costs (rough approximation based on Claude Code SDK usage)
    const estimatedCost = this.calculateCostEstimate(attemptedImplementations, avgImplementationDuration);

    // ROI calculation (very rough estimate)
    const roiEstimate = estimatedCost > 0 ? (successfulValue / 100) / estimatedCost : 0;

    const metrics: PipelineMetrics = {
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      total_runtime: runtime,
      bounties_processed: this.processedBounties.length,

      decisions: {
        total_evaluated: this.decisions.length,
        go_decisions: goDecisions,
        caution_decisions: cautionDecisions,
        no_go_decisions: noGoDecisions,
        average_confidence: avgConfidence,
        average_threshold_used: avgThreshold,
      },

      implementations: {
        attempted: attemptedImplementations,
        successful: successfulImplementations,
        failed: failedImplementations,
        success_rate: successRate,
        average_duration: avgImplementationDuration,
        total_cost_estimate: estimatedCost,
      },

      quality_gates: {
        enabled: this.config.trackQualityMetrics,
        total_checked: this.qualityResults.length,
        passed: qualityPassed,
        failed: qualityFailed,
        average_score: avgQualityScore,
        common_blockers: commonBlockers,
      },

      performance: {
        evaluations_per_minute: evaluationsPerMinute,
        implementations_per_hour: implementationsPerHour,
        parallel_efficiency: this.calculateParallelEfficiency(),
        bottlenecks: this.identifyBottlenecks(),
      },

      value_analysis: {
        total_bounty_value: totalValue,
        successfully_implemented_value: successfulValue,
        roi_estimate: roiEstimate,
        average_bounty_value: avgBountyValue,
        value_distribution: valueDistribution,
      },
    };

    this.metrics = metrics;
    return metrics;
  }

  /**
   * Save metrics to file
   */
  async saveMetrics(metrics?: PipelineMetrics): Promise<void> {
    if (!this.config.saveMetricsToFile) return;

    const finalMetrics = metrics || this.generateMetrics();

    try {
      await Deno.mkdir(this.config.metricsOutputPath, { recursive: true });

      const filename = `pipeline-metrics-${this.sessionId}.json`;
      const filepath = `${this.config.metricsOutputPath}/${filename}`;

      await Deno.writeTextFile(filepath, JSON.stringify(finalMetrics, null, 2));

      console.log(`📊 Metrics saved to: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to save metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Print summary report to console
   */
  printSummary(metrics?: PipelineMetrics): void {
    const finalMetrics = metrics || this.generateMetrics();

    console.log(`\n📊 PIPELINE ANALYTICS SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Session: ${finalMetrics.session_id}`);
    console.log(`Runtime: ${Math.round(finalMetrics.total_runtime / 1000)}s`);
    console.log(`Bounties Processed: ${finalMetrics.bounties_processed}`);

    console.log(`\n🎯 DECISIONS:`);
    console.log(`   Total Evaluated: ${finalMetrics.decisions.total_evaluated}`);
    console.log(`   Go: ${finalMetrics.decisions.go_decisions}`);
    console.log(`   Caution: ${finalMetrics.decisions.caution_decisions}`);
    console.log(`   No-Go: ${finalMetrics.decisions.no_go_decisions}`);
    console.log(`   Average Confidence: ${finalMetrics.decisions.average_confidence.toFixed(1)}%`);

    console.log(`\n⚡ IMPLEMENTATIONS:`);
    console.log(`   Attempted: ${finalMetrics.implementations.attempted}`);
    console.log(`   Successful: ${finalMetrics.implementations.successful}`);
    console.log(`   Success Rate: ${finalMetrics.implementations.success_rate.toFixed(1)}%`);
    console.log(`   Average Duration: ${Math.round(finalMetrics.implementations.average_duration / 1000)}s`);

    if (finalMetrics.quality_gates.enabled) {
      console.log(`\n🔍 QUALITY GATES:`);
      console.log(`   Checked: ${finalMetrics.quality_gates.total_checked}`);
      console.log(`   Passed: ${finalMetrics.quality_gates.passed}`);
      console.log(`   Average Score: ${finalMetrics.quality_gates.average_score.toFixed(1)}/100`);
    }

    console.log(`\n📈 PERFORMANCE:`);
    console.log(`   Evaluations/min: ${finalMetrics.performance.evaluations_per_minute.toFixed(1)}`);
    console.log(`   Implementations/hour: ${finalMetrics.performance.implementations_per_hour.toFixed(1)}`);

    console.log(`\n💰 VALUE ANALYSIS:`);
    console.log(`   Total Bounty Value: $${(finalMetrics.value_analysis.total_bounty_value / 100).toFixed(2)}`);
    console.log(`   Successfully Implemented: $${(finalMetrics.value_analysis.successfully_implemented_value / 100).toFixed(2)}`);
    console.log(`   Estimated ROI: ${finalMetrics.value_analysis.roi_estimate.toFixed(2)}x`);

    if (finalMetrics.performance.bottlenecks.length > 0) {
      console.log(`\n⚠️ BOTTLENECKS:`);
      finalMetrics.performance.bottlenecks.forEach(bottleneck => {
        console.log(`   • ${bottleneck}`);
      });
    }

    console.log(`\n💡 Save detailed metrics: Check ${this.config.metricsOutputPath}/pipeline-metrics-${finalMetrics.session_id}.json`);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const random = Math.random().toString(36).substr(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Calculate rough cost estimate for Claude Code SDK usage
   */
  private calculateCostEstimate(implementations: number, avgDuration: number): number {
    // Very rough estimate: $0.50 per implementation attempt (prep + implement)
    // This is a placeholder - actual costs depend on token usage, model calls, etc.
    const baseEstimate = implementations * 0.50;

    // Adjust based on average duration (longer implementations likely use more tokens)
    const durationMultiplier = Math.max(1.0, avgDuration / 300000); // 5 minutes baseline

    return baseEstimate * durationMultiplier;
  }

  /**
   * Calculate parallel processing efficiency
   */
  private calculateParallelEfficiency(): number {
    // Placeholder calculation - would need more detailed timing data
    // For now, return a reasonable estimate based on implementation count
    if (this.implementationTimes.length < 2) return 0;

    // Simple heuristic: if we have multiple implementations, assume some parallelism
    return Math.min(85, 50 + (this.implementationTimes.length * 5));
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    const avgDuration = this.implementationTimes.length > 0
      ? this.implementationTimes.reduce((sum, time) => sum + time, 0) / this.implementationTimes.length
      : 0;

    if (avgDuration > 600000) { // 10 minutes
      bottlenecks.push('Implementation duration exceeds 10 minutes on average');
    }

    const successRate = this.processedBounties.length > 0
      ? this.processedBounties.filter(b => b.internal?.implementation_status === 'completed').length / this.processedBounties.length
      : 0;

    if (successRate < 0.5) {
      bottlenecks.push('Implementation success rate below 50%');
    }

    const qualityFailureRate = this.qualityResults.length > 0
      ? this.qualityResults.filter(q => !q.passed).length / this.qualityResults.length
      : 0;

    if (qualityFailureRate > 0.3) {
      bottlenecks.push('Quality gate failure rate above 30%');
    }

    return bottlenecks;
  }

  /**
   * Get current session metrics
   */
  getCurrentMetrics(): Partial<PipelineMetrics> {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}