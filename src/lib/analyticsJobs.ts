import { analyticsAggregationService } from '@/services/analyticsAggregationService'

/**
 * Initialize analytics background jobs
 * This should be called when the application starts
 */
export function initializeAnalyticsJobs(): void {
  console.log('Initializing analytics background jobs...')

  // Start the aggregation processor
  analyticsAggregationService.startProcessor(5) // Check every 5 minutes

  // Schedule initial aggregation jobs
  scheduleInitialJobs()

  // Set up recurring job scheduling
  setupRecurringSchedules()

  console.log('Analytics background jobs initialized')
}

/**
 * Schedule initial aggregation jobs for missing data
 */
async function scheduleInitialJobs(): Promise<void> {
  try {
    // Schedule hourly aggregation for the last few hours
    await analyticsAggregationService.scheduleHourlyAggregation()
    
    // Schedule daily aggregation for yesterday
    await analyticsAggregationService.scheduleDailyAggregation()
    
    // Schedule weekly aggregation for last week
    await analyticsAggregationService.scheduleWeeklyAggregation()
    
    // Schedule monthly aggregation for last month
    await analyticsAggregationService.scheduleMonthlyAggregation()
    
    console.log('Initial aggregation jobs scheduled')
  } catch (error) {
    console.error('Error scheduling initial aggregation jobs:', error)
  }
}

/**
 * Set up recurring schedules for aggregation jobs
 */
function setupRecurringSchedules(): void {
  // Schedule hourly aggregation every hour
  setInterval(async () => {
    try {
      await analyticsAggregationService.scheduleHourlyAggregation()
    } catch (error) {
      console.error('Error scheduling hourly aggregation:', error)
    }
  }, 60 * 60 * 1000) // Every hour

  // Schedule daily aggregation every day at 1 AM
  const scheduleDaily = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(1, 0, 0, 0) // 1 AM

    const msUntilTomorrow = tomorrow.getTime() - now.getTime()

    setTimeout(async () => {
      try {
        await analyticsAggregationService.scheduleDailyAggregation()
      } catch (error) {
        console.error('Error scheduling daily aggregation:', error)
      }

      // Schedule the next daily aggregation
      setInterval(async () => {
        try {
          await analyticsAggregationService.scheduleDailyAggregation()
        } catch (error) {
          console.error('Error scheduling daily aggregation:', error)
        }
      }, 24 * 60 * 60 * 1000) // Every 24 hours
    }, msUntilTomorrow)
  }

  scheduleDaily()

  // Schedule weekly aggregation every Monday at 2 AM
  const scheduleWeekly = () => {
    const now = new Date()
    const nextMonday = new Date(now)
    const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7
    nextMonday.setDate(now.getDate() + daysUntilMonday)
    nextMonday.setHours(2, 0, 0, 0) // 2 AM

    const msUntilNextMonday = nextMonday.getTime() - now.getTime()

    setTimeout(async () => {
      try {
        await analyticsAggregationService.scheduleWeeklyAggregation()
      } catch (error) {
        console.error('Error scheduling weekly aggregation:', error)
      }

      // Schedule the next weekly aggregation
      setInterval(async () => {
        try {
          await analyticsAggregationService.scheduleWeeklyAggregation()
        } catch (error) {
          console.error('Error scheduling weekly aggregation:', error)
        }
      }, 7 * 24 * 60 * 60 * 1000) // Every 7 days
    }, msUntilNextMonday)
  }

  scheduleWeekly()

  // Schedule monthly aggregation on the 1st of each month at 3 AM
  const scheduleMonthly = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 3, 0, 0, 0) // 3 AM on 1st

    const msUntilNextMonth = nextMonth.getTime() - now.getTime()

    setTimeout(async () => {
      try {
        await analyticsAggregationService.scheduleMonthlyAggregation()
      } catch (error) {
        console.error('Error scheduling monthly aggregation:', error)
      }

      // Schedule the next monthly aggregation
      const scheduleNext = () => {
        const currentDate = new Date()
        const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1, 3, 0, 0, 0)
        const msUntilNext = nextMonthDate.getTime() - currentDate.getTime()

        setTimeout(async () => {
          try {
            await analyticsAggregationService.scheduleMonthlyAggregation()
          } catch (error) {
            console.error('Error scheduling monthly aggregation:', error)
          }
          scheduleNext() // Schedule the next one
        }, msUntilNext)
      }

      scheduleNext()
    }, msUntilNextMonth)
  }

  scheduleMonthly()

  // Schedule data cleanup every day at 4 AM
  const scheduleCleanup = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(4, 0, 0, 0) // 4 AM

    const msUntilTomorrow = tomorrow.getTime() - now.getTime()

    setTimeout(async () => {
      try {
        await analyticsAggregationService.cleanupOldData()
      } catch (error) {
        console.error('Error during data cleanup:', error)
      }

      // Schedule daily cleanup
      setInterval(async () => {
        try {
          await analyticsAggregationService.cleanupOldData()
        } catch (error) {
          console.error('Error during data cleanup:', error)
        }
      }, 24 * 60 * 60 * 1000) // Every 24 hours
    }, msUntilTomorrow)
  }

  scheduleCleanup()

  console.log('Recurring aggregation schedules set up')
}

/**
 * Shutdown analytics jobs
 * This should be called when the application is shutting down
 */
export function shutdownAnalyticsJobs(): void {
  console.log('Shutting down analytics background jobs...')
  
  analyticsAggregationService.stopProcessor()
  
  console.log('Analytics background jobs shut down')
}

/**
 * Get analytics jobs status
 */
export function getAnalyticsJobsStatus(): {
  processorRunning: boolean
  connectedClients: number
} {
  return {
    processorRunning: true, // Would check actual processor status
    connectedClients: 0 // Would get from WebSocket service
  }
}