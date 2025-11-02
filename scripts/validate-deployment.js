#!/usr/bin/env node

/**
 * Deployment Configuration Validation Script
 * 
 * This script validates that all deployment configuration files are properly set up
 * and that the deployment process can proceed without issues.
 */

import fs from 'fs'
import path from 'path'

console.log('🔍 Validating deployment configuration...\n')

const requiredFiles = [
  'Dockerfile',
  'docker-compose.prod.yml',
  'nginx.conf',
  '.env.production.example',
  'scripts/deploy.sh',
  'scripts/rollback.sh',
  '.github/workflows/ci-cd.yml',
  'monitoring/docker-compose.monitoring.yml',
  'monitoring/prometheus.yml',
  'monitoring/alertmanager.yml',
  'monitoring/alert_rules.yml'
]

const requiredDirectories = [
  'scripts',
  'monitoring',
  '.github/workflows'
]

let allValid = true

// Check required directories
console.log('📁 Checking required directories...')
requiredDirectories.forEach(dir => {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    console.log(`✅ ${dir}`)
  } else {
    console.log(`❌ ${dir} - Missing or not a directory`)
    allValid = false
  }
})

console.log('\n📄 Checking required files...')
// Check required files
requiredFiles.forEach(file => {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    console.log(`✅ ${file}`)
  } else {
    console.log(`❌ ${file} - Missing`)
    allValid = false
  }
})

// Check package.json scripts
console.log('\n🔧 Checking package.json scripts...')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const requiredScripts = [
  'build',
  'start',
  'db:migrate:deploy',
  'docker:build',
  'docker:run',
  'deploy',
  'rollback',
  'monitoring:up',
  'test:e2e'
]

requiredScripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`✅ npm run ${script}`)
  } else {
    console.log(`❌ npm run ${script} - Missing`)
    allValid = false
  }
})

// Check Next.js configuration
console.log('\n⚙️ Checking Next.js configuration...')
try {
  const nextConfig = fs.readFileSync('next.config.js', 'utf8')
  
  const requiredConfigs = [
    'output: \'standalone\'',
    'serverExternalPackages',
    'reactStrictMode: true'
  ]
  
  requiredConfigs.forEach(config => {
    if (nextConfig.includes(config.split(':')[0])) {
      console.log(`✅ ${config}`)
    } else {
      console.log(`❌ ${config} - Missing or incorrect`)
      allValid = false
    }
  })
} catch (error) {
  console.log('❌ next.config.js - Error reading file')
  allValid = false
}

// Check API endpoints
console.log('\n🌐 Checking API endpoints...')
const apiEndpoints = [
  'src/app/api/health/route.ts',
  'src/app/api/metrics/route.ts'
]

apiEndpoints.forEach(endpoint => {
  if (fs.existsSync(endpoint)) {
    console.log(`✅ ${endpoint}`)
  } else {
    console.log(`❌ ${endpoint} - Missing`)
    allValid = false
  }
})

// Check Docker configuration
console.log('\n🐳 Checking Docker configuration...')
try {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8')
  const dockerCompose = fs.readFileSync('docker-compose.prod.yml', 'utf8')
  
  const dockerChecks = [
    { file: 'Dockerfile', content: dockerfile, checks: ['FROM node:', 'COPY --from=builder', 'HEALTHCHECK'] },
    { file: 'docker-compose.prod.yml', content: dockerCompose, checks: ['postgres:', 'redis:', 'app:', 'nginx:'] }
  ]
  
  dockerChecks.forEach(({ file, content, checks }) => {
    checks.forEach(check => {
      if (content.includes(check)) {
        console.log(`✅ ${file} contains ${check}`)
      } else {
        console.log(`❌ ${file} missing ${check}`)
        allValid = false
      }
    })
  })
} catch (error) {
  console.log('❌ Error reading Docker configuration files')
  allValid = false
}

// Check monitoring configuration
console.log('\n📊 Checking monitoring configuration...')
try {
  const prometheus = fs.readFileSync('monitoring/prometheus.yml', 'utf8')
  const alertmanager = fs.readFileSync('monitoring/alertmanager.yml', 'utf8')
  
  if (prometheus.includes('scrape_configs:') && prometheus.includes('unified-inbox-app')) {
    console.log('✅ Prometheus configuration')
  } else {
    console.log('❌ Prometheus configuration - Missing required sections')
    allValid = false
  }
  
  if (alertmanager.includes('receivers:') && alertmanager.includes('route:')) {
    console.log('✅ Alertmanager configuration')
  } else {
    console.log('❌ Alertmanager configuration - Missing required sections')
    allValid = false
  }
} catch (error) {
  console.log('❌ Error reading monitoring configuration files')
  allValid = false
}

// Check script permissions (Unix-like systems)
if (process.platform !== 'win32') {
  console.log('\n🔐 Checking script permissions...')
  const scripts = ['scripts/deploy.sh', 'scripts/rollback.sh']
  
  scripts.forEach(script => {
    try {
      const stats = fs.statSync(script)
      const mode = stats.mode & parseInt('777', 8)
      if (mode & parseInt('100', 8)) { // Check if executable by owner
        console.log(`✅ ${script} is executable`)
      } else {
        console.log(`❌ ${script} is not executable`)
        allValid = false
      }
    } catch (error) {
      console.log(`❌ ${script} - Error checking permissions`)
      allValid = false
    }
  })
}

// Final validation result
console.log('\n' + '='.repeat(50))
if (allValid) {
  console.log('🎉 All deployment configuration checks passed!')
  console.log('\n✅ Your deployment configuration is ready.')
  console.log('\nNext steps:')
  console.log('1. Copy .env.production.example to .env.production and configure')
  console.log('2. Set up SSL certificates in the ssl/ directory')
  console.log('3. Run: npm run deploy')
  process.exit(0)
} else {
  console.log('❌ Some deployment configuration checks failed.')
  console.log('\n🔧 Please fix the issues above before deploying.')
  process.exit(1)
}