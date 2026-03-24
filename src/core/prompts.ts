export const ANALYZE_PROMPT = (jobDescription: string): string =>
  `
You are an expert technical recruiter and career coach. Your task is to deeply analyze a job description and extract structured information.

Analyze the following job description and produce a structured output covering ALL sections below:

1. **Role Summary**: A concise summary of the position and its purpose.
2. **Must-Have Skills**: Hard skills explicitly required — these are gated requirements a candidate must have to pass screening.
3. **Nice-to-Have Skills**: Preferred qualifications and bonus skills that differentiate candidates but are not blockers.
4. **Key Qualifications**: Education, years of experience, certifications, or domain knowledge required.
5. **Core Responsibilities**: The primary duties and day-to-day expectations.
6. **Keywords**: Important keywords and phrases used in the posting that should appear in a tailored resume (ATS optimization). Include both acronyms and full forms where applicable (e.g. "CI/CD (Continuous Integration / Continuous Deployment)").
7. **Seniority Level**: Inferred seniority (e.g., junior, mid, senior, staff, principal).
8. **Domain / Industry**: The business domain or industry context.
9. **Exact Job Title**: The precise job title as written in the posting (e.g. "Senior Full Stack Engineer"). This will be used verbatim in the candidate's professional summary.
10. **Company / Culture Signals**: Extract signals about work environment and expectations — remote/hybrid/on-site preference, team size indicators, startup vs. enterprise context, pace descriptors (e.g. "fast-paced", "high-growth", "collaborative", "autonomous"). These signals inform the tone of the summary and bullet framing in the final resume.
11. **ATS Trigger Phrases**: 5–10 exact multi-word phrases from the posting that carry the most weight in ATS scoring — phrases that appear literally in the job description and should be mirrored verbatim in the resume where authentic (e.g. "cross-functional collaboration", "CI/CD pipeline", "stakeholder management", "agile development practices"). For each phrase also list the most common synonym or alternate phrasing (e.g. "cross-functional collaboration" → synonym: "collaborated across teams") so both exact-match parsers (Taleo) and semantic-NLP parsers (Workday, iCIMS) are covered.
12. **Must-Have vs Nice-to-Have Summary**: A concise two-column breakdown explicitly labelling each skill/requirement as MUST-HAVE or NICE-TO-HAVE, so the resume writer can prioritise coverage.
13. **Resume Length Recommendation**: Based on the inferred seniority and years of experience required, recommend either "1 page" (0–3 years) or "2 pages" (4+ years). This recommendation will guide how much content the generate step includes.

Job Description:
---
${jobDescription}
---

Respond with a well-structured analysis using all sections above. Be thorough — the quality of this analysis directly determines the quality of the final tailored resume.
`.trim();

export const MATCH_PROMPT = (analysis: string, resumeContent: string): string =>
  `
You are an expert resume strategist. You have a structured job analysis and a candidate's base resume. Your task is to produce a detailed skills and experience mapping that will guide a high-impact resume rewrite.

For each requirement identified in the analysis, determine:
1. **Direct Match**: Experiences or skills in the resume that directly satisfy the requirement.
2. **Indirect Match**: Experiences or skills that are transferable or adjacent to the requirement.
3. **Gap**: Requirements that have no corresponding evidence in the resume.

Also identify:
- **Strongest Alignment Points**: The top 3–5 experiences or skills that best position this candidate for the role.
- **Keyword Coverage**: Which ATS keywords from the analysis already appear in the resume, and which are missing but could be naturally incorporated. Estimate the current coverage percentage (e.g. "~45% — needs improvement").
- **Reframing Opportunities**: Existing experiences that could be reworded to better align with the role's language and priorities.
- **Mirror Opportunities**: List 5–8 exact ATS trigger phrases from the analysis (including their synonyms) that can be embedded verbatim and authentically into bullet points. For each phrase, identify which role or achievement in the resume it maps to (e.g. "cross-functional collaboration → maps to the 2021 platform migration project at Acme Corp").
- **Soft Skills Evidence**: For each soft skill mentioned in the JD (e.g. "strong communicator", "collaborative", "self-starter"), identify which existing bullet in the resume can be re-framed to *demonstrate* rather than *state* the skill. For example: "collaborative" → re-frame the 2022 Acme Corp team project bullet to include team size and cross-functional scope. Soft skills must never be listed in the Skills section — they must be shown through bullet context.
- **Quantification Opportunities**: IMPORTANT — these are editorial notes ONLY. The generate step is STRICTLY FORBIDDEN from inserting any metric that is not explicitly stated in the original resume — even if suggested here. For each role in the resume, flag which existing bullets are currently unquantified but could realistically have a metric added — count, percentage improvement, dollar value, time saved, team size, user scale, error reduction. Suggest the type of metric as a reminder for the candidate to verify (e.g. "Team lead bullet at XYZ Corp — could add headcount and delivery timeline if the candidate confirms the figures"). These suggestions are for the candidate's awareness, not for the AI writer to act upon.
- **Summary Hook**: Draft one punchy opening line for the professional summary that will be used verbatim or adapted. Format: "[Exact job title from posting] with [X years] of experience in [domain], [strongest achievement with metric — ONLY if a real metric exists in the resume; otherwise use qualitative impact]." This line must feel authentic to the candidate's real background. The full summary should be writable in 50–80 words total (3–4 sentences).

Job Analysis:
---
${analysis}
---

Candidate's Base Resume:
---
${resumeContent}
---

Produce a thorough mapping that will guide the resume rewrite. Do not fabricate experience — only map what exists. The quality of your mirror opportunities and soft skills evidence directly determines how strong and authentic the final resume will be.
`.trim();

import type { GenerationOptions } from './types.ts';

export const GENERATE_PROMPT = (
  matchResult: string,
  resumeContent: string,
  jobDescription: string,
  generationOptions?: GenerationOptions,
): string => {
  const n =
    typeof generationOptions?.maxKeyExperiences === 'number'
      ? generationOptions.maxKeyExperiences
      : 3;

  // ------------------------------------------------------------------
  // Audience-specific block (section order + bullet formula + summary)
  // ------------------------------------------------------------------
  const audienceBlock =
    generationOptions?.audience === 'ats'
      ? `
AUDIENCE: ATS-Optimized
Your primary goal is maximum ATS score. Every structural and wording decision must serve keyword coverage and parser compatibility.

MANDATORY section order (do not deviate):
  1. Contact Information — copy ALL contact fields from the original resume exactly. Format: # Full Name on its own line as an H1 heading, then one pipe-separated line with email, phone, and every URL present (LinkedIn, GitHub, portfolio, etc.). URLs MUST be output as bare text without protocol or www prefix (e.g. linkedin.com/in/johndoe, github.com/johndoe — NOT https://github.com/johndoe, NOT www.linkedin.com/...). If the original resume has a URL inside a markdown link like [LinkedIn](https://linkedin.com/in/johndoe), extract and output ONLY the URL part — never output the label alone without the URL. Do NOT invent, guess, or omit any contact field that exists in the original resume. (no tables, no columns)
  2. Professional Summary
  3. Core Competencies / Technical Skills
  4. Work Experience
  5. Any remaining sections that have real content in the original resume (e.g. Projects, Languages)

Professional Summary rules:
  - **Word count: 50–80 words total (3–4 sentences). Never exceed 80 words — recruiters skip long summaries.**
  - Structure: (1) Role identity sentence — exact job title from posting + years + domain + 1–2 must-have keywords; (2) Strongest achievement or differentiator — use a metric ONLY if present in the original resume; (3) Value proposition — what you bring specifically to this role
  - Achievement-focused — NOT "seeking a role" or "looking to leverage"
  - MUST open with the exact job title from the posting (where truthful): "[Title] with [X] years of experience in [domain]."
  - Embed 2–3 must-have keywords naturally across the 3 sentences

Core Competencies / Technical Skills rules:
  - 10–15 items, grouped by category (e.g. **Languages:** … | **Frameworks:** … | **Tools:** …)
  - **Hard skills only** — do NOT list soft skills (e.g. "team player", "strong communicator", "detail-oriented"). Soft skills must be demonstrated through bullet context (team size, stakeholder count, cross-functional scope) — never listed here
  - Pull directly from the must-have and nice-to-have lists in the analysis
  - Include both acronym and full form on first appearance: "CI/CD (Continuous Integration/Continuous Deployment)"
  - This section must contain the job's most critical keywords — ATS weights this section heavily

Experience bullet formula — XYZ (Google's method, metric-first):
  "[Strong action verb] [achievement + metric], by [method / tool / approach]"
  Examples:
    ✓ "Reduced API response time by 60% (from 800ms to 320ms) by migrating to Redis caching"
    ✓ "Scaled platform to 1.2M monthly active users by re-architecting the database layer"
    ✗ "Responsible for improving performance" (forbidden — no action verb, no metric)

Keyword placement — TOP-30% RULE (ATS weights the first third of the document most heavily):
  - Critical JD keywords MUST appear in: (1) Professional Summary, (2) Skills section, (3) first bullet of each relevant role
  - Mirror ATS trigger phrases from the match result verbatim where authentic; also use their synonyms where natural
  - Primary keywords (most critical): appear 3–5 times spread across Summary, Skills, and Experience — not concentrated in one section
  - Keyword density target: 1–3% of total resume word count; natural repetition only — modern ATS penalise keyword clustering
  - Target 65–75% coverage of job description keywords overall
  - Use both acronym and full form on first use throughout the document
`
      : generationOptions?.audience === 'hr'
        ? `
AUDIENCE: Human Recruiter (HR)
Your primary goal is to command attention in a 7-second scan and tell a compelling achievement story. Numbers and impact must be immediately visible.

MANDATORY section order — experience leads for experienced candidates (do not deviate):
  1. Contact Information — copy ALL contact fields from the original resume exactly. Format: # Full Name on its own line as an H1 heading, then one pipe-separated line with email, phone, and every URL present (LinkedIn, GitHub, portfolio, etc.). URLs MUST be output as bare text without protocol or www prefix (e.g. linkedin.com/in/johndoe, github.com/johndoe — NOT https://github.com/johndoe, NOT www.linkedin.com/...). If the original resume has a URL inside a markdown link like [LinkedIn](https://linkedin.com/in/johndoe), extract and output ONLY the URL part — never output the label alone without the URL. Do NOT invent, guess, or omit any contact field that exists in the original resume. (no tables, no columns)
  2. Professional Summary
  3. Work Experience
  4. Skills / Core Competencies
  5. Education — include ONLY if the original resume contains explicit education data (degree, institution, dates). If absent, skip this item completely — do not write "## Education" or any heading for it
  6. Certifications — include ONLY if the original resume contains explicit certifications. If absent, skip this item completely — do not write "## Certifications" or any heading for it
  7. Any other sections present in the original — omit entirely if absent

Professional Summary rules:
  - **Word count: 50–80 words total (3–4 sentences). Never exceed 80 words.**
  - Structure: (1) Role identity — title + years + domain; (2) Achievement-first differentiator — your single most impressive win with metric ONLY if present in the original resume; (3) Value proposition — what you bring to this specific role; (optional 4th sentence) company/culture alignment signal
  - NEVER "seeking a role" or "looking to leverage":
    Example: "Full Stack Engineer with 8 years in fintech who rebuilt the checkout flow for a 500K-user platform, cutting abandonment by 34%. Expert in React, Node.js, and payment integrations. Joining [Company] to bring that same focus on conversion and reliability to your growth stage."
  - Use the Summary Hook from the match result as your starting point — if the hook contains a metric not present in the original resume, replace it with qualitative language

Core Competencies / Skills rules:
  - **Hard skills only** — do NOT list soft skills (e.g. "team player", "strong communicator"). Demonstrate soft skills through bullet context (team size, stakeholder count, cross-functional scope)
  - 10–15 items, grouped by category
  - Both acronym and full form on first appearance

Experience bullet formula — CAR (Challenge → Action → Result, narrative-first):
  "[Strong action verb] [what you did / context of challenge], resulting in [quantified outcome]"
  Examples:
    ✓ "Rebuilt a crumbling CI pipeline that caused 3-hour deploy windows, cutting deploy time to 8 minutes and unblocking 12-engineer team"
    ✓ "Led migration of monolith to microservices for 800K-user platform, improving uptime from 97.2% to 99.8%"
    ✗ "Worked on improving the pipeline" (forbidden)

F-pattern scan optimisation (recruiter eyes follow name → section headers → left column):
  - **Bold** company names and job titles in experience headers
  - **Bold** the key metric or outcome in the first bullet of each role so it catches the eye immediately
  - Put quantified outcomes FIRST within the bullet, not buried at the end
  - First bullet of EVERY role = the single biggest win at that job (most impressive number or strongest impact)
  - Weak verbs are forbidden: "Responsible for", "Involved in", "Worked with", "Helped", "Assisted"
`
        : `
AUDIENCE: ATS + Human Recruiter (Balanced — default)
Satisfy both: pass the ATS keyword scan first, then compel the human reader. Keywords embedded in achievement statements serve both goals simultaneously.

MANDATORY section order (works for both ATS and HR — do not deviate):
  1. Contact Information — copy ALL contact fields from the original resume exactly. Format: # Full Name on its own line as an H1 heading, then one pipe-separated line with email, phone, and every URL present (LinkedIn, GitHub, portfolio, etc.). URLs MUST be output as bare text without protocol or www prefix (e.g. linkedin.com/in/johndoe, github.com/johndoe — NOT https://github.com/johndoe, NOT www.linkedin.com/...). If the original resume has a URL inside a markdown link like [LinkedIn](https://linkedin.com/in/johndoe), extract and output ONLY the URL part — never output the label alone without the URL. Do NOT invent, guess, or omit any contact field that exists in the original resume. (no tables, no columns)
  2. Professional Summary
  3. Core Competencies / Technical Skills
  4. Work Experience
  5. Education — include ONLY if the original resume contains explicit education data (degree, institution, dates). If absent, skip this item completely — do not write "## Education" or any heading for it
  6. Certifications — include ONLY if the original resume contains explicit certifications. If absent, skip this item completely — do not write "## Certifications" or any heading for it
  7. Any other sections present in the original — omit entirely if absent

Professional Summary rules:
  - **Word count: 50–80 words total (3–4 sentences). Never exceed 80 words — recruiters skip long summaries.**
  - Structure: (1) Role identity — exact job title from posting + years + domain + 1–2 must-have keywords; (2) Strongest achievement or differentiator — metric ONLY if present in the original resume; (3) Value proposition specific to this role
  - Achievement-first AND keyword-rich: "[Job title from posting] with [X years] in [domain] who [achievement + metric or qualitative impact]."
  - Include: exact job title from posting + 2–3 must-have keywords + 1 quantified or qualitative achievement
  - Use the Summary Hook from the match result as your starting point — if the hook contains a metric not present in the original resume, replace it with qualitative language

Core Competencies / Technical Skills rules:
  - 10–15 items, grouped by category
  - **Hard skills only** — do NOT list soft skills (e.g. "team player", "strong communicator", "detail-oriented"). Soft skills must be demonstrated through bullet context (team size, stakeholder count, cross-functional scope) — never listed here
  - Both acronym and full form on first appearance
  - Pull from must-have and nice-to-have lists

Experience bullet formula — XYZ with strong action verbs (metric-forward):
  "[Action verb] [achievement + metric] by [method / tool / approach]"
  Examples:
    ✓ "Cut infrastructure costs by 42% ($180K/year) by containerising 14 services with Docker and Kubernetes"
    ✓ "Grew organic search traffic by 220% in 6 months through technical SEO (Search Engine Optimisation) overhaul"
    ✗ "Responsible for infrastructure cost reduction" (forbidden)

Keyword placement — TOP-30% RULE:
  - Critical JD keywords MUST appear in: (1) Professional Summary, (2) Skills section, (3) first bullet of each relevant role
  - Mirror ATS trigger phrases from the match result verbatim where authentic; also use their synonyms where natural
  - Primary keywords (most critical): appear 3–5 times spread across Summary, Skills, and Experience — not concentrated in one section
  - Keyword density target: 1–3% of total resume word count; natural repetition only — modern ATS (Workday, SmartRecruiters) penalise unnatural keyword clustering
  - Target 65–75% coverage of job description keywords overall
  - Every keyword is backed by a real quantified result or scope detail (satisfies both ATS score and human credibility)
`;

  // ------------------------------------------------------------------
  // Experience depth rule
  // ------------------------------------------------------------------
  const experienceDepthBlock = `
Work experience depth rule:
  - Show detailed bullet points for exactly **${n}** roles (or all roles if the resume has fewer than ${n})
  - Do NOT reduce below ${n} — if the candidate has ${n}+ roles, all ${n} must have bullets
  - Bullet count per role (based on recency and relevance):
      • Most recent / current role: **5–8 bullets** — this role receives the most recruiter attention; give it the most space
      • Previous role (2–5 years ago): 4–6 bullets — focus on most relevant achievements
      • Older roles (5+ years) within the ${n} limit: 2–3 bullets — only the highest-impact, most relevant wins
      • Very old or marginally relevant roles within the ${n} limit: 1–2 bullets
  - First bullet of EVERY role = strongest quantified or scope-anchored achievement at that role (non-negotiable)`;

  // ------------------------------------------------------------------
  // Additional experience section
  // ------------------------------------------------------------------
  const additionalExperienceInstruction =
    generationOptions?.includeAdditionalExperience === false
      ? `- **Additional experience**: Omit roles beyond the detailed ${n}. Do not add an "Additional experience" section.`
      : `- **Additional experience**: Roles beyond the ${n} detailed ones may be listed as a compact "Additional Experience" section with one line each (company, title, dates — no bullets). Roles older than 10 years may be listed as title + company + dates only unless directly relevant to this posting. Do not expand them.`;

  // ------------------------------------------------------------------
  // Locale
  // ------------------------------------------------------------------
  const localeInstructions = [
    generationOptions?.targetCountry
      ? `- **Target country**: Use tone, spelling, and conventions appropriate for roles in **${generationOptions.targetCountry}** (e.g. UK spelling, local currency, relevant certifications).`
      : null,
    generationOptions?.targetLanguage
      ? `- **Language**: Write the entire resume in **${generationOptions.targetLanguage}**. All section headings, bullets, and summary must be in that language.`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  // ------------------------------------------------------------------
  // Custom rules
  // ------------------------------------------------------------------
  const rulesInstruction =
    generationOptions?.rules && generationOptions.rules.trim().length > 0
      ? `\nAdditional candidate preferences (these must never cause fabrication — only authentic reframing):\n${generationOptions.rules.trim()}\n`
      : '';

  // ------------------------------------------------------------------
  // Honesty guardrails (always included)
  // ------------------------------------------------------------------
  const honestyGuardrails = `
Honesty and non-exaggeration rules (non-negotiable):
- **Do not overstate skills**: If the candidate only has light or adjacent exposure to a technology, describe it as "familiarity with" or "exposure to", not deep expertise.
- **Respect gaps**: A skills gap identified in the match result cannot be turned into a claimed skill. You may highlight adjacent experience that shows learning ability.
- **No inflated seniority**: Do not upgrade job titles or imply higher ownership than the original resume supports.
- **No invented metrics — the plausibility test**: Only use numbers, percentages, and monetary values that are explicitly stated in the original resume. Do not estimate, approximate, or invent any metric. Apply this test: if you could replace the number in a bullet with a different number and it would still read equally plausibly, that is a fabricated metric — remove it. Every metric must be traceable to a specific line in the original resume. The Skills Mapping may suggest hypothetical metrics for unquantified bullets — IGNORE those suggestions entirely.
- **When no metric exists in the original resume**, use this priority hierarchy instead of inventing a number:
    1. **Scope indicators** (always preferred over no context): team size, headcount, number of stakeholders, budget managed, geographic reach, product user count (e.g. "Led team of 8", "managed $500K infrastructure budget", "deployed to 12 regional offices")
    2. **Relative / comparative markers**: "first engineer to implement X at the company", "company-wide rollout", "only team to achieve Y"
    3. **Business-context qualitative**: "resolved critical production incident preventing revenue loss", "eliminated manual process that required 3 FTEs"
    4. **Approximate range with qualifier** (acceptable when the candidate's resume implies a range): "reduced processing time by roughly 30%" — a hedged estimate is more credible than false precision, but only use this if the resume strongly implies the magnitude
    5. **Strong qualitative (last resort)**: "significantly reduced latency", "substantially improved reliability" — only if none of the above apply
    Never use bare "improved" or "enhanced" with no context — these are forbidden regardless of metric availability.
- **Verifiability principle**: All claims must be consistent with what a LinkedIn profile check or reference call would confirm. No scope exaggeration, no title inflation.`;

  // ------------------------------------------------------------------
  // Specificity rule (2025 AI-saturation differentiator)
  // ------------------------------------------------------------------
  const specificityRule = `
- **Specificity is mandatory (2025 AI-saturation rule)**: In a market where 40–80% of applicants use AI to write resumes, generic polished language is a rejection signal — it reads as AI noise. Every bullet must contain at least one concrete, specific detail: a named technology, a product or system name, a team size, a timeframe, a user count, or a dollar/percentage figure. A bullet that could describe any professional at any company is a weak bullet regardless of its grammar.
    ✗ "Improved system performance across the platform" (could describe anyone)
    ✓ "Optimised the Redis query layer for the payments service, reducing p99 latency from ~800ms to ~150ms" (specific, verifiable, traceable)`;

  return `
You are an expert resume writer with deep knowledge of ATS systems and recruiter psychology. Using the skills mapping and the original resume, produce a complete tailored resume in clean Markdown.

═══════════════════════════════════════════════
CRITICAL RULES — follow without exception
═══════════════════════════════════════════════
- **Always include the candidate's name**: The resume MUST start with "# Full Name" as an H1 Markdown heading. Copy the name exactly from the original resume. Never omit it, abbreviate it, or move it lower in the document.
- **NEVER output an empty or placeholder section**: If the original resume has no data for a section (Education, Certifications, Projects, Languages, etc.), DO NOT include that section heading at all. Outputting any of the following is a critical violation — treat these as hard-banned strings:
    ✗ "No education details provided"
    ✗ "No certifications provided"
    ✗ "No education information available"
    ✗ "N/A"
    ✗ "[Education details if present in the original resume]"
    ✗ "[Certification details if present in the original resume]"
    ✗ Any text in square brackets used as a placeholder
    ✗ A section heading (e.g. "## Education" or "## Certifications") with no real content beneath it
    ✗ Any section heading followed by nothing, a blank line, or a placeholder sentence
  A section that cannot be filled with real data from the original resume must be completely absent from the output — no heading, no blank line, nothing.
- **Never fabricate**: Do not invent any experience, skill, project, title, date, or achievement not present in the original resume. Violations destroy candidate credibility.
- **Reframe, don't invent**: Rephrase and reorder existing content to emphasise relevance. Incorporate job-relevant keywords only where they accurately describe existing work.
- **Preserve all facts**: Dates, company names, job titles, and measurable achievements must remain accurate to the original.
- **Quantify where real data exists**: Use every metric, number, and figure that is explicitly present in the ORIGINAL RESUME — revenue ($), cost savings ($), efficiency gains (%), time saved, team size, user scale, growth (%), error reduction (%). When no metric exists, use the qualitative hierarchy defined in the Honesty rules below — never guess a number.
- **Achievement over responsibility**: Every bullet must show what you ACHIEVED, not what you were "responsible for". Transform: "Responsible for leading team" → "Led team of 8, delivering [X] 2 weeks ahead of schedule."
- **Strong action verbs only**: Start every bullet with a past-tense action verb. Forbidden openers: "Responsible for", "Involved in", "Worked with", "Helped", "Assisted", "Participated in".
- **Standard section headings** (non-standard names break ATS parsers — especially Taleo which uses a fixed header dictionary):
    • "Work Experience" — NOT "Experience", "Background", "Employment History", "Career History"
    • "Core Competencies" or "Technical Skills" — NOT "Expertise", "Capabilities", "Toolbox"
    • "Professional Summary" or "Summary" — NOT "About Me", "Profile", "Executive Overview"
    • "Education" — standard
    • "Certifications" — standard
- **Relevance filter**: Omit or minimise skills, projects, or domains that are clearly unrelated to the target role. Do not highlight unrelated items as primary strengths.
- **Markdown only**: Use ##, ###, -, ** for structure. No HTML, no tables, no columns. Single-column layout only — multi-column breaks Taleo and Workday parsers.
- **Resume length**: Follow the length recommendation from the analysis. 1-page target for 0–3 years experience (ruthlessly cut irrelevant content); hard 2-page limit for 4+ years experience — never exceed 2 pages. A strong 1-page beats a padded 2-page every time.
${specificityRule}
${audienceBlock}
${experienceDepthBlock}
${additionalExperienceInstruction}
${honestyGuardrails}
${localeInstructions ? '\n' + localeInstructions : ''}

Skills Mapping (use this as your primary guide for what to emphasise):
---
${matchResult}
---

Original Resume (source of truth — all facts must come from here):
---
${resumeContent}
---

Target Job Description:
---
${jobDescription}
---

Output only the final Markdown resume. Do not include explanations, commentary, preamble, or code fences.
${rulesInstruction}`.trim();
};
