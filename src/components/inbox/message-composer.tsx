'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageChannel } from '@prisma/client';
import { PaperAirplaneIcon, PaperClipIcon, FaceSmileIcon } from '@heroicons/react/24/outline';

interface MessageComposerProps {
    threadId?: string;
    contactId?: string;
    availableChannels?: MessageChannel[];
    onMessageSent?: () => void;
    onFocusChange?: (focused: boolean) => void;
    onClose?: () => void;
    compact?: boolean;
}

export function MessageComposer({
    threadId,
    contactId,
    availableChannels = [MessageChannel.SMS],
    onMessageSent,
    onFocusChange,
    onClose,
    compact = false
}: MessageComposerProps) {
    const [message, setMessage] = useState('');
    const [selectedChannel, setSelectedChannel] = useState<MessageChannel>(
        availableChannels[0] || MessageChannel.SMS
    );
    const [isSending, setIsSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isFocused, setIsFocused] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    // Handle focus changes
    useEffect(() => {
        onFocusChange?.(isFocused);
    }, [isFocused, onFocusChange]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() && attachments.length === 0) return;
        if (isSending) return;

        setIsSending(true);

        try {
            // TODO: Implement actual message sending logic
            // This would integrate with the MessageService and IntegrationFactory

            console.log('Sending message:', {
                threadId,
                contactId,
                channel: selectedChannel,
                message: message.trim(),
                attachments: attachments.map(f => f.name)
            });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Clear form
            setMessage('');
            setAttachments([]);

            // Notify parent
            onMessageSent?.();

            // Close modal if not compact
            if (!compact) {
                onClose?.();
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            // TODO: Show error toast
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
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

    const getChannelLabel = (channel: MessageChannel) => {
        switch (channel) {
            case MessageChannel.SMS:
                return 'SMS';
            case MessageChannel.EMAIL:
                return 'Email';
            case MessageChannel.WHATSAPP:
                return 'WhatsApp';
            default:
                return channel;
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!compact) {
        // Modal version
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-4">
                        <MessageComposerContent
                            message={message}
                            setMessage={setMessage}
                            selectedChannel={selectedChannel}
                            setSelectedChannel={setSelectedChannel}
                            availableChannels={availableChannels}
                            attachments={attachments}
                            removeAttachment={removeAttachment}
                            handleFileSelect={handleFileSelect}
                            handleSubmit={handleSubmit}
                            handleKeyDown={handleKeyDown}
                            isSending={isSending}
                            isFocused={isFocused}
                            setIsFocused={setIsFocused}
                            textareaRef={textareaRef}
                            fileInputRef={fileInputRef}
                            getChannelIcon={getChannelIcon}
                            getChannelLabel={getChannelLabel}
                            formatFileSize={formatFileSize}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Compact inline version
    return (
        <div className="p-4">
            <MessageComposerContent
                message={message}
                setMessage={setMessage}
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                availableChannels={availableChannels}
                attachments={attachments}
                removeAttachment={removeAttachment}
                handleFileSelect={handleFileSelect}
                handleSubmit={handleSubmit}
                handleKeyDown={handleKeyDown}
                isSending={isSending}
                isFocused={isFocused}
                setIsFocused={setIsFocused}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                getChannelIcon={getChannelIcon}
                getChannelLabel={getChannelLabel}
                formatFileSize={formatFileSize}
                compact={true}
            />
        </div>
    );
}

// Shared content component
interface MessageComposerContentProps {
    message: string;
    setMessage: (message: string) => void;
    selectedChannel: MessageChannel;
    setSelectedChannel: (channel: MessageChannel) => void;
    availableChannels: MessageChannel[];
    attachments: File[];
    removeAttachment: (index: number) => void;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    isSending: boolean;
    isFocused: boolean;
    setIsFocused: (focused: boolean) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    getChannelIcon: (channel: MessageChannel) => string;
    getChannelLabel: (channel: MessageChannel) => string;
    formatFileSize: (bytes: number) => string;
    compact?: boolean;
}

function MessageComposerContent({
    message,
    setMessage,
    selectedChannel,
    setSelectedChannel,
    availableChannels,
    attachments,
    removeAttachment,
    handleFileSelect,
    handleSubmit,
    handleKeyDown,
    isSending,
    isFocused,
    setIsFocused,
    textareaRef,
    fileInputRef,
    getChannelIcon,
    getChannelLabel,
    formatFileSize,
    compact = false
}: MessageComposerContentProps) {
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Channel Selection */}
            {availableChannels.length > 1 && (
                <div className="flex space-x-2">
                    {availableChannels.map((channel) => (
                        <button
                            key={channel}
                            type="button"
                            onClick={() => setSelectedChannel(channel)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center space-x-2 ${selectedChannel === channel
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                }`}
                        >
                            <span>{getChannelIcon(channel)}</span>
                            <span>{getChannelLabel(channel)}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
                <div className="space-y-2">
                    {attachments.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border"
                        >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <span>📎</span>
                                <span className="text-sm font-medium truncate">{file.name}</span>
                                <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Message Input */}
            <div className={`relative border rounded-lg transition-colors ${isFocused ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20' : 'border-gray-300'
                }`}>
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={`Type your ${getChannelLabel(selectedChannel).toLowerCase()} message...`}
                    className="w-full p-3 pr-20 resize-none border-none outline-none rounded-lg"
                    rows={compact ? 1 : 3}
                    disabled={isSending}
                />

                {/* Action Buttons */}
                <div className="absolute bottom-2 right-2 flex items-center space-x-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        title="Attach file"
                    >
                        <PaperClipIcon className="w-5 h-5" />
                    </button>

                    <button
                        type="submit"
                        disabled={(!message.trim() && attachments.length === 0) || isSending}
                        className={`p-1.5 rounded transition-colors ${(!message.trim() && attachments.length === 0) || isSending
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                        title="Send message"
                    >
                        {isSending ? (
                            <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                        ) : (
                            <PaperAirplaneIcon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            {!compact && (
                <div className="text-xs text-gray-500">
                    Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send,
                    <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs ml-1">Shift + Enter</kbd> for new line
                </div>
            )}
        </form>
    );
}