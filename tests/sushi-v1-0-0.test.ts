import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sushi, sushiCache, SushiCache, StorageAdapter } from '../src/index.js'

// ==========================================
// 🛠️ MOCKING AREA (Biar gak ngabisin kuota)
// ==========================================
// We hijack globalThis.fetch so it doesn't actually call the internet
const mockFetch = vi.fn()
globalThis.fetch = mockFetch as any

describe('🍣 Sushi Fetch v1.0.0 - The Indestructible Edition', () => {
  
  beforeEach(() => {
    mockFetch.mockReset()
    sushiCache.clear()
    
    mockFetch.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 10))
      return new Response(JSON.stringify({ status: 'ok' }), { 
        status: 200, 
        headers: new Headers({ 'Content-Type': 'application/json' }) 
      })
    })
  })

  // ==========================================
  // 🧪 TEST 1: SMART BATCHING (Anti-Spam)
  // ==========================================
  it('🔥 must combine 3 requests simultaneously into 1 call (Smart Batching)', async () => {
    // Simulation: 3 UI components call the exact same API at the exact same second
    const req1 = sushi.get('https://api.github.com/users/sindresorhus', { batch: true })
    const req2 = sushi.get('https://api.github.com/users/sindresorhus', { batch: true })
    const req3 = sushi.get('https://api.github.com/users/sindresorhus', { batch: true })

    // Wait for everything to be done
    const [res1, res2, res3] = await Promise.all([req1, req2, req3])

    // Proof of Quality: The data is all...
    expect(res1).toEqual({ status: 'ok' })
    expect(res2).toEqual({ status: 'ok' })
    expect(res3).toEqual({ status: 'ok' })

    // ...BUT the server only got hit 1 TIME! That's the magic! 🤯
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // ==========================================
  // 🧪 TEST 2: OFFLINE PERSISTENCE (Hydration)
  // ==========================================
  it('💾 must read data from Offline Storage (Hydration) when first loaded', async () => {
    // Simulation of HP/Disk memory that already has contents
    const fakeDisk: Record<string, string> = {
      'test-db': JSON.stringify([
        ['/api/data', { data: 'Data from the past', expiry: Date.now() + 100000, lastAccess: Date.now() }]
      ])
    }

    // Create a fake Adapter (pretend to be localStorage)
    const mockStorage: StorageAdapter = {
      getItem: (k) => fakeDisk[k] || null,
      setItem: (k, v) => { fakeDisk[k] = v },
      removeItem: (k) => { delete fakeDisk[k] }
    }

    // Turn on Cache with persistence
    const persistentCache = new SushiCache({ 
      persistKey: 'test-db', 
      storage: mockStorage 
    })

    // Boom! The data is directly in RAM without the need for fetching
    expect(persistentCache.get('/api/data')).toBe('Data from the past')
  })

  // ==========================================
  // 🧪 TEST 3: AUTO-POLLING CLEANUP
  // ==========================================
  it(`⏱️ must be able to stop Auto-Polling so that memory doesn't leak`, async () => {
    vi.useFakeTimers() // Let's hurry up so we don't have to wait

    // Execute request by polling every 5 seconds
    sushi.get('https://api.sushi.com/live', { pollInterval: 5000 })

    // Advance the time by 16 seconds (fetch should be called 3x from polling + 1x from the beginning)
    await vi.advanceTimersByTimeAsync(16000)
    expect(mockFetch).toHaveBeenCalledTimes(4)

    // User moved page / component died, polling stopped
    sushiCache.stopPolling('GET:https://api.sushi.com/live:[]:')

    // Move the time forward another 10 seconds, the fetch shouldn't increase!
    await vi.advanceTimersByTimeAsync(10000)
    expect(mockFetch).toHaveBeenCalledTimes(4) // Still 4, no leaks!

    vi.useRealTimers()
  })
})