#!/usr/bin/env -S deno run --allow-all

/**
 * TDD Implementation Phase
 *
 * Stage 3 of spec-driven pipeline: Execute discrete tasks using Test-Driven Development
 */

import type { BountySpec } from '../types.ts';
import { query } from 'npm:@anthropic-ai/claude-code@latest';

export interface TaskImplementationResult {
  taskId: string;
  success: boolean;
  testsCreated: number;
  testsPassing: number;
  testsFailing: number;
  gitCommitHash?: string;
  implementationNotes: string[];
}

export interface TDDImplementationResult {
  success: boolean;
  totalTasks: number;
  completedTasks: TaskImplementationResult[];
  failedTasks: string[];
  overallTestsPassing: number;
  overallTestsFailing: number;
  codeQualityScore: number;
  implementationLog: string[];
}

export class TDDImplementationPhase {

  /**
   * Execute all discrete tasks using Test-Driven Development
   */
  async implementWithTDD(
    spec: BountySpec,
    workspacePath: string,
    branchName: string
  ): Promise<TDDImplementationResult> {
    console.log(`🔨 Starting TDD implementation for: ${spec.title}`);
    console.log(`   📋 ${spec.discrete_tasks.length} tasks to implement`);

    const implementationLog: string[] = [];
    const completedTasks: TaskImplementationResult[] = [];
    const failedTasks: string[] = [];
    let overallTestsPassing = 0;
    let overallTestsFailing = 0;

    // Sort tasks by dependency order
    const sortedTasks = this.sortTasksByDependencies(spec.discrete_tasks);

    // Execute each task in order
    for (const task of sortedTasks) {
      console.log(`\n   🎯 Task ${task.id}: ${task.description}`);
      console.log(`      Priority: ${task.priority} | Effort: ${task.estimated_effort}`);

      try {
        const taskResult = await this.implementSingleTask(
          task,
          spec,
          workspacePath,
          implementationLog
        );

        completedTasks.push(taskResult);

        if (taskResult.success) {
          overallTestsPassing += taskResult.testsPassing;
          overallTestsFailing += taskResult.testsFailing;
          console.log(`   ✅ Task completed: ${taskResult.testsCreated} tests created, ${taskResult.testsPassing} passing`);
        } else {
          failedTasks.push(task.id);
          console.log(`   ❌ Task failed: ${task.id}`);
          break; // Stop on failure to maintain consistency
        }

        // Brief pause between tasks
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ Task ${task.id} failed: ${error instanceof Error ? error.message : String(error)}`);
        failedTasks.push(task.id);
        implementationLog.push(`Task ${task.id} error: ${error instanceof Error ? error.message : String(error)}`);
        break; // Stop on error
      }
    }

    const success = failedTasks.length === 0 && completedTasks.length === sortedTasks.length;
    const codeQualityScore = this.calculateQualityScore(completedTasks, overallTestsPassing, overallTestsFailing);

    console.log(`\n   📊 Implementation Summary:`);
    console.log(`      ✅ Completed: ${completedTasks.length}/${sortedTasks.length} tasks`);
    console.log(`      🧪 Tests: ${overallTestsPassing} passing, ${overallTestsFailing} failing`);
    console.log(`      📈 Quality Score: ${codeQualityScore}/100`);

    return {
      success,
      totalTasks: sortedTasks.length,
      completedTasks,
      failedTasks,
      overallTestsPassing,
      overallTestsFailing,
      codeQualityScore,
      implementationLog
    };
  }

  /**
   * Implement a single discrete task using TDD methodology
   */
  private async implementSingleTask(
    task: any,
    spec: BountySpec,
    workspacePath: string,
    implementationLog: string[]
  ): Promise<TaskImplementationResult> {

    const tddPrompt = `
You are implementing a discrete task using Test-Driven Development methodology.

TASK CONTEXT:
- Task ID: ${task.id}
- Description: ${task.description}
- Priority: ${task.priority}
- Estimated Effort: ${task.estimated_effort}
- Dependencies: ${task.dependencies.join(', ') || 'none'}
- Implementation Notes: ${task.implementation_notes || 'none'}

BOUNTY CONTEXT:
- Title: ${spec.title}
- Technical Approach: ${spec.system_design.approach}
- Integration Points: ${spec.system_design.integration_points.join(', ') || 'none'}

TDD IMPLEMENTATION PROCESS:

1. **RED PHASE: Write Failing Tests**
   - Create comprehensive test cases for this specific task
   - Test edge cases and error conditions
   - Ensure tests fail initially (no implementation yet)
   - Follow repository's testing conventions

2. **GREEN PHASE: Implement Minimum Viable Code**
   - Write the simplest code that makes tests pass
   - Focus on functionality over optimization
   - Ensure all tests pass after implementation
   - Follow repository's coding conventions

3. **REFACTOR PHASE: Improve Code Quality**
   - Optimize for readability and maintainability
   - Remove duplication and improve structure
   - Ensure tests still pass after refactoring
   - Add documentation and comments as needed

4. **VALIDATION**
   - Run full test suite to ensure no regressions
   - Verify integration with existing codebase
   - Check code quality with linting tools
   - Create git commit with descriptive message

SAFETY REQUIREMENTS:
- Create git checkpoint before starting
- Roll back if tests fail after implementation
- Ensure no existing functionality is broken
- Maintain test coverage throughout process

EXECUTE THE FULL TDD CYCLE and report:
- 🧪 Tests created and their status
- 📝 Implementation details and approach
- ✅ Validation results and quality metrics
- 🔄 Git commit information
- ⚠️ Any issues or rollbacks performed

Focus on this single task only - do not implement other tasks.
`;

    const implementationNotes: string[] = [];
    let testsCreated = 0;
    let testsPassing = 0;
    let testsFailing = 0;
    let gitCommitHash: string | undefined;

    try {
      let response = '';
      for await (const message of query({
        prompt: tddPrompt,
        options: {
          model: 'claude-3-5-sonnet-20241022',
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          cwd: workspacePath,
          maxTurns: 8, // Reduced from 20 to prevent timeouts
          hooks: {
            PreToolUse: [{
              hooks: [async (input) => {
                console.log(`      🔧 ${input.tool_name}`);
                implementationLog.push(`Task ${task.id} - ${input.tool_name}: ${JSON.stringify(input.tool_input)}`);
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

      // Parse implementation results
      const testMatches = response.match(/(\d+)\s+tests?\s+created/i) ||
                         response.match(/created\s+(\d+)\s+tests?/i);
      if (testMatches) testsCreated = parseInt(testMatches[1]);

      const passingMatches = response.match(/(\d+)\s+tests?\s+passing/i) ||
                            response.match(/(\d+)\s+passing/i);
      if (passingMatches) testsPassing = parseInt(passingMatches[1]);

      const failingMatches = response.match(/(\d+)\s+tests?\s+failing/i) ||
                            response.match(/(\d+)\s+failing/i);
      if (failingMatches) testsFailing = parseInt(failingMatches[1]);

      const commitMatches = response.match(/commit\s+([a-f0-9]{7,})/i);
      if (commitMatches) gitCommitHash = commitMatches[1];

      implementationNotes.push(response);

      const success = response.includes('✅') &&
                     !response.includes('❌') &&
                     testsFailing === 0;

      return {
        taskId: task.id,
        success,
        testsCreated,
        testsPassing,
        testsFailing,
        gitCommitHash,
        implementationNotes
      };

    } catch (error) {
      implementationNotes.push(`Error: ${error instanceof Error ? error.message : String(error)}`);

      return {
        taskId: task.id,
        success: false,
        testsCreated: 0,
        testsPassing: 0,
        testsFailing: 0,
        implementationNotes
      };
    }
  }

  /**
   * Sort tasks by dependency order
   */
  private sortTasksByDependencies(tasks: any[]): any[] {
    const sorted: any[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: any) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task: ${task.id}`);
      }
      if (visited.has(task.id)) return;

      visiting.add(task.id);

      // Visit dependencies first
      for (const depId of task.dependencies || []) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          visit(depTask);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    // Visit all tasks
    for (const task of tasks) {
      visit(task);
    }

    return sorted;
  }

  /**
   * Calculate code quality score based on implementation results
   */
  private calculateQualityScore(
    completedTasks: TaskImplementationResult[],
    totalPassing: number,
    totalFailing: number
  ): number {
    if (completedTasks.length === 0) return 0;

    // Base score from task completion rate
    const completionRate = completedTasks.filter(t => t.success).length / completedTasks.length;
    let score = completionRate * 60; // 60 points for completion

    // Test coverage score
    const totalTests = totalPassing + totalFailing;
    if (totalTests > 0) {
      const testPassRate = totalPassing / totalTests;
      score += testPassRate * 25; // 25 points for test passing rate
    }

    // Implementation quality score
    const avgTestsPerTask = totalTests / completedTasks.length;
    if (avgTestsPerTask >= 3) score += 10; // 10 points for good test coverage
    if (avgTestsPerTask >= 5) score += 5;  // 5 more points for excellent coverage

    return Math.min(100, Math.round(score));
  }
}