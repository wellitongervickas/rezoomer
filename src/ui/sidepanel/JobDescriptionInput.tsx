import React, { useState, useEffect } from "react";
import { sendMessage } from "../shared/messaging.ts";
import type {
  BaseResume,
  GenerationOptions,
  ResumeAudience,
} from "@/core/types.ts";

interface Props {
  onGenerate: (
    baseResumeId: string,
    jobDescription: string,
    company: string,
    role: string,
    options: GenerationOptions,
  ) => void;
  isGenerating: boolean;
  initialOptions: GenerationOptions;
  onOptionsChange?: (options: GenerationOptions) => void;
}

export function JobDescriptionInput({
  onGenerate,
  isGenerating,
  initialOptions,
  onOptionsChange,
}: Props) {
  const [baseResumes, setBaseResumes] = useState<BaseResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [audience, setAudience] = useState<ResumeAudience>(
    initialOptions.audience,
  );
  const [maxKeyExperiences, setMaxKeyExperiences] = useState<string>(
    initialOptions.maxKeyExperiences != null
      ? String(initialOptions.maxKeyExperiences)
      : "",
  );
  const [includeAdditionalExperience, setIncludeAdditionalExperience] =
    useState(initialOptions.includeAdditionalExperience);
  const [targetCountry, setTargetCountry] = useState(
    initialOptions.targetCountry ?? "",
  );
  const [targetLanguage, setTargetLanguage] = useState(
    initialOptions.targetLanguage ?? "",
  );
  const [rules, setRules] = useState(initialOptions.rules);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setAudience(initialOptions.audience);
    setMaxKeyExperiences(
      initialOptions.maxKeyExperiences != null
        ? String(initialOptions.maxKeyExperiences)
        : "",
    );
    setIncludeAdditionalExperience(initialOptions.includeAdditionalExperience);
    setTargetCountry(initialOptions.targetCountry ?? "");
    setTargetLanguage(initialOptions.targetLanguage ?? "");
    setRules(initialOptions.rules);
  }, [initialOptions]);

  useEffect(() => {
    let cancelled = false;
    setLoadingResumes(true);
    setFetchError(null);
    sendMessage<BaseResume[]>({ type: "GET_BASE_RESUMES" })
      .then((data) => {
        if (!cancelled) {
          setBaseResumes(data);
          if (data.length > 0) setSelectedResumeId(data[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setFetchError(
            err instanceof Error ? err.message : "Failed to load resumes",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingResumes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canGenerate =
    !isGenerating && selectedResumeId !== "" && jobDescription !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    const options = buildOptions();

    onGenerate(selectedResumeId, jobDescription, company, role, options);
  }

  function buildOptions(): GenerationOptions {
    const parsedMax =
      maxKeyExperiences === "" || Number.isNaN(Number(maxKeyExperiences))
        ? null
        : Number(maxKeyExperiences);

    return {
      audience,
      maxKeyExperiences: parsedMax,
      includeAdditionalExperience,
      targetCountry: targetCountry === "" ? null : targetCountry,
      targetLanguage: targetLanguage === "" ? null : targetLanguage,
      rules: rules,
    };
  }

  useEffect(() => {
    if (!onOptionsChange) return;
    onOptionsChange(buildOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    audience,
    maxKeyExperiences,
    includeAdditionalExperience,
    targetCountry,
    targetLanguage,
    rules,
  ]);

  return (
    <form className="jd-input" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="base-resume-select">
          Base Resume
        </label>
        {loadingResumes ? (
          <p className="form-hint">Loading resumes…</p>
        ) : fetchError ? (
          <p className="form-error">{fetchError}</p>
        ) : baseResumes.length === 0 ? (
          <p className="form-hint">
            No base resumes saved. Add one in the options page.
          </p>
        ) : (
          <select
            id="base-resume-select"
            className="form-select"
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
            disabled={isGenerating}
          >
            <option value="">— Select a resume —</option>
            {baseResumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <details className="form-advanced">
        <summary className="form-advanced__summary">Advanced options</summary>
        <div className="form-advanced__content">
          <div className="form-group">
            <span className="form-label">Primary audience</span>
            <div className="form-radio-group">
              <label className="form-radio">
                <input
                  type="radio"
                  name="audience"
                  value="ats"
                  checked={audience === "ats"}
                  onChange={() => setAudience("ats")}
                  disabled={isGenerating}
                />
                <span>ATS-focused</span>
              </label>
              <label className="form-radio">
                <input
                  type="radio"
                  name="audience"
                  value="hr"
                  checked={audience === "hr"}
                  onChange={() => setAudience("hr")}
                  disabled={isGenerating}
                />
                <span>HR / recruiter</span>
              </label>
              <label className="form-radio">
                <input
                  type="radio"
                  name="audience"
                  value="both"
                  checked={audience === "both"}
                  onChange={() => setAudience("both")}
                  disabled={isGenerating}
                />
                <span>Both ATS and HR</span>
              </label>
            </div>
          </div>

          <div className="form-group form-group--inline">
            <div>
              <label className="form-label" htmlFor="max-experiences-input">
                Max key experiences
              </label>
              <input
                id="max-experiences-input"
                type="number"
                min={1}
                max={6}
                className="form-input form-input--sm"
                placeholder="3"
                value={maxKeyExperiences}
                onChange={(e) => setMaxKeyExperiences(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={includeAdditionalExperience}
                onChange={(e) =>
                  setIncludeAdditionalExperience(e.target.checked)
                }
                disabled={isGenerating}
              />
              <span>Show additional experience summary</span>
            </label>
          </div>

          <div className="form-group form-group--inline">
            <div>
              <label className="form-label" htmlFor="target-country-input">
                Target country
              </label>
              <input
                id="target-country-input"
                type="text"
                className="form-input"
                placeholder="e.g. United States, Germany"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="target-language-input">
                Target language
              </label>
              <input
                id="target-language-input"
                type="text"
                className="form-input"
                placeholder="e.g. English, Portuguese"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rules-textarea">
              Custom rules & emphasis
            </label>
            <textarea
              id="rules-textarea"
              className="form-textarea"
              rows={4}
              placeholder="Examples: downplay AWS and highlight GCP; mention I am still learning Kubernetes; avoid overstating blockchain experience."
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              disabled={isGenerating}
            />
            <p className="form-hint">
              These instructions will be passed directly to the AI to control
              tone and emphasis. They should never cause fabrication of skills
              or experience.
            </p>
          </div>
        </div>
      </details>

      <div className="form-group">
        <label className="form-label" htmlFor="company-input">
          Company <span className="form-optional">(optional)</span>
        </label>
        <input
          id="company-input"
          type="text"
          className="form-input"
          placeholder="Acme Corp"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="role-input">
          Role Title <span className="form-optional">(optional)</span>
        </label>
        <input
          id="role-input"
          type="text"
          className="form-input"
          placeholder="Senior Software Engineer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="jd-textarea">
          Job Description <span className="form-required">*</span>
        </label>
        <textarea
          id="jd-textarea"
          className="form-textarea"
          placeholder="Paste the full job description here…"
          rows={10}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          disabled={isGenerating}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-full"
        disabled={!canGenerate}
      >
        Generate Resume
      </button>
    </form>
  );
}
