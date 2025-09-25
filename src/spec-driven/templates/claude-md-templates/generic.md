# CLAUDE.md - {{bounty_title}}

Project-specific AI assistant guidelines for spec-driven bounty implementation.

## Bounty Context & Mission

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Reward**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability Assessment**: {{viability_category}} ({{viability_score}})
**Estimated Timeline**: {{time_estimate}}

**Mission Statement**: {{viability_reasoning}}

## Project Analysis & Tech Stack

### Primary Technology Stack
- **Language**: {{primary_language}}
- **Secondary Languages**: {{secondary_languages}}
- **Project Type**: {{project_type}}
- **File Organization**: {{file_organization}}
- **Naming Convention**: {{naming_convention}}

### Frameworks & Tools
- **Frameworks**: {{frameworks}}
- **Build Tools**: {{build_tools}}
- **Testing Frameworks**: {{testing_frameworks}}
- **Linting Tools**: {{linting_tools}}
- **Test Strategy**: {{test_strategy}}

### Project Structure
- **Entry Points**:
{{entry_points}}

- **Test Directories**:
{{test_directories}}

## Spec-Driven Requirements (EARS Format)

### Primary Requirements
{{primary_requirements}}

### Acceptance Criteria (Must-Have)
{{acceptance_criteria}}

### System Constraints
{{constraints}}

### Working Assumptions
{{assumptions}}

## System Design & Architecture

**Technical Approach**: {{technical_approach}}

### Architecture Changes Required
{{architecture_changes}}

### Integration Points
{{integration_points}}

### Data Flow
{{data_flow}}

## Implementation Plan: Discrete Tasks

{{discrete_tasks}}

**Summary**: {{task_count}} total tasks ({{high_priority_tasks}} high priority)

## Risk Management & Success Criteria

### Risk Assessment
{{risk_assessment}}

### Success Indicators
{{success_indicators}}

### Potential Blockers
{{potential_blockers}}

<!-- START_GLOBAL_CONTEXT -->
## Development Standards & Guidelines

### Code Quality Requirements
- Follow repository's existing patterns and conventions
- Maintain or improve test coverage
- Use {{naming_convention}} naming convention consistently
- Organize code following {{file_organization}} structure
- Ensure all linting tools pass: {{linting_tools}}

### Testing Strategy: {{test_strategy}}
- Write tests FIRST (TDD methodology)
- Use detected testing frameworks: {{testing_frameworks}}
- Target comprehensive coverage for new functionality
- Ensure integration tests where applicable

### Build & Deployment
- Use repository's build tools: {{build_tools}}
- Verify all build steps pass before submission
- Follow semantic commit message format
- Create feature branch for implementation

### Git Workflow
1. Create feature branch from main/master
2. Commit frequently with descriptive messages
3. Run full test suite before pushing
4. Create PR with comprehensive description
5. Ensure CI/CD pipeline passes
<!-- END_GLOBAL_CONTEXT -->

<!-- START_IMPLEMENTATION_GUIDANCE -->
## Implementation Guidance

### Step-by-Step Approach
1. **Analysis Phase**: Study existing codebase patterns
2. **Test Design**: Write comprehensive test cases first
3. **Implementation**: Implement minimum viable solution
4. **Validation**: Verify against acceptance criteria
5. **Integration**: Test with existing system components
6. **Documentation**: Update relevant docs and comments

### Key Implementation Principles
- **Follow Repository Patterns**: Mimic existing code style and structure
- **Test-Driven Development**: Red-Green-Refactor cycle
- **Incremental Progress**: Complete tasks in dependency order
- **Quality Gates**: Validate each step before proceeding
- **Documentation**: Maintain clear implementation notes

### Technology-Specific Considerations
Based on {{primary_language}} projects:
- Use appropriate error handling patterns
- Follow language-specific best practices
- Leverage existing utility functions and helpers
- Maintain consistent import/module organization
- Use established logging and debugging approaches
<!-- END_IMPLEMENTATION_GUIDANCE -->

<!-- START_BOUNTY_CONSTRAINTS -->
## Bounty-Specific Constraints

### Time & Scope Boundaries
- **Estimated Effort**: {{time_estimate}}
- **Scope**: Focus strictly on acceptance criteria
- **Out-of-Scope**: Avoid feature creep beyond requirements

### Quality Standards
- All acceptance criteria must pass validation
- Existing functionality must remain unaffected
- Test coverage must be maintained or improved
- Code must pass all existing quality checks

### Submission Requirements
- Create comprehensive PR description
- Include test results and validation proof
- Document any architectural decisions
- Provide clear usage examples if applicable
<!-- END_BOUNTY_CONSTRAINTS -->

## Context Management

### Critical Information (Always Prioritize)
1. Bounty requirements and acceptance criteria
2. Failing tests and error messages
3. Integration point dependencies
4. Repository-specific patterns and conventions

### Secondary Information
1. Related feature implementations
2. Historical context and decisions
3. Performance considerations
4. Documentation updates needed

### Information to Minimize
1. Boilerplate code and generated files
2. Unrelated modules and features
3. External dependency details
4. Verbose logging and debugging output

## Session Management

### Focus Boundaries
- **Primary Goal**: Complete {{bounty_title}} implementation
- **Success Metric**: All acceptance criteria validated
- **Quality Bar**: Match repository standards
- **Timeline**: {{time_estimate}} estimated effort

### Progress Tracking
Use TodoWrite tool to track implementation progress:
- Break down discrete tasks into actionable items
- Mark completion after validation
- Note blockers and resolution approaches
- Document key decisions and rationale

---

**Generated**: {{generated_date}}
**Methodology**: Spec-driven development inspired by kiro.dev
**Pipeline**: claude-code-bounty-pipe
**Context**: Repository-specific analysis with bounty integration