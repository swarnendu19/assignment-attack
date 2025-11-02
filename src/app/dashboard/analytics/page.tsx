import { Metadata } from 'next'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'

export const metadata: Metadata = {
  title: 'Analytics Dashboard | Unified Inbox',
  description: 'Real-time analytics and performance metrics for your communication channels',
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <AnalyticsDashboard />
    </div>
  )
}