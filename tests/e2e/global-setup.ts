import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...')
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
  
  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...')
    
    let retries = 30
    while (retries > 0) {
      try {
        const response = await page.request.get(`${baseURL}/api/health`)
        if (response.status() === 200) {
          console.log('✅ Application is ready!')
          break
        }
      } catch (error) {
        // Application not ready yet
      }
      
      retries--
      if (retries === 0) {
        throw new Error('Application failed to start within timeout')
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Perform any additional setup here
    // For example: seed test data, create test users, etc.
    
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup