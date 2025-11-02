'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface InboxSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function InboxSearch({
    value,
    onChange,
    placeholder = "Search messages...",
    className = ""
}: InboxSearchProps) {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Cmd/Ctrl + K to focus search
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                inputRef.current?.focus();
            }

            // Escape to clear search
            if (event.key === 'Escape' && isFocused) {
                onChange('');
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isFocused, onChange]);

    const handleClear = () => {
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon
                        className={`h-4 w-4 transition-colors ${isFocused ? 'text-blue-500' : 'text-gray-400'
                            }`}
                    />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className={`
            block w-full pl-10 pr-10 py-2 text-sm
            border border-gray-300 rounded-md
            placeholder-gray-500 text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            transition-colors
            ${value ? 'pr-10' : 'pr-4'}
          `}
                />

                {value && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                            onClick={handleClear}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            type="button"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search suggestions/results could go here */}
            {value && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                    {/* TODO: Add search suggestions/recent searches */}
                    <div className="p-3 text-sm text-gray-500">
                        Press Enter to search for "{value}"
                    </div>
                </div>
            )}

            {/* Keyboard shortcut hint */}
            {!isFocused && !value && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded">
                        ⌘K
                    </kbd>
                </div>
            )}
        </div>
    );
}