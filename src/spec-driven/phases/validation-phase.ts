#!/usr/bin/env -S deno run --allow-all

/**
 * Validation Phase
 *
 * Stage 4 of spec-driven pipeline: Integration and validation
 */

import type { BountySpec } from '../types.ts';
import type { TDDImplementationResult } from './tdd-implementation-phase.ts';
import { query } from 'npm:@anthropic-ai/claude-code@latest';

export interface ValidationResult {
  success: boolean;
  testSuiteStatus: 'passing' | 'failing' | 'mixed';
  codeQualityStatus: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  integrationStatus: 'clean' | 'warnings' | 'issues';
  regressionStatus: 'none' | 'minor' | 'major';
  coveragePercentage: number;
  readinessScore: number; // 0-100
  validationReport: string;
  nextSteps: string[];
}

export class ValidationPhase {

  /**
   * Perform comprehensive validation of implemented specification
   */
  async validateImplementation(
    spec: BountySpec,
    implementationResult: TDDImplementationResult,
    workspacePath: string
  ): Promise<ValidationResult> {
    console.log(`🔍 Validating implementation for: ${spec.title}`);

    const validationPrompt = `
You are performing comprehensive validation of a spec-driven implementation.

SPECIFICATION CONTEXT:
- Title: ${spec.title}
- Tasks Completed: ${implementationResult.completedTasks.length}/${implementationResult.totalTasks}
- Tests: ${implementationResult.overallTestsPassing} passing, ${implementationResult.overallTestsFailing} failing
- Quality Score: ${implementationResult.codeQualityScore}/100

REQUIREMENTS TO VALIDATE:

1. **COMPLETE TEST SUITE VALIDATION**
   - Run full test suite across all modules
   - Verify no test regressions from baseline
   - Check test coverage meets standards (aim for >85%)
   - Validate test quality and edge case coverage

2. **CODE QUALITY ASSESSMENT**
   - Run all linting tools and formatters
   - Check for code smells and complexity issues
   - Verify naming conventions and documentation
   - Assess maintainability and readability

3. **INTEGRATION TESTING**
   - Test integration points identified in spec
   - Verify data flow through the system
   - Check API contracts and interfaces
   - Validate component interactions

4. **REGRESSION DETECTION**
   - Run existing test suites to detect regressions
   - Verify existing functionality unchanged
   - Check for breaking changes in APIs
   - Test backward compatibility

5. **ACCEPTANCE CRITERIA VERIFICATION**
   - Validate each acceptance criterion from spec:
${spec.requirements.acceptance_criteria.map(criteria => `     • ${criteria}`).join('\n')}

6. **SYSTEM DESIGN COMPLIANCE**
   - Verify technical approach followed: ${spec.system_design.approach}
   - Check architecture changes implemented correctly
   - Validate integration points working: ${spec.system_design.integration_points.join(', ') || 'none'}

VALIDATION PROCESS:
1. Execute comprehensive test suite
2. Run code quality tools (linting, formatting)
3. Check integration and system tests
4. Verify no regressions in existing functionality
5. Assess overall implementation quality
6. Generate readiness score for submission

PROVIDE DETAILED VALIDATION REPORT:
- ✅ Test results and coverage metrics
- 📊 Code quality assessment
- 🔄 Integration test results
- ⚠️ Any regressions detected
- 📋 Acceptance criteria status
- 🎯 Overall readiness score (0-100)
- 📝 Specific next steps for improvement or submission
`;

    try {
      let response = '';
      for await (const message of query({
        prompt: validationPrompt,
        options: {
          model: 'claude-3-5-sonnet-20241022',
          allowedTools: ['Read', 'Bash', 'Glob', 'Grep'],
          cwd: workspacePath,
          maxTurns: 8, // Reduced from 15 to prevent timeouts
          hooks: {
            PreToolUse: [{
              hooks: [async (input) => {
                console.log(`   🔧 Validation tool: ${input.tool_name}`);
                return { continue: true };
              }]
            }]
          }
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

      // Parse validation results
      const validation = this.parseValidationResponse(response, implementationResult);

      console.log(`   📊 Validation Summary:`);
      console.log(`      🧪 Test Suite: ${validation.testSuiteStatus}`);
      console.log(`      📈 Code Quality: ${validation.codeQualityStatus}`);
      console.log(`      🔄 Integration: ${validation.integrationStatus}`);
      console.log(`      ⚡ Regressions: ${validation.regressionStatus}`);
      console.log(`      📊 Coverage: ${validation.coveragePercentage}%`);
      console.log(`      🎯 Readiness: ${validation.readinessScore}/100`);

      return validation;

    } catch (error) {
      console.error(`❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`);

      return {
        success: false,
        testSuiteStatus: 'failing',
        codeQualityStatus: 'poor',
        integrationStatus: 'issues',
        regressionStatus: 'major',
        coveragePercentage: 0,
        readinessScore: 0,
        validationReport: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        nextSteps: ['Fix validation execution issues', 'Retry validation process']
      };
    }
  }

  /**
   * Parse validation response and extract structured results
   */
  private parseValidationResponse(
    response: string,
    implementationResult: TDDImplementationResult
  ): ValidationResult {

    // Parse test suite status
    let testSuiteStatus: 'passing' | 'failing' | 'mixed' = 'mixed';
    if (response.includes('all tests pass') || response.includes('100% passing')) {
      testSuiteStatus = 'passing';
    } else if (response.includes('tests failing') || response.includes('❌')) {
      testSuiteStatus = 'failing';
    }

    // Parse code quality
    let codeQualityStatus: 'excellent' | 'good' | 'needs_improvement' | 'poor' = 'good';
    if (response.includes('excellent quality') || response.includes('high quality')) {
      codeQualityStatus = 'excellent';
    } else if (response.includes('needs improvement') || response.includes('quality issues')) {
      codeQualityStatus = 'needs_improvement';
    } else if (response.includes('poor quality') || response.includes('major issues')) {
      codeQualityStatus = 'poor';
    }

    // Parse integration status
    let integrationStatus: 'clean' | 'warnings' | 'issues' = 'clean';
    if (response.includes('integration warnings') || response.includes('minor issues')) {
      integrationStatus = 'warnings';
    } else if (response.includes('integration issues') || response.includes('integration failed')) {
      integrationStatus = 'issues';
    }

    // Parse regression status
    let regressionStatus: 'none' | 'minor' | 'major' = 'none';
    if (response.includes('minor regression') || response.includes('small regression')) {
      regressionStatus = 'minor';
    } else if (response.includes('major regression') || response.includes('breaking changes')) {
      regressionStatus = 'major';
    }

    // Parse coverage percentage
    let coveragePercentage = 0;
    const coverageMatch = response.match(/(\d+)%?\s*coverage/i) ||
                         response.match(/coverage:?\s*(\d+)%?/i);
    if (coverageMatch) {
      coveragePercentage = parseInt(coverageMatch[1]);
    }

    // Parse readiness score
    let readinessScore = 0;
    const readinessMatch = response.match(/readiness:?\s*(\d+)\/100/i) ||
                          response.match(/(\d+)\/100\s*readiness/i) ||
                          response.match(/readiness\s*score:?\s*(\d+)/i);
    if (readinessMatch) {
      readinessScore = parseInt(readinessMatch[1]);
    } else {
      // Calculate based on other metrics
      readinessScore = this.calculateReadinessScore({
        testSuiteStatus,
        codeQualityStatus,
        integrationStatus,
        regressionStatus,
        coveragePercentage,
        implementationResult
      });
    }

    // Extract next steps
    const nextSteps = this.extractNextSteps(response);

    const success = testSuiteStatus === 'passing' &&
                   regressionStatus === 'none' &&
                   readinessScore >= 80;

    return {
      success,
      testSuiteStatus,
      codeQualityStatus,
      integrationStatus,
      regressionStatus,
      coveragePercentage,
      readinessScore,
      validationReport: response,
      nextSteps
    };
  }

  /**
   * Calculate overall readiness score based on validation metrics
   */
  private calculateReadinessScore(metrics: {
    testSuiteStatus: string;
    codeQualityStatus: string;
    integrationStatus: string;
    regressionStatus: string;
    coveragePercentage: number;
    implementationResult: TDDImplementationResult;
  }): number {
    let score = 0;

    // Test suite contribution (40 points)
    if (metrics.testSuiteStatus === 'passing') score += 40;
    else if (metrics.testSuiteStatus === 'mixed') score += 20;

    // Code quality contribution (25 points)
    if (metrics.codeQualityStatus === 'excellent') score += 25;
    else if (metrics.codeQualityStatus === 'good') score += 20;
    else if (metrics.codeQualityStatus === 'needs_improvement') score += 10;

    // Integration status contribution (15 points)
    if (metrics.integrationStatus === 'clean') score += 15;
    else if (metrics.integrationStatus === 'warnings') score += 10;

    // Regression status contribution (10 points)
    if (metrics.regressionStatus === 'none') score += 10;
    else if (metrics.regressionStatus === 'minor') score += 5;

    // Coverage contribution (10 points)
    if (metrics.coveragePercentage >= 90) score += 10;
    else if (metrics.coveragePercentage >= 80) score += 8;
    else if (metrics.coveragePercentage >= 70) score += 6;
    else if (metrics.coveragePercentage >= 60) score += 4;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Extract next steps from validation response
   */
  private extractNextSteps(response: string): string[] {
    const steps: string[] = [];

    // Look for bullet points or numbered lists
    const bulletPattern = /[•\-\*]\s*([^\n\r]+)/g;
    const numberedPattern = /\d+\.\s*([^\n\r]+)/g;

    let match;
    while ((match = bulletPattern.exec(response)) !== null) {
      const step = match[1].trim();
      if (step.length > 10 && !steps.includes(step)) {
        steps.push(step);
      }
    }

    while ((match = numberedPattern.exec(response)) !== null) {
      const step = match[1].trim();
      if (step.length > 10 && !steps.includes(step)) {
        steps.push(step);
      }
    }

    // Default steps if none found
    if (steps.length === 0) {
      steps.push('Review validation report for specific issues');
      steps.push('Address any failing tests or quality issues');
      steps.push('Verify all acceptance criteria are met');
    }

    return steps.slice(0, 5); // Limit to 5 most important steps
  }
}