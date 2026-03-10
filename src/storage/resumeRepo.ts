import type { IResumeRepository, BaseResume, TailoredResume } from '@/core/types.ts';
import { getDB } from './db.ts';

export class IndexedDBResumeRepo implements IResumeRepository {
  async saveBaseResume(resume: BaseResume): Promise<void> {
    const db = await getDB();
    await db.put('baseResumes', resume);
  }

  async getBaseResume(id: string): Promise<BaseResume | null> {
    const db = await getDB();
    return (await db.get('baseResumes', id)) ?? null;
  }

  async getAllBaseResumes(): Promise<BaseResume[]> {
    const db = await getDB();
    return db.getAll('baseResumes');
  }

  async deleteBaseResume(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('baseResumes', id);
  }

  async saveTailoredResume(resume: TailoredResume): Promise<void> {
    const db = await getDB();
    await db.put('tailoredResumes', resume);
  }

  async getTailoredResume(id: string): Promise<TailoredResume | null> {
    const db = await getDB();
    return (await db.get('tailoredResumes', id)) ?? null;
  }

  async countTailoredResumes(): Promise<number> {
    const db = await getDB();
    return db.count('tailoredResumes');
  }

  async listTailoredResumes(page: number, pageSize: number): Promise<TailoredResume[]> {
    const db = await getDB();
    const index = db.transaction('tailoredResumes').store.index('by-created');

    const results: TailoredResume[] = [];
    const skip = (page - 1) * pageSize;
    let skipped = 0;

    let cursor = await index.openCursor(null, 'prev');

    while (cursor) {
      if (skipped < skip) {
        skipped++;
        cursor = await cursor.continue();
        continue;
      }

      results.push(cursor.value as TailoredResume);

      if (results.length >= pageSize) {
        break;
      }

      cursor = await cursor.continue();
    }

    return results;
  }
}
