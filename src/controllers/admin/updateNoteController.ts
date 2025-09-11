import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';
import { UpdateNoteService } from '@/services/updateNoteService';
import { upsertTranslation, getTranslationsForEntity } from '@/services/translationService';

// UPDATE NOTE MANAGEMENT
export const getUpdateNotes = async (req: AuthRequest, res: Response) => {
  try {
    // update isActive status automatically based on time
    await UpdateNoteService.updateActiveStatus();
    
    // show all notes in admin (no filtering)
    const updateNotes = await prisma.updateNote.findMany({
      include: { gardenItems: true },
      orderBy: [{ publishedAt: 'desc' }]
    });
    
    // Add translation data for admin
    const notesWithTranslations = await Promise.all(
      updateNotes.map(async (note) => {
        const translations = await getTranslationsForEntity('UpdateNote', note.id.toString());
        return {
          ...note,
          ...translations
        };
      })
    );
    
    res.json(notesWithTranslations);
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
          OR: [
            { validUntil: null },
            { validUntil: { gte: now } }
          ]
        },
        include: { gardenItems: true },
        orderBy: { publishedAt: 'desc' }
      });
    } else {
      updateNote = await prisma.updateNote.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { gardenItems: true }
      });
    }
    
    if (!updateNote) {
      return res.status(404).json({ message: 'Update note not found' });
    }
    
    // Add translation data for admin
    const translations = await getTranslationsForEntity('UpdateNote', updateNote.id.toString());
    const noteWithTranslations = {
      ...updateNote,
      ...translations
    };
    
    res.json(noteWithTranslations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update note' });
  }
};

export const createUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, titleKo, description, descriptionKo, imageUrl, validUntil, gardenItemIds, publishedAt } = req.body;
    
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
        title, // default (english)
        description, // default (english)
        imageUrl,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(), // Default to now if not provided
        validUntil: validUntil ? new Date(validUntil) : undefined,
        updatedById: req.superUser!.id,
        gardenItems: gardenItemIds ? {
          connect: gardenItemIds.map((id: number) => ({ id }))
        } : undefined
      },
      include: { gardenItems: true }
    });

    // Add Korean translations if provided
    const noteId = updateNote.id.toString();
    
    if (titleKo) {
      await upsertTranslation('UpdateNote', noteId, 'title', 'ko', titleKo);
    }
    if (descriptionKo) {
      await upsertTranslation('UpdateNote', noteId, 'description', 'ko', descriptionKo);
    }

    // Apply time-based automation after creating the note
    await UpdateNoteService.handleNoteCreation(updateNote.id);
    
    res.status(201).json(updateNote);
  } catch (error) {
    console.error('Create update note error:', error);
    res.status(500).json({ message: 'Error creating update note' });
  }
};

export const updateUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, titleKo, description, descriptionKo, imageUrl, validUntil, publishedAt, gardenItemIds } = req.body;
    const noteId = parseInt(req.params.id);
    
    const updatedNote = await UpdateNoteService.updateNote(
      noteId,
      { title, description, imageUrl, validUntil, publishedAt, gardenItemIds }, // default (english)
      req.superUser!.id
    );
    
    // Update Korean translations if provided
    const noteIdStr = req.params.id;
    
    if (titleKo !== undefined) {
      await upsertTranslation('UpdateNote', noteIdStr, 'title', 'ko', titleKo);
    }
    if (descriptionKo !== undefined) {
      await upsertTranslation('UpdateNote', noteIdStr, 'description', 'ko', descriptionKo);
    }
    
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