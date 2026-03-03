import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sushiFetch, sushiCache } from './fetcher'

// Mock globalThis.fetch
globalThis.fetch = vi.fn() as any

describe('sushi-fetch Core Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sushiCache.clear() // Invalidate cache before each test
  })

  it('should auto-stringify data object and set Content-Type', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const payload = { name: 'Haqqi', role: 'developer' }
    await sushiFetch.post('https://api.example.com/data', payload)

    const [url, options] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toBe('https://api.example.com/data')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(payload))
    expect(options.headers.get('Content-Type')).toBe('application/json')
  })

  it('should auto-parse JSON response if Content-Type is application/json', async () => {
    const responseData = { id: 1, message: 'Sushi is delicious' }
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => responseData,
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const result = await sushiFetch.get('https://api.example.com/info')

    expect(result).toEqual(responseData)
    expect(typeof result).toBe('object')
  })

  it('should support force option to bypass cache', async () => {
    const mockRes1 = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ value: 1 }),
      ok: true
    }
    const mockRes2 = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ value: 2 }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes1).mockResolvedValueOnce(mockRes2)

    await sushiFetch('https://api.example.com/cached', { cache: true })
    const res2 = await sushiFetch('https://api.example.com/cached', { force: true })

    expect(res2).toEqual({ value: 2 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('should use custom cacheKey if provided', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValue(mockRes)

    await sushiFetch('https://api.example.com/data?t=1', { cacheKey: 'my-custom-key' })
    await sushiFetch('https://api.example.com/data?t=2', { cacheKey: 'my-custom-key' })

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('should trigger onSuccess and onError callbacks', async () => {
    const successSpy = vi.fn()
    const errorSpy = vi.fn()

    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    await sushiFetch('https://api.example.com/success', { onSuccess: successSpy })
    expect(successSpy).toHaveBeenCalledWith({ success: true })

    ;(globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'))
    try { await sushiFetch('https://api.example.com/fail', { onError: errorSpy, retries: 0 }) } catch {}
    expect(errorSpy).toHaveBeenCalled()
  })

  it('should not auto-stringify if body is FormData', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const formData = new FormData()
    formData.append('file', 'test')

    await sushiFetch.post('https://api.example.com/upload', formData)

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.headers.get('Content-Type')).toBeNull()
  })
})
