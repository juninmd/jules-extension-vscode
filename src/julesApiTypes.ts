export interface JulesSource {
  name: string;
  id: string;
  githubRepo?: {
    owner: string;
    repo: string;
  };
}

export interface ListSourcesResponse {
  sources: JulesSource[];
  nextPageToken?: string;
}

export interface JulesPullRequest {
  url: string;
  title?: string;
  description?: string;
}

export interface JulesSessionOutput {
  pullRequest?: JulesPullRequest;
}

export interface JulesTask {
  name: string;
  id?: string;
  title?: string;
  prompt: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'pendingApproval';
  createdAt?: string;
  updatedAt?: string;
  sourceContext?: {
    source: string;
    githubRepoContext?: {
      startingBranch?: string;
    };
  };
  outputs?: JulesSessionOutput[];
}

export interface ListTasksResponse {
  sessions: JulesTask[];
  nextPageToken?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  index: number;
}

export interface JulesActivity {
  name: string;
  id?: string;
  createTime: string;
  originator?: 'agent' | 'user';
  artifacts?: Array<{
    bashOutput?: { command: string; output: string; exitCode: number };
    changeSet?: {
      source: string;
      gitPatch?: {
        unidiffPatch: string;
        baseCommitId: string;
        suggestedCommitMessage: string;
      };
    };
    media?: { data: string; mimeType: string };
  }>;
  planGenerated?: {
    plan: {
      id: string;
      steps: PlanStep[];
    };
  };
  planApproved?: { planId: string };
  progressUpdated?: { title: string; description: string };
  sessionCompleted?: Record<string, never>;
}

export interface ListActivitiesResponse {
  activities: JulesActivity[];
  nextPageToken?: string;
}

export interface CreateTaskRequest {
  prompt: string;
  sourceContext: {
    source: string;
    githubRepoContext?: {
      startingBranch?: string;
    };
  };
  automationMode?: 'AUTO_CREATE_PR';
  requirePlanApproval?: boolean;
  title?: string;
}
