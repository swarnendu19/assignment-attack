import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Adjust path as needed

const startTime = Date.now();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const healthStatus: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      services: {
        database: "unhealthy",
        redis: "not_configured",
      },
      uptime: Date.now() - startTime,
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage:
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      },
    };

    // Check DB
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthStatus.services.database = "healthy";
    } catch (err) {
      console.error("Database health check failed:", err);
      healthStatus.services.database = "unhealthy";
      healthStatus.status = "unhealthy";
    }

    // Check Redis
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });

        await redis.ping();
        healthStatus.services.redis = "healthy";
      } catch (err) {
        console.error("Upstash Redis check failed:", err);
        healthStatus.services.redis = "unhealthy";
        healthStatus.status = "unhealthy";
      }
    } else if (process.env.REDIS_URL) {
      try {
        const { createClient } = await import("redis");
        const redis = createClient({ url: process.env.REDIS_URL });
        await redis.connect();
        await redis.ping();
        await redis.disconnect();
        healthStatus.services.redis = "healthy";
      } catch (err) {
        console.error("Redis check failed:", err);
        healthStatus.services.redis = "unhealthy";
        healthStatus.status = "unhealthy";
      }
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 503;
    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (err) {
    console.error("Health check error:", err);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Internal server error during health check",
      },
      { status: 503 }
    );
  }
}
