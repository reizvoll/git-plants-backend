import prisma from '@/config/db';

/**
 * service for awarding default items to users automatically
 */
export class DefaultItemService {
  /**
   * helper function for awarding items
   */
  private static async awardItems(
    userId: string, 
    items: Array<{ id: number; name: string }>,
    category: string
  ): Promise<string[]> {
    const awardedItems: string[] = [];
    
    for (const item of items) {
      const existingItem = await prisma.userItem.findFirst({
        where: { userId, itemId: item.id }
      });

      if (!existingItem) {
        await prisma.userItem.create({
          data: { userId, itemId: item.id }
        });
        
        awardedItems.push(item.name);
        console.log(`Awarded ${category} "${item.name}" to user ${userId}`);
      }
    }
    
    return awardedItems;
  }

  /**
   * find and award default backgrounds for each mode
   */
  static async awardDefaultBackgrounds(userId: string): Promise<{
    garden: string[];
    mini: string[];
  }> {
    try {
      console.log(`Awarding default backgrounds to user: ${userId}`);
      
      const [gardenBackgrounds, miniBackgrounds] = await Promise.all([
        prisma.gardenItem.findMany({
          where: {
            category: 'background',
            mode: 'GARDEN',
            name: { startsWith: 'default_', mode: 'insensitive' }
          },
          select: { id: true, name: true }
        }),
        prisma.gardenItem.findMany({
          where: {
            category: 'background',
            mode: 'MINI',
            name: { startsWith: 'default_', mode: 'insensitive' }
          },
          select: { id: true, name: true }
        })
      ]);

      const [garden, mini] = await Promise.all([
        this.awardItems(userId, gardenBackgrounds, 'GARDEN background'),
        this.awardItems(userId, miniBackgrounds, 'MINI background')
      ]);

      return { garden, mini };
    } catch (error) {
      console.error('Error awarding default backgrounds:', error);
      return { garden: [], mini: [] };
    }
  }

  /**
   * find and award default pots
   */
  static async awardDefaultPots(userId: string): Promise<string[]> {
    try {
      console.log(`Awarding default pots to user: ${userId}`);
      
      const defaultPots = await prisma.gardenItem.findMany({
        where: {
          category: 'pot',
          name: { startsWith: 'default_', mode: 'insensitive' }
        },
        select: { id: true, name: true }
      });

      return await this.awardItems(userId, defaultPots, 'default pot');
    } catch (error) {
      console.error('Error awarding default pots:', error);
      return [];
    }
  }

  /**
   * award all default items (backgrounds and pots)
   */
  static async awardAllDefaultItems(userId: string): Promise<{
    backgrounds: {
      garden: string[];
      mini: string[];
    };
    pots: string[];
  }> {
    try {
      console.log(`Awarding all default items to user: ${userId}`);
      
      const [backgrounds, pots] = await Promise.all([
        this.awardDefaultBackgrounds(userId),
        this.awardDefaultPots(userId)
      ]);

      return {
        backgrounds,
        pots
      };
    } catch (error) {
      console.error('Error awarding all default items:', error);
      return {
        backgrounds: { garden: [], mini: [] },
        pots: []
      };
    }
  }
}



