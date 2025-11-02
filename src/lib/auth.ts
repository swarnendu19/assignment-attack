import { betterAuth } from "better-auth";

export const auth = betterAuth({
    database: {
        provider: "postgresql",
        url: process.env.DATABASE_URL!,
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Set to true in production
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "EDITOR",
                input: false, // Don't allow setting role during registration
            },
        },
    },
    trustedOrigins: [process.env.NEXTAUTH_URL || "http://localhost:3000"],
    secret: process.env.NEXTAUTH_SECRET!,
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

// Helper functions for role-based access control
export function hasRole(user: User | null, requiredRole: "VIEWER" | "EDITOR" | "ADMIN"): boolean {
    if (!user) return false;

    const roleHierarchy = { VIEWER: 0, EDITOR: 1, ADMIN: 2 };
    const userRole = (user.role as keyof typeof roleHierarchy) || "VIEWER";

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function requireRole(user: User | null, requiredRole: "VIEWER" | "EDITOR" | "ADMIN"): void {
    if (!hasRole(user, requiredRole)) {
        throw new Error(`Access denied. Required role: ${requiredRole}`);
    }
}