---
allowed-tools: Read, Grep, Glob, Bash(gh issue view:*), Bash(gh repo list:*), Bash(git clone:*), Bash(git log:*), Bash(find:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--output-dir=DIR] [--format=json|markdown]
description: Spec-driven bounty analysis using kiro.dev methodology with repository context
model: claude-3-5-sonnet-20241022
---

# Spec-Driven Bounty Analysis (Kiro.dev Methodology)

Transform bounty issues into structured specifications using AWS Kiro's proven spec-driven development methodology. This approach prioritizes clarity, actionability, and implementation readiness over complex evaluation metrics.

## Methodology Overview

**Philosophy**: Structured development over "vibe coding"
**Time Investment**: 3-5 minutes for focused specification generation
**Output**: Actionable specifications with discrete, implementable tasks
**Framework**: Based on kiro.dev's 3-phase approach (Requirements → Design → Tasks)

## SPEC-DRIVEN ANALYSIS REQUEST

**Target**: $ARGUMENTS

Execute comprehensive spec-driven analysis following kiro.dev methodology:

### Phase 1: Requirements Analysis (30 seconds)
**Objective**: Extract and structure primary requirements from bounty issue

**Analysis Steps**:
1. **Primary Requirements Extraction**
   - Parse issue description for core functionality requests
   - Identify user stories and acceptance criteria
   - Document explicit and implicit requirements

2. **Constraint Identification**
   - Repository technology stack constraints
   - Existing architecture limitations
   - Performance or compatibility requirements

3. **Assumption Documentation**
   - Integration point assumptions
   - Data flow assumptions
   - User experience assumptions

### Phase 2: System Design Analysis (60 seconds)
**Objective**: Determine technical approach using repository context

**Repository Context Analysis**:
- Use Read, Grep, and Glob tools extensively to analyze codebase
- Understand existing patterns, architecture, and conventions
- Identify similar implementations for reference

**Design Decisions**:
1. **Technical Approach**
   - Determine implementation strategy based on existing patterns
   - Identify specific files/modules requiring changes
   - Map integration points through actual code analysis

2. **Architecture Changes**
   - Document required structural modifications
   - Identify new components or modules needed
   - Plan data flow through existing system

### Phase 3: Discrete Task Generation (90 seconds)
**Objective**: Break implementation into 3-7 specific, actionable tasks

**Task Breakdown Criteria**:
- Each task should be completable in 30 minutes to 3 hours
- Tasks must have clear success criteria
- Dependencies between tasks must be explicit
- Priority levels: high, medium, low

**Task Structure**:
```
Task ID: descriptive-task-name
Description: Clear, actionable description
Priority: high|medium|low
Estimated Effort: realistic time estimate
Dependencies: [list of prerequisite task IDs]
Implementation Notes: specific guidance
```

### Phase 4: Implementation Reasoning (30 seconds)
**Objective**: Document technical rationale and risk assessment

**Reasoning Components**:
1. **Technical Approach Justification**
   - Why this approach fits the existing codebase
   - Evidence from repository analysis
   - Alternative approaches considered

2. **Risk Assessment**
   - Technical complexity risks
   - Integration risks
   - Potential blockers identified from code analysis

3. **Success Indicators**
   - Measurable completion criteria
   - Validation methods
   - Quality gates

### Phase 5: Viability Assessment (30 seconds)
**Objective**: Simple 1-10 scoring with clear categorization

**Scoring Criteria**:
- **1-3: Skip** - High risk, unclear requirements, or poor repository fit
- **4-6: Challenging** - Doable but requires significant investigation
- **7-10: Viable** - Clear path to implementation with good success probability

**Assessment Factors**:
- Repository code quality and patterns
- Clarity of requirements
- Availability of similar implementations
- Estimated complexity vs. reward

## OUTPUT REQUIREMENTS

Generate structured JSON matching this exact interface:

```typescript
interface BountySpec {
  bounty_id: string;
  title: string;
  amount: number;

  requirements: {
    primary: string[];
    acceptance_criteria: string[];
    constraints: string[];
    assumptions: string[];
  };

  system_design: {
    approach: string;
    architecture_changes: string[];
    integration_points: string[];
    data_flow: string;
  };

  discrete_tasks: {
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimated_effort: string;
    dependencies: string[];
    implementation_notes: string;
  }[];

  implementation_reasoning: {
    technical_approach: string;
    risk_assessment: string;
    success_indicators: string[];
    potential_blockers: string[];
  };

  viability: {
    score: number; // 1-10 scale
    category: 'viable' | 'challenging' | 'skip';
    reasoning: string;
    time_estimate: string;
  };
}
```

## CRITICAL REQUIREMENTS

1. **Repository Tools Usage**: Use Read, Grep, and Glob extensively to analyze actual code
2. **Evidence-Based Analysis**: Ground all decisions in repository evidence, not assumptions
3. **Actionable Output**: Every task must be immediately implementable
4. **Dependency Clarity**: Make task dependencies explicit and logical
5. **Reality Check**: Ensure viability assessment reflects actual implementation complexity

## SUCCESS CRITERIA

- **Specification Accuracy**: Tasks lead to successful implementation
- **Time Estimates**: Realistic effort estimates based on similar repository patterns
- **Implementation Ready**: No additional analysis required to begin coding
- **Risk Identification**: Potential blockers identified through code analysis

Execute this analysis now using repository context to generate an actionable specification for the target bounty.