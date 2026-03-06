import { sushiFetch, sushiCache, addSushiMiddleware } from "sushi-fetch"

// 1. Attach Global Middleware to log all fetch activities
addSushiMiddleware({
  onRequest: ({ url }) => console.log(`[Middleware] 🚀 Preparing to fetch: ${url}`),
  onResponse: (res) => console.log(`[Middleware] ✅ Response received: HTTP ${res.status}`)
})

async function runBunExample() {
  console.log("🍣 Starting Bun + Sushi Fetch Example...\n")

  const apiUrl = "https://jsonplaceholder.typicode.com/todos"

  // ==========================================
  // FETCH 1: Direct Network Request
  // ==========================================
  console.log("--- First Fetch (Network) ---")
  console.time("Fetch 1 Duration")
  
  const data1 = await sushiFetch<any[]>(apiUrl, {
    retries: 3,                 // Retry up to 3 times if the server fails
    retryDelay: 1000,           // Wait 1 second between retries
    cacheTags: ["todos-api"],   // Tag the cache for easy invalidation later
    ttl: 10000                  // Keep the data in memory for 10 seconds
  })
  
  console.timeEnd("Fetch 1 Duration")
  console.log(`📦 Data retrieved: ${data1.length} items\n`)

  // ==========================================
  // FETCH 2: Instant Cache Hit
  // ==========================================
  console.log("--- Second Fetch (Cache Hit) ---")
  console.time("Fetch 2 Duration")
  
  // The second request doesn't need the options again; it matches by URL/Key
  const data2 = await sushiFetch<any[]>(apiUrl)
  
  console.timeEnd("Fetch 2 Duration")
  console.log("⚡ Incredibly fast! This was served directly from Bun's memory.\n")

  // ==========================================
  // CACHE INVALIDATION & FETCH 3
  // ==========================================
  console.log("--- Cache Invalidation ---")
  console.log("🗑️ Invalidating cache with tag 'todos-api'...")
  
  // Clears the tagged cache instantly without affecting other cached items
  sushiCache.invalidateTag("todos-api") 

  console.log("\n--- Third Fetch (After Cache Cleared) ---")
  console.time("Fetch 3 Duration")
  
  const data3 = await sushiFetch<any[]>(apiUrl)
  
  console.timeEnd("Fetch 3 Duration")
  console.log("🌐 Since the cache was cleared, this request fired back to the server.\n")

  console.log("🎉 Bun example finished perfectly!")
}

runBunExample().catch(console.error)