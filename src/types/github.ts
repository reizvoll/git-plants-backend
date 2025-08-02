export interface GitHubActivity {
  id: string;
  userId: string;
  month: number;
  year: number;
  count: number;
}

// Input type for creating GitHubActivity (without id)
export type GitHubActivityInput = Omit<GitHubActivity, 'id'>;

// ActivityFilter defines the filter criteria for querying GitHub activities
export interface ActivityFilter {
  userId: string;
  month?: number;
  year?: number;
}

// Simplified GitHubGraphQLResponse - only contributions
export interface GitHubGraphQLResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
            }>;
          }>;
        };
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

// Contribution timeline entry for public contribution calendar
export interface ContributionTimelineEntry {
  date: string;
  count: number;
}