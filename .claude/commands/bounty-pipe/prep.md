---
allowed-tools: Read, Grep, Glob, Bash(gh issue view:*), Bash(gh repo list:*), Bash(git clone:*), Bash(git checkout:*), Bash(git branch:*), Bash(mkdir:*), Bash(curl:*), Bash(nix develop:*), Bash(deno:*), Bash(bun:*), Bash(npm:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--target-dir=path]
description: Complete 10-step bounty preparation workflow with environment setup
model: claude-3-5-sonnet-20241022
---

# Prep Bounty Workflow

After completing the 5-phase bounty evaluation and deciding to proceed, follow this systematic preparation workflow based on the successful tscircuit #758 preparation.

## Workflow Overview

This 10-step process ensures systematic bounty preparation with reproducible development environments, TDD foundations, and clean development practices.

**Time Investment**: 1-2 hours of preparation ensures implementation success
**Success Rate**: Validated environment guarantees TDD approach viability
**ROI**: Front-loaded setup prevents environment issues during implementation

## BOUNTY PREPARATION REQUEST

**Target**: $ARGUMENTS

Execute the complete 10-step prep workflow:

### Step 1: Repository Setup (5-10 minutes)
- Organize directory structure (`<org>/<repo>` or `<org>/<repo-issue-specific>`)
- Clone repository to proper location
- Verify repository structure and dependencies

### Step 2: Feature Branch Creation (2-3 minutes)
- Create descriptive feature branch
- Follow naming convention: `feat/issue-<number>-<brief-description>`

### Step 3: Implementation Analysis & Documentation (15-30 minutes)
- Create targeted `CLAUDE.md` with implementation plan
- Document architecture overview and technical approach
- Identify files to implement/modify and success criteria

### Step 4: Test-Driven Development Plan (20-40 minutes)
- Analyze existing test patterns in codebase
- Create `TEST_PLAN.md` with comprehensive TDD approach
- Document unit, integration, and edge case strategies

### Step 5: Development Environment Setup and Testing (20-40 minutes)
- Apply appropriate dev template (TypeScript/Deno/Rust/Go/Python)
- **CRITICAL**: Iterative dependency resolution until tests pass
- Validate test harness with existing test suite

### Step 6: Dependency Documentation (5-10 minutes)
- Document working environment configuration
- Record required Nix packages and environment variables
- Note any native module rebuilds needed

### Step 7: Test Suite Analysis (10-15 minutes)
- Analyze testing patterns and framework usage
- Document test structure and utilities for TDD

### Step 8: Cleanup and Gitignore (2-3 minutes)
- Add development files to .gitignore
- Ensure clean project state

### Step 9: Return to Root Repository (1 minute)
- Exit repository to avoid workspace pollution

### Step 10: Validation Checklist
- Verify environment setup, testing foundation, documentation, and clean setup

## Required Output

Provide structured preparation report with:

1. **Environment Setup Status**: Complete configuration details
2. **Test Foundation**: Verified working test harness with patterns
3. **Implementation Plan**: Detailed technical approach
4. **TDD Strategy**: Ready-to-execute test-first development plan
5. **Timeline**: Realistic milestones and deliverables

## Success Criteria

**Environment Ready:**
- ✅ Clean development environment with all dependencies
- ✅ **Existing test suite passes reliably** (foundation for TDD)
- ✅ Working build process and development commands

**Documentation Complete:**
- ✅ Technical implementation strategy documented
- ✅ Test coverage plan established following project patterns
- ✅ Success criteria clearly defined
- ✅ Working environment configuration documented

**TDD Foundation:**
- ✅ Test harness patterns analyzed and understood
- ✅ Testing framework and utilities identified
- ✅ Ready to write failing tests first

Focus on thorough preparation that enables confident implementation with established TDD practices.