export type BadgeRecord = {
  id: number;
  name: string;
  condition: string;
  imageUrl: string;
};

export type CreateBadgeData = {
  name: string;
  condition: string;
  imageUrl: string;
};

export type UserBadgeRecord = {
  badgeId: number;
};

export type BadgeCache = {
  badges: Array<{
    id: number;
    name: string;
    condition: string;
    parsedCondition: BadgeCondition | null;
  }>;
  lastUpdated: Date;
  isStale: boolean;
};

// simple condition type
export type BadgeCondition = {
  type: 'FIRST_LOGIN' | 'FIRST_SEED' | 'FIRST_PLANT' | 'FIRST_HARVEST' | 'CONTRIBUTION_COUNT' | 'HARVEST_COUNT' | 'PLANT_COUNT' | 'JOINED_YEAR' | 'SEED_COUNT';
  value?: number;
  period?: 'TOTAL' | 'MONTH';
};