#!/usr/bin/env -S deno run --allow-all

/**
 * Quality Assurance Engine
 *
 * Comprehensive quality gates system that validates implementations
 * before marking them as ready for submission. Includes automated
 * testing, code quality checks, requirement validation, and
 * submission readiness assessment.
 */

import type { Bounty } from '../../schemas/bounty-schema.ts';

export interface QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  gates: {
    testsPass: QualityGateCheck;
    requirementsMet: QualityGateCheck;
    codeQuality: QualityGateCheck;
    submissionReady: QualityGateCheck;
    implementationComplete: QualityGateCheck;
  };
  overallAssessment: string;
  recommendations: string[];
  blockers: string[];
  warnings: string[];
}

export interface QualityGateCheck {
  passed: boolean;
  score: number; // 0-100
  details: string;
  evidence: string[];
  issues: string[];
  recommendations: string[];
}

export interface QualityGateConfig {
  passingThreshold: number; // Overall score threshold (default: 80)
  gateWeights: {
    testsPass: number;
    requirementsMet: number;
    codeQuality: number;
    submissionReady: number;
    implementationComplete: number;
  };
  strictMode: boolean; // If true, all gates must pass individually
  allowManualOverride: boolean;
}

export class QualityAssuranceEngine {
  private config: QualityGateConfig;

  constructor(config?: Partial<QualityGateConfig>) {
    this.config = {
      passingThreshold: 80,
      gateWeights: {
        testsPass: 0.25,        // 25%
        requirementsMet: 0.30,  // 30%
        codeQuality: 0.20,      // 20%
        submissionReady: 0.15,  // 15%
        implementationComplete: 0.10  // 10%
      },
      strictMode: false,
      allowManualOverride: true,
      ...config,
    };
  }

  /**
   * Run comprehensive quality gates on bounty implementation
   */
  async runQualityGates(bounty: Bounty): Promise<QualityGateResult> {
    console.log(`\n🔍 Running quality gates for: ${bounty.task.title}`);

    // Run individual quality gate checks
    const testsPass = await this.checkTestsPassing(bounty);
    const requirementsMet = await this.checkRequirementsMet(bounty);
    const codeQuality = await this.checkCodeQuality(bounty);
    const submissionReady = await this.checkSubmissionReady(bounty);
    const implementationComplete = await this.checkImplementationComplete(bounty);

    // Calculate weighted overall score
    const overallScore = this.calculateOverallScore({
      testsPass,
      requirementsMet,
      codeQuality,
      submissionReady,
      implementationComplete,
    });

    // Determine overall pass/fail
    const strictModePassed = this.config.strictMode
      ? testsPass.passed && requirementsMet.passed && codeQuality.passed && submissionReady.passed && implementationComplete.passed
      : true;

    const passed = overallScore >= this.config.passingThreshold && strictModePassed;

    // Generate assessment and recommendations
    const { overallAssessment, recommendations, blockers, warnings } = this.generateAssessment({
      testsPass,
      requirementsMet,
      codeQuality,
      submissionReady,
      implementationComplete,
    }, overallScore, passed);

    const result: QualityGateResult = {
      passed,
      score: overallScore,
      gates: {
        testsPass,
        requirementsMet,
        codeQuality,
        submissionReady,
        implementationComplete,
      },
      overallAssessment,
      recommendations,
      blockers,
      warnings,
    };

    // Log results
    console.log(`   Overall Score: ${overallScore.toFixed(1)}/100 (threshold: ${this.config.passingThreshold})`);
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

    if (blockers.length > 0) {
      console.log(`   Blockers: ${blockers.length}`);
      blockers.forEach(blocker => console.log(`     ❌ ${blocker}`));
    }

    if (warnings.length > 0) {
      console.log(`   Warnings: ${warnings.length}`);
      warnings.forEach(warning => console.log(`     ⚠️ ${warning}`));
    }

    return result;
  }

  /**
   * Check if tests are passing
   */
  private async checkTestsPassing(bounty: Bounty): Promise<QualityGateCheck> {
    const implementationResult = bounty.internal?.implementation_result;
    const details: string[] = [];
    const issues: string[] = [];
    const evidence: string[] = [];
    const recommendations: string[] = [];

    let score = 0;
    let passed = false;

    if (!implementationResult) {
      issues.push('No implementation result available');
      details.push('Implementation must be completed before testing');
      recommendations.push('Complete implementation first');
    } else {
      // Check test results from implementation
      if (implementationResult.tests_passing) {
        score = 100;
        passed = true;
        details.push('All tests are passing');
        evidence.push('Implementation result shows tests_passing: true');
      } else {
        score = 0;
        passed = false;
        issues.push('Tests are not passing');
        details.push('Test failures detected in implementation');
        recommendations.push('Fix failing tests before submission');
      }

      // Check for test coverage or test existence indicators
      const implementationText = bounty.internal?.implementation_file;
      if (implementationText) {
        evidence.push('Implementation file exists for test verification');
      }
    }

    return {
      passed,
      score,
      details: details.join('. '),
      evidence,
      issues,
      recommendations,
    };
  }

  /**
   * Check if requirements are met
   */
  private async checkRequirementsMet(bounty: Bounty): Promise<QualityGateCheck> {
    const implementationResult = bounty.internal?.implementation_result;
    const details: string[] = [];
    const issues: string[] = [];
    const evidence: string[] = [];
    const recommendations: string[] = [];

    let score = 0;
    let passed = false;

    if (!implementationResult) {
      issues.push('No implementation result to verify requirements');
      details.push('Requirements verification requires completed implementation');
      recommendations.push('Complete implementation to verify requirements');
    } else {
      if (implementationResult.requirements_met) {
        score = 100;
        passed = true;
        details.push('All requirements have been met');
        evidence.push('Implementation result shows requirements_met: true');
      } else {
        score = 20; // Partial credit for attempted implementation
        passed = false;
        issues.push('Requirements not fully met');
        details.push('Implementation does not satisfy all bounty requirements');
        recommendations.push('Review bounty requirements and address missing functionality');
      }

      // Additional analysis based on bounty description
      const taskDescription = bounty.task.body || bounty.task.title;
      if (taskDescription.length < 50) {
        issues.push('Vague bounty requirements make verification difficult');
        recommendations.push('Request clarification of requirements from bounty owner');
      }
    }

    return {
      passed,
      score,
      details: details.join('. '),
      evidence,
      issues,
      recommendations,
    };
  }

  /**
   * Check code quality standards
   */
  private async checkCodeQuality(bounty: Bounty): Promise<QualityGateCheck> {
    const implementationResult = bounty.internal?.implementation_result;
    const details: string[] = [];
    const issues: string[] = [];
    const evidence: string[] = [];
    const recommendations: string[] = [];

    let score = 50; // Default middle score
    let passed = false;

    if (!implementationResult) {
      issues.push('No implementation to assess code quality');
      details.push('Code quality assessment requires completed implementation');
      recommendations.push('Complete implementation for quality assessment');
      score = 0;
    } else {
      if (implementationResult.code_quality_validated) {
        score = 90;
        passed = true;
        details.push('Code quality has been validated');
        evidence.push('Implementation result shows code_quality_validated: true');
      } else {
        score = 40;
        passed = false;
        issues.push('Code quality not validated');
        details.push('Implementation may not meet code quality standards');
        recommendations.push('Review code for style, patterns, and best practices');
      }

      // Additional quality indicators
      const complexity = bounty.internal?.complexity_score;
      if (complexity && complexity > 7) {
        score -= 10; // Penalty for high complexity implementations
        issues.push('High complexity implementation requires extra quality scrutiny');
        recommendations.push('Consider refactoring for better maintainability');
      }

      // Check for red flags
      const redFlags = bounty.internal?.red_flags || [];
      if (redFlags.length > 0) {
        score -= redFlags.length * 5; // 5 point penalty per red flag
        issues.push(`${redFlags.length} red flags identified during evaluation`);
        recommendations.push('Address evaluation red flags that may impact code quality');
      }
    }

    return {
      passed,
      score: Math.max(0, Math.min(100, score)),
      details: details.join('. '),
      evidence,
      issues,
      recommendations,
    };
  }

  /**
   * Check if implementation is ready for submission
   */
  private async checkSubmissionReady(bounty: Bounty): Promise<QualityGateCheck> {
    const implementationResult = bounty.internal?.implementation_result;
    const details: string[] = [];
    const issues: string[] = [];
    const evidence: string[] = [];
    const recommendations: string[] = [];

    let score = 0;
    let passed = false;

    if (!implementationResult) {
      issues.push('No implementation result for submission readiness check');
      details.push('Submission readiness requires completed implementation');
      recommendations.push('Complete implementation before checking submission readiness');
    } else {
      if (implementationResult.ready_for_submission) {
        score = 100;
        passed = true;
        details.push('Implementation is ready for submission');
        evidence.push('Implementation result shows ready_for_submission: true');
      } else {
        score = 0;
        passed = false;
        issues.push('Implementation not ready for submission');
        details.push('Additional work required before submission');
        recommendations.push('Address failing requirements, tests, or quality issues');
      }

      // Check for implementation file
      if (bounty.internal?.implementation_file) {
        evidence.push('Implementation file exists');
        score += 10; // Bonus points for documentation
      } else {
        issues.push('No implementation file found');
        recommendations.push('Generate implementation documentation');
      }

      // Check for prep file
      if (bounty.internal?.prep_status === 'completed') {
        evidence.push('Bounty was properly prepped');
        score += 5; // Bonus for proper preparation
      }
    }

    return {
      passed,
      score: Math.max(0, Math.min(100, score)),
      details: details.join('. '),
      evidence,
      issues,
      recommendations,
    };
  }

  /**
   * Check if implementation is complete
   */
  private async checkImplementationComplete(bounty: Bounty): Promise<QualityGateCheck> {
    const details: string[] = [];
    const issues: string[] = [];
    const evidence: string[] = [];
    const recommendations: string[] = [];

    let score = 0;
    let passed = false;

    const implementationStatus = bounty.internal?.implementation_status;

    if (implementationStatus === 'completed') {
      score = 100;
      passed = true;
      details.push('Implementation is marked as completed');
      evidence.push(`Implementation status: ${implementationStatus}`);
    } else if (implementationStatus === 'in_progress') {
      score = 30;
      passed = false;
      issues.push('Implementation is still in progress');
      details.push('Implementation has not been completed');
      recommendations.push('Complete the implementation before quality gate assessment');
    } else if (implementationStatus === 'failed') {
      score = 0;
      passed = false;
      issues.push('Implementation failed');
      details.push('Implementation encountered failures');
      recommendations.push('Debug and fix implementation failures');
    } else {
      score = 0;
      passed = false;
      issues.push('Implementation not started or status unknown');
      details.push('Implementation status is unknown or not started');
      recommendations.push('Start implementation process');
    }

    // Check for completion timestamp
    if (bounty.internal?.implementation_completed_at) {
      evidence.push(`Completed at: ${bounty.internal.implementation_completed_at}`);
    } else if (implementationStatus === 'completed') {
      issues.push('No completion timestamp despite completed status');
    }

    return {
      passed,
      score,
      details: details.join('. '),
      evidence,
      issues,
      recommendations,
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(gates: {
    testsPass: QualityGateCheck;
    requirementsMet: QualityGateCheck;
    codeQuality: QualityGateCheck;
    submissionReady: QualityGateCheck;
    implementationComplete: QualityGateCheck;
  }): number {
    const weights = this.config.gateWeights;

    return Math.round(
      gates.testsPass.score * weights.testsPass +
      gates.requirementsMet.score * weights.requirementsMet +
      gates.codeQuality.score * weights.codeQuality +
      gates.submissionReady.score * weights.submissionReady +
      gates.implementationComplete.score * weights.implementationComplete
    );
  }

  /**
   * Generate overall assessment and recommendations
   */
  private generateAssessment(
    gates: Record<string, QualityGateCheck>,
    overallScore: number,
    passed: boolean
  ): {
    overallAssessment: string;
    recommendations: string[];
    blockers: string[];
    warnings: string[];
  } {
    const recommendations: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Collect all issues and recommendations from individual gates
    Object.entries(gates).forEach(([gateName, gate]) => {
      if (!gate.passed) {
        blockers.push(`${gateName}: ${gate.details}`);
      }

      gate.issues.forEach(issue => {
        if (!gate.passed) {
          blockers.push(`${gateName}: ${issue}`);
        } else {
          warnings.push(`${gateName}: ${issue}`);
        }
      });

      gate.recommendations.forEach(rec => {
        recommendations.push(`${gateName}: ${rec}`);
      });
    });

    // Generate overall assessment
    let overallAssessment: string;
    if (passed) {
      overallAssessment = `Implementation passes quality gates with ${overallScore}/100 score. Ready for potential submission.`;
    } else if (overallScore >= 60) {
      overallAssessment = `Implementation shows promise (${overallScore}/100) but needs improvements to meet quality standards.`;
    } else {
      overallAssessment = `Implementation requires significant improvements (${overallScore}/100) before it can be considered for submission.`;
    }

    // Add strategic recommendations
    if (blockers.length > 3) {
      recommendations.push('Consider implementing in smaller increments to reduce complexity');
    }

    if (warnings.length > 0 && blockers.length === 0) {
      recommendations.push('Address warnings to improve implementation quality');
    }

    return {
      overallAssessment,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QualityGateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): QualityGateConfig {
    return { ...this.config };
  }
}