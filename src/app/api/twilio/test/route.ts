import { NextRequest, NextResponse } from 'next/server'
import { twilioService } from '@/services/twilioService'

/**
 * Test Twilio integration
 * GET /api/twilio/test
 */
export async function GET(request: NextRequest) {
  try {
    const tests = []

    // Test 1: Account Info
    try {
      const accountInfo = await twilioService.getAccountInfo()
      tests.push({
        name: 'Account Info',
        status: accountInfo ? 'PASS' : 'FAIL',
        data: accountInfo,
      })
    } catch (error) {
      tests.push({
        name: 'Account Info',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Test 2: Phone Number Info
    try {
      const phoneInfo = await twilioService.getPhoneNumberInfo()
      tests.push({
        name: 'Phone Number Info',
        status: phoneInfo ? 'PASS' : 'FAIL',
        data: phoneInfo,
      })
    } catch (error) {
      tests.push({
        name: 'Phone Number Info',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Test 3: Verified Numbers
    try {
      const verifiedNumbers = await twilioService.getVerifiedNumbers()
      tests.push({
        name: 'Verified Numbers',
        status: 'PASS',
        data: verifiedNumbers,
      })
    } catch (error) {
      tests.push({
        name: 'Verified Numbers',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Test 4: Webhook Signature Validation
    try {
      const testPayload = 'MessageSid=test&From=%2B1234567890&To=%2B0987654321&Body=Test'
      const testSignature = 'test-signature'
      const testUrl = 'https://example.com/webhook'
      
      // This will likely fail with invalid signature, but tests the method
      const isValid = twilioService.validateWebhookSignature(testPayload, testSignature, testUrl)
      tests.push({
        name: 'Webhook Validation',
        status: 'PASS', // Method executed without error
        data: { isValid, note: 'Expected to be false with test data' },
      })
    } catch (error) {
      tests.push({
        name: 'Webhook Validation',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    const passCount = tests.filter(t => t.status === 'PASS').length
    const failCount = tests.filter(t => t.status === 'FAIL').length

    return NextResponse.json({
      summary: {
        total: tests.length,
        passed: passCount,
        failed: failCount,
        status: failCount === 0 ? 'ALL_PASS' : 'SOME_FAIL',
      },
      tests,
      timestamp: new Date().toISOString(),
      environment: {
        hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
        hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      },
    })
  } catch (error) {
    console.error('Twilio test error:', error)
    return NextResponse.json(
      { 
        error: 'Test execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}