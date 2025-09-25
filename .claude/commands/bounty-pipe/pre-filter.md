---
allowed-tools: Read, Grep, Glob, Bash(gh issue view:*), Bash(gh repo list:*), WebFetch
argument-hint: <org>/<repo>#<issue> [--min-score=N]
description: Pre-evaluation filter using scoring matrix
model: claude-3-5-sonnet-20241022
---

# Pre-Evaluation Filter

Quick assessment using the proven pre-evaluation scoring matrix to determine if a bounty warrants full evaluation.

## Pre-Filter Scoring Matrix

**Competition Analysis (0-30 points):**
- Fresh opportunity (0-2 attempts): 25-30 points
- Low competition (3-5 attempts): 15-20 points
- Medium competition (6-10 attempts): 5-10 points
- High competition (10+ attempts): 0-5 points

**Reward Assessment (0-25 points):**
- High value ($100+): 20-25 points
- Good value ($50-99): 15-20 points
- Moderate value ($25-49): 10-15 points
- Low value ($5-24): 5-10 points
- Very low value (<$5): 0-5 points

**Complexity Indicators (0-25 points):**
- Simple implementation signals: 20-25 points
- Standard development task: 15-20 points
- Complex but clear requirements: 10-15 points
- Vague or multi-system requirements: 5-10 points
- Architecture changes required: 0-5 points

**Freshness Factor (0-10 points):**
- Created within 7 days: 8-10 points
- Created within 30 days: 5-8 points
- Created within 90 days: 2-5 points
- Older than 90 days: 0-2 points

**Organization Quality (0-10 points):**
- Responsive, active maintainers: 8-10 points
- Generally responsive: 5-8 points
- Slow response times: 2-5 points
- Unresponsive or abandoned: 0-2 points

## PRE-FILTER REQUEST

**Target**: $ARGUMENTS

Execute rapid pre-filter assessment:

1. **Competition Analysis**: Check attempt count and PR activity
2. **Reward Evaluation**: Assess bounty value and cost-benefit
3. **Complexity Signals**: Identify requirement clarity and scope
4. **Freshness Check**: Evaluate recency and relevance
5. **Organization Assessment**: Review maintainer responsiveness

## Required Output

Provide structured pre-filter result:

```json
{
  "pre_filter_score": 85,
  "pre_filter_category": "priority|consider|skip",
  "scoring_breakdown": {
    "competition": "25/30",
    "reward": "20/25",
    "complexity": "20/25",
    "freshness": "10/10",
    "organization": "10/10"
  },
  "signals": [
    "Fresh opportunity",
    "Good reward range",
    "Simple implementation signals",
    "Responsive organization"
  ],
  "recommendation": "proceed|caution|skip",
  "reasoning": "Brief justification for score and recommendation"
}
```

**Scoring Thresholds:**
- **80-100**: Priority (immediate evaluation recommended)
- **60-79**: Consider (evaluate if capacity available)
- **0-59**: Skip (not worth evaluation effort)

Focus on rapid, objective assessment to optimize evaluation pipeline efficiency.