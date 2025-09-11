import prisma from '@/config/db';

export type SupportedEntity = 'GardenItem' | 'Badge' | 'MonthlyPlant' | 'UpdateNote';
export type SupportedLanguage = 'ko' | 'en';

export const applyTranslations = async <T extends Record<string, unknown> & { id: string | number }>(
  entities: T[],
  entityType: SupportedEntity,
  language: SupportedLanguage = 'en',
  fields: (keyof T)[]
): Promise<T[]> => {
  if (language === 'en') {
    return entities; // default language is english
  }

  const entityIds = entities.map(entity => String(entity.id));
  
  const translations = await prisma.translation.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      field: { in: fields.map(f => String(f)) },
      language,
    },
  });

  // convert translations to map for performance optimization
  const translationMap = new Map<string, string>();
  translations.forEach(t => {
    const key = `${t.entityId}-${t.field}`;
    translationMap.set(key, t.value);
  });

  // apply translations to entities
  return entities.map(entity => {
    const translatedEntity = { ...entity };
    
    fields.forEach(field => {
      const key = `${entity.id}-${String(field)}`;
      const translation = translationMap.get(key);
      
      if (translation) {
        (translatedEntity as Record<string, unknown>)[String(field)] = translation;
      }
    });
    
    return translatedEntity;
  });
};

// helper function for individual entities
export const applyTranslation = async <T extends Record<string, unknown> & { id: string | number }>(
  entity: T,
  entityType: SupportedEntity,
  language: SupportedLanguage = 'en',
  fields: (keyof T)[]
): Promise<T> => {
  const [translatedEntity] = await applyTranslations([entity], entityType, language, fields);
  return translatedEntity;
};

// translation creation/update function
export const upsertTranslation = async (
  entityType: SupportedEntity,
  entityId: string,
  field: string,
  language: SupportedLanguage,
  value: string
) => {
  return await prisma.translation.upsert({
    where: {
      entityType_entityId_field_language: {
        entityType,
        entityId,
        field,
        language,
      },
    },
    update: { value },
    create: {
      entityType,
      entityId,
      field,
      language,
      value,
    },
  });
};

// Get translations for admin responses (returns fields like nameKo, titleKo, etc.)
export const getTranslationsForEntity = async (entityType: SupportedEntity, entityId: string) => {
  const translations = await prisma.translation.findMany({
    where: {
      entityType,
      entityId,
      language: 'ko'
    }
  });
  
  const translationMap: { [key: string]: string } = {};
  translations.forEach(t => {
    translationMap[`${t.field}Ko`] = t.value;
  });
  
  return translationMap;
};