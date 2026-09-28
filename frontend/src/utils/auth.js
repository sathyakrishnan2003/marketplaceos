const TOKEN_KEY = 'marketplace_token'
const REFRESH_KEY = 'marketplace_refresh_token'
const USER_KEY = 'marketplace_user'

export function saveSession(data) {
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY)
  const storedUser = localStorage.getItem(USER_KEY)
  let user = null
  if (storedUser) {
    try {
      user = JSON.parse(storedUser)
    } catch {
      localStorage.removeItem(USER_KEY)
    }
  }
  return token ? { token, user } : null
}

export function updateSessionUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('marketplace:session', { detail: getSession() }))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new CustomEvent('marketplace:session', { detail: null }))
}
