---
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: <spec-id> [--workspace-dir=DIR] [--git-branch=BRANCH]
description: TDD implementation following discrete tasks from spec-driven analysis
model: claude-3-5-sonnet-20241022
---

# Spec-Driven Implementation Engine (TDD Methodology)

Execute discrete tasks from spec-driven analysis using Test-Driven Development patterns. This command follows the generated specification to implement features systematically with quality gates at each task.

## Implementation Philosophy

**Approach**: Test-Driven Development with discrete task execution
**Quality Gates**: Each task validated independently before progression
**Safety**: Git checkpoints before each task for rollback capability
**Methodology**: Follow kiro.dev structured development patterns

## SPEC-DRIVEN IMPLEMENTATION REQUEST

**Target Spec**: $ARGUMENTS

Execute TDD implementation following the discrete tasks from the generated specification:

### Phase 1: Specification Loading and Validation
**Objective**: Load and validate the target specification

**Validation Steps**:
1. **Load Specification**
   - Read spec JSON from XDG-compliant directory (`~/.cache/bounty-pipe/specs/`)
   - Validate specification structure and completeness
   - Extract repository information and discrete tasks

2. **Environment Setup**
   - Verify repository access and workspace creation
   - Initialize development environment (flake.nix if available)
   - Create feature branch for implementation

3. **Task Order Resolution**
   - Analyze task dependencies to determine execution order
   - Identify parallel execution opportunities
   - Plan git checkpoint strategy

### Phase 2: Test-First Implementation
**Objective**: Implement each discrete task using TDD methodology

**TDD Implementation Pattern**:
For each task in dependency order:

1. **Red Phase: Write Failing Tests**
   ```
   - Create test file if it doesn't exist
   - Write test for the discrete task requirements
   - Verify test fails (Red)
   - Commit test code as checkpoint
   ```

2. **Green Phase: Implement Minimum Code**
   ```
   - Write minimal code to make test pass
   - Focus on task-specific requirements only
   - Verify test passes (Green)
   - Run existing test suite to ensure no regressions
   ```

3. **Refactor Phase: Improve Code Quality**
   ```
   - Refactor implementation for clarity and maintainability
   - Ensure all tests still pass
   - Follow repository coding conventions
   - Commit implementation as checkpoint
   ```

4. **Task Validation**
   ```
   - Verify task acceptance criteria met
   - Run relevant test suite
   - Check integration with existing code
   - Update task status in specification
   ```

### Phase 3: Integration and Quality Validation
**Objective**: Ensure complete implementation meets all requirements

**Integration Steps**:
1. **Complete Test Suite Execution**
   - Run full test suite across all modules
   - Verify no regressions introduced
   - Check test coverage meets repository standards

2. **Code Quality Gates**
   - Run linting tools if available
   - Check formatting consistency
   - Verify no unused imports or variables

3. **Acceptance Criteria Validation**
   - Verify all specification acceptance criteria met
   - Test integration points function correctly
   - Validate data flow through system

4. **Documentation Updates**
   - Update relevant documentation if needed
   - Add code comments for complex logic
   - Update API documentation if applicable

## ERROR HANDLING AND RECOVERY

### Task-Level Rollback Strategy
If any task fails during implementation:
1. **Identify Failure Point**: Determine which task step failed
2. **Rollback to Checkpoint**: Use git to rollback to last successful checkpoint
3. **Analyze Failure**: Review error and update implementation approach
4. **Retry or Skip**: Either retry with different approach or mark task for manual review

### Implementation Validation
Each task must pass these gates before progression:
- **Tests Pass**: All new and existing tests pass
- **Code Quality**: Meets repository standards (linting, formatting)
- **Integration**: Integrates correctly with existing code
- **Acceptance**: Meets task-specific acceptance criteria

## OUTPUT REQUIREMENTS

Generate comprehensive implementation report:

```json
{
  "implementation_status": "completed|partial|failed",
  "completed_tasks": ["task-id-1", "task-id-2"],
  "failed_tasks": ["task-id-3"],
  "test_results": {
    "total_tests": 45,
    "passing_tests": 43,
    "failing_tests": 2,
    "coverage_percentage": 87
  },
  "quality_checks": {
    "linting_passed": true,
    "formatting_passed": true,
    "no_regressions": true
  },
  "git_info": {
    "branch_name": "feat/spec-driven-implementation",
    "commits_created": 8,
    "checkpoint_commits": 4
  },
  "next_steps": [
    "Review failing tests in task-3",
    "Consider manual implementation for complex tasks",
    "Run additional integration tests"
  ]
}
```

## CRITICAL IMPLEMENTATION REQUIREMENTS

1. **Test-First Approach**: Always write tests before implementation code
2. **Task Isolation**: Each task implemented and validated independently
3. **Git Safety**: Create checkpoints before each major change
4. **Quality Maintenance**: Never break existing functionality
5. **Specification Compliance**: Follow discrete tasks exactly as specified

## SUCCESS CRITERIA

- **All Tasks Completed**: Every discrete task successfully implemented
- **Tests Passing**: 100% test pass rate including new and existing tests
- **No Regressions**: Existing functionality unchanged
- **Quality Standards**: Code meets repository quality standards
- **Acceptance Criteria**: All specification acceptance criteria satisfied

## TASK EXECUTION STRATEGY

### High Priority Tasks First
Execute tasks in dependency order, prioritizing high-priority tasks:
1. Load specification and validate task dependencies
2. Create task execution plan with checkpoint strategy
3. Execute tasks sequentially with TDD methodology
4. Validate integration after each task completion
5. Generate comprehensive implementation report

### Parallel Execution (When Possible)
For tasks with no dependencies:
- Identify parallel execution opportunities
- Create separate branches for independent tasks
- Merge parallel implementations after individual validation
- Resolve any integration conflicts

Execute spec-driven implementation now following TDD methodology for maximum quality and maintainability.