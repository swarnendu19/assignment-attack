'use client'

import { useState, useEffect } from 'react'

interface TwilioTrialWarningProps {
  recipientNumber?: string
  onVerificationNeeded?: (number: string) => void
}

interface TrialInfo {
  isTrial: boolean
  verifiedNumbers: string[]
  canSendTo: (number: string) => boolean
}

export default function TwilioTrialWarning({ 
  recipientNumber, 
  onVerificationNeeded 
}: TwilioTrialWarningProps) {
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrialInfo()
  }, [])

  const fetchTrialInfo = async () => {
    try {
      const response = await fetch('/api/twilio/account')
      if (response.ok) {
        const data = await response.json()
        setTrialInfo({
          isTrial: data.account.isTrial,
          verifiedNumbers: data.verifiedNumbers.map((n: any) => n.phoneNumber),
          canSendTo: (number: string) => {
            if (!data.account.isTrial) return true
            return data.verifiedNumbers.some((n: any) => n.phoneNumber === number)
          }
        })
      }
    } catch (error) {
      console.error('Error fetching trial info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !trialInfo || !trialInfo.isTrial) {
    return null
  }

  const canSendToRecipient = !recipientNumber || trialInfo.canSendTo(recipientNumber)

  if (canSendToRecipient) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Trial Account:</strong> You can send messages to this verified number.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Trial Account Limitation
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              You can only send messages to verified phone numbers with a trial account.
              {recipientNumber && (
                <span className="block mt-1">
                  <strong>{recipientNumber}</strong> is not verified.
                </span>
              )}
            </p>
          </div>
          <div className="mt-4 flex space-x-3">
            <a
              href="https://console.twilio.com/develop/phone-numbers/manage/verified"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200"
            >
              Verify Phone Number
            </a>
            <a
              href="https://console.twilio.com/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-gray-50 border border-yellow-200"
            >
              Upgrade Account
            </a>
          </div>
        </div>
      </div>

      {trialInfo.verifiedNumbers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            Verified Numbers (you can send to these):
          </h4>
          <div className="space-y-1">
            {trialInfo.verifiedNumbers.map((number, index) => (
              <div key={index} className="text-sm text-yellow-700 font-mono">
                {number}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for checking if a number can receive messages
export function useTwilioTrialCheck() {
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrialInfo = async () => {
      try {
        const response = await fetch('/api/twilio/account')
        if (response.ok) {
          const data = await response.json()
          setTrialInfo({
            isTrial: data.account.isTrial,
            verifiedNumbers: data.verifiedNumbers.map((n: any) => n.phoneNumber),
            canSendTo: (number: string) => {
              if (!data.account.isTrial) return true
              return data.verifiedNumbers.some((n: any) => n.phoneNumber === number)
            }
          })
        }
      } catch (error) {
        console.error('Error fetching trial info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrialInfo()
  }, [])

  return {
    trialInfo,
    loading,
    canSendTo: (number: string) => trialInfo?.canSendTo(number) ?? true,
    isTrial: trialInfo?.isTrial ?? false,
  }
}