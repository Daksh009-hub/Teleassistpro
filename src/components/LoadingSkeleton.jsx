import React from 'react';

export function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="d-flex flex-column gap-2 my-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card border-0 shadow-sm p-3 bg-white">
          <div className="placeholder-glow">
            <div className="d-flex justify-content-between mb-2">
              <span className="placeholder col-6 rounded bg-secondary-subtle py-2"></span>
              <span className="placeholder col-2 rounded bg-secondary-subtle py-2"></span>
            </div>
            <p className="placeholder col-10 rounded bg-secondary-subtle mb-1 py-1"></p>
            <p className="placeholder col-4 rounded bg-secondary-subtle py-1"></p>
          </div>
        </div>
      ))}
    </div>
  );
}
