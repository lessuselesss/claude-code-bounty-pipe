# Prep Bounty Workflow

After completing the 5-phase bounty evaluation and deciding to proceed, follow this systematic preparation workflow based on the successful tscircuit #758 preparation:

## Workflow Overview

This 10-step process ensures systematic bounty preparation with reproducible development environments, TDD foundations, and clean development practices.

**Time Investment**: 1-2 hours of preparation ensures implementation success
**Success Rate**: Validated environment guarantees TDD approach viability
**ROI**: Front-loaded setup prevents environment issues during implementation

## Step 1: Repository Setup (5-10 minutes)

```bash
# Check if organization directory exists, create if needed
ls -la | grep <org-name> || mkdir -p <org-name>

# Check if repository exists locally in org directory
ls -la <org-name>/ | grep <repo-name>

# If exists but we need issue-specific clone, use descriptive name
# Example: If repo is "tscircuit" and issue is #788, create "tscircuit-issue-788-description"
target_dir="<org-name>/<repo-name>"
if [ -d "$target_dir" ]; then
  target_dir="<org-name>/<repo-name>-issue-<number>-<brief-description>"
fi

# Clone to organized structure: <org>/<repo> or <org>/<repo-issue-specific>
git clone https://github.com/<org>/<repo-name> "$target_dir"
cd "$target_dir"
```

## Step 2: Feature Branch Creation (2-3 minutes)

```bash
# Create and checkout feature branch with descriptive name
git checkout -b feat/issue-<number>-<brief-description>
# Example: git checkout -b feat/issue-1264-netlabel-collision-detection
```

## Step 3: Implementation Analysis & Documentation (15-30 minutes)

Create targeted `CLAUDE.md` with implementation plan based on evaluation findings:

```markdown
# CLAUDE.md - Issue #<number> Implementation Guide

## Issue Context
[Brief description and link to bounty issue]

## Implementation Strategy
[Detailed technical approach based on evaluation]

## Architecture Overview
[Key components and integration points identified]

## Files to Implement/Modify
[Specific file paths and changes needed]

## Technical Dependencies
[Required libraries, APIs, existing functions]

## Success Criteria
[Clear definition of "done" and acceptance criteria]

## Timeline
[Realistic development schedule with milestones]
```

## Step 4: Test-Driven Development Plan (20-40 minutes)

Use ultrathink to create comprehensive `TEST_PLAN.md`:

```bash
# Use ultrathink for thorough test planning
# Analyze existing test patterns in the codebase
# Create TDD approach following project standards
```

**TEST_PLAN.md Structure:**
- **Existing Test Patterns**: Analysis of current testing harness
- **Unit Test Strategy**: Individual function/component tests
- **Integration Test Strategy**: Multi-component interaction tests
- **Visual/Snapshot Tests**: UI and rendering validation (if applicable)
- **Edge Case Coverage**: Boundary conditions and error scenarios
- **Test Implementation Order**: TDD sequence for development

## Step 5: Development Environment Setup and Testing (20-40 minutes)

This critical step ensures the environment is properly configured for TDD by validating against the existing test harness.

### 5.1: Analyze Project Configuration

```bash
# Analyze project dependencies
cat package.json | jq '.dependencies, .devDependencies'
cat package.json | jq '.scripts'

# Identify testing framework and commands
cat package.json | jq '.scripts | to_entries[] | select(.key | contains("test"))'

# Check for existing nix configuration
ls flake.nix .envrc 2>/dev/null || echo "No existing nix config"

# Identify native dependencies (common culprits for test failures)
cat package.json | jq '.dependencies, .devDependencies' | grep -E "(sharp|canvas|sqlite|bcrypt|node-gyp)"
```

### 5.2: Template Selection and Application

**Template Selection from gh:lessuselesss/dev-templates:**
- **TypeScript/Node.js projects**: `typescript-node/` template
- **Deno/Bun projects**: `deno/` or custom Bun template
- **React/Frontend projects**: `react-vite/` template
- **Rust projects**: `rust/` template
- **Go projects**: `go/` template
- **Python projects**: `python/` template

```bash
# Fetch appropriate template
curl -s https://raw.githubusercontent.com/lessuselesss/dev-templates/main/<template>/flake.nix > flake.nix
curl -s https://raw.githubusercontent.com/lessuselesss/dev-templates/main/<template>/.envrc > .envrc
```

### 5.3: Iterative Dependency Resolution

**CRITICAL**: Keep tweaking ONLY the flake.nix until tests run successfully!

```bash
# Initial test attempt
nix develop
bun install  # or npm install
bun test     # or npm test

# If tests fail, analyze error messages for missing dependencies
```

**Common Dependency Patterns by Error Type:**

```nix
# Native module compilation errors
packages = with pkgs; [
  stdenv.cc.cc.lib
  pkg-config
  python3
  gnumake
  gcc
];

# Sharp/image processing errors
packages = with pkgs; [
  vips
  glib
  expat
  librsvg
  libjpeg
  libpng
  libtiff
  libwebp
];

# Database connectivity errors
packages = with pkgs; [
  postgresql
  mysql
  sqlite
  redis
];

# Canvas/graphics errors
packages = with pkgs; [
  cairo
  pango
  pixman
  freetype
  fontconfig
];

# Crypto/bcrypt errors
packages = with pkgs; [
  openssl
  libsodium
];
```

### 5.4: Environment Variables Configuration

Add to flake.nix shellHook as needed:

```nix
shellHook = ''
  # Library paths
  export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
    pkgs.stdenv.cc.cc.lib
    # Add other required libraries
  ]}"

  # PKG_CONFIG paths for compilation
  export PKG_CONFIG_PATH="${pkgs.lib.concatMapStringsSep ":" (pkg: "${pkg}/lib/pkgconfig") [
    pkgs.vips
    pkgs.glib
    # Add other packages with pkg-config files
  ]}"

  # Node/npm specific
  export NODE_ENV=development

  # Module-specific fixes
  export SHARP_IGNORE_GLOBAL_LIBVIPS=1  # For sharp
  export CANVAS_BINARY_HOST_MIRROR=      # For canvas

  # Rebuild native modules for nix environment
  npm rebuild || true
'';
```

### 5.5: Test Harness Validation Loop

```bash
# The validation loop - KEEP ITERATING until tests pass!
while true; do
  nix develop

  # Clean install to ensure fresh state
  rm -rf node_modules package-lock.json bun.lockb
  bun install  # or npm install

  # Rebuild native modules if needed
  npm rebuild sharp 2>/dev/null || true
  npm rebuild canvas 2>/dev/null || true

  # Run the actual test suite
  bun test  # or npm test

  if [ $? -eq 0 ]; then
    echo "✅ Tests passing! Environment configured correctly."
    break
  else
    echo "❌ Tests failing. Analyze errors and update flake.nix..."
    exit  # Exit nix shell
    # Edit flake.nix to add missing dependencies
    # Then restart the loop
  fi
done
```

### 5.6: Common Test Failure Resolutions

**Pattern: "Cannot find module" for native dependencies**
```nix
# Add to packages in flake.nix
packages = with pkgs; [
  nodejs_22  # Use specific Node version if needed
  python3    # For node-gyp
];
```

**Pattern: "Library not found" or "undefined symbol"**
```nix
# Add missing system libraries
LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
  pkgs.stdenv.cc.cc.lib
  pkgs.glib
  # Add specific library mentioned in error
];
```

**Pattern: "pkg-config: command not found"**
```nix
packages = with pkgs; [
  pkg-config
  # Also add the library that needs pkg-config
];
```

**Pattern: Test timeout or performance issues**
```nix
# May need to adjust Node memory limits
shellHook = ''
  export NODE_OPTIONS="--max-old-space-size=4096"
'';
```

## Step 6: Dependency Documentation (5-10 minutes)

Once tests pass, document the working configuration:

```markdown
# In CLAUDE.md, add section:

## Working Environment Configuration

**Required Nix Packages:**
[List all packages that were needed]

**Environment Variables:**
[List any special env vars required]

**Native Module Rebuilds:**
[List any modules that needed rebuilding]

**Test Command:**
[Exact command that successfully runs tests]
```

## Step 7: Test Suite Analysis (10-15 minutes)

Now that tests run, analyze the testing patterns:

```bash
# Find all test files
find . -name "*.test.*" -o -name "*.spec.*" | head -20

# Analyze test structure
grep -r "describe\|it\|test\|expect" --include="*.test.*" | head -20

# Check for snapshot tests
find . -name "*.snap" | head -10

# Identify testing utilities
grep -r "beforeEach\|afterEach\|beforeAll\|afterAll" --include="*.test.*" | head -10
```

**Document findings in TEST_PLAN.md for TDD approach**

## Step 8: Cleanup and Gitignore (2-3 minutes)

```bash
# Add development files to gitignore
echo "
# Development files
CLAUDE.md
flake.nix
.envrc
.direnv/
TEST_PLAN.md" >> .gitignore

# Verify gitignore is working
git status | grep -E "(CLAUDE|flake|envrc|TEST_PLAN)" && echo "ERROR: Files not ignored!" || echo "✅ Files properly ignored"
```

## Step 9: Return to Root Repository (1 minute)

```bash
# Exit repository to avoid influencing worktree
cd ..
pwd  # Should be back in /home/lessuseless/Projects/Orgs/Algora/
```

## Step 10: Validation Checklist

Before proceeding with implementation, verify:

**Environment Setup:**
- [ ] Repository cloned to correct location (root repo, not /tmp)
- [ ] Feature branch created and checked out
- [ ] Appropriate dev template applied (flake.nix + .envrc)
- [ ] `nix develop` works successfully

**Testing Foundation:**
- [ ] **Existing test suite runs successfully** (CRITICAL for TDD)
- [ ] All native dependencies properly configured in flake.nix
- [ ] Test patterns and structure analyzed and documented
- [ ] Project commands (install, test, build) work reliably in nix shell

**Documentation:**
- [ ] CLAUDE.md contains detailed implementation plan
- [ ] TEST_PLAN.md outlines comprehensive TDD approach
- [ ] Working environment configuration documented
- [ ] Test harness patterns documented for TDD

**Clean Setup:**
- [ ] Development files added to .gitignore
- [ ] No uncommitted changes to actual project files
- [ ] Returned to root repository directory

## Prep Bounty Success Criteria

**Environment Ready:**
- ✅ Clean development environment with all dependencies
- ✅ **Existing test suite passes reliably** (foundation for TDD)
- ✅ Working build process and development commands
- ✅ Native dependencies correctly configured in flake.nix

**Documentation Complete:**
- ✅ Technical implementation strategy documented
- ✅ Test coverage plan established following project patterns
- ✅ Success criteria clearly defined
- ✅ Development timeline realistic and achievable
- ✅ Working environment configuration documented

**TDD Foundation:**
- ✅ Test harness patterns analyzed and understood
- ✅ Testing framework and utilities identified
- ✅ Test implementation order planned
- ✅ Ready to write failing tests first

## Example: Successful Prep (tscircuit #788)

**Repository**: tscircuit/tscircuit-issue-788-pinout-diagram
**Branch**: feat/issue-788-pinout-diagram
**Template**: Bun/TypeScript with Nix flake
**Key Dependencies**: Bun v1.2.21, Node.js v20.19.5, TypeScript v5.9.2
**Environment Validation**: Build system passes with `bun run build`
**Implementation Strategy**: SVG generation for pinout diagrams following assembly pattern
**TDD Approach**: Unit tests for SVG generation, integration tests for CLI export, visual regression with snapshots
**Timeline**: 4-5 days (50% scope reduction due to maintainer work)
**Result**: ✅ Successful preparation with validated Bun environment

**Critical Success Factor**: Validated build system and identified existing Pinout component, ensuring clear implementation path.

## Example: Previous Successful Prep (circuit-json-to-gltf #758)

**Repository**: circuit-json-to-gltf
**Branch**: feat/issue-758-gltf-support
**Template**: Custom Bun/TypeScript
**Key Dependencies**: nodejs_22, vips, glib, expat, sharp libraries
**Environment Validation**: Tests pass after `npm rebuild sharp`
**Implementation Strategy**: Custom GLTF parser following STL/OBJ pattern
**TDD Approach**: Unit tests for parser, integration tests for pipeline
**Timeline**: 3 days (83% already complete)
**Result**: ✅ Successful preparation with validated test environment

**Critical Success Factor**: Spent time getting tests to pass BEFORE implementation, ensuring TDD approach would work.

## Workflow Integration

This prep workflow seamlessly follows the 5-phase evaluation methodology:

**Phase 5 → Prep Workflow**:
1. Complete bounty evaluation and decision
2. Execute prep workflow for approved bounties
3. Begin implementation with TDD approach
4. Follow established testing and development patterns

**Key Benefits**:
- **Consistent Environment**: Reproducible development setup across all bounties
- **TDD Foundation**: Test plans ready before implementation begins
- **Clean Separation**: Development files don't pollute target repository
- **Risk Mitigation**: Environment validation catches issues early

This systematic preparation ensures bounty implementations start with maximum success probability and follow established development best practices.