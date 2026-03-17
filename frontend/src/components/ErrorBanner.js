import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ErrorBanner({ message, onDismiss }) {
    return (_jsxs("div", { className: "error-banner", role: "alert", children: [_jsx("span", { className: "error-banner__icon", "aria-hidden": "true", children: "!" }), _jsx("span", { className: "error-banner__message", children: message }), onDismiss && (_jsx("button", { className: "error-banner__close", onClick: onDismiss, type: "button", "aria-label": "Dismiss error", children: "x" }))] }));
}
