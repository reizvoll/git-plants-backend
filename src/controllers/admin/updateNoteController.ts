import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// UPDATE NOTE MANAGEMENT
export const getUpdateNotes = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const updateNotes = await prisma.updateNote.findMany({
      where: {
        publishedAt: { lte: now },
        OR: [
          { validUntil: null },
          { validUntil: { gte: now } }
        ],
        isActive: true
      },
      include: {
        gardenItems: true
      },
      orderBy: [
        { publishedAt: 'desc' }
      ]
    });
    res.json(updateNotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update notes' });
  }
};

export const getUpdateNoteById = async (req: AuthRequest, res: Response) => {
  try {
    let updateNote;
    const now = new Date();
    
    // If id is "active", return the current active update note
    if (req.params.id === 'active') {
      updateNote = await prisma.updateNote.findFirst({
        where: { 
          isActive: true,
          OR: [
            { validUntil: null },
            { validUntil: { gte: now } }
          ]
        },
        include: {
          gardenItems: true
        },
        orderBy: { publishedAt: 'desc' }
      });
    } else {
      updateNote = await prisma.updateNote.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          gardenItems: true
        }
      });
    }
    
    if (!updateNote) {
      return res.status(404).json({ message: 'Update note not found' });
    }
    
    res.json(updateNote);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update note' });
  }
} 

export const createUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, validUntil, gardenItemIds, publishedAt } = req.body;
    
    if (!title || !description || !imageUrl) {
      return res.status(400).json({ 
        message: 'Title, description, and imageUrl are required' 
      });
    }
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Validate publishedAt if provided
    if (publishedAt) {
      const publishDate = new Date(publishedAt);
      if (isNaN(publishDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid publishedAt date format' 
        });
      }
    }
    
    // disable past active update notes
    await prisma.updateNote.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    // Create update note - publishedAt is required for scheduling
    const updateNote = await prisma.updateNote.create({
      data: {
        title,
        description,
        imageUrl,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(), // Default to now if not provided
        validUntil: validUntil ? new Date(validUntil) : undefined,
        updatedById: req.superUser!.id,
        gardenItems: gardenItemIds ? {
          connect: gardenItemIds.map((id: number) => ({ id }))
        } : undefined
      },
      include: {
        gardenItems: true
      }
    });
    
    res.status(201).json(updateNote);
  } catch (error) {
    console.error('Create update note error:', error);
    res.status(500).json({ message: 'Error creating update note' });
  }
};

export const updateUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, isActive, validUntil, publishedAt, gardenItemIds } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Build update data
    const updateData: any = {
      updatedById: req.superUser!.id
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      
      // if this note is activated, disable all other notes
      if (isActive) {
        await prisma.updateNote.updateMany({
          where: { 
            isActive: true,
            id: { not: parseInt(req.params.id) }
          },
          data: { isActive: false }
        });
      }
    }
    
    // Handle garden items relationship
    if (gardenItemIds !== undefined) {
      updateData.gardenItems = {
        set: [], // Clear existing connections
        connect: gardenItemIds.map((id: number) => ({ id }))
      };
    }
    
    const updatedNote = await prisma.updateNote.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        gardenItems: true
      }
    });
    
    res.json(updatedNote);
  } catch (error) {
    console.error('Update note update error:', error);
    res.status(500).json({ message: 'Error updating update note' });
  }
}; 

export const deleteUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.updateNote.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.status(200).json({ message: 'Update note deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting update note' });
  }
};