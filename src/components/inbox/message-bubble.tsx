'use client';

import { useState } from 'react';
import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { UnifiedMessage } from '@/lib/types/message';
import { UnifiedContact } from '@/lib/types/contact';
import { MediaAttachment } from './media-attachment';

interface MessageBubbleProps {
    message: UnifiedMessage;
    showAvatar?: boolean;
    contact?: UnifiedContact | null;
}

export function MessageBubble({ message, showAvatar = true, contact }: MessageBubbleProps) {
    const [showDetails, setShowDetails] = useState(false);

    const isInbound = message.direction === Direction.INBOUND;
    const isOutbound = message.direction === Direction.OUTBOUND;

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

    const getStatusIcon = (status: MessageStatus) => {
        switch (status) {
            case MessageStatus.PENDING:
                return '⏳';
            case MessageStatus.SENT:
                return '✓';
            case MessageStatus.DELIVERED:
                return '✓✓';
            case MessageStatus.READ:
                return '✓✓';
            case MessageStatus.FAILED:
                return '❌';
            default:
                return '';
        }
    };

    const getStatusColor = (status: MessageStatus) => {
        switch (status) {
            case MessageStatus.PENDING:
                return 'text-yellow-500';
            case MessageStatus.SENT:
                return 'text-gray-400';
            case MessageStatus.DELIVERED:
                return 'text-blue-500';
            case MessageStatus.READ:
                return 'text-blue-600';
            case MessageStatus.FAILED:
                return 'text-red-500';
            default:
                return 'text-gray-400';
        }
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getContactInitials = () => {
        if (!contact) return '?';
        if (contact.name) return contact.name.charAt(0).toUpperCase();
        if (contact.email) return contact.email.charAt(0).toUpperCase();
        if (contact.phone) return contact.phone.charAt(1) || '?';
        return '?';
    };

    return (
        <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group`}>
            <div className={`flex max-w-xs lg:max-w-md ${isOutbound ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
                {/* Avatar */}
                {showAvatar && isInbound && (
                    <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {getContactInitials()}
                    </div>
                )}

                {/* Message Content */}
                <div className={`relative ${isOutbound ? 'mr-2' : 'ml-2'}`}>
                    {/* Message Bubble */}
                    <div
                        className={`px-4 py-2 rounded-2xl cursor-pointer transition-all ${isOutbound
                                ? 'bg-blue-600 text-white rounded-br-md'
                                : 'bg-gray-100 text-gray-900 rounded-bl-md'
                            } ${showDetails ? 'shadow-lg' : 'hover:shadow-md'}`}
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {/* Channel Badge */}
                        <div className={`flex items-center justify-between mb-1 ${message.content.text ? '' : 'mb-0'}`}>
                            <span className="text-xs opacity-75 flex items-center space-x-1">
                                <span>{getChannelIcon(message.channel)}</span>
                                <span className="uppercase tracking-wide">{message.channel}</span>
                            </span>
                        </div>

                        {/* Text Content */}
                        {message.content.text && (
                            <div className="whitespace-pre-wrap break-words">
                                {message.content.text}
                            </div>
                        )}

                        {/* Media Attachments */}
                        {message.content.media && message.content.media.length > 0 && (
                            <div className="mt-2 space-y-2">
                                {message.content.media.map((media, index) => (
                                    <MediaAttachment
                                        key={media.id || index}
                                        media={media}
                                        isOutbound={isOutbound}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Email-specific content */}
                        {message.channel === MessageChannel.EMAIL && message.metadata.channelSpecific?.subject && (
                            <div className={`text-xs mt-1 pt-1 border-t ${isOutbound ? 'border-blue-500' : 'border-gray-300'} opacity-75`}>
                                Subject: {message.metadata.channelSpecific.subject}
                            </div>
                        )}
                    </div>

                    {/* Message Details */}
                    {showDetails && (
                        <div className={`absolute top-full mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 text-xs text-gray-600 min-w-48 ${isOutbound ? 'right-0' : 'left-0'
                            }`}>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Time:</span>
                                    <span>{formatTime(message.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <span className={`flex items-center space-x-1 ${getStatusColor(message.status)}`}>
                                        <span>{getStatusIcon(message.status)}</span>
                                        <span>{message.status}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Channel:</span>
                                    <span className="flex items-center space-x-1">
                                        <span>{getChannelIcon(message.channel)}</span>
                                        <span>{message.channel}</span>
                                    </span>
                                </div>
                                {message.metadata.externalId && (
                                    <div className="flex justify-between">
                                        <span>ID:</span>
                                        <span className="font-mono text-xs truncate max-w-24" title={message.metadata.externalId}>
                                            {message.metadata.externalId}
                                        </span>
                                    </div>
                                )}

                                {/* Channel-specific metadata */}
                                {message.channel === MessageChannel.EMAIL && message.metadata.channelSpecific && (
                                    <>
                                        {message.metadata.channelSpecific.from && (
                                            <div className="flex justify-between">
                                                <span>From:</span>
                                                <span className="truncate max-w-32" title={message.metadata.channelSpecific.from}>
                                                    {message.metadata.channelSpecific.from}
                                                </span>
                                            </div>
                                        )}
                                        {message.metadata.channelSpecific.to && (
                                            <div className="flex justify-between">
                                                <span>To:</span>
                                                <span className="truncate max-w-32" title={Array.isArray(message.metadata.channelSpecific.to) ? message.metadata.channelSpecific.to.join(', ') : message.metadata.channelSpecific.to}>
                                                    {Array.isArray(message.metadata.channelSpecific.to) ? message.metadata.channelSpecific.to.join(', ') : message.metadata.channelSpecific.to}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {message.channel === MessageChannel.SMS && message.metadata.channelSpecific && (
                                    <>
                                        {message.metadata.channelSpecific.from && (
                                            <div className="flex justify-between">
                                                <span>From:</span>
                                                <span>{message.metadata.channelSpecific.from}</span>
                                            </div>
                                        )}
                                        {message.metadata.channelSpecific.to && (
                                            <div className="flex justify-between">
                                                <span>To:</span>
                                                <span>{message.metadata.channelSpecific.to}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timestamp and Status (Always Visible) */}
                    <div className={`flex items-center mt-1 text-xs text-gray-500 space-x-2 ${isOutbound ? 'justify-end' : 'justify-start'
                        }`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {isOutbound && (
                            <span className={`${getStatusColor(message.status)}`}>
                                {getStatusIcon(message.status)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}