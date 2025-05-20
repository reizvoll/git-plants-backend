export interface GitHubActivity {
  id: string;
  userId: string;
  type: 'contribution' | 'commit' | 'pull_request';
  repository: string;
  title: string;
  description?: string;
  url: string;
  eventId: string;
  createdAt: Date;
  contributionCount?: number;
}

// ActivityFilter defines the filter criteria for querying GitHub activities
export interface ActivityFilter {
  userId: string;
  type?: 'contribution' | 'commit' | 'pull_request';
  repository?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

// GitHubGraphQLResponse represents the structure of the GraphQL API response
export interface GitHubGraphQLResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
            }>;
          }>;
        };
      };
      repositories: {
        nodes: Array<{
          name: string;
          defaultBranchRef?: {
            target?: {
              history?: {
                nodes: Array<{
                  committedDate: string;
                  message: string;
                  url: string;
                  author: {
                    name: string;
                    email: string;
                  };
                }>;
              };
            };
          };
          pullRequests?: {
            nodes: Array<{
              title: string;
              url: string;
              createdAt: string;
              mergedAt?: string;
              state: 'MERGED' | 'CLOSED';
              repository: {
                name: string;
              };
            }>;
          };
        }>;
      };
    } | null;
  };
  errors?: Array<{
    message: string;
  }>;
}

// GroupByStats represents the result of groupBy queries for stats
export interface GroupByStats {
  type: string;
  _count: number;
}

// GroupByTimeline represents the result of groupBy queries for timeline
export interface GroupByTimeline {
  createdAt: Date;
  _sum: {
    contributionCount: number | null;
  };
}

// GroupByRepository represents the result of groupBy queries for repository distribution
export interface GroupByRepository {
  repository: string;
  _count: number;
}

// Entry for a timeline, typically date and count
export interface ContributionTimelineEntry {
  date: Date;
  count: number;
}