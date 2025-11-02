import TwilioTrialInfo from '@/components/twilio/TwilioTrialInfo'

export default function IntegrationsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integration Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your communication channel integrations and settings.
        </p>
      </div>

      <div className="space-y-8">
        {/* Twilio Integration */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <svg className="h-6 w-6 mr-2 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Twilio SMS & WhatsApp
            </h2>
            <p className="text-sm text-gray-600">
              SMS and WhatsApp messaging through Twilio
            </p>
          </div>
          
          <TwilioTrialInfo />
        </div>

        {/* Placeholder for other integrations */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Other Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Email Integration */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <svg className="h-6 w-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className="font-medium text-gray-900">Email</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Connect email accounts for unified messaging
              </p>
              <button className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200">
                Coming Soon
              </button>
            </div>

            {/* Social Media Integration */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <svg className="h-6 w-6 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                <h3 className="font-medium text-gray-900">Social Media</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Twitter, Facebook, and other social platforms
              </p>
              <button className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200">
                Coming Soon
              </button>
            </div>

            {/* Business Tools Integration */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <svg className="h-6 w-6 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="font-medium text-gray-900">Business Tools</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                HubSpot, Slack, Zapier integrations
              </p>
              <button className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200">
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}