export const ANALYZE_PROMPT = (jobDescription: string): string => `
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

export const MATCH_PROMPT = (analysis: string, resumeContent: string): string => `
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
): string => `
You are an expert resume writer. Using the skills mapping and the original resume, rewrite the resume in clean Markdown, tailored to the target job description.

CRITICAL RULES - you MUST follow these without exception:
- **Never fabricate**: Do not invent any experience, skill, project, title, date, or achievement that is not present in the original resume. Violations destroy candidate credibility.
- **Reframe, don't invent**: You may rephrase and reorder existing content to emphasize relevance. You may incorporate job-relevant keywords where they accurately describe existing work.
- **Preserve all facts**: Dates, company names, job titles, and measurable achievements must remain accurate.
- **Keyword optimization**: Naturally weave ATS-relevant keywords from the job description into bullet points where they genuinely apply.
- **Professional tone**: Use strong action verbs, quantify impact where data exists, and keep language concise and impactful.
- **Markdown formatting**: Use standard resume Markdown - headings (##), bullet lists (-), bold (**) for emphasis. Do not use HTML.

Structure the output as a complete resume with these sections (include only sections present in the original):
- Name and contact information
- Professional Summary (tailored to this specific role)
- Skills / Technical Skills
- Work Experience (most recent first)
- Education
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
