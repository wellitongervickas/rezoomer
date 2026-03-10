import { useState, useEffect, useCallback } from 'react';
import { useMessaging } from '../shared/hooks.ts';
import { sendMessage } from '../shared/messaging.ts';

interface BaseResume {
  id: string;
  label: string;
  content: string;
}

type Mode = 'list' | 'add' | 'edit';

export function BaseResumeManager() {
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [mode, setMode] = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<BaseResume | null>(null);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saved' | 'deleted' | 'error'>('idle');

  const { send, loading, error } = useMessaging<BaseResume | null>();

  const loadResumes = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await sendMessage<BaseResume[]>({ type: 'GET_BASE_RESUMES' });
      setResumes(data ?? []);
    } catch {
      setResumes([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  function openAdd() {
    setEditTarget(null);
    setLabel('');
    setContent('');
    setSavedStatus('idle');
    setMode('add');
  }

  function openEdit(resume: BaseResume) {
    setEditTarget(resume);
    setLabel(resume.label);
    setContent(resume.content);
    setSavedStatus('idle');
    setMode('edit');
  }

  function cancelForm() {
    setMode('list');
    setEditTarget(null);
    setLabel('');
    setContent('');
    setSavedStatus('idle');
  }

  async function handleSave() {
    if (!label.trim() || !content.trim()) return;

    if (mode === 'edit' && editTarget) {
      const result = await send({
        type: 'UPDATE_BASE_RESUME',
        id: editTarget.id,
        label: label.trim(),
        content: content.trim(),
      });
      if (result !== null) {
        setSavedStatus('saved');
        await loadResumes();
        setTimeout(() => { setMode('list'); setSavedStatus('idle'); }, 1000);
      } else {
        setSavedStatus('error');
      }
    } else {
      const result = await send({
        type: 'SAVE_BASE_RESUME',
        label: label.trim(),
        content: content.trim(),
      });
      if (result !== null) {
        setSavedStatus('saved');
        await loadResumes();
        setTimeout(() => { setMode('list'); setSavedStatus('idle'); }, 1000);
      } else {
        setSavedStatus('error');
      }
    }
  }

  async function handleDelete(id: string) {
    const result = await send({ type: 'DELETE_BASE_RESUME', id });
    if (result !== null) {
      setSavedStatus('deleted');
      await loadResumes();
      setTimeout(() => setSavedStatus('idle'), 2000);
    } else {
      setSavedStatus('error');
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <h2 className="section-title">Base Resumes</h2>
        {mode === 'list' && (
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Resume
          </button>
        )}
      </div>

      {savedStatus === 'deleted' && (
        <p className="status-message status-success">Resume deleted.</p>
      )}
      {(savedStatus === 'error' || error) && (
        <p className="status-message status-error">{error ?? 'An error occurred.'}</p>
      )}

      {mode === 'list' && (
        <>
          {loadingList && <p className="muted-text">Loading resumes…</p>}
          {!loadingList && resumes.length === 0 && (
            <p className="muted-text">No base resumes saved yet.</p>
          )}
          {!loadingList && resumes.length > 0 && (
            <ul className="resume-list">
              {resumes.map((r) => (
                <li key={r.id} className="resume-item">
                  <span className="resume-label">{r.label}</span>
                  <div className="resume-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(r.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {(mode === 'add' || mode === 'edit') && (
        <div className="resume-form">
          <h3 className="form-subtitle">
            {mode === 'edit' ? 'Edit Resume' : 'New Resume'}
          </h3>

          <div className="form-group">
            <label htmlFor="resume-label" className="form-label">
              Label
            </label>
            <input
              id="resume-label"
              type="text"
              className="form-input"
              placeholder="e.g. Software Engineer – Full Stack"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="resume-content" className="form-label">
              Content (Markdown)
            </label>
            <textarea
              id="resume-content"
              className="form-textarea"
              placeholder="# John Doe&#10;&#10;## Experience&#10;..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              rows={16}
            />
          </div>

          <div className="button-row">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading || !label.trim() || !content.trim()}
            >
              {loading ? 'Saving…' : mode === 'edit' ? 'Update Resume' : 'Save Resume'}
            </button>
            <button className="btn btn-secondary" onClick={cancelForm} disabled={loading}>
              Cancel
            </button>
          </div>

          {savedStatus === 'saved' && (
            <p className="status-message status-success">Resume saved.</p>
          )}
          {(savedStatus === 'error' || error) && (
            <p className="status-message status-error">{error ?? 'An error occurred.'}</p>
          )}
        </div>
      )}
    </section>
  );
}
