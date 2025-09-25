/**
 * Schema Validation Utilities
 *
 * Runtime validation functions for bounty data integrity and type safety.
 */

import type {
  Bounty,
  BountyIndex,
  AssignmentCheckResult,
  GitHubAssignment,
  AlgoraAssignment
} from './bounty-schema.ts';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single bounty object
 */
export function validateBounty(bounty: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!bounty.id) errors.push('Missing required field: id');
  if (!bounty.status) errors.push('Missing required field: status');
  if (!bounty.reward?.amount) errors.push('Missing required field: reward.amount');
  if (!bounty.org?.handle) errors.push('Missing required field: org.handle');
  if (!bounty.task?.url) errors.push('Missing required field: task.url');

  // Status validation
  const validStatuses = ['open', 'paid', 'claimed', 'closed'];
  if (bounty.status && !validStatuses.includes(bounty.status)) {
    errors.push(`Invalid status: ${bounty.status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Reward validation
  if (bounty.reward?.amount && bounty.reward.amount < 0) {
    errors.push('Reward amount cannot be negative');
  }
  if (bounty.reward?.amount && bounty.reward.amount < 1000) {
    warnings.push('Reward amount is very low (< $10)');
  }

  // URL validation
  if (bounty.task?.url && !isValidGitHubUrl(bounty.task.url)) {
    errors.push('Invalid GitHub URL format');
  }

  // Assignment consistency validation
  if (bounty.internal?.github_assignment && bounty.internal?.algora_assignment) {
    const githubAssigned = bounty.internal.github_assignment.assignees?.length > 0;
    const algoraClaimed = bounty.internal.algora_assignment.claimed;

    if (githubAssigned && !algoraClaimed) {
      warnings.push('GitHub shows assigned but Algora shows not claimed');
    }
    if (!githubAssigned && algoraClaimed) {
      warnings.push('Algora shows claimed but GitHub shows not assigned');
    }
  }

  // Evaluation status validation
  if (bounty.internal?.evaluation_status === 'evaluated') {
    if (!bounty.internal.go_no_go) {
      errors.push('Evaluated bounties must have go_no_go decision');
    }
    if (bounty.internal.success_probability === undefined) {
      warnings.push('Evaluated bounties should have success_probability');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate bounty index structure
 */
export function validateBountyIndex(index: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!index.generated_at) errors.push('Missing required field: generated_at');
  if (!index.organizations) errors.push('Missing required field: organizations');
  if (!Array.isArray(index.organizations)) {
    errors.push('Organizations must be an array');
  }

  // Schema version check
  if (!index.schema_version) {
    warnings.push('Missing schema_version - consider adding for future compatibility');
  }

  // Statistics validation
  if (index.total_bounties !== undefined && index.organizations) {
    const actualTotal = index.organizations.reduce((sum: number, org: any) =>
      sum + (org.bounties?.length || 0), 0);

    if (index.total_bounties !== actualTotal) {
      errors.push(`Total bounties mismatch: reported ${index.total_bounties}, actual ${actualTotal}`);
    }
  }

  // Validate each organization
  if (index.organizations && Array.isArray(index.organizations)) {
    index.organizations.forEach((org: any, idx: number) => {
      if (!org.organization) {
        errors.push(`Organization ${idx}: missing organization field`);
      }
      if (!Array.isArray(org.bounties)) {
        errors.push(`Organization ${idx}: bounties must be an array`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate GitHub assignment data
 */
export function validateGitHubAssignment(assignment: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!assignment.last_checked) {
    errors.push('Missing last_checked timestamp');
  }

  if (!Array.isArray(assignment.assignees)) {
    errors.push('Assignees must be an array');
  }

  if (!Array.isArray(assignment.labels)) {
    errors.push('Labels must be an array');
  }

  if (assignment.state && !['open', 'closed'].includes(assignment.state)) {
    errors.push(`Invalid GitHub state: ${assignment.state}`);
  }

  // Check if last_checked is recent (within 24 hours)
  if (assignment.last_checked) {
    const lastCheck = new Date(assignment.last_checked);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (lastCheck < dayAgo) {
      warnings.push('GitHub assignment data is stale (>24 hours old)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate Algora assignment data
 */
export function validateAlgoraAssignment(assignment: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (assignment.claimed && !assignment.claimant) {
    warnings.push('Bounty marked as claimed but no claimant specified');
  }

  if (assignment.claimant && !assignment.claimed) {
    errors.push('Claimant specified but bounty not marked as claimed');
  }

  if (!Array.isArray(assignment.bids)) {
    errors.push('Bids must be an array');
  }

  // Check if last_checked is recent (within 1 hour for Algora)
  if (assignment.last_checked) {
    const lastCheck = new Date(assignment.last_checked);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (lastCheck < hourAgo) {
      warnings.push('Algora assignment data is stale (>1 hour old)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate assignment check result
 */
export function validateAssignmentCheckResult(result: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result.bounty_id) errors.push('Missing bounty_id');
  if (result.is_available === undefined) errors.push('Missing is_available flag');
  if (!result.last_checked) errors.push('Missing last_checked timestamp');

  if (!Array.isArray(result.github_assignees)) {
    errors.push('github_assignees must be an array');
  }

  if (!Array.isArray(result.conflicts)) {
    errors.push('conflicts must be an array');
  }

  if (!Array.isArray(result.errors)) {
    errors.push('errors must be an array');
  }

  // Logic validation
  if (result.github_assigned && result.github_assignees?.length === 0) {
    errors.push('github_assigned is true but no assignees listed');
  }

  if (!result.github_assigned && result.github_assignees?.length > 0) {
    errors.push('github_assigned is false but assignees are listed');
  }

  if (result.algora_claimed && !result.algora_claimant) {
    warnings.push('algora_claimed is true but no claimant specified');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Utility functions
 */
function isValidGitHubUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'github.com' &&
           parsedUrl.pathname.includes('/issues/');
  } catch {
    return false;
  }
}

/**
 * Comprehensive validation for a complete bounty index
 */
export function validateCompleteIndex(index: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate index structure
  const indexResult = validateBountyIndex(index);
  errors.push(...indexResult.errors);
  warnings.push(...indexResult.warnings);

  // Validate each bounty
  if (index.organizations && Array.isArray(index.organizations)) {
    let totalBounties = 0;

    index.organizations.forEach((org: any, orgIdx: number) => {
      if (org.bounties && Array.isArray(org.bounties)) {
        org.bounties.forEach((bounty: any, bountyIdx: number) => {
          totalBounties++;
          const bountyResult = validateBounty(bounty);

          // Prefix errors with location
          bountyResult.errors.forEach(err =>
            errors.push(`Org ${orgIdx} (${org.organization}), Bounty ${bountyIdx}: ${err}`)
          );
          bountyResult.warnings.forEach(warn =>
            warnings.push(`Org ${orgIdx} (${org.organization}), Bounty ${bountyIdx}: ${warn}`)
          );
        });
      }
    });

    console.log(`✅ Validated ${totalBounties} bounties across ${index.organizations.length} organizations`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate validation report
 */
export function generateValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✅ Validation PASSED - No errors found');
  } else {
    lines.push('❌ Validation FAILED');
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('🚨 ERRORS:');
    result.errors.forEach(error => lines.push(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️  WARNINGS:');
    result.warnings.forEach(warning => lines.push(`  - ${warning}`));
  }

  lines.push('');
  lines.push(`📊 Summary: ${result.errors.length} errors, ${result.warnings.length} warnings`);

  return lines.join('\n');
}