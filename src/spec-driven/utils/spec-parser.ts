#!/usr/bin/env -S deno run --allow-all

/**
 * Spec Parser and Plan Generator Utilities
 *
 * Utilities for parsing BountySpec and generating implementation plans
 */

import type { BountySpec } from '../types.ts';

export class SpecParser {

  static validateSpec(spec: BountySpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!spec.bounty_id) errors.push('Missing bounty_id');
    if (!spec.title) errors.push('Missing title');
    if (!spec.amount || spec.amount <= 0) errors.push('Invalid amount');

    // Validate requirements
    if (!spec.requirements?.primary?.length) errors.push('Missing primary requirements');
    if (!spec.requirements?.acceptance_criteria?.length) errors.push('Missing acceptance criteria');

    // Validate discrete tasks
    if (!spec.discrete_tasks?.length) errors.push('Missing discrete tasks');
    else {
      spec.discrete_tasks.forEach((task, index) => {
        if (!task.id) errors.push(`Task ${index}: missing id`);
        if (!task.description) errors.push(`Task ${index}: missing description`);
        if (!task.priority || !['high', 'medium', 'low'].includes(task.priority)) {
          errors.push(`Task ${index}: invalid priority`);
        }
      });
    }

    // Validate viability
    if (!spec.viability?.category || !['viable', 'challenging', 'skip'].includes(spec.viability.category)) {
      errors.push('Invalid viability category');
    }
    if (!spec.viability?.score || spec.viability.score < 1 || spec.viability.score > 10) {
      errors.push('Invalid viability score (must be 1-10)');
    }

    return { valid: errors.length === 0, errors };
  }

  static generateImplementationPlan(spec: BountySpec): string {
    const planTemplate = `# Bounty Implementation Plan
## ${spec.title} ($${spec.amount})

### Viability Assessment: ${spec.viability.category.toUpperCase()} (${spec.viability.score}/10)
**Reasoning**: ${spec.viability.reasoning}
**Estimated Time**: ${spec.viability.time_estimate}

### Requirements
**Primary Requirements:**
${spec.requirements.primary.map(req => `- ${req}`).join('\n')}

**Acceptance Criteria:**
${spec.requirements.acceptance_criteria.map(criteria => `- [ ] ${criteria}`).join('\n')}

**Constraints:**
${spec.requirements.constraints.map(constraint => `- ${constraint}`).join('\n')}

### System Design
**Approach**: ${spec.system_design.approach}

**Architecture Changes:**
${spec.system_design.architecture_changes.map(change => `- ${change}`).join('\n')}

**Integration Points:**
${spec.system_design.integration_points.map(point => `- ${point}`).join('\n')}

**Data Flow**: ${spec.system_design.data_flow}

### Implementation Tasks
${spec.discrete_tasks.map((task, index) => `
#### Task ${index + 1}: ${task.description}
- **Priority**: ${task.priority}
- **Effort**: ${task.estimated_effort}
- **Dependencies**: ${task.dependencies.join(', ') || 'None'}
- **Notes**: ${task.implementation_notes}
`).join('\n')}

### Implementation Strategy
**Technical Approach**: ${spec.implementation_reasoning.technical_approach}

**Risk Assessment**: ${spec.implementation_reasoning.risk_assessment}

**Success Indicators:**
${spec.implementation_reasoning.success_indicators.map(indicator => `- [ ] ${indicator}`).join('\n')}

**Potential Blockers:**
${spec.implementation_reasoning.potential_blockers.map(blocker => `- ⚠️  ${blocker}`).join('\n')}

---
*Generated using spec-driven development methodology inspired by kiro.dev*
`;

    return planTemplate;
  }

  static extractTaskDependencies(spec: BountySpec): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    spec.discrete_tasks.forEach(task => {
      dependencies.set(task.id, task.dependencies);
    });

    return dependencies;
  }

  static orderTasksByDependencies(spec: BountySpec): string[] {
    const dependencies = this.extractTaskDependencies(spec);
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(taskId: string) {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      if (visited.has(taskId)) {
        return;
      }

      visiting.add(taskId);

      const taskDeps = dependencies.get(taskId) || [];
      taskDeps.forEach(depId => {
        if (dependencies.has(depId)) {
          visit(depId);
        }
      });

      visiting.delete(taskId);
      visited.add(taskId);
      ordered.push(taskId);
    }

    spec.discrete_tasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    });

    return ordered;
  }

  static generateTaskSummary(spec: BountySpec): {
    totalTasks: number;
    highPriorityTasks: number;
    estimatedEffort: string;
    complexityScore: number;
  } {
    const totalTasks = spec.discrete_tasks.length;
    const highPriorityTasks = spec.discrete_tasks.filter(task => task.priority === 'high').length;

    // Simple complexity scoring based on task count and dependencies
    const avgDependencies = spec.discrete_tasks.reduce((sum, task) => sum + task.dependencies.length, 0) / totalTasks;
    const complexityScore = Math.min(10, Math.max(1, Math.round(totalTasks + avgDependencies * 2)));

    // Aggregate estimated effort (simplified)
    const effortHours = spec.discrete_tasks.reduce((total, task) => {
      const effortText = task.estimated_effort.toLowerCase();
      if (effortText.includes('minute')) {
        const minutes = parseInt(effortText.match(/(\d+)/)?.[1] || '30');
        return total + minutes / 60;
      } else if (effortText.includes('hour')) {
        const hours = parseInt(effortText.match(/(\d+)/)?.[1] || '2');
        return total + hours;
      }
      return total + 2; // Default 2 hours
    }, 0);

    const estimatedEffort = effortHours < 1
      ? `${Math.round(effortHours * 60)} minutes`
      : `${Math.round(effortHours)} hours`;

    return {
      totalTasks,
      highPriorityTasks,
      estimatedEffort,
      complexityScore
    };
  }
}