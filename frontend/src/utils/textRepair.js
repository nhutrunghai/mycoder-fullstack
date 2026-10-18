export function repairText(value) {
  if (typeof value !== 'string') return value

  // Repair UTF-8 bytes that were decoded as Latin-1/Windows-1252.
  if (!/[ÃÂÄÅÆÇÐÑØÙÝÞáºá»â€/]/.test(value)) {
    return value
  }

  try {
    const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff)
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return repaired.includes('\ufffd') ? value : repaired
  } catch {
    return value
  }
}

export function deepRepair(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepRepair(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepRepair(item)]),
    )
  }

  return repairText(value)
}
