import prisma from '@/config/db';
import { BadgeRecord, CreateBadgeData, UserBadgeRecord, BadgeCache, BadgeCondition } from '@/types/badge';

// cache for badges
let badgeCache: BadgeCache | null = null;
const CACHE_TTL = parseInt(process.env.BADGE_CACHE_TTL || '300000'); // default 5 minutes

// cache management functions
async function loadBadgesToCache(): Promise<BadgeCache> {
  console.log('Loading badges to cache...');
  
  const badges = await prisma.badge.findMany({
    select: {
      id: true,
      name: true,
      condition: true,
      imageUrl: true
    }
  });

  const parsedBadges = badges.map((badge: BadgeRecord) => ({
    ...badge,
    parsedCondition: parseBadgeCondition(badge.condition)
  }));

  return {
    badges: parsedBadges,
    lastUpdated: new Date(),
    isStale: false
  };
}

function isCacheValid(cache: BadgeCache): boolean {
  const now = new Date();
  const timeDiff = now.getTime() - cache.lastUpdated.getTime();
  return timeDiff < CACHE_TTL && !cache.isStale;
}

async function getBadgesFromCache(): Promise<BadgeCache['badges']> {
  if (!badgeCache || !isCacheValid(badgeCache)) {
    badgeCache = await loadBadgesToCache();
  }
  return badgeCache.badges;
}

// invalidate cache
export function invalidateBadgeCache(): void {
  if (badgeCache) {
    badgeCache.isStale = true;
  }
}

// simple keyword condition parsing
export function parseBadgeCondition(conditionText: string): BadgeCondition | null {
  const text = conditionText.toLowerCase().trim();

  if (text.includes('start git plants')) {
    return { type: 'FIRST_LOGIN' };
  }

  if (text.includes('get first seed')) {
    return { type: 'FIRST_SEED' };
  }

  if (text.includes('first plant')) {
    return { type: 'FIRST_PLANT' };
  }

  if (text.includes('first harvest')) {
    return { type: 'FIRST_HARVEST' };
  }

  // year-based join condition
  const yearMatch = text.match(/joined in (\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    return { type: 'JOINED_YEAR', value: year };
  }

  // number-based condition
  const contributionMatch = text.match(/(\d+)\s*(contribution|commit)/);
  if (contributionMatch) {
    const count = parseInt(contributionMatch[1]);
    const period = text.includes('month') ? 'MONTH' : 'TOTAL';
    return { type: 'CONTRIBUTION_COUNT', value: count, period };
  }

  // harvest count condition
  const harvestMatch = text.match(/(\d+)\s*(harvest|crop)/);
  if (harvestMatch) {
    const count = parseInt(harvestMatch[1]);
    return { type: 'HARVEST_COUNT', value: count };
  }

  // plant count condition
  const plantMatch = text.match(/(\d+)\s*plant/);
  if (plantMatch) {
    const count = parseInt(plantMatch[1]);
    return { type: 'PLANT_COUNT', value: count };
  }

  // seed count condition
  const seedMatch = text.match(/(\d+)\s*seed/);
  if (seedMatch) {
    const count = parseInt(seedMatch[1]);
    return { type: 'SEED_COUNT', value: count };
  }
  
  return null;
}

// evaluate badge condition
export async function evaluateBadgeCondition(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  try {
    switch (condition.type) {
      case 'FIRST_LOGIN':
        return await evaluateFirstLogin(userId);

      case 'FIRST_SEED':
        return await evaluateFirstSeed(userId);

      case 'FIRST_PLANT':
        return await evaluateFirstPlant(userId);

      case 'FIRST_HARVEST':
        return await evaluateFirstHarvest(userId);

      case 'CONTRIBUTION_COUNT':
        return await evaluateContributionCount(condition, userId);

      case 'HARVEST_COUNT':
        return await evaluateHarvestCount(condition, userId);

      case 'PLANT_COUNT':
        return await evaluatePlantCount(condition, userId);

      case 'JOINED_YEAR':
        return await evaluateJoinedYear(condition, userId);

      case 'SEED_COUNT':
        return await evaluateSeedCount(condition, userId);

      default:
        return false;
    }
  } catch (error) {
    console.error('Error evaluating badge condition:', error);
    return false;
  }
}

// check first login (if already has badge, consider it as first login)
async function evaluateFirstLogin(userId: string): Promise<boolean> {
  const userBadges = await prisma.userBadge.count({
    where: { userId }
  });
  return userBadges === 0;
}

// check first seed
async function evaluateFirstSeed(userId: string): Promise<boolean> {
  const seed = await prisma.seed.findUnique({
    where: { userId }
  });
  return seed !== null && seed.count > 0;
}

// check first plant
async function evaluateFirstPlant(userId: string): Promise<boolean> {
  const plantCount = await prisma.userPlant.count({
    where: { userId }
  });
  return plantCount > 0;
}

// check first harvest
async function evaluateFirstHarvest(userId: string): Promise<boolean> {
  const totalHarvests = await prisma.userPlant.aggregate({
    where: { userId },
    _sum: { harvestCount: true }
  });
  return (totalHarvests._sum.harvestCount || 0) > 0;
}

// check contributions (growth)
async function evaluateContributionCount(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  if (!condition.value) return false;

  const period = condition.period || 'TOTAL';

  if (period === 'TOTAL') {
    const result = await prisma.gitHubActivity.aggregate({
      where: { userId },
      _sum: { count: true }
    });
    const totalCount = result._sum.count || 0;
    return totalCount >= condition.value;
  }

  if (period === 'MONTH') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthly = await prisma.gitHubActivity.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: currentMonth,
          year: currentYear
        }
      },
      select: { count: true }
    });

    const monthlyCount = monthly?.count || 0;
    return monthlyCount >= condition.value;
  }

  return false;
}

// check harvest count
async function evaluateHarvestCount(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  if (!condition.value) return false;

  const result = await prisma.userPlant.aggregate({
    where: { userId },
    _sum: { harvestCount: true }
  });

  const totalHarvests = result._sum.harvestCount || 0;
  return totalHarvests >= condition.value;
}

// check plant count
async function evaluatePlantCount(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  if (!condition.value) return false;

  const plantCount = await prisma.userPlant.count({
    where: { userId }
  });

  return plantCount >= condition.value;
}

// check joined year
async function evaluateJoinedYear(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  if (!condition.value) return false;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true }
    });
    
    if (!user) return false;
    
    const joinYear = user.createdAt.getFullYear();
    return joinYear === condition.value;
  } catch (error) {
    console.error('Error evaluating joined year condition:', error);
    return false;
  }
}

// evaluate seed count
async function evaluateSeedCount(
  condition: BadgeCondition,
  userId: string
): Promise<boolean> {
  if (!condition.value) return false;

  const seed = await prisma.seed.findUnique({
    where: { userId }
  });

  const totalSeeds = seed?.count || 0;
  return totalSeeds >= condition.value;
}

// check and award badges from cache
export async function checkAndAwardBadges(userId: string): Promise<Array<{name: string, imageUrl: string}>> {
  try {
    // get badges from cache
    const cachedBadges = await getBadgesFromCache();
    const awardedBadges: Array<{name: string, imageUrl: string}> = [];

    // get existing badges for user (N+1 problem)
    const existingUserBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true }
    });
    
    const existingBadgeIds = new Set(existingUserBadges.map((ub: UserBadgeRecord) => ub.badgeId));

    for (const badge of cachedBadges) {
      // check if already awarded
      if (existingBadgeIds.has(badge.id)) continue;

      // skip if parsed condition is null
      if (!badge.parsedCondition) {
        console.log(`Could not parse condition for badge: ${badge.name} - "${badge.condition}"`);
        continue;
      }

      // evaluate condition
      const shouldAward = await evaluateBadgeCondition(badge.parsedCondition, userId);

      if (shouldAward) {
        // award badge
        await prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge.id
          }
        });

        // Get badge details including imageUrl
        const badgeDetails = await prisma.badge.findUnique({
          where: { id: badge.id },
          select: { name: true, imageUrl: true }
        });

        if (badgeDetails) {
          awardedBadges.push({
            name: badgeDetails.name,
            imageUrl: badgeDetails.imageUrl
          });
        }

        console.log(`Awarded badge "${badge.name}" to user ${userId}`);
      }
    }

    return awardedBadges;
  } catch (error) {
    console.error('Error checking and awarding badges:', error);
    return [];
  }
}

// invalidate cache when badge is added/updated/deleted
export async function addBadgeService(badgeData: CreateBadgeData): Promise<BadgeRecord> {
  const badge = await prisma.badge.create({ data: badgeData });
  invalidateBadgeCache();
  return badge;
}

export async function updateBadgeService(id: number, badgeData: { 
  name?: string; 
  condition?: string; 
  imageUrl?: string;
  updatedById?: string;
}): Promise<void> {
  await prisma.badge.update({ 
    where: { id }, 
    data: badgeData 
  });
  invalidateBadgeCache();
}

export async function deleteBadgeService(id: number): Promise<void> {
  await prisma.badge.delete({ where: { id } });
  invalidateBadgeCache();
}
