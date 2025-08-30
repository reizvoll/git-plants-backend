// Database-related types

export type GardenItemType = {
  id: number;
  name: string;
  category: string;
  mode: string | null;
  imageUrl: string;
  iconUrl: string;
  price: number;
};

export type UserEquippedItem = {
  id: string;
  equipped: boolean;
  acquiredAt: Date;
  item: GardenItemType;
};