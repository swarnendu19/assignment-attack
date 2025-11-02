import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";

async function handler(req: NextRequest) {
    const user = (req as any).user;

    return NextResponse.json({
        message: "Authentication successful",
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    });
}

export const GET = withAuth(handler);