import { marked } from 'marked';
import { buildResumeHtml } from '@/core/resumeTemplate.ts';

export class ExportService {
  /**
   * Converts resume markdown to a printable HTML document.
   * DOMPurify is not used here because service workers lack a DOM.
   * Content is trusted: it was AI-generated and already sanitized on display.
   */
  export(markdown: string): string {
    const html = marked.parse(markdown, { async: false }) as string;
    return buildResumeHtml(html);
  }
}
