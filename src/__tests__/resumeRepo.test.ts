import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDBResumeRepo } from '@/storage/resumeRepo.ts';
import type { BaseResume, TailoredResume } from '@/core/types.ts';
import { __resetDB } from '@/storage/db.ts';

beforeEach(async () => {
  await __resetDB();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('rezoomer');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

function makeBaseResume(id: string): BaseResume {
  return {
    id,
    label: `Resume ${id}`,
    content: `Content for ${id}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeTailoredResume(id: string, createdAt: number): TailoredResume {
  return {
    id,
    baseResumeId: 'base-1',
    jobDescription: { rawText: `Job for ${id}` },
    content: `Tailored ${id}`,
    providerId: 'openai-gpt-4o',
    model: 'gpt-4o',
    createdAt,
  };
}

describe('IndexedDBResumeRepo', () => {
  describe('base resume CRUD', () => {
    it('saves and retrieves a base resume', async () => {
      const repo = new IndexedDBResumeRepo();
      const resume = makeBaseResume('r1');

      await repo.saveBaseResume(resume);
      const retrieved = await repo.getBaseResume('r1');
      expect(retrieved).toEqual(resume);
    });

    it('returns null for missing resume', async () => {
      const repo = new IndexedDBResumeRepo();
      const result = await repo.getBaseResume('nonexistent');
      expect(result).toBeNull();
    });

    it('retrieves all base resumes', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveBaseResume(makeBaseResume('a'));
      await repo.saveBaseResume(makeBaseResume('b'));
      await repo.saveBaseResume(makeBaseResume('c'));

      const all = await repo.getAllBaseResumes();
      expect(all).toHaveLength(3);
    });

    it('deletes a base resume', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveBaseResume(makeBaseResume('del'));
      await repo.deleteBaseResume('del');

      const result = await repo.getBaseResume('del');
      expect(result).toBeNull();
    });

    it('overwrites resume with same id', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveBaseResume(makeBaseResume('r1'));
      await repo.saveBaseResume({
        ...makeBaseResume('r1'),
        label: 'Updated',
      });

      const result = await repo.getBaseResume('r1');
      expect(result?.label).toBe('Updated');
    });
  });

  describe('tailored resume CRUD', () => {
    it('saves and retrieves a tailored resume', async () => {
      const repo = new IndexedDBResumeRepo();
      const resume = makeTailoredResume('t1', 1000);

      await repo.saveTailoredResume(resume);
      const retrieved = await repo.getTailoredResume('t1');
      expect(retrieved).toEqual(resume);
    });

    it('returns null for missing tailored resume', async () => {
      const repo = new IndexedDBResumeRepo();
      const result = await repo.getTailoredResume('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('pagination (listTailoredResumes)', () => {
    it('returns empty array when no resumes exist', async () => {
      const repo = new IndexedDBResumeRepo();
      const result = await repo.listTailoredResumes(1, 10);
      expect(result).toEqual([]);
    });

    it('returns first page of results (newest first)', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveTailoredResume(makeTailoredResume('old', 1000));
      await repo.saveTailoredResume(makeTailoredResume('mid', 2000));
      await repo.saveTailoredResume(makeTailoredResume('new', 3000));

      const page = await repo.listTailoredResumes(1, 2);
      expect(page).toHaveLength(2);
      expect(page[0].id).toBe('new');
      expect(page[1].id).toBe('mid');
    });

    it('returns second page', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveTailoredResume(makeTailoredResume('old', 1000));
      await repo.saveTailoredResume(makeTailoredResume('mid', 2000));
      await repo.saveTailoredResume(makeTailoredResume('new', 3000));

      const page = await repo.listTailoredResumes(2, 2);
      expect(page).toHaveLength(1);
      expect(page[0].id).toBe('old');
    });

    it('returns empty for page beyond total', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveTailoredResume(makeTailoredResume('only', 1000));

      const page = await repo.listTailoredResumes(5, 10);
      expect(page).toEqual([]);
    });

    it('handles exact page boundary', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveTailoredResume(makeTailoredResume('a', 1000));
      await repo.saveTailoredResume(makeTailoredResume('b', 2000));

      const page1 = await repo.listTailoredResumes(1, 2);
      expect(page1).toHaveLength(2);

      const page2 = await repo.listTailoredResumes(2, 2);
      expect(page2).toHaveLength(0);
    });

    it('handles page size of 1', async () => {
      const repo = new IndexedDBResumeRepo();
      await repo.saveTailoredResume(makeTailoredResume('a', 1000));
      await repo.saveTailoredResume(makeTailoredResume('b', 2000));
      await repo.saveTailoredResume(makeTailoredResume('c', 3000));

      const p1 = await repo.listTailoredResumes(1, 1);
      const p2 = await repo.listTailoredResumes(2, 1);
      const p3 = await repo.listTailoredResumes(3, 1);

      expect(p1).toHaveLength(1);
      expect(p1[0].id).toBe('c');
      expect(p2[0].id).toBe('b');
      expect(p3[0].id).toBe('a');
    });
  });
});
