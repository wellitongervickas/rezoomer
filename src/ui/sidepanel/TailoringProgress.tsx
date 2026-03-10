import React from 'react';

export type TailoringStep = 'analyzing' | 'matching' | 'generating';

interface Props {
  step: TailoringStep;
  streamedText: string;
  onCancel: () => void;
}

const STEPS: { key: TailoringStep; label: string }[] = [
  { key: 'analyzing', label: 'Analyzing job description' },
  { key: 'matching', label: 'Matching your experience' },
  { key: 'generating', label: 'Generating resume' },
];

function stepIndex(step: TailoringStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export function TailoringProgress({ step, streamedText, onCancel }: Props) {
  const current = stepIndex(step);

  return (
    <div className="progress-panel">
      <div className="progress-steps">
        {STEPS.map((s, i) => {
          const state =
            i < current ? 'done' : i === current ? 'active' : 'pending';
          return (
            <div key={s.key} className={`progress-step progress-step--${state}`}>
              <span className="progress-step__indicator">
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="progress-step__label">{s.label}</span>
            </div>
          );
        })}
      </div>

      <p className="progress-counter">
        Step {current + 1} of {STEPS.length}
      </p>

      {streamedText && (
        <div className="progress-stream">
          <pre className="progress-stream__text">{streamedText}</pre>
        </div>
      )}

      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
