import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { stripCodeFences } from '@/core/markdown.ts';
import { buildResumeHtml } from '@/core/resumeTemplate.ts';

export function renderMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(stripCodeFences(markdown), { async: false }) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml);
  return buildResumeHtml(cleanHtml);
}
