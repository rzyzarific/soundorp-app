// The navbar's destinations, as data so a unit test can pin them: a wrong address here would
// send every visitor to the wrong page.

export interface NavLink {
  label: string
  href: string
}

export const SITE_URL = 'https://soundorp.com'

/** The wordmark: back to the main site. */
export const BRAND_LINK: NavLink = { label: 'soundorp', href: SITE_URL }

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Gear Guide', href: `${SITE_URL}/equipments/` },
  { label: 'Blog', href: `${SITE_URL}/blog/` },
  { label: 'Contact', href: `${SITE_URL}/contact/` },
]

/** Where the visitor is now. Shown in the bar, but never as a link. */
export const CURRENT_SECTION = 'Signal Chain Builder'

// New tab, because the chain being built is not saved anywhere until the visitor saves it:
// leaving in the same tab would lose their work. `noopener` stops the new page reaching back
// into this one. `noreferrer` is left off on purpose, so soundorp.com can see that visitors
// arrived from this app.
export const LINK_TARGET = '_blank'
export const LINK_REL = 'noopener'
