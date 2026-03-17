import React from 'react';

interface ErrorBannerProps {
    message: string;
    onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): React.ReactElement {
    return (
        <div className="error-banner" role="alert">
            <span className="error-banner__icon" aria-hidden="true">!</span>
            <span className="error-banner__message">{message}</span>
            {onDismiss && (
                <button
                    className="error-banner__close"
                    onClick={onDismiss}
                    type="button"
                    aria-label="Dismiss error"
                >
                    x
                </button>
            )}
        </div>
    );
}
