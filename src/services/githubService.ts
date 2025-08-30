import axios, { AxiosError } from 'axios';
import prisma from '@/config/db';
import { GitHubActivity,GitHubGraphQLResponse, ContributionTimelineEntry } from '@/types/github';
import { autoUpdateAllUserPlants } from '@/controllers/auth/userController';
import { GitHubCacheService } from '@/services/cacheService';
import { REDIS_CONFIG } from '@/config/redis';

// Save auto sync users
const autoSyncUsers = new Map<string, NodeJS.Timeout>();

// Simplified GraphQL query - only contributions
const CONTRIBUTIONS_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

export const fetchUserActivities = async (userId: string, username: string): Promise<GitHubActivity[]> => {
  try {
    console.log('Fetching activities for user:', username);

    // get user's accessToken from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accessToken: true }
    });

    if (!user?.accessToken) {
      throw new Error('GitHub access token not found');
    }

    // Call GraphQL API
    const response = await axios.post<GitHubGraphQLResponse>(
      'https://api.github.com/graphql',
      {
        query: CONTRIBUTIONS_QUERY,
        variables: { username }
      },
      {
        headers: {
          Authorization: `token ${user.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    const userData = response.data.data.user;
    if (!userData) {
      throw new Error('User data not found');
    }

    // Aggregate contributions by month
    const monthlyContributions = new Map<string, number>();

    // Transform daily contributions into monthly aggregates
    userData.contributionsCollection.contributionCalendar.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        if (day.contributionCount > 0) {
          const date = new Date(day.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${month}`;

          const currentCount = monthlyContributions.get(key) || 0;
          monthlyContributions.set(key, currentCount + day.contributionCount);
        }
      });
    });

    // Upsert monthly activities
    for (const [monthKey, totalCount] of monthlyContributions) {
      const [year, month] = monthKey.split('-').map(Number);

      await prisma.gitHubActivity.upsert({
        where: {
          userId_month_year: {
            userId,
            month,
            year
          }
        },
        update: {
          count: totalCount
        },
        create: {
          userId,
          month,
          year,
          count: totalCount
        }
      });

      // update cache
      await GitHubCacheService.setMonthlyContribution(userId, year, month, totalCount);
    }

    // update current month cache
    await GitHubCacheService.invalidateCurrentMonth(userId);

    // Auto-update plant growth if there are new activities
    if (monthlyContributions.size > 0) {
      try {
        await autoUpdateAllUserPlants(userId);
        console.log(`Plant growth updated for user: ${username}`);
      } catch (error) {
        console.error('Error updating plant growth:', error);
      }
    }

    // Return saved activities
    const savedActivities = await prisma.gitHubActivity.findMany({
      where: { userId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return savedActivities;
  } catch (error) {
    console.error('Detailed error:', error);
    if (error instanceof AxiosError) {
      console.error('Error response:', error.response?.data);
    }
    throw error;
  }
};

// Setup automatic GitHub activity sync for a user
export const setupAutoSync = async (userId: string): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });

    if (!user) return false;

    // Stop existing sync if any
    stopAutoSync(userId);

    // Setup interval for auto sync (every 12 hours)
    const intervalId = setInterval(async () => {
      try {
        console.log(`Auto syncing GitHub activities for user: ${user.username}`);
        await fetchUserActivities(userId, user.username);
      } catch (error) {
        console.error(`Auto sync error for user ${user.username}:`, error);
      }
    }, REDIS_CONFIG.GITHUB_SYNC_INTERVAL_MS); // 환경변수로 설정 가능

    autoSyncUsers.set(userId, intervalId);
    console.log(`Auto sync setup for user: ${user.username}`);

    return true;
  } catch (error) {
    console.error('Error setting up auto sync:', error);
    return false;
  }
};

// Stop automatic sync for a user
export const stopAutoSync = (userId: string): boolean => {
  const intervalId = autoSyncUsers.get(userId);
  if (intervalId) {
    clearInterval(intervalId);
    autoSyncUsers.delete(userId);
    console.log(`Auto sync stopped for user: ${userId}`);
    return true;
  }
  return false;
};

// Get auto sync status
export const getAutoSyncStatus = (userId: string): boolean => {
  return autoSyncUsers.has(userId);
};

// GitHub GraphQL API Query for not-signed in user's contribution
const PUBLIC_CONTRIBUTION_QUERY = `
  query($username: String!, $from: DateTime, $to: DateTime) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

// Fetch public contribution calendar by username
export const fetchPublicContributionCalendarByUsername = async (
  username: string,
  githubApiToken: string,
  period?: string,
  year?: string
): Promise<ContributionTimelineEntry[]> => {
  const apiUrl = process.env.GITHUB_GRAPHQL_API_URL;
  if (!apiUrl) {
    console.error('GITHUB_GRAPHQL_API_URL environment variable is not set.');
    throw new Error('Server configuration error: GitHub API URL is missing.');
  }

  let fromDate: Date | undefined;
  let toDate: Date | undefined = new Date();

  if (period === 'all') {
    fromDate = new Date();
    fromDate.setFullYear(toDate.getFullYear() - 5);
  } else if (period === 'year' && year) {
    const numericYear = parseInt(year);
    fromDate = new Date(numericYear, 0, 1);
    toDate = new Date(numericYear, 11, 31, 23, 59, 59);
  } else if (period) {
    const now = new Date();
    const periodMap: Record<string, number> = {
      'day': 1, 'week': 7, 'month': 30, 'year': 365,
    };
    const days = periodMap[period.toLowerCase()];
    if (days) {
      fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      toDate = now;
    } else {
      fromDate = new Date();
      fromDate.setFullYear(new Date().getFullYear() - 1);
    }
  } else {
    fromDate = new Date();
    fromDate.setFullYear(new Date().getFullYear() - 1);
  }

  try {
    const response = await axios.post<GitHubGraphQLResponse>(
      apiUrl,
      {
        query: PUBLIC_CONTRIBUTION_QUERY,
        variables: {
          username,
          from: fromDate?.toISOString(),
          to: toDate?.toISOString()
        },
      },
      {
        headers: {
          Authorization: `bearer ${githubApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    const userData = response.data.data.user;
    if (!userData) {
      throw new Error('User data not found');
    }

    const contributions: ContributionTimelineEntry[] = [];

    userData.contributionsCollection.contributionCalendar.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        contributions.push({
          date: day.date,
          count: day.contributionCount,
        });
      });
    });

    return contributions;
  } catch (error) {
    console.error('Error fetching public contribution calendar:', error);
    if (error instanceof AxiosError) {
      console.error('Error response:', error.response?.data);
    }
    throw error;
  }
};
