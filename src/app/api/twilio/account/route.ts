import { NextRequest, NextResponse } from 'next/server'
import { twilioService } from '@/services/twilioService'

/**
 * Get Twilio account information
 * GET /api/twilio/account
 */
export async function GET(request: NextRequest) {
  try {
    // Get account information
    const accountInfo = await twilioService.getAccountInfo()
    
    if (!accountInfo) {
      return NextResponse.json(
        { error: 'Failed to fetch account information' },
        { status: 500 }
      )
    }

    // Get phone number information
    const phoneNumberInfo = await twilioService.getPhoneNumberInfo()
    
    // Get verified numbers (for trial accounts)
    const verifiedNumbers = await twilioService.getVerifiedNumbers()

    // Determine if this is a trial account
    const isTrialAccount = accountInfo.type === 'Trial'

    const response = {
      account: {
        friendlyName: accountInfo.friendlyName,
        status: accountInfo.status,
        type: accountInfo.type,
        isTrial: isTrialAccount,
      },
      phoneNumber: phoneNumberInfo ? {
        phoneNumber: phoneNumberInfo.phoneNumber,
        friendlyName: phoneNumberInfo.friendlyName,
        capabilities: phoneNumberInfo.capabilities,
        smsEnabled: phoneNumberInfo.capabilities?.sms || false,
        voiceEnabled: phoneNumberInfo.capabilities?.voice || false,
        mmsEnabled: phoneNumberInfo.capabilities?.mms || false,
      } : null,
      verifiedNumbers: verifiedNumbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
      })),
      trialLimitations: isTrialAccount ? {
        canOnlySendToVerifiedNumbers: true,
        requiresPhoneNumberVerification: true,
        limitedFeatures: [
          'Can only send messages to verified phone numbers',
          'Limited to Twilio phone numbers for outbound messages',
          'Some advanced features may be restricted',
        ],
        upgradeRequired: 'To send messages to any phone number, upgrade your Twilio account',
      } : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching Twilio account info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account information' },
      { status: 500 }
    )
  }
}