import { backgroundJobService } from '@/services/backgroundJobService'

let isInitialized = false

export function initializeBackgroundJobs() {
  if (isInitialized) {
    return
  }

  // Only run background jobs in production or when explicitly enabled
  const shouldRunJobs = process.env.NODE_ENV === 'production' || 
                       process.env.ENABLE_BACKGROUND_JOBS === 'true'

  if (shouldRunJobs) {
    console.log('Initializing background job service...')
    backgroundJobService.start()
    isInitialized = true

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Shutting down background jobs...')
      backgroundJobService.stop()
    })

    process.on('SIGINT', () => {
      console.log('Shutting down background jobs...')
      backgroundJobService.stop()
      process.exit(0)
    })
  } else {
    console.log('Background jobs disabled in development mode')
  }
}

export { backgroundJobService }