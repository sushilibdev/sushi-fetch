import { sushiFetch, sushiCache } from "../../src/index"

async function basicExample() {
  console.log("\n📌 BASIC FETCH")

  const users = await sushiFetch(
    "https://jsonplaceholder.typicode.com/users"
  )

  console.log("✅ Users:", users.length)
}

async function cacheExample() {
  console.log("\n📦 CACHE EXAMPLE")

  // first request (from network)
  await sushiFetch("https://jsonplaceholder.typicode.com/posts")

  // second request (should hit cache)
  await sushiFetch("https://jsonplaceholder.typicode.com/posts")
}

async function revalidateExample() {
  console.log("\n♻️ REVALIDATE (stale-while-revalidate)")

  await sushiFetch("https://jsonplaceholder.typicode.com/todos", {
    ttl: 10000,
  })

  // this will return cache instantly and refresh in background
  await sushiFetch("https://jsonplaceholder.typicode.com/todos", {
    revalidate: true,
  })
}

async function retryExample() {
  console.log("\n🔁 RETRY EXAMPLE")

  try {
    await sushiFetch("https://jsonplaceholder.typicode.com/invalid-url", {
      retries: 3,
      retryDelay: 500,
      retryStrategy: "exponential",
    })
  } catch (err) {
    console.log("❌ Failed after retries")
  }
}

async function timeoutExample() {
  console.log("\n⏱️ TIMEOUT EXAMPLE")

  try {
    await sushiFetch("https://jsonplaceholder.typicode.com/photos", {
      timeout: 10, // super kecil biar timeout
    })
  } catch (err) {
    console.log("⏰ Request timeout triggered")
  }
}

async function hooksExample() {
  console.log("\n🎣 HOOKS EXAMPLE")

  await sushiFetch("https://jsonplaceholder.typicode.com/comments", {
    onSuccess: (data) => {
      console.log("🎉 Success hook:", data.length, "comments")
    },
    onError: (err) => {
      console.log("💥 Error hook:", err.message)
    },
  })
}

async function dedupExample() {
  console.log("\n🔁 DEDUP REQUEST EXAMPLE")

  await Promise.all([
    sushiFetch("https://jsonplaceholder.typicode.com/albums"),
    sushiFetch("https://jsonplaceholder.typicode.com/albums"),
    sushiFetch("https://jsonplaceholder.typicode.com/albums"),
  ])
}

async function cacheControlExample() {
  console.log("\n🧹 CACHE CONTROL")

  const key = "custom-users"

  await sushiFetch("https://jsonplaceholder.typicode.com/users", {
    cacheKey: key,
  })

  console.log("🔎 Cache has key:", sushiCache.has(key))

  sushiCache.delete(key)

  console.log("🗑️ Cache deleted. Exists?", sushiCache.has(key))
}

async function runAll() {
  console.log("🚀 SUSHI-FETCH DEMO START")

  await basicExample()
  await cacheExample()
  await revalidateExample()
  await retryExample()
  await timeoutExample()
  await hooksExample()
  await dedupExample()
  await cacheControlExample()

  console.log("\n🎉 ALL DEMOS DONE")
}

runAll()