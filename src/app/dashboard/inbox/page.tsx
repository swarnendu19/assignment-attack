'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { UnifiedInbox } from '@/components/inbox/UnifiedInbox'

export default function InboxPage() {
  return (
    <ProtectedRoute>
      <div className="h-screen flex flex-col">
        <UnifiedInbox />
      </div>
    </ProtectedRoute>
  )
}