import { Metadata } from 'next'
import BusinessToolsManager from '@/components/business-tools/BusinessToolsManager'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Business Tools - Unified Inbox',
  description: 'Manage integrations with HubSpot, Slack, Zapier and other business tools',
}

export default async function BusinessToolsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  // Get user's team ID (you'll need to implement this based on your auth system)
  const teamId = session.user.teamId || 'default'

  return (
    <div className="container mx-auto px-4 py-8">
      <BusinessToolsManager teamId={teamId} />
    </div>
  )
}