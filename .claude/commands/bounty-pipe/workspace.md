---
allowed-tools: Read, Write, Edit, Bash(git:*), Bash(mkdir:*), Bash(ls:*), Bash(find:*)
argument-hint: create <org>/<repo>#<issue> | list | cleanup [--force]
description: Manage XDG-compliant bounty development workspaces
model: claude-3-5-sonnet-20241022
---

# Bounty Workspace Manager

Manage XDG-compliant development workspaces for bounty implementation with proper isolation and persistence across sessions.

## Workspace Philosophy

**Persistent Development**: Workspaces survive across sessions for multi-day bounties
**XDG Compliance**: Uses `$XDG_DATA_HOME/bounty-pipe/work` for proper system integration
**Clean Isolation**: Each bounty gets its own workspace with feature branch
**Repository Caching**: Leverages cached repositories for fast workspace creation

## WORKSPACE REQUEST

**Command**: $ARGUMENTS

Execute workspace management operation:

### Create Workspace
```bash
/bounty-pipe:workspace create tscircuit/core#1264
```

**Actions:**
- Creates isolated workspace from cached repository
- Sets up feature branch: `feat/issue-1264-bounty`
- Establishes development environment
- Preserves work across sessions

### List Workspaces
```bash
/bounty-pipe:workspace list
```

**Actions:**
- Shows all active bounty workspaces
- Displays branch status and modification dates
- Identifies workspaces ready for development

### Cleanup Workspaces
```bash
/bounty-pipe:workspace cleanup
/bounty-pipe:workspace cleanup --force
```

**Actions:**
- Removes stale or completed workspaces
- Preserves active development work
- Force mode removes all workspaces

## XDG Directory Structure

**Workspace Location**: `$XDG_DATA_HOME/bounty-pipe/work/`
```
~/.local/share/bounty-pipe/work/
├── tscircuit-core-1264/          # Workspace: org-repo-issue
│   ├── .git/                     # Git repository
│   ├── feat/issue-1264-bounty    # Feature branch
│   └── [project files]           # Ready for development
├── activepieces-activepieces-123/
└── twentyhq-twenty-567/
```

**Repository Cache**: `$XDG_CACHE_HOME/bounty-pipe/`
```
~/.cache/bounty-pipe/
├── repo_metadata.json           # Repository usage tracking
├── tscircuit/
│   ├── core/                     # Cached repository
│   ├── schematic-viewer/         # Cached repository
│   ├── tscircuit-core-1264.md   # Evaluation files in org directories
│   └── tscircuit-schematic-123.md # More evaluation reports
└── activepieces/
    ├── activepieces/             # Cached repository
    └── activepieces-activepieces-456.md # Evaluation files
```

## Workspace Features

**Isolation**: Each bounty gets completely isolated workspace
**Persistence**: Work survives system reboots and session changes
**Efficiency**: Fast creation from cached repositories
**Clean State**: Fresh feature branch for each bounty
**XDG Compliance**: Follows Linux desktop standards

## Required Output

Provide workspace operation result:

**Create Operation:**
```
✅ Workspace created: tscircuit-core-1264
📂 Location: ~/.local/share/bounty-pipe/work/tscircuit-core-1264
🌿 Branch: feat/issue-1264-bounty
🚀 Ready for development
```

**List Operation:**
```
📋 Active Bounty Workspaces:
1. tscircuit-core-1264 (feat/issue-1264-bounty) - 2 days ago
2. activepieces-activepieces-123 (feat/issue-123-bounty) - 5 hours ago
3. twentyhq-twenty-567 (feat/issue-567-bounty) - 1 day ago
```

**Cleanup Operation:**
```
🧹 Workspace cleanup completed:
- Removed 2 stale workspaces
- Preserved 1 active workspace
- Freed 150MB disk space
```

Focus on providing persistent, XDG-compliant development environments that support multi-session bounty development workflows.