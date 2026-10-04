// Public chain pages live at /c/<encoded-chain>. The encoded chain is the same self-contained
// lz-string payload the ?chain= links use, so the page needs no backend and the link never
// expires. (Its alphabet, A-Z a-z 0-9 + - $, is safe in a URL path as it stands.)

const PUBLIC_CHAIN_PATH = /^\/c\/([^/]+)\/?$/

export function publicChainPath(encoded: string): string {
  return `/c/${encoded}`
}

export function buildPublicChainUrl(origin: string, encoded: string): string {
  return `${origin}${publicChainPath(encoded)}`
}

/** The editable builder, pre-loaded with the same chain (the existing ?chain= flow). */
export function buildBuilderUrl(encoded: string): string {
  return `/?chain=${encoded}`
}

/**
 * Whether a path is a public chain page, and if so which payload it carries.
 *  - null: not a public chain route (the builder should render);
 *  - { encoded: null }: it is a /c/<something> route, but the segment can't be decoded;
 *  - { encoded }: the payload to hand to decodeShareParam.
 */
export function readPublicChainRoute(pathname: string): { encoded: string | null } | null {
  const match = pathname.match(PUBLIC_CHAIN_PATH)
  if (!match) return null
  try {
    return { encoded: decodeURIComponent(match[1]) }
  } catch {
    return { encoded: null }
  }
}
