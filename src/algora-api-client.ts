#!/usr/bin/env -S deno run --allow-net

/**
 * Algora API Client - DISABLED VERSION
 *
 * The Algora API returns unreliable fake/placeholder data, so we disable all API calls
 * and rely solely on GitHub assignment status and external scraper data.
 */

// Export types for compatibility
export interface BountyClaimStatus {
  bountyId: string;
  claimed: boolean;
  claimant?: string;
  claimDate?: string;
  lastChecked: string;
  error?: string;
}

export interface AssignmentCheckResult {
  bounty_id: string;
  is_available: boolean;
  github_assigned: boolean;
  github_assignees: string[];
  algora_claimed: boolean;
  algora_claimant?: string;
  last_checked: string;
  conflicts: string[];
  errors: string[];
}

/**
 * DISABLED: Algora API returns fake data
 * Always returns 'not claimed' since API is unreliable
 */
export async function checkBountyAvailability(bountyId: string): Promise<BountyClaimStatus> {
  console.log(`⚠️ Algora API disabled for ${bountyId} - API returns fake data`);

  return {
    bountyId,
    claimed: false, // Always false - API disabled
    lastChecked: new Date().toISOString(),
    error: 'Algora API disabled due to fake data responses'
  };
}

/**
 * GitHub-only assignment check (Algora API disabled)
 */
export async function checkComprehensiveAssignment(bounty: any): Promise<AssignmentCheckResult> {
  const result: AssignmentCheckResult = {
    bounty_id: bounty.id,
    is_available: true,
    github_assigned: false,
    github_assignees: [],
    algora_claimed: false, // Always false - API disabled
    last_checked: new Date().toISOString(),
    conflicts: [],
    errors: ['Algora API disabled - returns fake placeholder data']
  };

  try {
    // Check GitHub assignment (RELIABLE)
    if (bounty.task?.url) {
      const [owner, repo, , issueNumber] = bounty.task.url.replace('https://github.com/', '').split('/');

      if (owner && repo && issueNumber) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
        const githubResponse = await fetch(apiUrl);

        if (githubResponse.ok) {
          const issueData = await githubResponse.json();
          result.github_assignees = issueData.assignees?.map((a: any) => a.login) || [];
          result.github_assigned = result.github_assignees.length > 0;
        } else {
          result.errors.push(`GitHub API returned ${githubResponse.status}`);
        }
      } else {
        result.errors.push('Invalid GitHub URL format');
      }
    }

    // Determine final availability (GitHub only)
    result.is_available = !result.github_assigned;

  } catch (error) {
    result.errors.push(`GitHub assignment check failed: ${error.message}`);
    result.is_available = false;
  }

  return result;
}

/**
 * DISABLED: Batch check - all return false since API is disabled
 */
export async function checkMultipleBountyAvailability(bountyIds: string[]): Promise<BountyClaimStatus[]> {
  console.log(`⚠️ Algora API batch check disabled for ${bountyIds.length} bounties`);

  return bountyIds.map(id => ({
    bountyId: id,
    claimed: false,
    lastChecked: new Date().toISOString(),
    error: 'Algora API disabled due to fake data responses'
  }));
}

// All other functions return disabled/no-op versions
export async function updateBountyClaimStatus(bounty: any): Promise<boolean> {
  return false; // Always available since API is disabled
}

export async function batchUpdateClaimStatus(bounties: any[]): Promise<void> {
  console.log(`⚠️ Algora batch update disabled - API returns fake data`);
}