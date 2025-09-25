---
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(gh:*), Bash(git:*), Bash(deno:*), Bash(bun:*), Bash(npm:*), Bash(nix develop:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--auto-submit] [--conservative]
description: Complete end-to-end bounty pipeline
model: claude-3-5-sonnet-20241022
---

# Complete Bounty Pipeline

Execute the full end-to-end bounty pipeline from evaluation through submission, following all proven methodologies and workflows.

## Pipeline Overview

**5-Phase Evaluation** → **Pre-Filter Assessment** → **Comprehensive Evaluation** → **Systematic Preparation** → **TDD Implementation** → **Professional Submission**

This complete pipeline orchestrates all bounty workflows in sequence, ensuring systematic progression through each validated stage.

## PIPELINE REQUEST

**Target**: $ARGUMENTS

Execute complete bounty pipeline:

### Stage 1: Pre-Filter Assessment
- Rapid scoring using competition, reward, complexity, freshness, organization metrics
- Determine if bounty warrants full evaluation effort
- Decision point: PROCEED / SKIP

### Stage 2: Comprehensive Evaluation (if pre-filter passes)
- 5-phase evaluation methodology with systematic risk assessment
- GitHub CLI research and technical deep dive
- Decision point: GO / NO-GO / CAUTION

### Stage 3: Systematic Preparation (if evaluation is GO)
- Complete 10-step prep workflow
- Environment setup and TDD foundation
- Implementation planning and documentation

### Stage 4: TDD Implementation (if prep successful)
- Test-driven development following prep plan
- Incremental implementation with continuous validation
- Quality assurance and integration testing

### Stage 5: Professional Submission (if implementation complete)
- Bounty declaration and PR submission
- Comprehensive documentation and demonstration
- Professional follow-up and review management

## Pipeline Configuration

**Conservative Mode** (`--conservative`):
- Higher thresholds for progression between stages
- Additional validation checkpoints
- More thorough testing and quality assurance

**Auto-Submit Mode** (`--auto-submit`):
- Automatic progression through all stages
- Minimal human intervention required
- Suitable for high-confidence bounties

**Standard Mode** (default):
- Balanced progression with quality gates
- Human decision points at critical stages
- Recommended for most bounties

## Decision Gates

**Pre-Filter Gate**: Score ≥60 required to proceed
**Evaluation Gate**: GO or CAUTION required to proceed
**Preparation Gate**: Environment validation required to proceed
**Implementation Gate**: All tests passing required to proceed
**Submission Gate**: Quality standards met required to proceed

## Required Output

Provide complete pipeline report with:

1. **Stage Results**: Outcome and metrics from each completed stage
2. **Decision Trail**: Rationale for progression or termination at each gate
3. **Final Status**: Complete pipeline outcome (SUCCESS/FAILED/TERMINATED)
4. **Deliverables**: All artifacts produced (evaluations, prep docs, implementation, PR)
5. **Lessons Learned**: Pipeline improvements and optimizations identified

## Success Criteria

**Complete Pipeline Success:**
- ✅ All stages executed successfully with quality gates passed
- ✅ Professional PR submitted with bounty properly claimed
- ✅ Implementation meets all requirements with comprehensive testing
- ✅ Documentation and workflows updated with lessons learned

**Partial Pipeline Success:**
- ✅ Systematic evaluation prevented wasted effort on unviable bounty
- ✅ Quality gates prevented progression of flawed implementation
- ✅ Professional decision-making at each stage with clear rationale
- ✅ Valuable feedback captured for future pipeline improvements

Focus on systematic execution of the complete proven methodology while maintaining quality standards and professional practices throughout.