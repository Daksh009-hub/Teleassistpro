import React from 'react';

export function AISummaryBadge({ text }) {
  if (!text) return null;
  return (
    <span className="badge bg-primary-subtle text-primary border border-primary border-opacity-50 fw-semibold d-inline-flex align-items-center">
      <span className="me-1">✨</span> {text}
    </span>
  );
}
