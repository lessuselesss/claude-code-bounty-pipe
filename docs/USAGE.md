# Usage Guide

Complete guide to using the Claude Code Bounty Pipeline for automated bounty discovery, evaluation, and preparation.

## Quick Start

### 1. Initial Setup
```bash
# Clone the repository
git clone https://your-repo/claude-code-bounty-pipe
cd claude-code-bounty-pipe

# Cache dependencies
deno cache src/*.ts
```

### 2. Generate Bounty Index
```bash
# Full scan of all organizations (first run)
deno task generate:full

# Quick incremental update (daily)
deno task generate
```

### 3. Evaluate Bounties
```bash
# Evaluate up to 5 new bounties
deno task evaluate

# Focus on priority organizations
deno task evaluate:priority
```

### 4. Integrated Pipeline
```bash
# Evaluate + auto-prep high-confidence bounties
deno task pipeline:auto-prep

# Conservative approach (only prep 85%+ success rate)
deno task pipeline:conservative
```

## Detailed Workflows

### Daily Maintenance Routine

**Morning Discovery** (5 minutes):
```bash
# Update index with new bounties
deno task generate:quick

# Evaluate 3 new opportunities
deno run --allow-all src/claude-evaluation-engine.ts --max-evaluations=3 --max-attempts=0
```

**Review Results**:
```bash
# Check latest evaluation results
ls -la output/evaluations/ | tail -5

# View GO recommendations
cat output/reports/go-recommendations.md
```

### Weekly Strategic Analysis

**Comprehensive Evaluation** (30 minutes):
```bash
# Full evaluation run with reports
deno task weekly

# Focus on high-value organizations
deno run --allow-all src/pipeline-orchestrator.ts \
  --orgs=tscircuit,twentyhq,triggerdotdev \
  --max-evaluations=10 \
  --auto-prep \
  --min-success=75
```

**Strategic Review**:
```bash
# Review organization analysis
cat output/reports/organization-analysis.md

# Check prepped bounties ready for implementation
find output/prep/ -name "*.md" -mtime -7
```

### Target-Specific Evaluation

**High-Value Focus**:
```bash
# Target bounties ≥$100 with auto-prep
deno run --allow-all src/pipeline-orchestrator.ts \
  --min-amount=10000 \
  --auto-prep \
  --min-success=80 \
  --max-evaluations=5
```

**Organization-Specific**:
```bash
# Deep dive into specific organizations
deno run --allow-all src/claude-evaluation-engine.ts \
  --orgs=tscircuit,zio \
  --max-evaluations=10 \
  --max-attempts=2
```

**Zero-Attempt Hunting**:
```bash
# Find fresh bounties with no attempts
deno run --allow-all src/pipeline-orchestrator.ts \
  --max-attempts=0 \
  --auto-prep \
  --max-evaluations=8
```

## Command Reference

### Bounty Index Generator

```bash
# Basic usage
deno run --allow-all src/bounty-index-generator.ts [options]

# Options:
--full-scan         # Force full scan of all organizations
--max-age=HOURS     # Skip orgs updated within HOURS (default: 24)
--orgs=org1,org2    # Target specific organizations only

# Examples:
deno run --allow-all src/bounty-index-generator.ts --full-scan
deno run --allow-all src/bounty-index-generator.ts --max-age=6
deno run --allow-all src/bounty-index-generator.ts --orgs=tscircuit,zio
```

### Claude Evaluation Engine

```bash
# Basic usage
deno run --allow-all src/claude-evaluation-engine.ts [options]

# Options:
--max-evaluations=N   # Maximum evaluations to perform (default: 5)
--min-amount=CENTS    # Minimum bounty amount in cents (default: 5000)
--max-attempts=N      # Maximum attempt count to consider (default: 0)
--orgs=org1,org2      # Target specific organizations
--reevaluate          # Re-evaluate existing evaluations

# Examples:
deno run --allow-all src/claude-evaluation-engine.ts --max-evaluations=3
deno run --allow-all src/claude-evaluation-engine.ts --orgs=tscircuit,zio --max-evaluations=5
deno run --allow-all src/claude-evaluation-engine.ts --max-attempts=2 --max-evaluations=5
deno run --allow-all src/claude-evaluation-engine.ts --reevaluate --max-evaluations=2
```

### Pipeline Orchestrator

```bash
# Basic usage
deno run --allow-all src/pipeline-orchestrator.ts [options]

# Options:
--max-evaluations=N   # Maximum evaluations (default: 5)
--min-amount=CENTS    # Minimum amount in cents (default: 5000)
--max-attempts=N      # Maximum attempts (default: 0)
--orgs=org1,org2      # Target organizations
--auto-prep           # Enable automatic prep for GO bounties
--min-success=PCT     # Minimum success % for auto-prep (default: 75)
--max-prep=N          # Maximum prep operations (default: 2)
--reevaluate          # Re-evaluate existing
--reports             # Generate analysis reports

# Examples:
deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --min-success=80
deno run --allow-all src/pipeline-orchestrator.ts --auto-prep --min-success=85 --max-prep=1
deno run --allow-all src/pipeline-orchestrator.ts --orgs=tscircuit,zio --auto-prep
```

## Configuration

### Organizations Configuration

Edit `config/organizations.json`:
```json
{
  "organizations": [
    "tscircuit",
    "your-target-org",
    "another-org"
  ],
  "priority_organizations": [
    "tscircuit",
    "zio",
    "twentyhq"
  ],
  "evaluation_thresholds": {
    "minAmount": 5000,
    "maxAttempts": 0,
    "minSuccessForPrep": 75,
    "autoPrep": false
  }
}
```

### Deno Tasks

Use predefined tasks in `deno.json`:
```bash
# Available tasks:
deno task generate           # Basic index generation
deno task generate:full      # Full scan
deno task generate:quick     # Quick 6-hour update
deno task evaluate           # Basic evaluation
deno task evaluate:priority  # Priority orgs evaluation
deno task pipeline           # Basic pipeline
deno task pipeline:auto-prep # Auto-prep enabled
deno task pipeline:conservative # Conservative prep
deno task daily             # Daily maintenance routine
deno task weekly            # Weekly analysis routine
```

## Output Structure

### Generated Files

**Bounty Indices**:
- `output/indices/bounty-index-YYYY-MM-DD.json` - Complete bounty database
- Latest index loaded automatically by evaluation and pipeline tools

**Evaluations**:
- `output/evaluations/org-repo-issuenum.md` - Individual evaluations
- Contains complete 5-phase analysis with GitHub research
- JSON summaries with structured evaluation data

**Prep Reports**:
- `output/prep/org-repo-issuenum-prep.md` - Preparation documentation
- Environment setup instructions and validation
- Implementation strategies and TDD plans

**Analysis Reports**:
- `output/reports/go-recommendations.md` - High-value GO bounties
- `output/reports/caution-recommendations.md` - Risky but valuable
- `output/reports/organization-analysis.md` - Org performance metrics

### Data Flow

```
1. Algora API → bounty-index-YYYY-MM-DD.json
2. Index → Claude Code evaluation → evaluations/
3. GO bounties → Claude Code prep → prep/
4. All data → Analysis reports → reports/
```

## Performance Optimization

### Batch Operations

**Evaluate multiple orgs in parallel**:
```bash
# Use pipeline orchestrator for efficiency
deno task pipeline:auto-prep
```

**Rate limiting considerations**:
- 5-second delay between Claude Code evaluations
- 3-second delay between prep operations
- 200ms delay between Algora API calls

### Resource Management

**Memory usage**:
- Each evaluation: ~10-50MB memory
- Large indices: ~100MB memory
- Claude Code timeout: 5-10 minutes per evaluation

**Storage requirements**:
- Index files: ~5-10MB each
- Evaluation files: ~5-50KB each
- Prep files: ~10-100KB each

## Troubleshooting

### Common Issues

**"No bounty index found"**:
```bash
# Generate initial index
deno task generate:full
```

**Claude Code evaluation timeouts**:
```bash
# Reduce batch size
deno run --allow-all src/claude-evaluation-engine.ts --max-evaluations=1
```

**API rate limiting**:
```bash
# Use incremental updates
deno task generate:quick
```

**Missing evaluation framework**:
```bash
# Check framework files exist
ls -la workflows/CLAUDE-EVALUATE-BOUNTY.md
ls -la workflows/CLAUDE-PREP-BOUNTY.md
```

### Debug Mode

Enable verbose output:
```bash
# Add debug flag to Claude Code operations
# Edit src/claude-evaluation-engine.ts and change:
.debug(false)
# to:
.debug(true)
```

### Log Analysis

**Check latest evaluations**:
```bash
ls -lat output/evaluations/ | head -5
```

**Review evaluation results**:
```bash
grep -r "go_no_go.*go" output/evaluations/ | wc -l
```

**Find prep-ready bounties**:
```bash
grep -r "prep_status.*completed" output/indices/bounty-index-*.json
```

## Best Practices

### Evaluation Strategy

1. **Start Conservative**: Use `--max-attempts=0` for fresh bounties
2. **Focus Quality**: Use `--min-success=80` for auto-prep
3. **Batch Efficiently**: Use pipeline orchestrator over individual tools
4. **Monitor Success**: Review reports regularly for pattern recognition

### Workflow Integration

1. **Daily Routine**: Quick update + evaluate 3 bounties
2. **Weekly Analysis**: Comprehensive evaluation + strategic review
3. **Monthly Deep Dive**: Full scan + organization analysis
4. **Continuous Learning**: Update frameworks based on outcomes

### Success Metrics

Track these key indicators:
- **Evaluation Accuracy**: GO vs actual implementation success
- **Prep Quality**: Environment validation success rate
- **Time Efficiency**: Evaluation time vs manual research time
- **Discovery Rate**: New high-value opportunities per week