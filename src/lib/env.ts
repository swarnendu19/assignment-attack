/**
 * Environment variable validation and type-safe access
 */

const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
] as const;

const optionalEnvVars = [
    'REDIS_URL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'RESEND_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type OptionalEnvVar = (typeof optionalEnvVars)[number];
type EnvVar = RequiredEnvVar | OptionalEnvVar;

class EnvironmentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvironmentError';
    }
}

/**
 * Validates that all required environment variables are present
 */
export function validateEnvironment(): void {
    const missing: string[] = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    if (missing.length > 0) {
        throw new EnvironmentError(
            `Missing required environment variables: ${missing.join(', ')}`
        );
    }
}

/**
 * Type-safe environment variable access
 */
export function getEnvVar(name: RequiredEnvVar): string;
export function getEnvVar(name: OptionalEnvVar): string | undefined;
export function getEnvVar(name: EnvVar): string | undefined {
    return process.env[name];
}

/**
 * Get environment variable with default value
 */
export function getEnvVarWithDefault(
    name: string,
    defaultValue: string
): string {
    return process.env[name] ?? defaultValue;
}

/**
 * Check if we're in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if we're in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if we're in test mode
 */
export const isTest = process.env.NODE_ENV === 'test';

// Validate environment on module load (except in test)
if (!isTest) {
    validateEnvironment();
}