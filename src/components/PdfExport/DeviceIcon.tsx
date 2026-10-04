import type { Device } from '../../data/devices.schema'
import { deviceIconKind, type DeviceIconKind } from '../../lib/deviceIconKind'

// Generic, shape-based drawings of each kind of gear for the PDF. They are code, not images:
// nothing to generate, store or pay for, and they work for custom devices too. They depict a
// kind of device, never a specific product, so they can't misrepresent one.
//
// Plain SVG attributes with literal hex colours only: html2canvas can't read the CSS the
// rest of the app uses, and the PDF layout has no stylesheet.

const INK = '#111827'
const MUTED = '#6b7280'
const RED = '#ee1d1d'
const FILL = '#e5e7eb'
const WHITE = '#ffffff'

const stroke = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const thin = { stroke: MUTED, strokeWidth: 1.5, strokeLinecap: 'round' } as const

function shapes(kind: DeviceIconKind) {
  switch (kind) {
    case 'mic_dynamic':
      return (
        <>
          <rect x="17" y="5" width="14" height="22" rx="7" fill={FILL} {...stroke} />
          <line x1="17" y1="12" x2="31" y2="12" {...thin} />
          <line x1="17" y1="16" x2="31" y2="16" {...thin} />
          <line x1="17" y1="20" x2="31" y2="20" {...thin} />
          <path d="M19 27 L21 43 H27 L29 27 Z" fill={FILL} {...stroke} />
          <rect x="19.5" y="28" width="9" height="3" fill={RED} />
        </>
      )
    case 'mic_condenser':
      return (
        <>
          <circle cx="24" cy="17" r="12" fill={WHITE} {...stroke} />
          <circle cx="24" cy="17" r="7" fill={FILL} stroke={MUTED} strokeWidth="1.5" />
          <line x1="17" y1="17" x2="31" y2="17" {...thin} />
          <line x1="24" y1="10" x2="24" y2="24" {...thin} />
          <line x1="24" y1="29" x2="24" y2="40" {...stroke} />
          <line x1="15" y1="43" x2="33" y2="43" {...stroke} strokeWidth={3} />
        </>
      )
    case 'mic_ribbon':
      return (
        <>
          <rect x="15" y="5" width="18" height="28" rx="4" fill={FILL} {...stroke} />
          <line x1="20" y1="10" x2="20" y2="28" {...thin} />
          <line x1="24" y1="10" x2="24" y2="28" {...thin} />
          <line x1="28" y1="10" x2="28" y2="28" {...thin} />
          <line x1="24" y1="33" x2="24" y2="40" {...stroke} />
          <line x1="15" y1="43" x2="33" y2="43" {...stroke} strokeWidth={3} />
        </>
      )
    case 'booster':
      return (
        <>
          <line x1="2" y1="24" x2="7" y2="24" {...stroke} />
          <line x1="41" y1="24" x2="46" y2="24" {...stroke} />
          <rect x="7" y="17" width="34" height="14" rx="7" fill={FILL} {...stroke} />
          <line x1="19" y1="24" x2="29" y2="24" stroke={RED} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="24" y1="19" x2="24" y2="29" stroke={RED} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )
    case 'preamp':
      return (
        <>
          <rect x="5" y="14" width="38" height="20" rx="2" fill={FILL} {...stroke} />
          <circle cx="15" cy="24" r="4" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <line x1="15" y1="22" x2="15" y2="24" {...thin} />
          <circle cx="26" cy="24" r="4" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <line x1="26" y1="22" x2="26" y2="24" {...thin} />
          <circle cx="36" cy="24" r="2" fill={RED} />
        </>
      )
    case 'interface':
      return (
        <>
          <rect x="5" y="13" width="38" height="23" rx="3" fill={FILL} {...stroke} />
          <circle cx="14" cy="25" r="4.5" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <circle cx="14" cy="25" r="1.5" fill={MUTED} />
          <circle cx="26" cy="25" r="4.5" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <circle cx="26" cy="25" r="1.5" fill={MUTED} />
          <circle cx="37" cy="25" r="3.5" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <line x1="37" y1="23" x2="37" y2="25" {...thin} />
          <circle cx="37" cy="18" r="1.5" fill={RED} />
        </>
      )
    case 'mixer':
      return (
        <>
          <rect x="5" y="8" width="38" height="32" rx="3" fill={FILL} {...stroke} />
          <line x1="13" y1="14" x2="13" y2="34" {...thin} strokeWidth={2} />
          <line x1="21" y1="14" x2="21" y2="34" {...thin} strokeWidth={2} />
          <line x1="29" y1="14" x2="29" y2="34" {...thin} strokeWidth={2} />
          <line x1="37" y1="14" x2="37" y2="34" {...thin} strokeWidth={2} />
          <rect x="10" y="22" width="6" height="4" rx="1" fill={INK} />
          <rect x="18" y="16" width="6" height="4" rx="1" fill={RED} />
          <rect x="26" y="27" width="6" height="4" rx="1" fill={INK} />
          <rect x="34" y="19" width="6" height="4" rx="1" fill={INK} />
        </>
      )
    case 'monitor':
      return (
        <>
          <rect x="12" y="4" width="24" height="40" rx="3" fill={FILL} {...stroke} />
          <circle cx="24" cy="13" r="3.5" fill={WHITE} {...stroke} strokeWidth={1.5} />
          <circle cx="24" cy="30" r="9" fill={WHITE} {...stroke} />
          <circle cx="24" cy="30" r="3.5" fill={MUTED} />
        </>
      )
    case 'headphones':
      return (
        <>
          <path d="M10 29 V24 a14 14 0 0 1 28 0 V29" fill="none" {...stroke} strokeWidth={3} />
          <rect x="6" y="27" width="9" height="14" rx="4" fill={FILL} {...stroke} />
          <rect x="33" y="27" width="9" height="14" rx="4" fill={FILL} {...stroke} />
        </>
      )
    case 'daw':
      return (
        <>
          <rect x="5" y="8" width="38" height="32" rx="3" fill={WHITE} {...stroke} />
          <line x1="5" y1="16" x2="43" y2="16" {...thin} />
          <circle cx="10" cy="12" r="1.3" fill={MUTED} />
          <circle cx="14" cy="12" r="1.3" fill={MUTED} />
          <circle cx="18" cy="12" r="1.3" fill={MUTED} />
          <polyline
            points="9,29 13,29 15,23 18,35 21,20 24,36 27,24 30,31 33,27 36,29 39,29"
            fill="none"
            stroke={RED}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )
  }
}

interface DeviceIconProps {
  device: Device
  size?: number
}

export function DeviceIcon({ device, size = 32 }: DeviceIconProps) {
  const kind = deviceIconKind(device)
  return (
    <svg
      data-icon={kind}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {shapes(kind)}
    </svg>
  )
}
