#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * Bounty Validation Integration
 *
 * Integrates schema validation into the bounty processing pipeline
 * to ensure data integrity and catch issues early.
 */

import {
  validateBounty,
  validateBountyIndex,
  validateCompleteIndex,
  generateValidationReport,
  type ValidationResult
} from '../schemas/schema-validation.ts';
import type { Bounty, BountyIndex } from '../schemas/bounty-schema.ts';

/**
 * Validate a single bounty and log results
 */
export function validateAndLogBounty(bounty: Bounty, context: string = ''): boolean {
  const result = validateBounty(bounty);

  if (!result.valid) {
    console.error(`❌ Bounty validation failed ${context}:`);
    console.error(`   Bounty ID: ${bounty.id}`);
    console.error(`   Title: ${bounty.task.title}`);
    result.errors.forEach(error => console.error(`   - ${error}`));

    if (result.warnings.length > 0) {
      console.warn(`⚠️  Warnings:`);
      result.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    return false;
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️  Bounty validation warnings ${context}:`);
    console.warn(`   Bounty ID: ${bounty.id}`);
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  return true;
}

/**
 * Validate bounty index and log results
 */
export function validateAndLogIndex(index: BountyIndex, context: string = ''): boolean {
  const result = validateCompleteIndex(index);

  if (!result.valid) {
    console.error(`❌ Bounty index validation failed ${context}:`);
    console.error(generateValidationReport(result));
    return false;
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️  Bounty index validation warnings ${context}:`);
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  console.log(`✅ Bounty index validation passed ${context}`);
  return true;
}

/**
 * Validate bounties in batch and filter out invalid ones
 */
export function validateAndFilterBounties(bounties: Bounty[], context: string = ''): Bounty[] {
  const validBounties: Bounty[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  for (const bounty of bounties) {
    const result = validateBounty(bounty);

    if (result.valid) {
      validBounties.push(bounty);
      validCount++;

      if (result.warnings.length > 0) {
        warningCount++;
      }
    } else {
      invalidCount++;
      console.error(`❌ Invalid bounty filtered out: ${bounty.id} - ${bounty.task.title}`);
      result.errors.forEach(error => console.error(`   - ${error}`));
    }
  }

  console.log(`📊 Bounty validation summary ${context}:`);
  console.log(`   ✅ Valid: ${validCount}`);
  console.log(`   ❌ Invalid (filtered): ${invalidCount}`);
  console.log(`   ⚠️  With warnings: ${warningCount}`);

  return validBounties;
}

/**
 * Enhanced bounty processing with validation
 */
export async function processWithValidation<T>(
  bounties: Bounty[],
  processor: (bounty: Bounty) => Promise<T>,
  context: string = 'processing'
): Promise<{ results: T[]; validationSummary: ValidationSummary }> {
  const validationSummary: ValidationSummary = {
    total: bounties.length,
    valid: 0,
    invalid: 0,
    warnings: 0,
    processed: 0,
    errors: []
  };

  const results: T[] = [];

  for (const bounty of bounties) {
    // Validate before processing
    const validation = validateBounty(bounty);

    if (!validation.valid) {
      validationSummary.invalid++;
      validationSummary.errors.push(`${bounty.id}: ${validation.errors.join(', ')}`);
      console.error(`❌ Skipping invalid bounty ${bounty.id} during ${context}`);
      continue;
    }

    validationSummary.valid++;
    if (validation.warnings.length > 0) {
      validationSummary.warnings++;
    }

    try {
      const result = await processor(bounty);
      results.push(result);
      validationSummary.processed++;
    } catch (error) {
      validationSummary.errors.push(`${bounty.id}: Processing failed - ${error.message}`);
      console.error(`❌ Processing failed for bounty ${bounty.id}:`, error.message);
    }
  }

  console.log(`📊 Processing with validation complete (${context}):`);
  console.log(`   📥 Total: ${validationSummary.total}`);
  console.log(`   ✅ Valid: ${validationSummary.valid}`);
  console.log(`   ❌ Invalid: ${validationSummary.invalid}`);
  console.log(`   ⚠️  Warnings: ${validationSummary.warnings}`);
  console.log(`   🔄 Processed: ${validationSummary.processed}`);
  console.log(`   💥 Errors: ${validationSummary.errors.length}`);

  return { results, validationSummary };
}

/**
 * Validation summary interface
 */
export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  processed: number;
  errors: string[];
}

/**
 * Validate assignment data integrity
 */
export function validateAssignmentIntegrity(bounty: Bounty): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bounty.internal) {
    warnings.push('No internal tracking data available');
    return { valid: true, errors, warnings };
  }

  const github = bounty.internal.github_assignment;
  const algora = bounty.internal.algora_assignment;
  const isAvailable = bounty.internal.is_available;

  // Check GitHub assignment consistency
  if (github) {
    const hasAssignees = github.assignees && github.assignees.length > 0;

    if (hasAssignees && isAvailable) {
      errors.push('Bounty marked as available but has GitHub assignees');
    }

    if (!github.is_bounty) {
      warnings.push('GitHub issue does not appear to be a bounty (no bounty labels)');
    }

    if (github.state === 'closed' && isAvailable) {
      warnings.push('GitHub issue is closed but bounty marked as available');
    }
  }

  // Check Algora assignment consistency
  if (algora) {
    if (algora.claimed && isAvailable) {
      errors.push('Bounty marked as available but claimed on Algora');
    }

    if (algora.claimed && !algora.claimant) {
      warnings.push('Algora shows claimed but no claimant specified');
    }
  }

  // Check cross-platform consistency
  if (github && algora) {
    const githubAssigned = github.assignees && github.assignees.length > 0;
    const algoraClaimed = algora.claimed;

    if (githubAssigned && !algoraClaimed) {
      warnings.push('GitHub shows assigned but Algora shows not claimed');
    }

    if (!githubAssigned && algoraClaimed) {
      warnings.push('Algora shows claimed but GitHub shows not assigned');
    }
  }

  // Check availability derivation
  if (github && algora) {
    const shouldBeAvailable = github.assignees.length === 0 && !algora.claimed;
    if (shouldBeAvailable !== isAvailable) {
      errors.push(`Availability mismatch: should be ${shouldBeAvailable}, marked as ${isAvailable}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Comprehensive bounty health check
 */
export function performBountyHealthCheck(bounty: Bounty): {
  overall: boolean;
  schema: ValidationResult;
  assignment: ValidationResult;
  recommendations: string[];
} {
  const schema = validateBounty(bounty);
  const assignment = validateAssignmentIntegrity(bounty);
  const recommendations: string[] = [];

  // Generate recommendations based on validation results
  if (!schema.valid) {
    recommendations.push('Fix schema validation errors before processing');
  }

  if (!assignment.valid) {
    recommendations.push('Resolve assignment data inconsistencies');
  }

  if (bounty.internal?.github_assignment && !bounty.internal.github_assignment.is_bounty) {
    recommendations.push('Verify this is actually a bounty issue on GitHub');
  }

  if (!bounty.internal?.is_available) {
    if (bounty.internal?.github_assignment?.assignees?.length > 0) {
      recommendations.push('Consider skipping - assigned to others on GitHub');
    }
    if (bounty.internal?.algora_assignment?.claimed) {
      recommendations.push('Consider skipping - already claimed on Algora');
    }
  }

  if (bounty.reward.amount < 5000) {
    recommendations.push('Low value bounty - consider raising minimum threshold');
  }

  const overall = schema.valid && assignment.valid;

  return {
    overall,
    schema,
    assignment,
    recommendations
  };
}