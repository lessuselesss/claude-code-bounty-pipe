---
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch
argument-hint: <org>/<repo>#<issue> [--auto-implement] [--workspace-dir=DIR]
description: Complete spec-driven development pipeline from analysis to implementation
model: claude-3-5-sonnet-20241022
---

# Complete Spec-Driven Development Pipeline

Execute the full spec-driven development lifecycle using kiro.dev methodology: Analysis → Environment Setup → Implementation → Quality Validation. This represents the complete alternative to traditional 5-phase evaluation.

## Pipeline Philosophy

**Methodology**: Kiro.dev spec-driven development workflow
**Approach**: Structured development with actionable specifications
**Quality**: TDD implementation with comprehensive validation
**Speed**: Faster than traditional evaluation through focused analysis

## SPEC-DRIVEN PIPELINE REQUEST

**Target**: $ARGUMENTS

Execute complete spec-driven development pipeline:

### Stage 1: Spec-Driven Analysis (3-5 minutes)
**Objective**: Transform bounty into actionable specification

**Analysis Process**:
1. **Repository Context Loading**
   - Clone/update target repository to XDG-compliant cache
   - Analyze existing codebase patterns and architecture
   - Understand integration points and conventions

2. **Spec Generation**
   - Extract requirements from issue description
   - Design technical approach based on repository analysis
   - Generate 3-7 discrete, implementable tasks
   - Assess viability with 1-10 scoring

3. **Specification Validation**
   - Validate task dependencies and ordering
   - Ensure realistic effort estimates
   - Confirm implementation readiness

**Output**: Structured BountySpec JSON with implementation plan

### Stage 2: Environment Preparation (1-2 minutes)
**Objective**: Setup isolated development environment

**Environment Setup**:
1. **Workspace Creation**
   - Create XDG-compliant workspace directory
   - Initialize development environment (flake.nix if available)
   - Prepare git repository with feature branch

2. **Development Tools**
   - Verify test framework availability
   - Check linting and formatting tools
   - Validate build system functionality

3. **Dependency Verification**
   - Confirm all required dependencies available
   - Test development server startup
   - Verify development workflow readiness

### Stage 3: TDD Implementation (Variable)
**Objective**: Execute discrete tasks using Test-Driven Development

**Implementation Strategy**:
1. **Task Execution Order**
   - Process tasks in dependency-resolved order
   - Create git checkpoints before each task
   - Execute TDD cycle: Red → Green → Refactor

2. **Quality Gates**
   - Each task validated independently
   - Test suite must pass after each task
   - No regressions allowed

3. **Progress Tracking**
   - Real-time task completion status
   - Test coverage monitoring
   - Quality metric tracking

**Safety Mechanisms**:
- Git checkpoint before each task
- Rollback capability on failure
- Task-level error isolation

### Stage 4: Integration and Validation (2-3 minutes)
**Objective**: Ensure complete implementation meets all requirements

**Validation Process**:
1. **Complete Test Suite**
   - Run full test suite across all modules
   - Verify test coverage meets standards
   - Check for any regressions

2. **Code Quality Validation**
   - Run linting tools
   - Check formatting consistency
   - Verify repository conventions followed

3. **Acceptance Criteria Verification**
   - Validate all specification requirements met
   - Test integration points
   - Confirm data flow correctness

4. **Documentation Updates**
   - Update relevant documentation
   - Add code comments for complex logic
   - Generate API documentation if needed

## PIPELINE EXECUTION MODES

### Standard Mode (Default)
Execute analysis and prepare for manual implementation:
```bash
claude /spec-driven:pipeline owner/repo#123
```

### Auto-Implementation Mode
Execute complete pipeline including implementation:
```bash
claude /spec-driven:pipeline owner/repo#123 --auto-implement
```

### Workspace Mode
Use custom workspace directory:
```bash
claude /spec-driven:pipeline owner/repo#123 --workspace-dir=/path/to/workspace
```

## OUTPUT REQUIREMENTS

Generate comprehensive pipeline report:

```json
{
  "pipeline_status": "completed|analysis_only|failed",
  "stages_completed": ["analysis", "environment", "implementation", "validation"],
  "specification": {
    "bounty_id": "unique-id",
    "viability_score": 8,
    "viability_category": "viable",
    "total_tasks": 5,
    "estimated_time": "4-6 hours"
  },
  "implementation_results": {
    "tasks_completed": 5,
    "tasks_failed": 0,
    "tests_passing": 42,
    "tests_failing": 0,
    "coverage_percentage": 91
  },
  "quality_metrics": {
    "linting_passed": true,
    "formatting_passed": true,
    "no_regressions": true,
    "documentation_updated": true
  },
  "workspace_info": {
    "path": "/home/user/.local/share/bounty-pipe/spec-workspaces/owner-repo-123",
    "branch": "feat/spec-driven-impl-123",
    "commits": 6,
    "ready_for_pr": true
  },
  "next_steps": [
    "Review implementation for edge cases",
    "Run additional integration tests",
    "Create pull request with generated documentation"
  ]
}
```

## DECISION LOGIC

### Analysis Stage Decisions
- **Viability Score 1-3**: Stop pipeline, mark as "skip"
- **Viability Score 4-6**: Complete analysis, recommend manual review
- **Viability Score 7-10**: Continue to implementation if --auto-implement

### Implementation Stage Decisions
- **Task Failure**: Rollback to checkpoint, attempt alternative approach
- **Test Failure**: Stop implementation, report failed tasks
- **Quality Failure**: Fix quality issues before progression

### Validation Stage Decisions
- **All Tests Pass**: Mark implementation complete
- **Regressions Detected**: Rollback and fix regressions
- **Coverage Low**: Add missing test cases

## PERFORMANCE CHARACTERISTICS

### Speed Comparison
- **Traditional 5-Phase Evaluation**: 5-15 minutes analysis only
- **Spec-Driven Pipeline**: 3-5 minutes analysis + implementation ready
- **Complete Implementation**: Variable based on task complexity

### Success Rate
- **Spec Accuracy**: 90%+ of generated tasks implementable as specified
- **Implementation Success**: 85%+ of viable bounties successfully implemented
- **Quality Standards**: 95%+ pass all quality gates

## CRITICAL SUCCESS FACTORS

1. **Repository Analysis Depth**: Use tools extensively for accurate context
2. **Task Granularity**: Break work into 30-minute to 3-hour tasks
3. **Dependency Management**: Ensure correct task execution order
4. **Quality Maintenance**: Never compromise existing functionality
5. **Specification Compliance**: Follow generated tasks exactly

Execute complete spec-driven development pipeline now, transforming the bounty issue into production-ready implementation using proven kiro.dev methodology.