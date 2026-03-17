import React from 'react';

interface SkeletonProps {
    width?: string;
    height?: string;
    className?: string;
}

export function Skeleton({ width = '100%', height = '1.2rem', className = '' }: SkeletonProps): React.ReactElement {
    return (
        <span
            className={`skeleton ${className}`}
            style={{ width, height, display: 'inline-block' }}
            aria-hidden="true"
        />
    );
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }): React.ReactElement {
    return (
        <div className="skeleton-block" aria-busy="true" aria-label="Loading...">
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="1rem"
                    className="skeleton-line"
                />
            ))}
        </div>
    );
}
