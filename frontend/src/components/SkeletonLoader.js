import { jsx as _jsx } from "react/jsx-runtime";
export function Skeleton({ width = '100%', height = '1.2rem', className = '' }) {
    return (_jsx("span", { className: `skeleton ${className}`, style: { width, height, display: 'inline-block' }, "aria-hidden": "true" }));
}
export function SkeletonBlock({ lines = 3 }) {
    return (_jsx("div", { className: "skeleton-block", "aria-busy": "true", "aria-label": "Loading...", children: Array.from({ length: lines }, (_, i) => (_jsx(Skeleton, { width: i === lines - 1 ? '60%' : '100%', height: "1rem", className: "skeleton-line" }, i))) }));
}
