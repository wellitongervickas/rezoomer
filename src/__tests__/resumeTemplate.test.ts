import { describe, it, expect } from 'vitest';
import { buildResumeHtml } from '@/core/resumeTemplate.ts';

describe('buildResumeHtml', () => {
  it('produces a valid HTML5 document', () => {
    const html = buildResumeHtml('<p>Hello</p>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('</html>');
  });

  it('wraps body in .resume div', () => {
    const html = buildResumeHtml('<h1>John Doe</h1>');
    expect(html).toContain('<div class="resume">');
    expect(html).toContain('John Doe');
    expect(html).toContain('</div>');
  });

  it('uses default title "Resume"', () => {
    const html = buildResumeHtml('<p>content</p>');
    expect(html).toContain('<title>Resume</title>');
  });

  it('uses custom title when provided', () => {
    const html = buildResumeHtml('<p>content</p>', 'Senior Engineer');
    expect(html).toContain('<title>Senior Engineer</title>');
  });

  it('includes print media styles', () => {
    const html = buildResumeHtml('<p>content</p>');
    expect(html).toContain('@media print');
    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
  });

  it('includes resume CSS styling', () => {
    const html = buildResumeHtml('<p>content</p>');
    expect(html).toContain('font-family');
    expect(html).toContain('.resume');
    expect(html).toContain('max-width: 780px');
  });

  it('handles empty body', () => {
    const html = buildResumeHtml('');
    expect(html).toContain('<div class="resume">');
    expect(html).toContain('</div>');
  });

  it('indents body HTML', () => {
    const html = buildResumeHtml('<p>line1</p>\n<p>line2</p>');
    expect(html).toContain('    <p>line1</p>');
    expect(html).toContain('    <p>line2</p>');
  });
});
