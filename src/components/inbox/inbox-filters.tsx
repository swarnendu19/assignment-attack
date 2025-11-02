'use client';

import { useState } from 'react';
import { MessageChannel, MessageStatus } from '@prisma/client';
import { ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/outline';

interface InboxFiltersProps {
    filters: {
        channels?: MessageChannel[];
        status?: MessageStatus[];
        unreadOnly?: boolean;
        dateRange?: {
            from: Date;
            to: Date;
        };
    };
    onChange: (filters: any) => void;
}

export function InboxFilters({ filters, onChange }: InboxFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const channelOptions = [
        { value: MessageChannel.SMS, label: 'SMS', icon: '💬' },
        { value: MessageChannel.EMAIL, label: 'Email', icon: '📧' },
        { value: MessageChannel.WHATSAPP, label: 'WhatsApp', icon: '📱' }
    ];

    const statusOptions = [
        { value: MessageStatus.PENDING, label: 'Pending', color: 'yellow' },
        { value: MessageStatus.SENT, label: 'Sent', color: 'blue' },
        { value: MessageStatus.DELIVERED, label: 'Delivered', color: 'green' },
        { value: MessageStatus.READ, label: 'Read', color: 'gray' },
        { value: MessageStatus.FAILED, label: 'Failed', color: 'red' }
    ];

    const handleChannelToggle = (channel: MessageChannel) => {
        const currentChannels = filters.channels || [];
        const newChannels = currentChannels.includes(channel)
            ? currentChannels.filter(c => c !== channel)
            : [...currentChannels, channel];

        onChange({
            ...filters,
            channels: newChannels.length > 0 ? newChannels : undefined
        });
    };

    const handleStatusToggle = (status: MessageStatus) => {
        const currentStatuses = filters.status || [];
        const newStatuses = currentStatuses.includes(status)
            ? currentStatuses.filter(s => s !== status)
            : [...currentStatuses, status];

        onChange({
            ...filters,
            status: newStatuses.length > 0 ? newStatuses : undefined
        });
    };

    const handleUnreadToggle = () => {
        onChange({
            ...filters,
            unreadOnly: !filters.unreadOnly
        });
    };

    const handleDateRangeChange = (range: 'today' | 'week' | 'month' | 'clear') => {
        const now = new Date();
        let dateRange;

        switch (range) {
            case 'today':
                dateRange = {
                    from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                };
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                dateRange = {
                    from: weekStart,
                    to: now
                };
                break;
            case 'month':
                dateRange = {
                    from: new Date(now.getFullYear(), now.getMonth(), 1),
                    to: now
                };
                break;
            case 'clear':
                dateRange = undefined;
                break;
        }

        onChange({
            ...filters,
            dateRange
        });
    };

    const clearAllFilters = () => {
        onChange({});
    };

    const hasActiveFilters = !!(
        filters.channels?.length ||
        filters.status?.length ||
        filters.unreadOnly ||
        filters.dateRange
    );

    return (
        <div className="space-y-3">
            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <FunnelIcon className="h-4 w-4" />
                    <span>Filters</span>
                    <ChevronDownIcon
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                    {hasActiveFilters && (
                        <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full"></span>
                    )}
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Quick Filters (Always Visible) */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleUnreadToggle}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${filters.unreadOnly
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                >
                    Unread only
                </button>

                {channelOptions.map((channel) => (
                    <button
                        key={channel.value}
                        onClick={() => handleChannelToggle(channel.value)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors flex items-center space-x-1 ${filters.channels?.includes(channel.value)
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            }`}
                    >
                        <span>{channel.icon}</span>
                        <span>{channel.label}</span>
                    </button>
                ))}
            </div>

            {/* Expanded Filters */}
            {isExpanded && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                    {/* Message Status */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                            Message Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {statusOptions.map((status) => (
                                <button
                                    key={status.value}
                                    onClick={() => handleStatusToggle(status.value)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${filters.status?.includes(status.value)
                                            ? `bg-${status.color}-100 text-${status.color}-800 border-${status.color}-200`
                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                            Date Range
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => handleDateRangeChange('today')}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${filters.dateRange &&
                                        new Date().toDateString() === filters.dateRange.from.toDateString()
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => handleDateRangeChange('week')}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${filters.dateRange &&
                                        filters.dateRange.from.getTime() < Date.now() - (6 * 24 * 60 * 60 * 1000)
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                This week
                            </button>
                            <button
                                onClick={() => handleDateRangeChange('month')}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${filters.dateRange &&
                                        filters.dateRange.from.getMonth() === new Date().getMonth()
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                This month
                            </button>
                            {filters.dateRange && (
                                <button
                                    onClick={() => handleDateRangeChange('clear')}
                                    className="px-2 py-1 text-xs rounded border bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}