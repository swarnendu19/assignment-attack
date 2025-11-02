'use client';

import { useState } from 'react';
import { UnifiedContact } from '@/lib/types/contact';
import { XMarkIcon, PencilIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

interface ContactProfileProps {
    contact: UnifiedContact;
    onClose: () => void;
}

export function ContactProfile({ contact, onClose }: ContactProfileProps) {
    const [isEditing, setIsEditing] = useState(false);

    const getContactInitials = () => {
        if (contact.name) return contact.name.charAt(0).toUpperCase();
        if (contact.email) return contact.email.charAt(0).toUpperCase();
        if (contact.phone) return contact.phone.charAt(1) || '?';
        return '?';
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString([], {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Contact Profile</h2>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit contact"
                    >
                        <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Contact Info */}
            <div className="p-4">
                {/* Avatar and Name */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                        {getContactInitials()}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                        {contact.name || 'Unknown Contact'}
                    </h3>
                    {contact.metadata?.company && (
                        <p className="text-gray-600">{contact.metadata.company}</p>
                    )}
                    {contact.metadata?.jobTitle && (
                        <p className="text-sm text-gray-500">{contact.metadata.jobTitle}</p>
                    )}
                </div>

                {/* Contact Details */}
                <div className="space-y-4">
                    {/* Phone */}
                    {contact.phone && (
                        <div className="flex items-center space-x-3">
                            <PhoneIcon className="w-5 h-5 text-gray-400" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                                <p className="text-xs text-gray-500">Phone</p>
                            </div>
                            <button className="text-blue-600 hover:text-blue-700 text-sm">
                                Call
                            </button>
                        </div>
                    )}

                    {/* Email */}
                    {contact.email && (
                        <div className="flex items-center space-x-3">
                            <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                                <p className="text-xs text-gray-500">Email</p>
                            </div>
                            <button className="text-blue-600 hover:text-blue-700 text-sm">
                                Email
                            </button>
                        </div>
                    )}

                    {/* Social Handles */}
                    {contact.socialHandles && Object.keys(contact.socialHandles).length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Social Media</h4>
                            <div className="space-y-2">
                                {Object.entries(contact.socialHandles).map(([platform, handle]) => (
                                    handle && (
                                        <div key={platform} className="flex items-center space-x-3">
                                            <span className="w-5 h-5 text-center">
                                                {platform === 'twitter' && '🐦'}
                                                {platform === 'facebook' && '📘'}
                                                {platform === 'instagram' && '📷'}
                                                {platform === 'linkedin' && '💼'}
                                                {platform === 'whatsapp' && '📱'}
                                                {!['twitter', 'facebook', 'instagram', 'linkedin', 'whatsapp'].includes(platform) && '🔗'}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{handle}</p>
                                                <p className="text-xs text-gray-500 capitalize">{platform}</p>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tags */}
                {contact.tags && contact.tags.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                            {contact.tags.map((tag, index) => (
                                <span
                                    key={index}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Statistics */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Statistics</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">{contact.messageCount || 0}</p>
                            <p className="text-xs text-gray-500">Messages</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">
                                {contact.lastMessageAt ? formatDate(contact.lastMessageAt) : 'Never'}
                            </p>
                            <p className="text-xs text-gray-500">Last Message</p>
                        </div>
                    </div>
                </div>

                {/* Metadata */}
                {contact.metadata && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Info</h4>
                        <div className="space-y-2 text-sm">
                            {contact.metadata.source && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Source:</span>
                                    <span className="text-gray-900 capitalize">{contact.metadata.source.replace('_', ' ')}</span>
                                </div>
                            )}
                            {contact.metadata.timezone && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Timezone:</span>
                                    <span className="text-gray-900">{contact.metadata.timezone}</span>
                                </div>
                            )}
                            {contact.metadata.language && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Language:</span>
                                    <span className="text-gray-900">{contact.metadata.language}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Created:</span>
                                <span className="text-gray-900">{formatDate(contact.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Updated:</span>
                                <span className="text-gray-900">{formatDate(contact.updatedAt)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Fields */}
                {contact.metadata?.customFields && Object.keys(contact.metadata.customFields).length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Custom Fields</h4>
                        <div className="space-y-2 text-sm">
                            {Object.entries(contact.metadata.customFields).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <span className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                                    <span className="text-gray-900">{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}