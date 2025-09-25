#!/usr/bin/env -S deno run --allow-all

/**
 * Repository Cache Manager
 *
 * XDG-compliant caching system for bounty repositories to support
 * multi-session development and avoid repeated downloads.
 */

import { join, basename, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.208.0/fs/mod.ts";

/**
 * XDG Base Directory specification paths
 */
function getXDGPaths() {
  const home = Deno.env.get("HOME");
  if (!home) {
    throw new Error("HOME environment variable not set");
  }

  return {
    cache: Deno.env.get("XDG_CACHE_HOME") || join(home, ".cache"),
    data: Deno.env.get("XDG_DATA_HOME") || join(home, ".local", "share"),
    config: Deno.env.get("XDG_CONFIG_HOME") || join(home, ".config"),
  };
}

/**
 * Get bounty-pipe cache directories
 */
export function getBountyPipePaths() {
  const xdg = getXDGPaths();

  return {
    // Repository cache (XDG_CACHE_HOME/bounty-pipe/<org>/<repo>)
    repoCache: join(xdg.cache, "bounty-pipe"),

    // Working directories for active bounties (XDG_DATA_HOME/bounty-pipe/work)
    workDir: join(xdg.data, "bounty-pipe", "work"),

    // Repository metadata file (XDG_CACHE_HOME/bounty-pipe/repo_metadata.json)
    metadataFile: join(xdg.cache, "bounty-pipe", "repo_metadata.json"),
  };
}

interface CachedRepo {
  org: string;
  repo: string;
  path: string;
  lastUpdated: string;
  gitCommit: string;
  bountyCount: number; // Track how many bounties use this repo
}

interface RepoMetadata {
  repos: CachedRepo[];
  lastCleanup: string;
}

/**
 * Repository Cache Manager
 */
export class RepositoryCache {
  private paths = getBountyPipePaths();

  constructor() {
    // Metadata file is now directly specified in paths
  }

  /**
   * Initialize cache directories
   */
  async initialize(): Promise<void> {
    await Deno.mkdir(this.paths.repoCache, { recursive: true });
    await Deno.mkdir(this.paths.workDir, { recursive: true });

    // Ensure parent directory for metadata file exists
    await Deno.mkdir(dirname(this.paths.metadataFile), { recursive: true });
  }

  /**
   * Load repository metadata
   */
  private async loadMetadata(): Promise<RepoMetadata> {
    try {
      if (await exists(this.paths.metadataFile)) {
        const content = await Deno.readTextFile(this.paths.metadataFile);
        return JSON.parse(content);
      }
    } catch (error) {
      console.log(`⚠️ Could not load repo metadata: ${error.message}`);
    }

    return {
      repos: [],
      lastCleanup: new Date().toISOString(),
    };
  }

  /**
   * Save repository metadata
   */
  private async saveMetadata(metadata: RepoMetadata): Promise<void> {
    await Deno.writeTextFile(this.paths.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get cached repository path or clone if needed
   */
  async getRepository(org: string, repo: string, options: {
    maxAgeHours?: number;
    forBounty?: boolean;
  } = {}): Promise<string> {
    const { maxAgeHours = 168, forBounty = true } = options; // Default: 1 week cache

    await this.initialize();

    const metadata = await this.loadMetadata();
    const repoKey = `${org}/${repo}`;
    const repoPath = join(this.paths.repoCache, org, repo);

    // Check if repo exists in cache
    let cachedRepo = metadata.repos.find(r => r.org === org && r.repo === repo);

    if (cachedRepo && await exists(cachedRepo.path)) {
      // Check if cache is still fresh
      const lastUpdate = new Date(cachedRepo.lastUpdated);
      const hoursOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursOld < maxAgeHours) {
        console.log(`📁 Using cached repository: ${repoKey} (${Math.round(hoursOld)}h old)`);

        // Update bounty count if this is for a bounty
        if (forBounty) {
          cachedRepo.bountyCount++;
          await this.saveMetadata(metadata);
        }

        return cachedRepo.path;
      } else {
        console.log(`🔄 Cache expired for ${repoKey} (${Math.round(hoursOld)}h old), updating...`);
      }
    }

    // Clone or update repository
    console.log(`📦 Cloning/updating repository: ${repoKey}`);

    try {
      // Ensure parent directory exists
      await Deno.mkdir(join(this.paths.repoCache, org), { recursive: true });

      if (await exists(repoPath)) {
        // Update existing repository
        console.log(`  🔄 Updating existing clone...`);
        const gitPull = new Deno.Command("git", {
          args: ["pull", "origin", "HEAD"],
          cwd: repoPath,
          stdout: "piped",
          stderr: "piped",
        });

        const { code } = await gitPull.output();
        if (code !== 0) {
          console.log(`  ⚠️ Git pull failed, removing and re-cloning...`);
          await Deno.remove(repoPath, { recursive: true });
          await this.cloneRepository(org, repo, repoPath);
        }
      } else {
        // Fresh clone
        await this.cloneRepository(org, repo, repoPath);
      }

      // Get current git commit
      const gitCommit = await this.getGitCommit(repoPath);

      // Update metadata
      if (cachedRepo) {
        cachedRepo.lastUpdated = new Date().toISOString();
        cachedRepo.gitCommit = gitCommit;
        if (forBounty) cachedRepo.bountyCount++;
      } else {
        cachedRepo = {
          org,
          repo,
          path: repoPath,
          lastUpdated: new Date().toISOString(),
          gitCommit,
          bountyCount: forBounty ? 1 : 0,
        };
        metadata.repos.push(cachedRepo);
      }

      await this.saveMetadata(metadata);

      console.log(`✅ Repository cached: ${repoKey}`);
      return repoPath;

    } catch (error) {
      console.log(`❌ Failed to cache repository ${repoKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clone repository to cache
   */
  private async cloneRepository(org: string, repo: string, targetPath: string): Promise<void> {
    console.log(`  📥 Cloning ${org}/${repo}...`);

    const gitClone = new Deno.Command("git", {
      args: ["clone", `https://github.com/${org}/${repo}.git`, targetPath],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await gitClone.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Git clone failed: ${errorText}`);
    }
  }

  /**
   * Get current git commit hash
   */
  private async getGitCommit(repoPath: string): Promise<string> {
    try {
      const gitCommit = new Deno.Command("git", {
        args: ["rev-parse", "HEAD"],
        cwd: repoPath,
        stdout: "piped",
      });

      const { stdout } = await gitCommit.output();
      return new TextDecoder().decode(stdout).trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Create working directory for bounty development
   */
  async createWorkspace(org: string, repo: string, issueNumber: number, options: {
    baseRef?: string;
    branchName?: string;
  } = {}): Promise<string> {
    const { baseRef = "HEAD", branchName = `feat/issue-${issueNumber}` } = options;

    // Get cached repository
    const cachedRepoPath = await this.getRepository(org, repo, { forBounty: true });

    // Create workspace directory
    const workspaceName = `${org}-${repo}-${issueNumber}`;
    const workspacePath = join(this.paths.workDir, workspaceName);

    if (await exists(workspacePath)) {
      console.log(`📂 Using existing workspace: ${workspaceName}`);
      return workspacePath;
    }

    console.log(`🛠️ Creating workspace: ${workspaceName}`);

    // Clone from cache to workspace
    const gitClone = new Deno.Command("git", {
      args: ["clone", cachedRepoPath, workspacePath],
      stdout: "piped",
      stderr: "piped",
    });

    const { code } = await gitClone.output();
    if (code !== 0) {
      throw new Error(`Failed to create workspace from cached repository`);
    }

    // Create feature branch
    const gitCheckout = new Deno.Command("git", {
      args: ["checkout", "-b", branchName, baseRef],
      cwd: workspacePath,
      stdout: "piped",
      stderr: "piped",
    });

    await gitCheckout.output(); // Don't fail if branch already exists

    console.log(`✅ Workspace ready: ${workspacePath}`);
    return workspacePath;
  }

  /**
   * Clean up old cache entries
   */
  async cleanup(options: {
    maxAgeHours?: number;
    keepActiveRepos?: boolean;
  } = {}): Promise<void> {
    const { maxAgeHours = 720, keepActiveRepos = true } = options; // Default: 30 days

    const metadata = await this.loadMetadata();
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

    console.log(`🧹 Cleaning up repository cache (older than ${maxAgeHours}h)...`);

    let removedCount = 0;

    for (const cachedRepo of [...metadata.repos]) {
      const lastUpdate = new Date(cachedRepo.lastUpdated).getTime();
      const shouldKeep = keepActiveRepos && cachedRepo.bountyCount > 0;

      if (lastUpdate < cutoffTime && !shouldKeep) {
        try {
          if (await exists(cachedRepo.path)) {
            await Deno.remove(cachedRepo.path, { recursive: true });
            console.log(`  🗑️ Removed: ${cachedRepo.org}/${cachedRepo.repo}`);
          }

          // Remove from metadata
          const index = metadata.repos.indexOf(cachedRepo);
          if (index > -1) {
            metadata.repos.splice(index, 1);
          }

          removedCount++;
        } catch (error) {
          console.log(`  ⚠️ Failed to remove ${cachedRepo.org}/${cachedRepo.repo}: ${error.message}`);
        }
      }
    }

    metadata.lastCleanup = new Date().toISOString();
    await this.saveMetadata(metadata);

    console.log(`✅ Cleanup complete: ${removedCount} repositories removed`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalRepos: number;
    totalSize: string;
    activeRepos: number;
    oldestCache: string;
  }> {
    const metadata = await this.loadMetadata();

    // Calculate total size (approximate)
    let totalSize = 0;
    for (const cachedRepo of metadata.repos) {
      try {
        if (await exists(cachedRepo.path)) {
          const info = await Deno.stat(cachedRepo.path);
          totalSize += info.size || 0;
        }
      } catch {
        // Ignore errors for size calculation
      }
    }

    const activeRepos = metadata.repos.filter(r => r.bountyCount > 0).length;
    const oldestCache = metadata.repos.length > 0
      ? metadata.repos.reduce((oldest, repo) =>
          new Date(repo.lastUpdated) < new Date(oldest.lastUpdated) ? repo : oldest
        ).lastUpdated
      : new Date().toISOString();

    return {
      totalRepos: metadata.repos.length,
      totalSize: `${Math.round(totalSize / 1024 / 1024)}MB`,
      activeRepos,
      oldestCache,
    };
  }
}

// Export singleton instance
export const repoCache = new RepositoryCache();