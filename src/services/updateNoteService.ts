import prisma, { PrismaTransaction } from '@/config/db';

/*
=== UpdateNote System Flow (업데이트 노트 시스템 플로우) ===

1. SYSTEM OVERVIEW (시스템 개요)
   - UpdateNote는 시간 기반으로 활성/비활성 상태가 자동 관리되는 시스템
   - 각 노트는 publishedAt(발행일시)와 validUntil(만료일시)를 가짐
   - 현재 시간 기준으로 가장 최근에 발행된 노트가 활성 상태가 됨

2. ACTIVE STATUS MANAGEMENT (활성 상태 관리)
   - 현재 시간 <= publishedAt인 노트 중 가장 최근 것이 활성화됨
   - 활성 노트의 validUntil은 null로 설정 (무제한 유효)
   - 이전 노트들의 validUntil은 다음 활성 노트의 publishedAt으로 설정
   - 미래 노트들의 validUntil은 null로 설정

3. ITEM AVAILABILITY SYSTEM (아이템 사용 가능성 시스템)
   - 활성 노트에 연결된 gardenItems는 isAvailable: true
   - 미래 노트의 gardenItems는 isAvailable: false (아직 사용 불가)
   - 과거 노트의 gardenItems는 validUntil이 있으면 isAvailable: true 유지

4. AUTOMATION TRIGGERS (자동화 트리거)
   - 노트 생성 시: handleNoteCreation() 호출
   - 노트 수정 시: publishedAt/validUntil 변경 시 트랜잭션으로 처리
   - 정기 실행: updateActiveStatus() 호출 (cron job 등)

5. TRANSACTION SAFETY (트랜잭션 안전성)
   - 시간 필드 변경 시 updateActiveStatusInTransaction() 사용
   - 모든 상태 변경이 원자적으로 처리됨
   - 데이터 일관성 보장

6. STATE TRANSITIONS (상태 전환)
   Future Note → Active Note → Past Note (with validUntil) → Expired Note
   (미래 노트 → 활성 노트 → 과거 노트(유효기간 있음) → 만료 노트)

7. BUSINESS LOGIC (비즈니스 로직)
   - 사용자는 현재 활성 노트의 아이템만 사용 가능
   - 과거 노트의 아이템은 validUntil까지 사용 가능
   - 미래 노트의 아이템은 발행 전까지 사용 불가
*/

export class UpdateNoteService {
  /**
   *  update active status automatically based on time
   * (시간 기반으로 노트의 활성 상태를 자동으로 업데이트)
   */
  static async updateActiveStatus(now: Date = new Date()) {
    // 1. disable expired notes (만료된 노트들 비활성화)
    await prisma.updateNote.updateMany({
      where: {
        isActive: true,
        validUntil: { not: null, lt: now }
      },
      data: { isActive: false }
    });

    // 2. find the most recent valid note (가장 최근에 발행된 유효한 노트 찾기)
    const mostRecentValidNote = await prisma.updateNote.findFirst({
      where: { publishedAt: { lte: now } },
      orderBy: { publishedAt: 'desc' }
    });

    if (mostRecentValidNote) {
      const currentActiveNote = await prisma.updateNote.findFirst({
        where: { isActive: true }
      });

      // 3. change active note if needed (필요한 경우 활성 노트 변경)
      if (!currentActiveNote || currentActiveNote.id !== mostRecentValidNote.id) {
        await prisma.updateNote.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });

        await prisma.updateNote.update({
          where: { id: mostRecentValidNote.id },
          data: { isActive: true }
        });

        await this.updateValidUntilForPreviousNotes(mostRecentValidNote.id);
      }
    } else {
      // 4. remove all validUntil if no valid note (유효한 노트가 없으면 모든 validUntil 제거)
      await prisma.updateNote.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      await prisma.updateNote.updateMany({
        where: { validUntil: { not: null } },
        data: { validUntil: null }
      });
    }

    await this.updateAllItemAvailability(now);
  }

  /**
   * update active status in transaction
   * (트랜잭션 내에서 경량화된 활성 상태 업데이트)
   */
  static async updateActiveStatusInTransaction(tx: any, now: Date) {
    const mostRecentValidNote = await tx.updateNote.findFirst({
      where: { publishedAt: { lte: now } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, publishedAt: true }
    });
    
    if (mostRecentValidNote) {
      // 1. disable all notes (모든 노트 비활성화)
      await tx.updateNote.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // 2. activate the most recent note + FIXED: set validUntil to null
      // (가장 최근 노트 활성화 + FIXED: 자신의 validUntil도 null로 설정)
      await tx.updateNote.update({
        where: { id: mostRecentValidNote.id },
        data: { 
          isActive: true,
          validUntil: null  // set validUntil to null for the activated note
        }
      });

      // 3. set validUntil for previous notes (이전 노트들의 validUntil 설정)
      await tx.updateNote.updateMany({
        where: {
          id: { not: mostRecentValidNote.id },
          publishedAt: { lt: mostRecentValidNote.publishedAt }
        },
        data: { validUntil: mostRecentValidNote.publishedAt }
      });

      // 4. remove validUntil for future notes (미래 노트들의 validUntil 제거)
      await tx.updateNote.updateMany({
        where: {
          id: { not: mostRecentValidNote.id },
          publishedAt: { gt: mostRecentValidNote.publishedAt }
        },
        data: { validUntil: null }
      });

      // 5. update item availability (아이템 사용 가능 상태 업데이트)
      await this.updateItemAvailabilityInTransaction(tx, now);
    }
  }

  /**
   * set validUntil for previous notes automatically
   * (이전 노트들의 validUntil 자동 설정)
   */
  private static async updateValidUntilForPreviousNotes(newActiveNoteId: number) {
    const newActiveNote = await prisma.updateNote.findUnique({
      where: { id: newActiveNoteId },
      select: { publishedAt: true }
    });

    if (newActiveNote) {
      // set validUntil for previous notes (이전 노트들의 validUntil 설정)
      await prisma.updateNote.updateMany({
        where: {
          id: { not: newActiveNoteId },
          publishedAt: { lt: newActiveNote.publishedAt }
        },
        data: { validUntil: newActiveNote.publishedAt }
      });

      // remove validUntil for future notes (미래 노트들의 validUntil 제거)
      await prisma.updateNote.updateMany({
        where: {
          id: { not: newActiveNoteId },
          publishedAt: { gt: newActiveNote.publishedAt }
        },
        data: { validUntil: null }
      });
    }
  }

  /**
   * update item availability in transaction
   * (트랜잭션 내에서 아이템 사용 가능 상태 업데이트)
   */
  private static async updateItemAvailabilityInTransaction(tx: any, now: Date) {
    // 1. activate items in the active note (활성 노트의 아이템들 활성화)
    const activeNote = await tx.updateNote.findFirst({
      where: { isActive: true },
      include: { gardenItems: true }
    });

    if (activeNote?.gardenItems.length) {
      await tx.gardenItem.updateMany({
        where: { id: { in: activeNote.gardenItems.map((item: any) => item.id) } },
        data: { isAvailable: true }
      });
    }

    // 2. disable items in future notes (미래 노트의 아이템들 비활성화)
    const futureNotes = await tx.updateNote.findMany({
      where: { publishedAt: { gt: now } },
      include: { gardenItems: true }
    });

    for (const note of futureNotes) {
      if (note.gardenItems.length > 0) {
        await tx.gardenItem.updateMany({
          where: { id: { in: note.gardenItems.map((item: any) => item.id) } },
          data: { isAvailable: false }
        });
      }
    }

    // 3. keep items in past notes (if validUntil is not null)
    // 과거 노트의 아이템들 유지 (validUntil이 있는 것들)
    const pastNotes = await tx.updateNote.findMany({
      where: {
        isActive: false,
        publishedAt: { lte: now },
        validUntil: { not: null }
      },
      include: { gardenItems: true }
    });

    for (const note of pastNotes) {
      if (note.gardenItems.length > 0) {
        await tx.gardenItem.updateMany({
          where: { id: { in: note.gardenItems.map((item: any) => item.id) } },
          data: { isAvailable: true }
        });
      }
    }
  }

  /**
   * update all item availability
   * (모든 아이템의 사용 가능 상태 업데이트)
   */
  private static async updateAllItemAvailability(now: Date) {
    // 1. find the active note (활성 노트 찾기)
    const activeNote = await prisma.updateNote.findFirst({
      where: { isActive: true },
      include: { gardenItems: true }
    });

    // 2. find future notes (미래 노트들 찾기)
    const futureNotes = await prisma.updateNote.findMany({
      where: { publishedAt: { gt: now } },
      include: { gardenItems: true }
    });

    // 3. disable items in future notes (미래 노트의 아이템들 비활성화)
    for (const note of futureNotes) {
      if (note.gardenItems.length > 0) {
        await prisma.gardenItem.updateMany({
          where: { id: { in: note.gardenItems.map((item: any) => item.id) } },
          data: { isAvailable: false }
        });
      }
    }

    // 4. activate items in the active note (활성 노트의 아이템들 활성화)
    if (activeNote && activeNote.gardenItems.length > 0) {
      await prisma.gardenItem.updateMany({
        where: { id: { in: activeNote.gardenItems.map((item: any) => item.id) } },
        data: { isAvailable: true }
      });
    }

    // 5. keep items in past notes (if validUntil is not null)
    // (과거 노트의 아이템들 유지 (validUntil이 있는 것들)
    const pastNotes = await prisma.updateNote.findMany({
      where: {
        isActive: false,
        publishedAt: { lte: now },
        validUntil: { not: null }
      },
      include: { gardenItems: true }
    });

    for (const note of pastNotes) {
      if (note.gardenItems.length > 0) {
        await prisma.gardenItem.updateMany({
          where: { id: { in: note.gardenItems.map((item: any) => item.id) } },
          data: { isAvailable: true }
        });
      }
    }
  }

  /**
   * apply automation when creating a new update note (업데이트 노트 생성 시 자동화 적용)
   */
  static async handleNoteCreation(noteId: number) {
    const now = new Date();
    await this.updateActiveStatus(now);
  }

  /**
   * check if time fields are changed (시간 필드 변경 여부 확인)
   */
  static hasTimeFieldChanges(body: any): boolean {
    return body.publishedAt !== undefined || body.validUntil !== undefined;
  }

  /**
   * update UpdateNote
   */
  static async updateNote(
    noteId: number,
    updateData: {
      title?: string;
      description?: string;
      imageUrls?: string[];
      validUntil?: string | null;
      publishedAt?: string | null;
      gardenItemIds?: number[];
    },
    updatedById: string
  ) {
    const timeFieldsChanged = this.hasTimeFieldChanges(updateData);

    if (timeFieldsChanged) {
      // handle time fields changes in transaction (시간 필드 변경 시 트랜잭션으로 처리)
      return await prisma.$transaction(async (tx: PrismaTransaction) => {
        // configure update data (업데이트 데이터 구성)
        const prismaUpdateData: any = {
          updatedById
        };

        if (updateData.title !== undefined) prismaUpdateData.title = updateData.title;
        if (updateData.description !== undefined) prismaUpdateData.description = updateData.description;
        if (updateData.imageUrls !== undefined) prismaUpdateData.imageUrls = updateData.imageUrls;
        if (updateData.publishedAt !== undefined) {
          prismaUpdateData.publishedAt = updateData.publishedAt ? new Date(updateData.publishedAt) : null;
        }
        if (updateData.validUntil !== undefined) {
          prismaUpdateData.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null;
        }

        // handle garden items relationship (관계 처리)
        if (updateData.gardenItemIds !== undefined) {
          prismaUpdateData.gardenItems = {
            set: [], // disconnect existing connections
            connect: updateData.gardenItemIds.map((id: number) => ({ id }))
          };
        }

        // update note (노트 업데이트)
        await tx.updateNote.update({
          where: { id: noteId },
          data: prismaUpdateData
        });

        // apply automation based on time changes (시간 변경에 따른 자동화 실행)
        const now = new Date();
        await this.updateActiveStatusInTransaction(tx, now);

        // return the updated note (최종 업데이트된 노트 반환)
        return await tx.updateNote.findUnique({
          where: { id: noteId },
          include: { gardenItems: true }
        });
      });
    } else {
      // simple update (no automation)
      const prismaUpdateData: any = {
        updatedById
      };

      if (updateData.title !== undefined) prismaUpdateData.title = updateData.title;
      if (updateData.description !== undefined) prismaUpdateData.description = updateData.description;
      if (updateData.imageUrls !== undefined) prismaUpdateData.imageUrls = updateData.imageUrls;

      // handle garden items relationship (관계 처리)
      if (updateData.gardenItemIds !== undefined) {
        prismaUpdateData.gardenItems = {
          set: [], // disconnect existing connections
          connect: updateData.gardenItemIds.map((id: number) => ({ id }))
        };
      }

      return await prisma.updateNote.update({
        where: { id: noteId },
        data: prismaUpdateData,
        include: { gardenItems: true }
      });
    }
  }
}