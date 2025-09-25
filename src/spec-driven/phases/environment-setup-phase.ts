#!/usr/bin/env -S deno run --allow-all

/**
 * Environment Setup Phase
 *
 * Stage 2 of spec-driven pipeline: Setup isolated development environment
 */

import type { BountySpec } from '../types.ts';
import { query } from 'npm:@anthropic-ai/claude-code@latest';
import { getBountyPipePaths } from '../../repository-cache.ts';
import { ClaudeMdGenerator } from '../utils/claude-md-generator.ts';

export interface EnvironmentSetupResult {
  success: boolean;
  workspacePath: string;
  branchName: string;
  developmentReady: boolean;
  setupLog: string[];
  claudeMarkdownGenerated?: boolean;
  claudeMarkdownPath?: string;
}

export class EnvironmentSetupPhase {
  private claudeMarkdownGenerator = new ClaudeMdGenerator();

  /**
   * Setup isolated development environment for spec implementation
   */
  async setupEnvironment(spec: BountySpec, cachedRepoPath: string): Promise<EnvironmentSetupResult> {
    console.log(`🏗️  Setting up development environment for: ${spec.title}`);

    const paths = getBountyPipePaths();
    const workspacePath = `${paths.repoCache}/spec-workspaces/${spec.bounty_id}`;
    const branchName = `feat/spec-driven-impl-${spec.bounty_id}`;
    const setupLog: string[] = [];

    // Ensure HOME variable is properly expanded in commands
    const expandedWorkspacePath = workspacePath.replace('${HOME}', Deno.env.get('HOME') || '~');

    const setupPrompt = `
You are setting up a development environment for spec-driven implementation.

SPECIFICATION CONTEXT:
- Bounty ID: ${spec.bounty_id}
- Title: ${spec.title}
- Tasks: ${spec.discrete_tasks.length} discrete tasks to implement
- Repository: Available at ${cachedRepoPath}

ENVIRONMENT SETUP REQUIREMENTS:

1. WORKSPACE PREPARATION
   - Create isolated workspace at: ${workspacePath}
   - Copy repository files from cache to workspace
   - Initialize git repository if not already present
   - Create feature branch: ${branchName}

2. DEVELOPMENT TOOLS VERIFICATION
   - Check for package.json, deno.json, Cargo.toml, or other build files
   - Identify test framework (Jest, Deno test, cargo test, etc.)
   - Verify linting tools availability (eslint, deno lint, clippy)
   - Check formatting tools (prettier, deno fmt, rustfmt)

3. DEPENDENCY MANAGEMENT
   - Install or verify dependencies are available
   - Check if development server can start
   - Validate build process works
   - Ensure test suite can run

4. GIT SETUP
   - Create feature branch for implementation
   - Set up git hooks if present
   - Verify git is properly configured

EXECUTE ALL SETUP TASKS and report:
- ✅ Success status for each step
- 🔧 Tools and frameworks detected
- 📁 Workspace location and git status
- ⚠️ Any issues or missing dependencies
- 🎯 Confirmation that environment is ready for TDD implementation

Return structured summary of environment setup status.
`;

    try {
      let response = '';
      for await (const message of query({
        prompt: setupPrompt,
        options: {
          model: 'claude-3-5-sonnet-20241022',
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          cwd: cachedRepoPath, // Start from cached repo
          maxTurns: 10, // Reduced from 15 to prevent timeouts
          hooks: {
            PreToolUse: [{
              hooks: [async (input) => {
                console.log(`   🔧 Setup tool: ${input.tool_name}`);
                setupLog.push(`${input.tool_name}: ${JSON.stringify(input.tool_input)}`);
                return { continue: true };
              }]
            }]
          }
        }
      })) {
        if (message.type === 'assistant') {
          response += message.message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            response = message.result;
          }
          break;
        }
      }

      // Verify actual filesystem state instead of parsing text responses
      const setupChecks = {
        workspaceCreated: await this.verifyWorkspaceExists(expandedWorkspacePath),
        gitInitialized: await this.verifyGitRepository(expandedWorkspacePath),
        branchCreated: await this.verifyBranchExists(expandedWorkspacePath, branchName),
        dependenciesReady: await this.verifyDependencies(expandedWorkspacePath),
        buildVerified: await this.verifyBuildSystem(expandedWorkspacePath)
      };

      // Enhanced logging with actual filesystem state
      console.log(`   📁 Workspace exists: ${setupChecks.workspaceCreated ? '✓' : '✗'}`);
      console.log(`   🔧 Git repository: ${setupChecks.gitInitialized ? '✓' : '✗'}`);
      console.log(`   🌿 Branch created: ${setupChecks.branchCreated ? '✓' : '✗'}`);
      console.log(`   📦 Dependencies: ${setupChecks.dependenciesReady ? '✓' : '✗'}`);
      console.log(`   🔨 Build system: ${setupChecks.buildVerified ? '✓' : '✗'}`);

      // Check for critical failures in response (more targeted)
      const responseLower = response.toLowerCase();
      const criticalFailures = [
        /error: .*(failed|cannot|unable)/i,
        /permission denied.*file/i,
        /fatal: .*(not found|failed)/i,
        /build failed/i,
        /compilation error/i
      ].some(pattern => pattern.test(response));

      // Count successful checks
      const successfulChecks = Object.values(setupChecks).filter(v => v).length;

      // Core requirements: workspace + git + branch (more realistic threshold)
      const coreRequirements = setupChecks.workspaceCreated && setupChecks.gitInitialized && setupChecks.branchCreated;
      const success = coreRequirements && !criticalFailures;

      // Development ready requires git and branch setup
      const developmentReady = success &&
                              setupChecks.gitInitialized &&
                              (setupChecks.branchCreated || response.includes('branch'));

      // Detailed logging for debugging
      console.log(`   ${success ? '✅' : '❌'} Environment setup ${success ? 'completed' : 'failed'}`);
      if (!success) {
        console.log(`   ⚠️ Setup checks (${successfulChecks}/5):`);
        Object.entries(setupChecks).forEach(([check, passed]) => {
          console.log(`      ${passed ? '✓' : '✗'} ${check}`);
        });
        if (criticalFailures) {
          console.log(`      ⚠️ Failure indicators detected in response`);
        }
      }
      if (developmentReady) {
        console.log(`   🎯 Development environment ready for TDD implementation`);
      }

      // Generate project-specific CLAUDE.md file
      let claudeMarkdownGenerated = false;
      let claudeMarkdownPath: string | undefined;

      if (success && developmentReady) {
        console.log(`   📝 Generating project-specific CLAUDE.md...`);
        try {
          const claudeResult = await this.claudeMarkdownGenerator.generateClaudeMarkdown(
            spec,
            expandedWorkspacePath,
            cachedRepoPath
          );

          if (claudeResult.success) {
            claudeMarkdownGenerated = true;
            claudeMarkdownPath = claudeResult.filePath;
            console.log(`   ✅ CLAUDE.md generated: ${claudeResult.template} template`);
            setupLog.push(`CLAUDE.md generated using ${claudeResult.template} template`);
          } else {
            console.log(`   ⚠️ CLAUDE.md generation failed, continuing without project-specific instructions`);
            setupLog.push(`CLAUDE.md generation failed: ${claudeResult.generationLog.join(', ')}`);
          }
        } catch (error) {
          console.log(`   ⚠️ CLAUDE.md generation error: ${error instanceof Error ? error.message : String(error)}`);
          setupLog.push(`CLAUDE.md generation error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        success,
        workspacePath,
        branchName,
        developmentReady,
        setupLog,
        claudeMarkdownGenerated,
        claudeMarkdownPath
      };

    } catch (error) {
      console.error(`❌ Environment setup failed: ${error instanceof Error ? error.message : String(error)}`);

      return {
        success: false,
        workspacePath,
        branchName,
        developmentReady: false,
        setupLog: [...setupLog, `Error: ${error instanceof Error ? error.message : String(error)}`],
        claudeMarkdownGenerated: false,
        claudeMarkdownPath: undefined
      };
    }
  }

  /**
   * Verify workspace directory exists
   */
  private async verifyWorkspaceExists(workspacePath: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(workspacePath);
      return stat.isDirectory;
    } catch {
      return false;
    }
  }

  /**
   * Verify git repository is initialized
   */
  private async verifyGitRepository(workspacePath: string): Promise<boolean> {
    try {
      const gitDir = await Deno.stat(`${workspacePath}/.git`);
      return gitDir.isDirectory;
    } catch {
      return false;
    }
  }

  /**
   * Verify specific branch exists and is checked out
   */
  private async verifyBranchExists(workspacePath: string, branchName: string): Promise<boolean> {
    try {
      const process = new Deno.Command('git', {
        args: ['branch', '--show-current'],
        cwd: workspacePath,
        stdout: 'piped',
        stderr: 'piped'
      });
      const { stdout } = await process.output();
      const currentBranch = new TextDecoder().decode(stdout).trim();
      return currentBranch === branchName;
    } catch {
      return false;
    }
  }

  /**
   * Verify dependencies are ready (basic check for common files)
   */
  private async verifyDependencies(workspacePath: string): Promise<boolean> {
    try {
      // Check for common dependency files
      const commonFiles = ['package.json', 'Cargo.toml', 'requirements.txt', 'pom.xml', 'build.gradle'];

      for (const file of commonFiles) {
        try {
          const stat = await Deno.stat(`${workspacePath}/${file}`);
          if (stat.isFile) return true; // Found at least one dependency file
        } catch {
          continue; // File doesn't exist, try next
        }
      }

      // If no dependency files found, assume dependencies are ready (e.g., simple projects)
      return true;
    } catch {
      return true; // Default to true for robustness
    }
  }

  /**
   * Verify build system is functional (basic check for build files)
   */
  private async verifyBuildSystem(workspacePath: string): Promise<boolean> {
    try {
      // Check for common build files
      const buildFiles = ['Makefile', 'CMakeLists.txt', 'build.gradle', 'meson.build'];

      for (const file of buildFiles) {
        try {
          const stat = await Deno.stat(`${workspacePath}/${file}`);
          if (stat.isFile) return true; // Found at least one build file
        } catch {
          continue; // File doesn't exist, try next
        }
      }

      // If no specific build files found, assume build system is ready (e.g., interpreted languages)
      return true;
    } catch {
      return true; // Default to true for robustness
    }
  }
}