import type { EasyApplyFields, EasyApplyResult, LinkedInJobData } from '@/core/types.ts';

// ---------------------------------------------------------------------------
// Page-world functions
// These run inside the LinkedIn tab via chrome.scripting.executeScript.
// They must be self-contained — no imports, no closure references.
// ---------------------------------------------------------------------------

export function scrapeLinkedInJobPage(): LinkedInJobData | null {
  if (!/^https:\/\/www\.linkedin\.com\/jobs\/view\//.test(window.location.href)) {
    return null;
  }

  // document.title is always stable: "Job Title | Company | LinkedIn"
  const titleParts = document.title.split(' | ');
  const jobTitle = titleParts[0]?.trim() ?? '';
  const companyName = titleParts[1]?.trim() ?? '';

  // Find the description: smallest container whose text starts with "About the job"
  const allEls = Array.from(document.querySelectorAll('div, section, article'));
  const descEl = allEls
    .filter((el) => {
      const text = (el as HTMLElement).innerText?.trim() ?? '';
      return text.startsWith('About the job') && text.length > 100 && text.length < 20000;
    })
    .sort((a, b) => ((a as HTMLElement).innerText?.length ?? 0) - ((b as HTMLElement).innerText?.length ?? 0))[0] as HTMLElement | undefined;

  let jobDescription = descEl?.innerText?.trim() ?? '';

  // Fallback: grab from <main>
  if (!jobDescription) {
    jobDescription = (document.querySelector('main') as HTMLElement | null)?.innerText?.trim() ?? '';
  }

  if (!jobTitle && !jobDescription) return null;

  return { jobTitle, companyName, jobDescription };
}

export function fillEasyApplyModal(fields: EasyApplyFields): EasyApplyResult {
  function findModal(): Element | null {
    const selectors = [
      '[data-testid="jobs-apply-modal"]',
      '.jobs-easy-apply-content',
      '[aria-labelledby*="apply"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function fillInput(
    modal: Element,
    selectors: string[],
    value: string,
  ): boolean {
    for (const sel of selectors) {
      const el = modal.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.readOnly && !el.disabled) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (el.value === value) return true;
      }
    }
    return false;
  }

  const modal = findModal();
  if (!modal) {
    return { filledCount: 0, skippedFields: ['modal_not_found'] };
  }

  let filledCount = 0;
  const skippedFields: string[] = [];

  if (fields.name) {
    const ok = fillInput(modal, [
      'input[name="name"]',
      'input[id*="name"]',
      'input[aria-label*="name" i]',
      'input[placeholder*="name" i]',
    ], fields.name);
    ok ? filledCount++ : skippedFields.push('name');
  }

  if (fields.email) {
    const ok = fillInput(modal, [
      'input[type="email"]',
      'input[name="email"]',
      'input[aria-label*="email" i]',
    ], fields.email);
    ok ? filledCount++ : skippedFields.push('email');
  }

  if (fields.phone) {
    const ok = fillInput(modal, [
      'input[name="phoneNumber"]',
      'input[id*="phone"]',
      'input[aria-label*="phone" i]',
      'input[type="tel"]',
    ], fields.phone);
    ok ? filledCount++ : skippedFields.push('phone');
  }

  if (fields.coverLetter) {
    const ok = fillInput(modal, [
      'textarea[id*="coverLetter"]',
      'textarea[aria-label*="cover" i]',
      'textarea[placeholder*="cover" i]',
      'textarea',
    ], fields.coverLetter);
    ok ? filledCount++ : skippedFields.push('coverLetter');
  }

  return { filledCount, skippedFields };
}

// ---------------------------------------------------------------------------
// Extension-world resume parser (runs in service worker / sidepanel context)
// ---------------------------------------------------------------------------

export function parseResumeForEasyApply(markdownContent: string): EasyApplyFields {
  const lines = markdownContent.split('\n');
  const first20 = lines.slice(0, 20).join('\n');

  const nameMatch = /^#\s+(.+)$/m.exec(markdownContent);
  const name = nameMatch?.[1]?.trim();

  const emailMatch = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.exec(first20);
  const email = emailMatch?.[0]?.trim();

  const phoneMatch = /\+?[\d\s\-().]{7,20}/.exec(first20);
  const phone = phoneMatch?.[0]?.trim();

  const summaryMatch =
    /^##\s+(?:Summary|Professional Summary|Profile)\s*\n([\s\S]*?)(?=\n##|$)/im.exec(
      markdownContent,
    );
  const rawSummary = summaryMatch?.[1]?.trim();
  const coverLetter = rawSummary ? rawSummary.slice(0, 1500) : undefined;

  const result: EasyApplyFields = {};
  if (name) (result as Record<string, string>).name = name;
  if (email) (result as Record<string, string>).email = email;
  if (phone) (result as Record<string, string>).phone = phone;
  if (coverLetter) (result as Record<string, string>).coverLetter = coverLetter;

  return result;
}
