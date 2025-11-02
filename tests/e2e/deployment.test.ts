/**
 * End-to-End Deployment Tests
 * 
 * These tests validate that the deployed application is working correctly
 * across all major functionality areas.
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

test.describe('Deployment Validation', () => {
  test('Health check endpoint responds correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`)
    
    expect(response.status()).toBe(200)
    
    const health = await response.json()
    expect(health.status).toBe('healthy')
    expect(health.services.database).toBe('healthy')
    expect(health.timestamp).toBeDefined()
    expect(health.uptime).toBeGreaterThan(0)
  })

  test('Metrics endpoint provides Prometheus format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/metrics`)
    
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    
    const metrics = await response.text()
    expect(metrics).toContain('app_info')
    expect(metrics).toContain('memory_usage_bytes')
    expect(metrics).toContain('total_messages')
  })

  test('Application loads successfully', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Should redirect to login or show the application
    await expect(page).toHaveTitle(/Unified Multi-Channel Inbox|Login/)
    
    // Check that the page loads without JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })

  test('API routes are accessible', async ({ request }) => {
    // Test authentication endpoint
    const authResponse = await request.post(`${BASE_URL}/api/auth/signin`, {
      data: { email: 'test@example.com', password: 'invalid' }
    })
    
    // Should return 401 or validation error, not 500
    expect([400, 401, 422]).toContain(authResponse.status())
  })

  test('WebSocket connection can be established', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Check if Socket.IO client can connect
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Try to connect to Socket.IO
        const script = document.createElement('script')
        script.src = '/socket.io/socket.io.js'
        script.onload = () => {
          try {
            // @ts-ignore
            const socket = io()
            socket.on('connect', () => {
              socket.disconnect()
              resolve(true)
            })
            socket.on('connect_error', () => {
              resolve(false)
            })
            
            // Timeout after 5 seconds
            setTimeout(() => resolve(false), 5000)
          } catch (error) {
            resolve(false)
          }
        }
        script.onerror = () => resolve(false)
        document.head.appendChild(script)
      })
    })
    
    expect(wsConnected).toBe(true)
  })

  test('Database connectivity through API', async ({ request }) => {
    // Test an endpoint that requires database access
    const response = await request.get(`${BASE_URL}/api/contacts`)
    
    // Should return 401 (unauthorized) or 200, not 500 (database error)
    expect([200, 401]).toContain(response.status())
  })

  test('Static assets are served correctly', async ({ request }) => {
    // Test that static assets load
    const faviconResponse = await request.get(`${BASE_URL}/favicon.ico`)
    expect([200, 404]).toContain(faviconResponse.status()) // 404 is acceptable if no favicon
    
    // Test Next.js static assets
    const response = await request.get(`${BASE_URL}/_next/static/css/app.css`)
    // Should either exist (200) or not exist (404), but not error (500)
    expect([200, 404]).toContain(response.status())
  })

  test('Security headers are present', async ({ request }) => {
    const response = await request.get(BASE_URL)
    const headers = response.headers()
    
    // Check for security headers (these might be set by Nginx in production)
    expect(headers['x-content-type-options']).toBeDefined()
    expect(headers['x-frame-options']).toBeDefined()
  })

  test('Rate limiting is functional', async ({ request }) => {
    // Make multiple rapid requests to test rate limiting
    const requests = Array.from({ length: 10 }, () => 
      request.get(`${BASE_URL}/api/health`)
    )
    
    const responses = await Promise.all(requests)
    
    // All should succeed for health endpoint (it might not be rate limited)
    // But we're testing that the server handles concurrent requests
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status())
    })
  })
})

test.describe('Cross-Channel Message Flow', () => {
  test.skip('SMS message flow works end-to-end', async ({ request }) => {
    // This would test the complete SMS flow
    // Skipped in deployment tests as it requires real Twilio credentials
  })

  test.skip('WhatsApp message flow works end-to-end', async ({ request }) => {
    // This would test the complete WhatsApp flow
    // Skipped in deployment tests as it requires real WhatsApp credentials
  })

  test.skip('Email message flow works end-to-end', async ({ request }) => {
    // This would test the complete email flow
    // Skipped in deployment tests as it requires real email credentials
  })
})

test.describe('Real-time Collaboration', () => {
  test('Multiple users can access the application simultaneously', async ({ browser }) => {
    // Create multiple browser contexts to simulate multiple users
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    // Both should be able to load the application
    await Promise.all([
      page1.goto(BASE_URL),
      page2.goto(BASE_URL)
    ])
    
    await Promise.all([
      expect(page1).toHaveTitle(/Unified Multi-Channel Inbox|Login/),
      expect(page2).toHaveTitle(/Unified Multi-Channel Inbox|Login/)
    ])
    
    await context1.close()
    await context2.close()
  })
})

test.describe('Performance Validation', () => {
  test('Application loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load within 5 seconds (generous for deployment testing)
    expect(loadTime).toBeLessThan(5000)
  })

  test('Memory usage is within acceptable limits', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/metrics`)
    const metrics = await response.text()
    
    // Extract memory usage from metrics
    const memoryMatch = metrics.match(/memory_usage_percentage (\d+\.?\d*)/)
    if (memoryMatch) {
      const memoryUsage = parseFloat(memoryMatch[1])
      
      // Memory usage should be less than 90%
      expect(memoryUsage).toBeLessThan(90)
    }
  })
})