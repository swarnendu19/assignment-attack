'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import ScheduledMessagesList from '@/components/scheduling/ScheduledMessagesList'
import TemplateManager from '@/components/templates/TemplateManager'
import CreateTemplateModal from '@/components/templates/CreateTemplateModal'

export default function SchedulingPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'templates'>('scheduled')
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Message Scheduling & Templates</h1>
            <p className="text-gray-600 mt-2">
              Manage your scheduled messages and message templates
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scheduled'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Scheduled Messages
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Message Templates
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow">
            {activeTab === 'scheduled' ? (
              <div className="p-6">
                <ScheduledMessagesList />
              </div>
            ) : (
              <div className="p-6">
                <TemplateManager 
                  showCreateButton={true}
                />
              </div>
            )}
          </div>

          {/* Create Template Modal */}
          <CreateTemplateModal
            isOpen={showCreateTemplate}
            onClose={() => setShowCreateTemplate(false)}
            onSuccess={() => {
              setShowCreateTemplate(false)
              // Refresh templates if needed
            }}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}