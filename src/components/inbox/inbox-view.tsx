'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { UnifiedMessage } from '@/lib/types/message';
import { ContactService } from '@/lib/services/contact-service';
import { MessageService } from '@/lib/services/message-service';
import { MessageThread } from './message-thread';
import { MessageComposer } from './message-composer';
import { InboxFilters } from './inbox-filters';
import { InboxSearch } from './inbox-search';
import { LoadingSpinner } from '../ui/loading-spinner';
import { EmptyState } from '../ui/empty-state';

interface InboxViewProps {
    userId: string;
}

interface ThreadGroup {
    threadId: string;
    messages: UnifiedMessage[];
    lastMessage: UnifiedMessage;
    unreadCount: number;
    contactName?: string;
    contactId?: string;
    channels: MessageChannel[];
}

interface InboxFilters {
    channels?: MessageChannel[];
    status?: MessageStatus[];
    unreadOnly?: boolean;
    dateRange?: {
        from: Date;
        to: Date;
    };
    searchQuery?: string;
}

export function InboxView({ userId }: InboxViewProps) {
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [filters, setFilters] = useState<InboxFilters>({});
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch messages and group by thread
    const {
        data: threads,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['inbox-threads', userId, filters],
        queryFn: async () => {
            const messageService = new MessageService();
            const contactService = new ContactService();

            // Fetch messages with filters
            const messages = await messageService.getMessages({
                userId,
                channels: filters.channels,
                status: filters.status,
                unreadOnly: filters.unreadOnly,
                searchQuery: filters.searchQuery,
                dateRange: filters.dateRange,
                limit: 100,
                includeContact: true
            });

            // Group messages by thread
            const threadMap = new Map<string, UnifiedMessage[]>();

            messages.forEach(message => {
                const threadId = message.threadId;
                if (!threadMap.has(threadId)) {
                    threadMap.set(threadId, []);
                }
                threadMap.get(threadId)!.push(message);
            });

            // Create thread groups with metadata
            const threadGroups: ThreadGroup[] = [];

            for (const [threadId, threadMessages] of threadMap.entries()) {
                // Sort messages by date (newest first for last message)
                const sortedMessages = threadMessages.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                const lastMessage = sortedMessages[0];
                const unreadCount = threadMessages.filter(
                    m => m.status !== MessageStatus.READ
                ).length;

                // Get unique channels in this thread
                const channels = [...new Set(threadMessages.map(m => m.channel))];

                // Get contact info
                let contactName: string | undefined;
                let contactId: string | undefined;

                if (lastMessage.contactId) {
                    try {
                        const contact = await contactService.getContactById(lastMessage.contactId);
                        if (contact) {
                            contactName = contact.name || contact.email || contact.phone || 'Unknown Contact';
                            contactId = contact.id;
                        }
                    } catch (error) {
                        console.warn('Failed to fetch contact:', error);
                    }
                }

                threadGroups.push({
                    threadId,
                    messages: sortedMessages.reverse(), // Chronological order for display
                    lastMessage,
                    unreadCount,
                    contactName,
                    contactId,
                    channels
                });
            }

            // Sort threads by last message date (newest first)
            return threadGroups.sort(
                (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
            );
        },
        refetchInterval: 30000, // Refetch every 30 seconds
        staleTime: 10000 // Consider data stale after 10 seconds
    });

    // Handle real-time updates (WebSocket integration would go here)
    useEffect(() => {
        // TODO: Set up WebSocket connection for real-time updates
        // For now, we'll use polling via the refetchInterval above
    }, [userId]);

    // Handle thread selection
    const handleThreadSelect = (threadId: string) => {
        setSelectedThread(threadId);

        // Mark messages as read when thread is opened
        const thread = threads?.find(t => t.threadId === threadId);
        if (thread && thread.unreadCount > 0) {
            const messageService = new MessageService();
            thread.messages
                .filter(m => m.status !== MessageStatus.READ)
                .forEach(async (message) => {
                    try {
                        await messageService.updateMessageStatus(message.id, MessageStatus.READ);
                    } catch (error) {
                        console.warn('Failed to mark message as read:', error);
                    }
                });

            // Invalidate queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
        }
    };

    // Handle new message sent
    const handleMessageSent = () => {
        // Refresh threads after sending a message
        refetch();
        setIsComposerOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-red-600 mb-2">Failed to load messages</p>
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-gray-50">
            {/* Thread List Sidebar */}
            <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
                        <button
                            onClick={() => setIsComposerOpen(true)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                            New Message
                        </button>
                    </div>

                    {/* Search */}
                    <InboxSearch
                        value={filters.searchQuery || ''}
                        onChange={(searchQuery) => setFilters(prev => ({ ...prev, searchQuery }))}
                        placeholder="Search messages..."
                    />
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-200">
                    <InboxFilters
                        filters={filters}
                        onChange={setFilters}
                    />
                </div>

                {/* Thread List */}
                <div className="flex-1 overflow-y-auto">
                    {threads && threads.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {threads.map((thread) => (
                                <ThreadListItem
                                    key={thread.threadId}
                                    thread={thread}
                                    isSelected={selectedThread === thread.threadId}
                                    onClick={() => handleThreadSelect(thread.threadId)}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No messages"
                            description="No messages match your current filters."
                            action={
                                <button
                                    onClick={() => setFilters({})}
                                    className="text-blue-600 hover:text-blue-700"
                                >
                                    Clear filters
                                </button>
                            }
                        />
                    )}
                </div>
            </div>

            {/* Message Thread View */}
            <div className="flex-1 flex flex-col">
                {selectedThread ? (
                    <MessageThread
                        threadId={selectedThread}
                        messages={threads?.find(t => t.threadId === selectedThread)?.messages || []}
                        contactId={threads?.find(t => t.threadId === selectedThread)?.contactId}
                        onMessageSent={handleMessageSent}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                            <p className="text-gray-500">Choose a thread from the sidebar to view messages</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Message Composer Modal */}
            {isComposerOpen && (
                <MessageComposer
                    onClose={() => setIsComposerOpen(false)}
                    onMessageSent={handleMessageSent}
                />
            )}
        </div>
    );
}

// Thread List Item Component
interface ThreadListItemProps {
    thread: ThreadGroup;
    isSelected: boolean;
    onClick: () => void;
}

function ThreadListItem({ thread, isSelected, onClick }: ThreadListItemProps) {
    const { lastMessage, unreadCount, contactName, channels } = thread;

    const formatTime = (date: Date) => {
        const now = new Date();
        const messageDate = new Date(date);
        const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 24 * 7) {
            return messageDate.toLocaleDateString([], { weekday: 'short' });
        } else {
            return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getChannelIcon = (channel: MessageChannel) => {
        switch (channel) {
            case MessageChannel.SMS:
                return '💬';
            case MessageChannel.EMAIL:
                return '📧';
            case MessageChannel.WHATSAPP:
                return '📱';
            default:
                return '💬';
        }
    };

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    return (
        <div
            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                }`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                        {contactName || 'Unknown Contact'}
                    </h3>
                    <div className="flex space-x-1">
                        {channels.map((channel, index) => (
                            <span key={index} className="text-xs" title={channel}>
                                {getChannelIcon(channel)}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                        {formatTime(lastMessage.createdAt)}
                    </span>
                    {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <span className={`text-sm ${lastMessage.direction === Direction.INBOUND ? 'text-gray-600' : 'text-blue-600'}`}>
                    {lastMessage.direction === Direction.INBOUND ? '←' : '→'}
                </span>
                <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                    {truncateText(lastMessage.content.text || 'Media message', 60)}
                </p>
            </div>
        </div>
    );
}