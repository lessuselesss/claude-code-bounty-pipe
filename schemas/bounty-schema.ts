/**
 * Formal Bounty Schema
 *
 * Comprehensive TypeScript interface defining the complete bounty data structure
 * that combines Algora API data with GitHub assignment information and internal
 * pipeline tracking fields.
 */

// Core bounty status types
export type BountyStatus = 'open' | 'paid' | 'claimed' | 'closed';
export type BountyType = 'standard' | 'premium' | 'urgent';
export type BountyKind = 'dev' | 'design' | 'research' | 'documentation';
export type BountyVisibility = 'public' | 'private';
export type RewardType = 'cash' | 'points' | 'hybrid';
export type Currency = 'USD' | 'EUR' | 'BTC' | 'ETH';

// GitHub-specific types
export type GitHubIssueState = 'open' | 'closed';
export type GitHubForge = 'github' | 'gitlab' | 'bitbucket';

// Pipeline evaluation types
export type EvaluationStatus = 'not_evaluated' | 'in_progress' | 'evaluated' | 'evaluation_failed';
export type GoNoGoDecision = 'go' | 'no-go' | 'caution' | 'pending';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type PrepStatus = 'not_prepped' | 'in_progress' | 'completed' | 'failed';
export type SubmissionStatus = 'not_submitted' | 'attempt_declared' | 'implementing' | 'pr_submitted' | 'pr_approved' | 'bounty_claimed' | 'submission_failed';
export type ImplementationStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';

/**
 * GitHub User Information
 */
export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  location: string;
  company: string;
  avatar_url: string;
  twitter_username: string;
  html_url: string;
}

/**
 * GitHub Issue Label
 */
export interface GitHubLabel {
  id: number;
  name: string;
  description: string;
  color: string;
}

/**
 * GitHub Assignment Information (from GitHub API)
 */
export interface GitHubAssignment {
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  state: GitHubIssueState;
  closed_by?: GitHubUser;
  closed_at?: string;
  last_checked: string; // When we last fetched from GitHub API
  is_bounty: boolean; // Derived from labels containing 'Bounty' or '$'
  bounty_labels: string[]; // Labels that indicate bounty (e.g., "$150", "💎 Bounty")
}

/**
 * Algora Assignment Information (from Algora API)
 */
export interface AlgoraAssignment {
  claimed?: boolean;
  claimant?: string;
  claim_date?: string;
  last_checked?: string;
  bids: any[]; // Usually empty in current API
  manual_assignments: boolean;
  error?: string; // If there was an error checking Algora
}

/**
 * Reward Information
 */
export interface Reward {
  currency: Currency;
  amount: number; // Amount in cents/smallest unit
  formatted: string; // Human-readable format (e.g., "$150")
  tiers: RewardTier[];
  type: RewardType;
}

export interface RewardTier {
  name: string;
  amount: number;
  currency: Currency;
  requirements?: string[];
}

/**
 * Organization Information (from Algora)
 */
export interface Organization {
  handle: string;
  id: string;
  name: string;
  display_name: string;
  description: string;
  github_handle: string;
  avatar_url: string;
  website_url: string;
  discord_url: string;
  slack_url: string;
  twitter_url: string;
  youtube_url: string;
  tech: string[];
  stargazers_count: number;
  accepts_sponsorships: boolean;
  enabled_expert_recs: boolean;
  enabled_private_bounties: boolean;
  days_until_timeout?: number;
  members: any[]; // Organization members
  created_at: string;
}

/**
 * Task/Issue Information (combines Algora + GitHub data)
 */
export interface Task {
  // Core identifiers
  id: string;
  number: number;
  hash: string; // Format: "repo#issue_number"

  // Content
  title: string;
  body: string;
  url: string; // GitHub issue URL

  // Repository information
  repo_name: string;
  repo_owner: string;
  forge: GitHubForge;

  // Status and metadata
  status: GitHubIssueState; // From GitHub API
  tech: string[];
  type: 'issue' | 'pull_request';

  // GitHub source data (from Algora API)
  source: {
    data: {
      id: string;
      user: GitHubUser; // Issue creator
      title: string;
      body: string;
      html_url: string;
    };
    type: GitHubForge;
  };
}

/**
 * Implementation Result Data
 */
export interface ImplementationResult {
  tests_passing: boolean;
  requirements_met: boolean;
  code_quality_validated: boolean;
  ready_for_submission: boolean;
  performance_impact?: string;
  security_considerations?: string[];
  breaking_changes?: boolean;
}

/**
 * Internal Pipeline Tracking
 */
export interface InternalTracking {
  // Evaluation phase
  evaluation_status: EvaluationStatus;
  go_no_go: GoNoGoDecision;
  complexity_score?: number; // 1-10 scale
  success_probability?: number; // 0-100 percentage
  risk_level: RiskLevel;
  evaluation_file?: string; // Path to evaluation report
  last_evaluated?: string;
  red_flags?: string[];
  estimated_timeline?: string;
  notes?: string;
  claude_code_evaluated?: boolean;

  // Preparation phase
  prep_status?: PrepStatus;
  prep_file?: string;
  environment_validated?: boolean;
  test_suite_passing?: boolean;
  implementation_plan_ready?: boolean;

  // Implementation phase
  implementation_status?: ImplementationStatus;
  implementation_started_at?: string;
  implementation_completed_at?: string;
  implementation_file?: string;
  implementation_result?: ImplementationResult;

  // Submission phase
  our_submission_status?: SubmissionStatus;
  our_attempt_declared_at?: string;
  our_pr_url?: string;
  our_pr_submitted_at?: string;
  our_claim_submitted?: boolean;
  our_submission_file?: string;
  our_implementation_summary?: string;

  // Assignment tracking (from both sources)
  github_assignment?: GitHubAssignment;
  algora_assignment?: AlgoraAssignment;

  // Derived assignment status
  is_available: boolean; // True if not assigned on GitHub AND not claimed on Algora
  assignment_last_checked: string;
  assignment_conflict?: string; // If GitHub and Algora show different states
}

/**
 * Complete Bounty Schema
 *
 * This is the master interface that defines the complete bounty data structure
 * used throughout the pipeline.
 */
export interface Bounty {
  // Core Algora identifiers
  id: string; // Algora bounty ID
  status: BountyStatus;
  type: BountyType;
  kind: BountyKind;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Configuration
  visibility: BountyVisibility;
  autopay_disabled: boolean;
  is_external: boolean;
  manual_assignments: boolean;
  timeouts_disabled: boolean;

  // Technology and metadata
  tech: string[];
  point_reward?: any;

  // Financial information
  reward: Reward;

  // Organization and task
  org: Organization;
  task: Task;

  // External data (optional, from initial discovery)
  attempt_count?: number;

  // Internal pipeline tracking
  internal?: InternalTracking;
}

/**
 * Organization Bounties Collection
 */
export interface OrganizationBounties {
  organization: string;
  bounties: Bounty[];
  total_bounties: number;
  total_amount: number;
  last_updated: string;
  github_assignment_check_enabled: boolean;
  algora_assignment_check_enabled: boolean;
  error?: string;
}

/**
 * Complete Bounty Index
 */
export interface BountyIndex {
  generated_at: string;
  last_full_scan?: string;
  update_mode: 'full' | 'incremental';
  schema_version: string; // For future compatibility

  // Statistics
  total_organizations: number;
  total_bounties: number;
  total_amount: number;
  available_bounties: number; // Not assigned/claimed

  // Assignment checking status
  github_api_enabled: boolean;
  algora_api_enabled: boolean;
  assignment_check_coverage: number; // Percentage of bounties checked

  // Pipeline configuration
  evaluation_thresholds: {
    minAmount: number;
    maxAttempts: number;
    minSuccessForPrep: number;
    autoPrep: boolean;
  };

  // Data
  organizations: OrganizationBounties[];

  // Metadata
  api_rate_limits?: {
    github_remaining?: number;
    algora_remaining?: number;
  };
  errors?: string[];
  warnings?: string[];
}

/**
 * Assignment Check Result
 */
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
 * Batch Assignment Check Result
 */
export interface BatchAssignmentCheckResult {
  total_checked: number;
  available_bounties: number;
  github_assigned: number;
  algora_claimed: number;
  conflicts: number;
  errors: number;
  results: AssignmentCheckResult[];
  check_duration_ms: number;
}

// Re-export for convenience
export type {
  BountyStatus,
  BountyType,
  BountyKind,
  EvaluationStatus,
  GoNoGoDecision,
  RiskLevel,
  PrepStatus,
  SubmissionStatus,
  ImplementationStatus
};