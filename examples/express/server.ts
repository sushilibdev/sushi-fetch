import express from "express";
// Import type secara spesifik biar TS seneng, tapi nggak ngerusak runtime ESM
import type { Request, Response } from "express"; 

import { sushiFetch, sushiCache, addSushiMiddleware } from "../../dist/index.js";

// 1. Global Middleware: Only runs when an ACTUAL network request happens.
// If it's a cache hit, this won't log, proving how fast the cache is!
addSushiMiddleware({
  onRequest: ({ url }) => console.log(`[Network] 🌐 Fetching fresh data from: ${url}`),
  onResponse: (res) => console.log(`[Network] ✅ Successfully fetched: HTTP ${res.status}`)
})

const app = express()
const PORT = 3000

// Middleware to parse JSON bodies
app.use(express.json())

/**
 * GET /users
 * Demonstrates Cache, Deduplication, and Forced Revalidation.
 * Try hitting this endpoint multiple times quickly!
 */
app.get("/users", async (req: Request, res: Response) => {
  try {
    // If user passes ?force=true, we bypass the cache
    const shouldForceFetch = req.query.force === "true"
    
    const startTime = Date.now()

    const users = await sushiFetch("https://jsonplaceholder.typicode.com/users", {
      ttl: 60000,               // Cache for 60 seconds
      force: shouldForceFetch,  // Bypass cache if requested
      retries: 2,               // Fallback mechanism if the external API is flaky
      cacheTags: ["api-users"], // Tag it for targeted invalidation later
    })

    const duration = Date.now() - startTime

    res.status(200).json({
      success: true,
      source: duration < 10 ? "Memory Cache ⚡" : "External Network 🌐",
      durationMs: duration,
      data: users,
    })
  } catch (error: any) {
    console.error("[Error] Failed to fetch users:", error.message)
    res.status(500).json({ success: false, message: "Internal Server Error" })
  }
})

/**
 * POST /cache/clear
 * Demonstrates how to invalidate specific tags from the cache dynamically.
 */
app.post("/cache/clear", (req: Request, res: Response) => {
  const { tag } = req.body

  if (!tag) {
    return res.status(400).json({ success: false, message: "Please provide a 'tag' in the body" })
  }

  // Instantly wipe out all cache entries associated with this tag
  sushiCache.invalidateTag(tag)
  console.log(`[Cache] 🗑️ Wiped cache for tag: ${tag}`)

  res.status(200).json({
    success: true,
    message: `Cache tag '${tag}' invalidated successfully. Next request will hit the network.`
  })
})

app.listen(PORT, () => {
  console.log(`\n🍣 Sushi Fetch Express Example Running!`)
  console.log(`🚀 Server listening on http://localhost:${PORT}`)
  console.log(`\nTry these endpoints:`)
  console.log(`1. GET  http://localhost:${PORT}/users`)
  console.log(`2. GET  http://localhost:${PORT}/users?force=true`)
  console.log(`3. POST http://localhost:${PORT}/cache/clear (Body: { "tag": "api-users" })`)
  console.log(`--------------------------------------------------\n`)
})