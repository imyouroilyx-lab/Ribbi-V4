export function validateStoryImageUrl(input: string) {
  if (!input) return false

  const trimmed = input.trim()

  if (trimmed.length > 2000) return false

  try {
    const url = new URL(trimmed)

    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function getStoryExpiresText(expiresAt: string) {
  const expires = new Date(expiresAt).getTime()
  const now = Date.now()

  const diffMs = expires - now

  if (diffMs <= 0) {
    return 'หมดอายุแล้ว'
  }

  const diffMinutes = Math.floor(diffMs / 1000 / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours > 0) {
    return `เหลือ ${diffHours} ชม.`
  }

  return `เหลือ ${diffMinutes} นาที`
}
