import React, { useState, useEffect, useCallback } from 'react';
import { sendMessage } from '../shared/messaging.ts';
import type { TailoredResume } from '@/core/types.ts';

const PAGE_SIZE = 10;

interface ListTailoredResponse {
  items: TailoredResume[];
  total: number;
}

interface Props {
  onSelect: (resume: TailoredResume) => void;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function HistoryList({ onSelect }: Props) {
  const [items, setItems] = useState<TailoredResume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendMessage<ListTailoredResponse>({
        type: 'LIST_TAILORED',
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  function handleLoadMore() {
    loadPage(page + 1, true);
  }

  const hasMore = items.length < total;

  if (!loading && items.length === 0 && !error) {
    return (
      <div className="history-empty">
        <p>No tailored resumes yet.</p>
        <p className="form-hint">Generate one from the Generate tab.</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {error && <p className="form-error">{error}</p>}

      <ul className="history-list__items">
        {items.map((item) => {
          const { companyName, roleTitle } = item.jobDescription;
          const title = [roleTitle, companyName].filter(Boolean).join(' @ ') || 'Untitled';
          return (
            <li key={item.id} className="history-card">
              <button
                type="button"
                className="history-card__btn"
                onClick={() => onSelect(item)}
              >
                <span className="history-card__title">{title}</span>
                <span className="history-card__date">{formatDate(item.createdAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          className="btn btn-ghost btn-full"
          onClick={handleLoadMore}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load More'}
        </button>
      )}

      {loading && items.length === 0 && (
        <p className="form-hint">Loading history…</p>
      )}
    </div>
  );
}
