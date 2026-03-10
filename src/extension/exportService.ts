import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { buildResumeHtml } from '@/core/resumeTemplate.ts';

export class ExportService {
  export(markdown: string, metadata?: { title?: string }): string {
    const rawHtml = marked.parse(markdown, { async: false }) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return buildResumeHtml(cleanHtml, metadata?.title);
  }
}
