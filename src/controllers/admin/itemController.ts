import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';
import { addBadgeService, updateBadgeService, deleteBadgeService } from '@/services/badgeService';
import { upsertTranslation, getTranslationsForEntity, applyTranslations, SupportedLanguage } from '@/services/translationService';

// for garden item(background, pot)
export const getGardenItems = async (req: AuthRequest, res: Response) => {
    try {
      const items = await prisma.gardenItem.findMany({
        orderBy: { category: 'asc' }
      });

      // Add translation data for admin
      const itemsWithTranslations = await Promise.all(
        items.map(async (item) => {
          const translations = await getTranslationsForEntity('GardenItem', item.id.toString());
          return {
            ...item,
            ...translations
          };
        })
      );

      res.json(itemsWithTranslations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching items' });
    }
  };

export const getGardenItemById = async (req: AuthRequest, res: Response) => {
    try {
      const item = await prisma.gardenItem.findUnique({
        where: { id: parseInt(req.params.id) }
      });

      if (!item) {
        return res.status(404).json({ message: 'Garden item not found' });
      }

      // Add translation data for admin
      const translations = await getTranslationsForEntity('GardenItem', item.id.toString());
      const itemWithTranslations = {
        ...item,
        ...translations
      };

      res.json(itemWithTranslations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching item' });
    }
  };

export const createGardenItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, nameKo, category, imageUrl, iconUrl, price, mode, isAvailable } = req.body;

    if (!name || !category || !imageUrl || !iconUrl || price === undefined || price === null) {
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    if (category === 'background' && !mode) {
      return res.status(400).json({
        message: 'Mode is required for background category'
      });
    }

      const gardenItem = await prisma.gardenItem.create({
        data: {
          name, // default (english)
          category,
          imageUrl,
          iconUrl,
          price: parseInt(price),
          mode: mode || 'default',
          isAvailable: isAvailable,
          updatedById: req.superUser!.id
        }
      });

      // Add Korean translation if provided
      if (nameKo) {
        await upsertTranslation(
          'GardenItem',
          gardenItem.id.toString(),
          'name',
          'ko',
          nameKo
        );
      }

      // Get created item with translations for admin
      const translations = await getTranslationsForEntity('GardenItem', gardenItem.id.toString());
      const itemWithTranslations = {
        ...gardenItem,
        ...translations
      };

      res.json({
        data: category === 'background' ? itemWithTranslations : { ...itemWithTranslations, mode: undefined }
      });
    } catch (error) {
      console.error('Item creation error:', error);
      res.status(500).json({ 
        message: 'Item creation failed' 
      });
    }
  };

export const updateGardenItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, nameKo, category, imageUrl, price, mode, isAvailable } = req.body;
    
    // Check if mode is required for background category
    if (category === 'background' && !mode) {
      return res.status(400).json({
        message: 'Mode is required for background category'
      });
    }
      
      const updateData: {
        name?: string;
        category?: string;
        imageUrl?: string;
        price?: number;
        mode?: string;
        isAvailable?: boolean;
        updatedBy: { connect: { id: string } };
      } = {
        updatedBy: { connect: { id: req.superUser!.id } }
      };

      // update only if the field is not undefined (conditional field update)
      if (name !== undefined) updateData.name = name; // default (english)
      if (category !== undefined) updateData.category = category;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (price !== undefined) updateData.price = parseInt(price);
      if (mode !== undefined) updateData.mode = mode;
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

      const updatedItem = await prisma.gardenItem.update({
        where: { id: parseInt(req.params.id) },
        data: updateData  // only includes fields that were provided
      });

      // Update Korean translation if provided
      if (nameKo !== undefined) {
        await upsertTranslation(
          'GardenItem',
          updatedItem.id.toString(),
          'name',
          'ko',
          nameKo
        );
      }

      // Get updated item with translations for admin
      const translations = await getTranslationsForEntity('GardenItem', updatedItem.id.toString());
      const itemWithTranslations = {
        ...updatedItem,
        ...translations
      };

      res.json(category === 'background' ? itemWithTranslations : { ...itemWithTranslations, mode: undefined });
    } catch (error) {
      console.error('Garden item update error:', error);
      res.status(500).json({ message: 'Error updating item' });
    }
  };

export const deleteGardenItem = async (req: AuthRequest, res: Response) => {
    try {
      await prisma.gardenItem.delete({
        where: { id: parseInt(req.params.id) }
      });
      res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Garden item deletion error:', error);
      res.status(500).json({ message: 'Error deleting item' });
    }
  };

// for badge
export const getBadges = async (req: AuthRequest, res: Response) => {
    try {
      const badges = await prisma.badge.findMany();
      
      // Add translation data for admin
      const badgesWithTranslations = await Promise.all(
        badges.map(async (badge) => {
          const translations = await getTranslationsForEntity('Badge', badge.id.toString());
          return {
            ...badge,
            ...translations
          };
        })
      );
      
      res.json(badgesWithTranslations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching badges' });
    }
  };

export const createBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, nameKo, condition, conditionKo, imageUrl } = req.body;

    if (!name || !condition || !imageUrl) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // use badgeService (cache invalidation included)
    const badge = await addBadgeService({ name, condition, imageUrl });

    // Add Korean translation if provided
    if (nameKo && badge) {
      await upsertTranslation(
        'Badge',
        badge.id.toString(),
        'name',
        'ko',
        nameKo
      );
    }

    // Add Korean translation for condition if provided
    if (conditionKo && badge) {
      await upsertTranslation(
        'Badge',
        badge.id.toString(),
        'condition',
        'ko',
        conditionKo
      );
    }

    res.status(201).json({ message: 'Badge created successfully' });
  } catch (error) {
    console.error('Badge creation error:', error);
    res.status(500).json({ message: 'Error creating badge' });
  }
};

export const getBadgeById = async (req: AuthRequest, res: Response) => {
  try {
    const badge = await prisma.badge.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    // Add translation data for admin
    const translations = await getTranslationsForEntity('Badge', badge.id.toString());
    const badgeWithTranslations = {
      ...badge,
      ...translations
    };

    res.json(badgeWithTranslations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badge' });
  }
};

export const updateBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, nameKo, condition, conditionKo, imageUrl } = req.body;

    const updateData: {
      name?: string;
      condition?: string;
      imageUrl?: string;
      updatedById: string;
    } = {
      updatedById: req.superUser!.id
    };

    // update only if the field is not undefined (conditional field update)
    if (name !== undefined) updateData.name = name; // default (english)
    if (condition !== undefined) updateData.condition = condition;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    // use badgeService (cache invalidation included)
    await updateBadgeService(parseInt(req.params.id), updateData);

    // Update Korean translation if provided
    if (nameKo !== undefined) {
      await upsertTranslation(
        'Badge',
        req.params.id,
        'name',
        'ko',
        nameKo
      );
    }

    // Update Korean translation for condition if provided
    if (conditionKo !== undefined) {
      await upsertTranslation(
        'Badge',
        req.params.id,
        'condition',
        'ko',
        conditionKo
      );
    }

      res.json({ message: 'Badge updated successfully' });
  } catch (error) {
    console.error('Badge update error:', error);
    res.status(500).json({ message: 'Error updating badge' });
  }
};

export const deleteBadge = async (req: AuthRequest, res: Response) => {
  try {
    const badgeId = parseInt(req.params.id);
    
    // use badgeService (cache invalidation included)
    await deleteBadgeService(badgeId);
    
    res.status(200).json({ message: 'Badge deleted successfully' });
  } catch (error) {
    console.error('Badge deletion error:', error);
    res.status(500).json({ message: 'Error deleting badge' });
  }
};