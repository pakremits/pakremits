import { ImageResponse } from 'next/og'

export const alt = 'PakRemits — compare money transfer rates to Pakistan'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      width: '100%', height: '100%', padding: '68px 76px',
      background: '#024E38', color: '#F3F6F4', fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
        Pak<span style={{ color: '#E0A513' }}>Remits</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08, maxWidth: 950 }}>
          Compare rates before you send money to Pakistan
        </div>
        <div style={{ fontSize: 29, color: '#B7E4D4' }}>
          See the rupees received after rates and fees
        </div>
      </div>
      <div style={{ height: 8, width: 156, borderRadius: 4, background: '#E0A513' }} />
    </div>,
    size,
  )
}
