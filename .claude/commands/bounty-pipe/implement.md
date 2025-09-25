---
allowed-tools: Read, Write, Edit, MultiEdit, Grep, Glob, Bash(git:*), Bash(deno:*), Bash(bun:*), Bash(npm:*), Bash(nix develop:*), Bash(cargo:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--test-first] [--incremental]
description: TDD implementation following prep workflow
model: claude-3-5-sonnet-20241022
---

# Bounty Implementation Engine

Execute Test-Driven Development implementation following the validated prep workflow and established development environment.

## Implementation Philosophy

**TDD Foundation**: Write failing tests first, then implement to make them pass
**Incremental Development**: Small, testable changes with continuous validation
**Quality Standards**: Professional code following project conventions
**Clean Integration**: Respect existing architecture and patterns

## IMPLEMENTATION REQUEST

**Target**: $ARGUMENTS

Execute systematic TDD implementation:

### Phase 1: Environment Validation
- Verify prep workflow completion and working test environment
- Confirm all dependencies resolved and build system functional
- Validate existing test suite passes reliably

### Phase 2: Test-First Development
- Implement failing tests based on prep TEST_PLAN.md
- Follow project testing patterns and conventions
- Cover unit tests, integration tests, and edge cases

### Phase 3: Incremental Implementation
- Implement minimum code to make tests pass
- Follow existing code patterns and architectural decisions
- Maintain clean, readable, and maintainable code

### Phase 4: Integration and Validation
- Run full test suite and ensure no regressions
- Verify implementation meets all success criteria
- Validate performance and quality standards

### Phase 5: Documentation and Cleanup
- Update relevant documentation
- Clean up development artifacts
- Prepare for submission workflow

## Implementation Standards

**Code Quality:**
- Follow project's existing code style and conventions
- Write clear, self-documenting code with minimal comments
- Ensure proper error handling and edge case coverage
- Maintain consistent naming and architectural patterns

**Testing Requirements:**
- All new functionality must have corresponding tests
- Tests should be clear, focused, and maintainable
- Follow existing test patterns and utilities
- Ensure good test coverage without over-testing

**Git Workflow:**
- Commit early and often with meaningful messages
- Use conventional commit format when applicable
- Keep commits focused and atomic
- Maintain clean git history

## Required Output

Provide implementation report with:

1. **Implementation Status**: Complete feature delivery confirmation
2. **Test Results**: All tests passing with coverage metrics
3. **Code Quality**: Adherence to project standards
4. **Integration**: Successful integration with existing codebase
5. **Documentation**: Updated docs and implementation notes

## Success Criteria

**Implementation Complete:**
- ✅ All requirements from bounty implemented
- ✅ Comprehensive test coverage following TDD approach
- ✅ Existing test suite continues to pass
- ✅ Code follows project conventions and quality standards

**Ready for Submission:**
- ✅ Feature works as specified in bounty requirements
- ✅ No regressions or breaking changes introduced
- ✅ Clean, professional code ready for PR submission
- ✅ Implementation documented and ready for review

Focus on delivering production-quality implementation that maintains project standards and enables successful bounty completion.