/**
 * Spec-Driven Development Types
 *
 * Core TypeScript interfaces for kiro.dev methodology implementation
 */

export interface BountySpec {
  bounty_id: string;
  title: string;
  amount: number;

  // Spec-driven analysis
  requirements: {
    primary: string[];
    acceptance_criteria: string[];
    constraints: string[];
    assumptions: string[];
  };

  system_design: {
    approach: string;
    architecture_changes: string[];
    integration_points: string[];
    data_flow: string;
  };

  discrete_tasks: {
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimated_effort: string;
    dependencies: string[];
    implementation_notes: string;
  }[];

  implementation_reasoning: {
    technical_approach: string;
    risk_assessment: string;
    success_indicators: string[];
    potential_blockers: string[];
  };

  // Simplified assessment (replacing complex 5-phase evaluation)
  viability: {
    score: number; // 1-10 scale
    category: 'viable' | 'challenging' | 'skip';
    reasoning: string;
    time_estimate: string;
  };
}

export interface WorkspaceInfo {
  path: string;
  repositoryPath: string;
  branchName: string;
  gitCheckpoint?: string;
}

export interface SpecAnalysisResult {
  spec: BountySpec;
  repositoryContext: {
    org: string;
    repo: string;
    path: string;
    analyzedFiles: string[];
  };
}

export interface ImplementationResult {
  success: boolean;
  completedTasks: string[];
  failedTasks: string[];
  testsPassing: boolean;
  qualityValidated: boolean;
  rollbackRequired: boolean;
}

export interface SubmissionResult {
  success: boolean;
  prUrl?: string;
  submissionId: string;
  qualityReport: {
    allTasksCompleted: boolean;
    acceptanceCriteriaMet: boolean;
    testsPass: boolean;
    lintingPassed: boolean;
  };
}