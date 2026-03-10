import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: false,
  gfm: true,
});

/**
 * Strips wrapping code fences that LLMs commonly add around markdown output.
 */
export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '');
}

/**
 * Returns a sanitized HTML fragment suitable for dangerouslySetInnerHTML in React.
 */
export function renderMarkdownFragment(markdown: string): string {
  const rawHtml = marked.parse(stripCodeFences(markdown), { async: false }) as string;
  return DOMPurify.sanitize(rawHtml);
}
