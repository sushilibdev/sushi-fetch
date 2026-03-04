import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSushi } from './fetcher'

// Mock globalThis.fetch
globalThis.fetch = vi.fn() as any

describe('sushi-fetch Interceptors (v0.7.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run request interceptor and modify options', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const sushi = createSushi({
      interceptors: {
        request: async (url, options) => {
          return {
            ...options,
            headers: {
              ...options.headers,
              'X-Custom-Header': 'Intercepted'
            }
          }
        }
      }
    })

    await sushi.get('https://api.example.com/test')

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.headers.get('X-Custom-Header')).toBe('Intercepted')
  })

  it('should run response interceptor and modify response', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true,
      clone: function() { return this }
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const sushi = createSushi({
      interceptors: {
        response: async (res) => {
          // Wrap response to add something
          const originalJson = res.json.bind(res)
          res.json = async () => {
            const data = await originalJson()
            return { ...data, intercepted: true }
          }
          return res
        }
      }
    })

    const result = await sushi.get('https://api.example.com/test')
    expect(result).toEqual({ success: true, intercepted: true })
  })

  it('should handle async request interceptors for token injection', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const getToken = async () => 'secret-token'

    const sushi = createSushi({
      interceptors: {
        request: async (url, options) => {
          const token = await getToken()
          const headers = new Headers(options.headers)
          headers.set('Authorization', `Bearer ${token}`)
          return { ...options, headers }
        }
      }
    })

    await sushi.get('/api/me')

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.headers.get('Authorization')).toBe('Bearer secret-token')
  })

  it('should handle global and call-site interceptors (merged)', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const sushi = createSushi({
      interceptors: {
        request: (url, opts) => {
          const h = new Headers(opts.headers)
          h.set('X-Global', 'yes')
          return { ...opts, headers: h }
        }
      }
    })

    await sushi.get('/test', {
      interceptors: {
        response: (res) => {
           // just passing through
           return res
        }
      }
    })

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.headers.get('X-Global')).toBe('yes')
  })
})
