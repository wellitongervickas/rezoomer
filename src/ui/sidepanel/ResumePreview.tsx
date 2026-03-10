import { useState } from 'react';
import { MarkdownViewer } from '../shared/MarkdownViewer.tsx';
import { renderMarkdownToHtml } from '../shared/exportHtml.ts';
import type { TailoredResume } from '@/core/types.ts';

interface Props {
  resume: TailoredResume;
  onBack: () => void;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ResumePreview({ resume, onBack }: Props) {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { companyName, roleTitle } = resume.jobDescription;

  function handleExportPdf() {
    setExportLoading(true);
    setExportError(null);
    try {
      const html = renderMarkdownToHtml(resume.content);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Pop-up blocked. Please allow pop-ups for this extension.');
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportLoading(false);
    }
  }

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(resume.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <div className="resume-preview">
      <div className="resume-preview__header">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>

        <div className="resume-preview__meta">
          {(companyName || roleTitle) && (
            <h2 className="resume-preview__title">
              {[roleTitle, companyName].filter(Boolean).join(' @ ')}
            </h2>
          )}
          <p className="resume-preview__date">Created {formatDate(resume.createdAt)}</p>
        </div>

        <div className="resume-preview__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyMarkdown}
          >
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleExportPdf}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>

        {exportError && <p className="form-error">{exportError}</p>}
      </div>

      <div className="resume-preview__content">
        <MarkdownViewer content={resume.content} className="markdown-body" />
      </div>
    </div>
  );
}
