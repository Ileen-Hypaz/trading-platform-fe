/**
 * Tests for src/lib/api.ts
 *
 * Covers:
 *  - ApiError classification helpers (isDegradation, isGuardrailViolation)
 *  - Authorization header injection when VITE_API_KEY is set
 *  - No Authorization header when VITE_API_KEY is empty
 *
 * Run: npx vitest run
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from './api'

// ---------------------------------------------------------------------------
// ApiError classification
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('isDegradation is true for status >= 503', () => {
    expect(new ApiError(503, 'Service Unavailable').isDegradation).toBe(true)
    expect(new ApiError(504, 'Gateway Timeout').isDegradation).toBe(true)
  })

  it('isDegradation is false for 4xx errors', () => {
    expect(new ApiError(400, 'Bad Request').isDegradation).toBe(false)
    expect(new ApiError(401, 'Unauthorized').isDegradation).toBe(false)
  })

  it('isDegradation is true for MARKET_DATA_UNAVAILABLE error code', () => {
    const err = new ApiError(200, 'OK', 'MARKET_DATA_UNAVAILABLE')
    expect(err.isDegradation).toBe(true)
  })

  it('isDegradation is true for AI_SERVICE_UNAVAILABLE error code', () => {
    const err = new ApiError(200, 'OK', 'AI_SERVICE_UNAVAILABLE')
    expect(err.isDegradation).toBe(true)
  })

  it('isGuardrailViolation is true for GUARDRAIL_VIOLATION error code', () => {
    const err = new ApiError(422, 'Unprocessable', 'GUARDRAIL_VIOLATION')
    expect(err.isGuardrailViolation).toBe(true)
  })

  it('isGuardrailViolation is false for other codes', () => {
    const err = new ApiError(422, 'Unprocessable', 'VALIDATION_ERROR')
    expect(err.isGuardrailViolation).toBe(false)
  })

  it('errorCode is null when not provided', () => {
    const err = new ApiError(500, 'Server Error')
    expect(err.errorCode).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Authorization header injection
// ---------------------------------------------------------------------------

describe('Authorization header injection', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // Restore any env vars before each test
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  it('injects Authorization header when VITE_API_KEY is set', async () => {
    vi.stubEnv('VITE_API_KEY', 'test-secret-key')

    // Re-import the module after env change to pick up the new value.
    // Vitest re-evaluates modules in isolation; use dynamic import with cache-bust.
    const capturedHeaders: Record<string, string>[] = []

    globalThis.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      capturedHeaders.push(headers)
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as typeof fetch

    // Dynamically import a fresh copy so env vars are re-read.
    const mod = await import('./api?t=' + Date.now())
    await mod.api.get('/test')

    expect(capturedHeaders.length).toBeGreaterThan(0)
    const authHeader = capturedHeaders[0]['Authorization']
    expect(authHeader).toBe('Bearer test-secret-key')
  })

  it('omits Authorization header when VITE_API_KEY is empty', async () => {
    vi.stubEnv('VITE_API_KEY', '')

    const capturedHeaders: Record<string, string>[] = []

    globalThis.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      capturedHeaders.push(headers)
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as typeof fetch

    const mod = await import('./api?t=' + Date.now() + '1')
    await mod.api.get('/test')

    expect(capturedHeaders.length).toBeGreaterThan(0)
    expect(capturedHeaders[0]['Authorization']).toBeUndefined()
  })
})
