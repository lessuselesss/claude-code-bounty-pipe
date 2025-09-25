---
allowed-tools: Read, Grep, Glob, Bash(gh issue view:*), Bash(gh repo list:*), Bash(git clone:*), Bash(git log:*), Bash(find:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--min-reward=N] [--complexity-focus]
description: Comprehensive 5-phase bounty evaluation using proven methodology
model: claude-3-5-sonnet-20241022
---

# Bounty Evaluation Framework (5-Phase Methodology)

This framework provides a systematic approach to evaluating bounty viability, preventing costly misjudgments and identifying "trap bounties" that appear simple but have hidden complexity.

## Framework Overview

**Time Investment**: 2-4 hours of evaluation prevents weeks/months of wasted development effort.
**Success Rate**: Correctly identifies unworkable bounties with 90%+ accuracy based on validation testing.
**ROI**: Extremely positive - methodology correctly predicted failure patterns that occurred in reality.

## BOUNTY EVALUATION REQUEST

**Target**: $ARGUMENTS

Execute comprehensive 5-phase evaluation following the proven methodology:

### Phase 1: Initial Screening (15-30 minutes)
- Repository identification and verification
- Quick assessment of bounty requirements
- Initial red flag detection for immediate disqualifiers

### Phase 2: Technical Deep Dive (45-90 minutes)
- Repository architecture analysis
- Dependency verification and unknown function detection
- Similar issue analysis for complexity comparison
- Integration point analysis

### Phase 3: Complexity Scoring (30-45 minutes)
- Core Algorithm Complexity (1-3 points)
- System Integration Complexity (0-4 points)
- Knowledge Domain Complexity (0-2 points)
- Quality/Testing Complexity (0-1 points)

### Phase 4: Risk Assessment and Decision (15-30 minutes)
- Critical disqualifier identification
- Risk factor analysis and success probability calculation
- Timeline estimation with risk multipliers
- Go/No-Go decision matrix evaluation

### Phase 5: Documentation and Tracking
- Structured assessment recording
- Decision rationale documentation
- Lessons learned integration

## Critical Red Flags to Check

### Critical Disqualifiers (Automatic NO-GO)
- 🚩 **Unresponsive Maintainers**: PRs ignored for months, no response to status questions
- 🚩 **Multi-Repository Integration**: Work required across 3+ repositories
- 🚩 **Unknown Dependencies**: References to undocumented functions or modules
- 🚩 **Domain Expertise Requirements**: Specialized knowledge (SPICE, cryptography, multimedia)
- 🚩 **Vague Requirements**: "Find way to somehow..." or "possibly modifying..."
- 🚩 **Maintainer Coordination Required**: "Must work with maintainer" dependency

### High-Risk Indicators
- 🚩 **System Integration**: Issues mentioning "phases", "pipeline", "integration"
- 🚩 **Subjective Criteria**: "Aesthetic", "optimal", "clean", without clear metrics
- 🚩 **Architecture Changes**: "New phase", "modify pipeline", "extend system"
- 🚩 **Conflicting Reports**: Multiple developers report different experiences
- 🚩 **High Attempt Count**: >10 attempts often indicates systemic complexity issues

## Required Output

Provide both:

1. **Detailed Markdown Report**: Complete evaluation with methodology validation
2. **JSON Summary**: Structured decision data

```json
{
  "go_no_go": "GO/NO-GO/CAUTION",
  "complexity_score": "X/10",
  "success_probability": "X%",
  "risk_level": "LOW/MEDIUM/HIGH/CRITICAL",
  "red_flags": ["list of specific issues"],
  "estimated_timeline": "realistic timeframe",
  "decision_rationale": "clear reasoning for recommendation"
}
```

Focus on identifying "trap bounties" and providing accurate complexity assessment following the validated framework methodology.