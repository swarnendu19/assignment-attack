'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({
    title,
    description,
    icon,
    action,
    className = ''
}: EmptyStateProps) {
    return (
        <div className={`text-center py-12 px-4 ${className}`}>
            {icon && (
                <div className="mx-auto mb-4">
                    {icon}
                </div>
            )}

            <h3 className="text-lg font-medium text-gray-900 mb-2">
                {title}
            </h3>

            {description && (
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                    {description}
                </p>
            )}

            {action && (
                <div>
                    {action}
                </div>
            )}
        </div>
    );
}