// Vercel serverless function: POST /api/chat (see server/chat/handler.ts).
import { handleChat } from '../server/chat/handler'

export function POST(request: Request): Promise<Response> {
  return handleChat(request, process.env)
}
