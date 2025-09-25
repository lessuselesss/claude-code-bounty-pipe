---
allowed-tools: Read, Write, Bash(gh:*), Bash(git:*), Bash(deno:*), Bash(bun:*), Bash(npm:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--dry-run] [--record-only]
description: Professional bounty submission workflow
model: claude-3-5-sonnet-20241022
---

# Bounty Submission Workflow

Execute professional submission process following industry best practices for bounty completion and PR submission.

## Submission Philosophy

**Professional Standards**: High-quality PR with comprehensive documentation
**Clear Communication**: Transparent progress and implementation approach
**Demonstration**: Working examples and verification of functionality
**Respectful Process**: Follow maintainer guidelines and community standards

## SUBMISSION REQUEST

**Target**: $ARGUMENTS

Execute complete submission workflow:

### Phase 1: Pre-Submission Validation
- Verify implementation completeness and quality
- Run full test suite and ensure all tests pass
- Validate functionality matches bounty requirements exactly
- Check for any regressions or breaking changes

### Phase 2: Bounty Declaration
- Post `/attempt` comment on GitHub issue
- Declare intention to claim bounty transparently
- Follow any specific claiming procedures

### Phase 3: PR Preparation
- Create comprehensive PR description
- Include demo video or screenshots of functionality
- Document implementation approach and decisions
- List all changes and their rationale

### Phase 4: Professional Submission
- Submit high-quality pull request
- Link PR to original bounty issue
- Include verification steps for reviewers
- Provide clear testing instructions

### Phase 5: Follow-Up Management
- Monitor PR for reviewer feedback
- Respond promptly to review comments
- Make requested changes professionally
- Maintain engagement until resolution

## PR Quality Standards

**Description Requirements:**
- Clear summary of changes and implementation
- Link to original bounty issue
- Demo video or screenshots showing functionality
- Step-by-step testing instructions for reviewers

**Code Quality:**
- Clean, well-documented implementation
- No debugging code or temporary changes
- Proper error handling and edge cases
- Follows project coding standards

**Testing Evidence:**
- All existing tests continue to pass
- New functionality has comprehensive test coverage
- Manual testing results documented
- Performance impact assessed if applicable

## Required Output

Provide submission report with:

1. **Submission Status**: Complete workflow execution confirmation
2. **PR Details**: Link to submitted pull request with quality metrics
3. **Declaration**: Confirmation of bounty attempt declaration
4. **Documentation**: Comprehensive submission documentation
5. **Follow-Up Plan**: Strategy for review engagement and completion

## Success Criteria

**Professional Submission:**
- ✅ High-quality PR submitted with comprehensive documentation
- ✅ Bounty attempt properly declared on original issue
- ✅ Demo video/screenshots showing working functionality
- ✅ Clear testing instructions for maintainers

**Ready for Review:**
- ✅ Implementation exactly matches bounty requirements
- ✅ All tests passing with no regressions
- ✅ Professional presentation ready for maintainer review
- ✅ Responsive plan for handling reviewer feedback

Focus on delivering a submission that demonstrates professionalism and maximizes the probability of bounty acceptance and payment.