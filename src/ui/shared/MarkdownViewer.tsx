import { useMemo } from 'react';
import { renderMarkdownFragment } from '@/core/markdown.ts';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const html = useMemo(() => renderMarkdownFragment(content), [content]);

  const classes = ['markdown-body', className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
