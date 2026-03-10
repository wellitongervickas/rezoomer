import React, { useState, useEffect } from 'react';
import { sendMessage } from '../shared/messaging.ts';
import type { BaseResume } from '@/core/types.ts';

interface Props {
  onGenerate: (baseResumeId: string, jobDescription: string, company: string, role: string) => void;
  isGenerating: boolean;
}

export function JobDescriptionInput({ onGenerate, isGenerating }: Props) {
  const [baseResumes, setBaseResumes] = useState<BaseResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingResumes(true);
    setFetchError(null);
    sendMessage<BaseResume[]>({ type: 'GET_BASE_RESUMES' })
      .then((data) => {
        if (!cancelled) {
          setBaseResumes(data);
          if (data.length > 0) setSelectedResumeId(data[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load resumes');
      })
      .finally(() => {
        if (!cancelled) setLoadingResumes(false);
      });
    return () => { cancelled = true; };
  }, []);

  const canGenerate =
    !isGenerating &&
    selectedResumeId.trim() !== '' &&
    jobDescription.trim() !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerate(selectedResumeId, jobDescription.trim(), company.trim(), role.trim());
  }

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
          <p className="form-hint">No base resumes saved. Add one in the options page.</p>
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
