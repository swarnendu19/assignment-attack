'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { UnifiedMessage } from '@/lib/types/message';
import { UnifiedContact } from '@/lib/types/contact';
import { ContactService } from '@/lib/services/contact-service';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';
import { ContactProfile } from './contact-profile';
import { LoadingSpinner } from '../ui/loading-spinner';

interface MessageThreadProps {
    threadId: string;
    messages: UnifiedMessage[];
    contactId?: string;
    onMessageSent?: () => void;
}

export function MessageThread({
    threadId,
    messages,
    contactId,
    onMessageSent
}: MessageThreadProps) {
    const [showContactProfile, setShowContactProfile] = useState(false);
    const [isComposerFocused, setIsComposerFocused] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Fetch contact details
    const { data: contact } = useQuery({
        queryKey: ['contact', contactId],
        queryFn: async () => {
            if (!contactId) return null;
            const contactService = new ContactService();
            return contactService.getContactById(contactId, {
                includeStats: true
            });
        },
        enabled: !!contactId
    });

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Group messages by date
    const groupMessagesByDate = (messages: UnifiedMessage[]) => {
        const groups: { date: string; messages: UnifiedMessage[] }[] = [];
        let currentDate = '';
        let currentGroup: UnifiedMessage[] = [];

        messages.forEach((message) => {
            const messageDate = new Date(message.createdAt).toDateString();

            if (messageDate !== currentDate) {
                if (currentGroup.length > 0) {
                    groups.push({ date: currentDate, messages: currentGroup });
                }
                currentDate = messageDate;
                currentGroup = [message];
            } else {
                currentGroup.push(message);
            }
        });

        if (currentGroup.length > 0) {
            groups.push({ date: currentDate, messages: currentGroup });
        }

        return groups;
    };

    const formatDateHeader = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
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

    const getContactDisplayName = (contact?: UnifiedContact | null) => {
        if (!contact) return 'Unknown Contact';
        return contact.name || contact.email || contact.phone || 'Unknown Contact';
    };

    const messageGroups = groupMessagesByDate(messages);
    const availableChannels = [...new Set(messages.map(m => m.channel))];

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Thread Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                    {/* Contact Avatar */}
                    <button
                        onClick={() => setShowContactProfile(true)}
                        className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium hover:bg-blue-700 transition-colors"
                    >
                        {contact?.name ? contact.name.charAt(0).toUpperCase() : '?'}
                    </button>

                    <div>
                        <h2 className="font-semibold text-gray-900">
                            {getContactDisplayName(contact)}
                        </h2>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>{messages.length} messages</span>
                            <span>•</span>
                            <div className="flex space-x-1">
                                {availableChannels.map((channel, index) => (
                                    <span key={index} title={channel}>
                                        {getChannelIcon(channel)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Thread Actions */}
                    <button
                        onClick={() => setShowContactProfile(true)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title="View contact profile"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </button>

                    <button
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title="More options"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-6"
            >
                {messageGroups.length > 0 ? (
                    messageGroups.map((group, groupIndex) => (
                        <div key={groupIndex}>
                            {/* Date Header */}
                            <div className="flex justify-center mb-4">
                                <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                                    {formatDateHeader(group.date)}
                                </span>
                            </div>

                            {/* Messages for this date */}
                            <div className="space-y-3">
                                {group.messages.map((message, messageIndex) => (
                                    <MessageBubble
                                        key={message.id}
                                        message={message}
                                        showAvatar={
                                            messageIndex === 0 ||
                                            group.messages[messageIndex - 1].direction !== message.direction
                                        }
                                        contact={contact}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                            <p className="text-gray-500">Start a conversation by sending a message below</p>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            <div className={`border-t border-gray-200 transition-all ${isComposerFocused ? 'bg-gray-50' : 'bg-white'}`}>
                <MessageComposer
                    threadId={threadId}
                    contactId={contactId}
                    availableChannels={availableChannels}
                    onMessageSent={onMessageSent}
                    onFocusChange={setIsComposerFocused}
                    compact={true}
                />
            </div>

            {/* Contact Profile Sidebar */}
            {showContactProfile && contact && (
                <ContactProfile
                    contact={contact}
                    onClose={() => setShowContactProfile(false)}
                />
            )}
        </div>
    );
}