const RESUME_CSS = `
  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .resume {
    max-width: 780px;
    margin: 0 auto;
    padding: 32px 40px;
  }

  h1 { font-size: 22pt; margin: 0 0 4px; }
  h2 { font-size: 14pt; margin: 20px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 12pt; margin: 14px 0 4px; }

  p  { margin: 0 0 8px; }

  ul {
    margin: 0 0 8px;
    padding-left: 20px;
  }
  li { margin-bottom: 3px; }

  hr {
    border: none;
    border-top: 1px solid #ccc;
    margin: 16px 0;
  }

  strong { font-weight: 600; }
  em     { font-style: italic; }

  a { color: #1a1a1a; text-decoration: none; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.9em; color: #555; }

  @media print {
    body  { font-size: 10pt; }
    .resume { padding: 0; max-width: 100%; }
    h2  { break-after: avoid; }
    ul, p { orphans: 3; widows: 3; }
    @page {
      size: A4;
      margin: 20mm 18mm;
      margin-top: 10mm;
      margin-bottom: 10mm;
    }
  }
`.trim();

export function buildResumeHtml(bodyHtml: string): string {
  const indented = bodyHtml
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resume</title>
  <style>
${RESUME_CSS}
  </style>
</head>
<body>
  <div class="resume">
${indented}
  </div>
</body>
</html>`;
}
