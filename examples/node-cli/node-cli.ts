import { sushiFetch, sushiCache } from "sushi-fetch"

// Simple ANSI color codes for beautiful terminal output (no external dependencies needed!)
const colors = {
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
  dim: "\x1b[2m"
}

async function runCliExample() {
  console.log(`${colors.cyan}==========================================${colors.reset}`)
  console.log(`${colors.cyan}  🍣 Sushi Fetch - Node.js CLI Example    ${colors.reset}`)
  console.log(`${colors.cyan}==========================================${colors.reset}\n`)

  const apiUrl = "https://jsonplaceholder.typicode.com/posts"

  try {
    // ==========================================
    // FETCH 1: Network Request with Transform
    // ==========================================
    console.log(`${colors.yellow}➤ [1/3] Fetching latest posts from network...${colors.reset}`)
    
    const startTime1 = Date.now()
    const rawPosts = await sushiFetch<any[]>(apiUrl, {
      retries: 2,
      timeout: 5000,
      cacheTags: ["cli-posts"],
      // Let's use the transform feature to clean up the data before returning and caching it
      transform: (data: any[]) => {
        // Only take the first 3 posts and format their keys for console.table
        return data.slice(0, 3).map((post) => ({
          "Post ID": post.id,
          "Author ID": post.userId,
          "Title": post.title.length > 40 ? post.title.slice(0, 37) + "..." : post.title
        }))
      }
    })
    const duration1 = Date.now() - startTime1

    console.log(`${colors.green}✔ Success! Network fetch took ${duration1}ms.${colors.reset}\n`)
    console.table(rawPosts) // This prints a beautiful table in the terminal!


    // ==========================================
    // FETCH 2: Instant Cache Hit
    // ==========================================
    console.log(`\n${colors.yellow}➤ [2/3] Fetching the exact same URL again...${colors.reset}`)
    
    const startTime2 = Date.now()
    // Notice we don't need to pass the transform function again, 
    // it automatically returns the transformed data from the cache!
    const cachedPosts = await sushiFetch<any[]>(apiUrl)
    const duration2 = Date.now() - startTime2

    console.log(`${colors.magenta}⚡ BOOM! Cache hit took only ${duration2}ms!${colors.reset}`)
    console.log(`${colors.dim}(Served entirely from local memory, bypassing the network)${colors.reset}\n`)


    // ==========================================
    // CACHE METRICS
    // ==========================================
    console.log(`${colors.yellow}➤ [3/3] Inspecting SushiCache Memory...${colors.reset}`)
    console.log(`${colors.dim}Current items in cache: ${sushiCache.has(apiUrl) ? 1 : 0}${colors.reset}\n`)

    console.log(`${colors.green}🎉 CLI Example completed successfully!${colors.reset}\n`)

  } catch (error: any) {
    console.error(`\n${colors.magenta}❌ An error occurred during fetch:${colors.reset}`)
    console.error(error.message)
    process.exit(1)
  }
}

runCliExample()