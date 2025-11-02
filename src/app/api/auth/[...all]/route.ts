import { auth } from "@/lib/auth"

// Better Auth handler
export async function GET(request: Request) {
  return auth.handler(request)
}

export async function POST(request: Request) {
  return auth.handler(request)
}