import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole, requireRole, type User } from "./auth";

export interface AuthenticatedRequest extends NextRequest {
    user: User;
}

/**
 * Middleware to authenticate API requests
 */
export async function withAuth(
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
    options?: {
        requiredRole?: "VIEWER" | "EDITOR" | "ADMIN";
    }
) {
    return async (req: NextRequest) => {
        try {
            // Get session from Better Auth
            const session = await auth.api.getSession({
                headers: req.headers,
            });

            if (!session) {
                return NextResponse.json(
                    { error: "Authentication required" },
                    { status: 401 }
                );
            }

            // Check role if required
            if (options?.requiredRole) {
                if (!hasRole(session.user, options.requiredRole)) {
                    return NextResponse.json(
                        { error: `Access denied. Required role: ${options.requiredRole}` },
                        { status: 403 }
                    );
                }
            }

            // Add user to request
            const authenticatedReq = req as AuthenticatedRequest;
            authenticatedReq.user = session.user;

            return await handler(authenticatedReq);
        } catch (error) {
            console.error("Auth middleware error:", error);
            return NextResponse.json(
                { error: "Authentication failed" },
                { status: 401 }
            );
        }
    };
}

/**
 * Higher-order function to create role-based middleware
 */
export function withRole(requiredRole: "VIEWER" | "EDITOR" | "ADMIN") {
    return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) =>
        withAuth(handler, { requiredRole });
}

/**
 * Middleware for viewer role and above
 */
export const withViewer = withRole("VIEWER");

/**
 * Middleware for editor role and above
 */
export const withEditor = withRole("EDITOR");

/**
 * Middleware for admin role only
 */
export const withAdmin = withRole("ADMIN");

/**
 * Extract user from request headers (for use in API routes)
 */
export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
    try {
        const session = await auth.api.getSession({
            headers: req.headers,
        });
        return session?.user || null;
    } catch (error) {
        console.error("Failed to get user from request:", error);
        return null;
    }
}