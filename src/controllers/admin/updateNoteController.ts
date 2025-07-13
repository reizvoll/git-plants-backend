import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// UPDATE NOTE MANAGEMENT
export const getUpdateNotes = async (req: AuthRequest, res: Response) => {
  try {
    const updateNotes = await prisma.updateNote.findMany({
      include: {
        gardenItems: true
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.json(updateNotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update notes' });
  }
};

export const getUpdateNoteById = async (req: AuthRequest, res: Response) => {
  try {
    const updateNote = await prisma.updateNote.findUnique({
      where: { id: parseInt(req.params.id) }
    });
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
    const { title, description, imageUrl, month, year, gardenItemIds } = req.body;
    
    if (!title || !description || !imageUrl || !month || !year) {
      return res.status(400).json({ 
        message: 'Title, description, imageUrl, month, and year are required' 
      });
    }
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Check if update note already exists for this month/year
    const existingUpdateNote = await prisma.updateNote.findFirst({
      where: {
        month: parseInt(month),
        year: parseInt(year)
      }
    });
    
    if (existingUpdateNote) {
      return res.status(409).json({ 
        message: 'An update note already exists for this month and year' 
      });
    }
    
    // Create update note
    const updateNote = await prisma.updateNote.create({
      data: {
        title,
        description,
        imageUrl,
        month: parseInt(month),
        year: parseInt(year),
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
    console.error('Update note creation error:', error);
    res.status(500).json({ message: 'Error creating update note' });
  }
};

export const updateUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, isActive, gardenItemIds } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Build update data
    const updateData: any = {
      updatedById: req.superUser!.id
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    
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