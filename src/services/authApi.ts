import { createInternalNeonAuth } from '@neondatabase/auth'

const AUTH_URL = import.meta.env.VITE_NEON_AUTH_BASE_URL as string | undefined

if (!AUTH_URL) throw new Error('Neon Auth URL is not configured.')

const neonAuth = createInternalNeonAuth(AUTH_URL)
const auth = neonAuth.adapter

function unwrap<T extends { data?: unknown; error?: { message?: string } | null }>(result: T): NonNullable<T['data']> {
  if (result.error) throw new Error(result.error.message || 'Authentication request failed.')
  if (!result.data) throw new Error('Authentication request returned no session.')
  return result.data as NonNullable<T['data']>
}

export const authApi = {
  signUp: async (name: string, email: string, password: string) => unwrap(await auth.signUp.email({ name, email, password })),
  signIn: async (email: string, password: string) => unwrap(await auth.signIn.email({ email, password })),
  signOut: () => auth.signOut(),
  getSession: async () => {
    const result = await auth.getSession()
    if (result.error) throw new Error(result.error.message || 'Could not load the authentication session.')
    return result.data
  },
  getAuthToken: () => neonAuth.getJWTToken(),
  signInWithGoogle: async () => {
    const result = await auth.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
      disableRedirect: true,
    })
    if (result.error) throw new Error(result.error.message || 'Google sign-in is unavailable right now.')
    if (!result.data?.url) throw new Error('Google sign-in did not return an authorization URL.')

    const authorizationUrl = new URL(result.data.url)
    authorizationUrl.searchParams.set('prompt', 'select_account')
    window.location.assign(authorizationUrl.toString())
  },
}
