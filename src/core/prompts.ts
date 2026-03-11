export const ANALYZE_PROMPT = (jobDescription: string): string =>
  `
You are an expert technical recruiter and career coach. Your task is to deeply analyze a job description and extract structured information.

Analyze the following job description and produce a structured output covering:

1. **Role Summary**: A concise summary of the position and its purpose.
2. **Required Skills**: Hard skills explicitly required (languages, frameworks, tools, platforms).
3. **Preferred Skills**: Nice-to-have skills or bonus qualifications.
4. **Key Qualifications**: Education, years of experience, certifications, or domain knowledge required.
5. **Core Responsibilities**: The primary duties and day-to-day expectations.
6. **Keywords**: Important keywords and phrases used in the posting that should appear in a tailored resume (ATS optimization).
7. **Seniority Level**: Inferred seniority (e.g., junior, mid, senior, staff, principal).
8. **Domain / Industry**: The business domain or industry context.

Job Description:
---
${jobDescription}
---

Respond with a well-structured analysis using the sections above.
`.trim();

export const MATCH_PROMPT = (analysis: string, resumeContent: string): string =>
  `
You are an expert resume strategist. You have a structured job analysis and a candidate's base resume. Your task is to produce a detailed skills and experience mapping.

For each requirement identified in the analysis, determine:
1. **Direct Match**: Experiences or skills in the resume that directly satisfy the requirement.
2. **Indirect Match**: Experiences or skills that are transferable or adjacent to the requirement.
3. **Gap**: Requirements that have no corresponding evidence in the resume.

Also identify:
- **Strongest Alignment Points**: The top 3-5 experiences or skills that best position this candidate for the role.
- **Keyword Coverage**: Which ATS keywords from the analysis already appear in the resume, and which are missing but could be naturally incorporated.
- **Reframing Opportunities**: Existing experiences that could be reworded to better align with the role's language and priorities.

Job Analysis:
---
${analysis}
---

Candidate's Base Resume:
---
${resumeContent}
---

Produce a thorough mapping that will guide the resume rewrite. Do not fabricate experience - only map what exists.
`.trim();

export const GENERATE_PROMPT = (
  matchResult: string,
  resumeContent: string,
  jobDescription: string,
): string =>
  `
You are an expert resume writer. Using the skills mapping and the original resume, rewrite the resume in clean Markdown, tailored to the target job description.

CRITICAL RULES - you MUST follow these without exception:
- **Never fabricate**: Do not invent any experience, skill, project, title, date, or achievement that is not present in the original resume. Violations destroy candidate credibility.
- **Reframe, don't invent**: You may rephrase and reorder existing content to emphasize relevance. You may incorporate job-relevant keywords where they accurately describe existing work.
- **Preserve all facts**: Dates, company names, job titles, and measurable achievements must remain accurate.
- **Keyword optimization**: Naturally weave ATS-relevant keywords from the job description into bullet points where they genuinely apply.
- **Professional tone**: Use strong action verbs, quantify impact where data exists, and keep language concise and impactful.
- **Markdown formatting**: Use standard resume Markdown - headings (##), bullet lists (-), bold (**) for emphasis. Do not use HTML.
- **Work experience limit**: Include detailed bullet points for **no more than 3 work experiences**. When there are more roles in the original resume, select the 2–3 **most recent and most relevant** roles for the target job and focus the bullets there. Older or less relevant roles may be omitted or briefly summarized in a short "Additional experience" line, but do not expand them into full subsections.
- **Education section rule**: Only include an **Education** section if the original resume already contains explicit education information (e.g. degree name, institution, dates). **Never invent or guess degrees, fields of study, or schools**, and do not add placeholder text such as "Bachelor of Computer Science (or relevant degree, if applicable)" when no education is present.
- **Relevance filter**: Strongly prioritize skills, technologies, tools, and projects that are directly relevant to the job analysis and description. It is acceptable to **omit or very briefly mention** technologies, domains, or projects that are clearly unrelated to the target role (for example, niche blockchain / NFT / crypto work when applying to a purely web / SaaS role). Do not highlight unrelated items as primary strengths or dedicate standalone project sections to them unless the job description explicitly calls for them.

Structure the output as a complete resume with these sections (include only sections present in the original):
- Name and contact information
- Professional Summary (tailored to this specific role)
- Skills / Technical Skills
- Work Experience (most recent first, **maximum 3 roles with detailed bullets**) + Additional Experiences
- Education (only if present in the original resume)
- Any other sections from the original (certifications, projects, publications, etc.)

Skills Mapping:
---
${matchResult}
---

Original Resume:
---
${resumeContent}
---

Target Job Description:
---
${jobDescription}
---

Output only the final Markdown resume. Do not include explanations, commentary, or preamble.
`.trim();
