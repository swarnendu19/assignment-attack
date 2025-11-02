'use client'

import { useState, useEffect } from 'react'

interface TwilioAccountInfo {
  account: {
    friendlyName: string
    status: string
    type: string
    isTrial: boolean
  }
  phoneNumber: {
    phoneNumber: string
    friendlyName: string
    capabilities: {
      sms: boolean
      voice: boolean
      mms: boolean
    }
    smsEnabled: boolean
    voiceEnabled: boolean
    mmsEnabled: boolean
  } | null
  verifiedNumbers: Array<{
    phoneNumber: string
    friendlyName: string
  }>
  trialLimitations: {
    canOnlySendToVerifiedNumbers: boolean
    requiresPhoneNumberVerification: boolean
    limitedFeatures: string[]
    upgradeRequired: string
  } | null
}

export default function TwilioTrialInfo() {
  const [accountInfo, setAccountInfo] = useState<TwilioAccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccountInfo()
  }, [])

  const fetchAccountInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/twilio/account')
      
      if (!response.ok) {
        throw new Error('Failed to fetch account information')
      }

      const data = await response.json()
      setAccountInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading Twilio information
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchAccountInfo}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!accountInfo) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Account Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Twilio Account Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{accountInfo.account.friendlyName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Type</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                accountInfo.account.isTrial 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {accountInfo.account.type}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                accountInfo.account.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {accountInfo.account.status}
              </span>
            </dd>
          </div>
        </div>
      </div>

      {/* Phone Number Information */}
      {accountInfo.phoneNumber && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phone Number</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {accountInfo.phoneNumber.phoneNumber}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Friendly Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {accountInfo.phoneNumber.friendlyName || 'Not set'}
              </dd>
            </div>
          </div>

          <div className="mt-4">
            <dt className="text-sm font-medium text-gray-500 mb-2">Capabilities</dt>
            <div className="flex space-x-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                accountInfo.phoneNumber.smsEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                SMS {accountInfo.phoneNumber.smsEnabled ? '✓' : '✗'}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                accountInfo.phoneNumber.mmsEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                MMS {accountInfo.phoneNumber.mmsEnabled ? '✓' : '✗'}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                accountInfo.phoneNumber.voiceEnabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                Voice {accountInfo.phoneNumber.voiceEnabled ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trial Limitations */}
      {accountInfo.trialLimitations && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Trial Account Limitations
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  {accountInfo.trialLimitations.limitedFeatures.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
                <p className="mt-3 font-medium">
                  {accountInfo.trialLimitations.upgradeRequired}
                </p>
              </div>
              <div className="mt-4">
                <a
                  href="https://console.twilio.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200"
                >
                  Upgrade Account
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verified Numbers */}
      {accountInfo.verifiedNumbers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Verified Phone Numbers
            {accountInfo.account.isTrial && (
              <span className="ml-2 text-sm text-gray-500">
                (Trial accounts can only send to these numbers)
              </span>
            )}
          </h3>
          
          <div className="space-y-2">
            {accountInfo.verifiedNumbers.map((number, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <span className="text-sm font-medium text-gray-900 font-mono">
                    {number.phoneNumber}
                  </span>
                  {number.friendlyName && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({number.friendlyName})
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              </div>
            ))}
          </div>

          {accountInfo.account.isTrial && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> To add more verified numbers, visit your{' '}
                <a
                  href="https://console.twilio.com/develop/phone-numbers/manage/verified"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-800"
                >
                  Twilio Console
                </a>
                .
              </p>
            </div>
          )}
        </div>
      )}

      {/* Number Purchase Interface (for trial accounts) */}
      {accountInfo.account.isTrial && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Ready to upgrade?
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Upgrade your Twilio account to send messages to any phone number and unlock all features.
                </p>
              </div>
              <div className="mt-4 flex space-x-3">
                <a
                  href="https://console.twilio.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-100 px-3 py-2 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-200"
                >
                  Upgrade Account
                </a>
                <a
                  href="https://console.twilio.com/develop/phone-numbers/manage/search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white px-3 py-2 rounded-md text-sm font-medium text-blue-800 hover:bg-gray-50 border border-blue-200"
                >
                  Buy Phone Numbers
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}