---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: <spec-id> [--workspace-dir=DIR] [--coverage-threshold=N]
description: Validate spec-driven implementation against acceptance criteria and quality standards
model: claude-3-5-sonnet-20241022
---

# Spec-Driven Implementation Validation

Comprehensive validation of spec-driven implementation against original acceptance criteria, quality standards, and repository conventions. Ensures implementation readiness before submission.

## Validation Philosophy

**Approach**: Multi-layered validation with objective criteria
**Standards**: Repository conventions + specification requirements
**Quality Gates**: Test coverage, code quality, functional validation
**Readiness**: Ensure submission-ready implementation

## SPEC-DRIVEN VALIDATION REQUEST

**Target Spec**: $ARGUMENTS

Execute comprehensive validation of spec-driven implementation:

### Layer 1: Specification Compliance Validation
**Objective**: Verify all discrete tasks completed per specification

**Compliance Checks**:
1. **Task Completion Verification**
   - Load specification and implementation status
   - Verify each discrete task marked as completed
   - Check task acceptance criteria satisfaction
   - Validate task dependency resolution

2. **Requirements Validation**
   - Primary requirements implementation check
   - Acceptance criteria verification
   - Constraint compliance validation
   - Assumption verification against implementation

3. **System Design Validation**
   - Architecture changes implemented correctly
   - Integration points functional
   - Data flow verification through system
   - Technical approach followed as specified

### Layer 2: Code Quality Validation
**Objective**: Ensure implementation meets repository standards

**Quality Metrics**:
1. **Test Coverage Analysis**
   - Calculate test coverage percentage
   - Identify untested code paths
   - Verify test quality and comprehensiveness
   - Check test naming and organization

2. **Code Standards Compliance**
   - Run repository linting tools
   - Check formatting consistency
   - Verify naming conventions
   - Validate import organization

3. **Code Complexity Assessment**
   - Identify overly complex functions
   - Check for code duplication
   - Validate proper separation of concerns
   - Assess maintainability metrics

### Layer 3: Functional Validation
**Objective**: Verify implementation works as intended

**Functional Tests**:
1. **Unit Test Validation**
   - Run all unit tests for implemented features
   - Verify test isolation and independence
   - Check edge case coverage
   - Validate error handling tests

2. **Integration Test Validation**
   - Run integration tests for modified components
   - Verify component interactions
   - Test data flow through system
   - Validate API contract compliance

3. **System Test Validation**
   - Run full system test suite
   - Verify no regressions introduced
   - Test system-level functionality
   - Validate performance characteristics

### Layer 4: Repository Integration Validation
**Objective**: Ensure seamless integration with existing codebase

**Integration Checks**:
1. **Backward Compatibility**
   - Verify existing APIs unchanged
   - Check for breaking changes
   - Validate database schema compatibility
   - Test existing functionality unchanged

2. **Documentation Consistency**
   - Verify documentation updated
   - Check API documentation accuracy
   - Validate code comments quality
   - Ensure README reflects changes

3. **Build System Integration**
   - Verify build process successful
   - Check dependency management
   - Validate deployment scripts
   - Test CI/CD pipeline compatibility

## VALIDATION REPORT GENERATION

Generate comprehensive validation report:

```json
{
  "validation_status": "passed|failed|partial",
  "validation_timestamp": "2024-01-15T10:30:00Z",
  "spec_compliance": {
    "tasks_completed": 5,
    "tasks_total": 5,
    "requirements_satisfied": true,
    "acceptance_criteria_met": true,
    "architecture_changes_implemented": true
  },
  "code_quality": {
    "test_coverage_percentage": 91,
    "linting_passed": true,
    "formatting_passed": true,
    "complexity_score": "acceptable",
    "code_duplication": "minimal"
  },
  "functional_validation": {
    "unit_tests_passing": 42,
    "unit_tests_failing": 0,
    "integration_tests_passing": 15,
    "integration_tests_failing": 0,
    "system_tests_passing": 8,
    "system_tests_failing": 0
  },
  "repository_integration": {
    "backward_compatibility": true,
    "documentation_updated": true,
    "build_successful": true,
    "no_regressions": true
  },
  "quality_gates": [
    {
      "gate": "test_coverage",
      "required": 85,
      "actual": 91,
      "status": "passed"
    },
    {
      "gate": "linting",
      "status": "passed"
    },
    {
      "gate": "regression_tests",
      "status": "passed"
    }
  ],
  "issues_found": [],
  "recommendations": [
    "Consider adding edge case tests for error handling",
    "Documentation could include more usage examples"
  ],
  "submission_readiness": {
    "ready_for_pr": true,
    "confidence_score": 95,
    "estimated_review_time": "15-30 minutes"
  }
}
```

## QUALITY GATES

### Mandatory Gates (Must Pass)
1. **Test Coverage**: Minimum 85% (configurable)
2. **All Tests Passing**: 100% test pass rate
3. **No Regressions**: Existing functionality unchanged
4. **Linting Clean**: No linting errors or warnings
5. **Build Success**: Clean build without errors

### Advisory Gates (Warnings Only)
1. **Code Complexity**: Flag overly complex functions
2. **Documentation Coverage**: Identify undocumented code
3. **Performance Impact**: Detect potential performance issues
4. **Security Considerations**: Flag potential security concerns

## FAILURE RECOVERY

### Validation Failure Handling
When validation fails:
1. **Identify Root Cause**: Determine specific failure points
2. **Categorize Issues**: Technical vs. specification vs. quality
3. **Generate Action Plan**: Specific steps to resolve issues
4. **Priority Assessment**: Critical vs. nice-to-have fixes

### Common Failure Patterns
- **Test Coverage Too Low**: Add missing test cases
- **Regressions Detected**: Fix broken existing functionality
- **Quality Standards Violation**: Address linting/formatting issues
- **Specification Deviation**: Align implementation with original spec

## SUCCESS CRITERIA

### Full Validation Success
- All quality gates pass
- 100% specification compliance
- No regressions detected
- Ready for pull request submission

### Partial Success with Warnings
- Core functionality working
- Minor quality issues identified
- Recommendations for improvement
- Conditional readiness for submission

### Validation Failure
- Critical issues preventing submission
- Clear action plan for resolution
- Specific steps to achieve compliance

## PERFORMANCE OPTIMIZATION

### Validation Speed
- **Quick Validation**: Essential gates only (2-3 minutes)
- **Comprehensive Validation**: All layers (5-10 minutes)
- **Deep Validation**: Including performance and security (15+ minutes)

### Parallel Execution
Where possible, run validation layers in parallel:
- Code quality checks concurrent with functional tests
- Documentation validation parallel with integration tests
- Static analysis alongside dynamic testing

Execute comprehensive spec-driven implementation validation now to ensure submission readiness and maintain repository quality standards.