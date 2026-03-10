import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: false,
  gfm: true,
});

/**
 * Returns a sanitized HTML fragment suitable for dangerouslySetInnerHTML in React.
 */
export function renderMarkdownFragment(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}
