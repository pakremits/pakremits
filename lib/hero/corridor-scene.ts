/**
 * Home hero canvas: a dotted world map with money arcs flowing into Pakistan.
 *
 * Framework-free so it can be driven from a single effect. Hover a sending
 * country to highlight its corridor and show its rate; click it to fire
 * onCorridorClick. Hover Pakistan itself and every corridor lights up and
 * hurries home, under a "Pakistan · Home" tooltip. Pauses when off screen or in a background tab, and draws a
 * single still frame under prefers-reduced-motion.
 */

export interface HeroColors {
  /** Darkest band stop. */
  deep: string
  /** Middle band stop. */
  mid: string
  /** Glow colour; the band's last stop is `mid` blended halfway towards it. */
  bright: string
  /** Pakistan marker and the occasional gold packet. */
  accent: string
}

export interface HeroCorridor {
  /** Where a click on this corridor goes. */
  href: string
  label: string
  lon: number
  lat: number
  /** Second tooltip line, e.g. "GBP → PKR 369.80". */
  detail?: string
}

/** The Pakistan marker's tooltip. */
export interface HeroHome {
  label: string
  /** Second line, e.g. "Home · 8 corridors land here". */
  detail?: string
}

export interface CorridorSceneOptions {
  colors: HeroColors
  corridors: HeroCorridor[]
  /** Without it the Pakistan marker has no hover state. */
  home?: HeroHome
  /** Element that receives pointer events. Defaults to the canvas's parent. */
  eventTarget?: HTMLElement | null
  /** Pointer events for which this returns true are treated as leaving the map. */
  ignore?: (event: PointerEvent) => boolean
  /** Canvas stacked above the hero text; the hovered corridor and tooltip draw there. */
  overlay?: HTMLCanvasElement | null
  onCorridorClick?: (corridor: HeroCorridor) => void
}

/** Lahore, and where it sits in the band as fractions of width and height. */
const HOME = { lon: 72.5, lat: 31.2 }
const HOME_X = 0.58
const HOME_Y = 0.44
/** Pointer distance, in px, that counts as being on a corridor's origin. */
const HIT_RADIUS = 46
/** The same for the Pakistan marker, which sits among other things so gets less. */
const HOME_HIT_RADIUS = 26

/* 1° land mask: 360 cols (lon -180..180) × 140 rows (lat 80..-60), Natural Earth 110m */
const MASK_B64 = 'AAAAAAAAAAAAAA///+D////////AAAAD//wAAAAAAAAAAH8gAAAAAAAAAAAAAAAAAAAAAAAcH3P//5////////+AAAAB/+AAAAAAAAAAAAH4AAAAAAAAAAAAAAAAAAAAAA8cABwP/A////////+AAAAAPHAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAH+DB/+//Af///////+AAAAAAAAAAAAAf4AAAAP/+AAAAAAAAAAAAAAAAAAAAAP/x/3/8AAAf/////+AAAAAAAAAAAAP+AAAB////AAAB/uAAAAAAAAAAAAAAeA8AA8/8AAAP/////8AAAAAAAAAAAAfAAAAP///8AAAAgBAAAAAAAAAAAAAAf+AYe+d/gAAD/////8AAAAAAAAAAAB4AAAP/////+HwAPAAAAAAAAAAAAAAA//+4/4//wAAB/////wAAAAAAAAAAADwAHt////////4Af4AAAAAwAABAAAAAff/8P4///AAD/////wAAAAAAAAAAAHwAf/////////4///wAAABAAA//wAACAP//B8f//8AB/////wAAAAAAF/gAAAIA/v/////////////8AAAAAB///+P//n//v+D4f+AB/////AAAAAAA//8AAAA+f////////////////v+wAf////////5+Hfz4f+AAf///4AAAAAAD///4OH/////////////////////+AH/////////////4Z/wA///4AAAAAAAP///+O////v//////////////////4P/////////////wD/8A///wAwYAAAAf///+////////////////////////8//////////////A/+4Af/8AA/8AAAA/+f+D///////////////////////Bwf/////////////x//gAP/wAAf8AAAD/9/+f//////////////////////+AOB////////////HcA/gAP/gAADgAAAP/z/////////////////////////+AAH///////////8Ay6PgAD/AAAAAAAB//H//////////////////////////AAP///////////4AA/gAAD/AAAAAAAB//H//////////////////////3v/AAAf//3////////wAA/4AAAOAAAAAAAB//n//////////////////////A/8AAAB/7gH///////wAA/4wAAAAAAAAAAB//g/////////////////////+D4AAAAAv4AA///////4AA//4AAAAAAAAA4A5+B///////////////////8AAPgAAAAAD8AAD//////9AAf/8AAAAAAAAA8AG+H///////////////////wAA/gAAAAAOAAAB///////wAf/+AAAAAAAAA8AO8H///////////////////AAB/gAAAAB4AAAA///////+A///AAAAAAAAA+AN4H//////////////////+AAB/AAAAAGAAAAAf///////z///4AAAAAAAHPAOn///////////////////+AAB/AAAAAAAAAABP///////x///8AAAAAAAPfB//////////////////////+AB+AAAAAAAAAAAn///////5///+AAAAAAAPfz///////////////////////AA4AAAAAAAAAAAD///////////+AAAAAAAEfn///////////////////////AAwAAAAAAAAAAAH///////////sAAAAAAAA8f//////////////////////7AAAAAAAAAAAAAAB/////////+MPAAAAAAAAD///////////////////////7gAAAAAAAAAAAAAAf/////////wfgAAAAAAAf///////////////////////yAAAAAAAAAAAAAAAf/////////gfwAAAAAAAH///////////////////////yAAAAAAAAAAAAAAAP/////////9AgAAAAAAAD//////v/x//////////////jAAAAAAAAAAAAAAAP//////////AAAAAAAAAB/////P//B//////////////AAAAAAAAAAAAAAAAP////////+4AAAAAAAAAD//n/+Gf+H/////////////+HAAAAAAAAAAAAAAAf////////wgAAAAAAAAH//zz/+AH/H/////////////4PwAAAAAAAAAAAAAAf////////wAAAAAAAAAH/4N4/8AB/D////////////+APAAAAAAAAAAAAAAAP////////wAAAAAAAAAH/4E+f+fh/g////////////8AMAAAAAAAAAAAAAAAf///////+AAAAAAAAAAH/gMPfv///x////////////8AMAAAAAAAAAAAAAAAP///////8AAAAAAAAAAP/AMGPP///h///////////bwAMAAAAAAAAAAAAAAAP///////4AAAAAAAAAAP/AAGHP///g//////////8B4AcAAAAAAAAAAAAAAAH///////4AAAAAAAAAAH+AE8HH///w//////////+x4A4AAAAAAAAAAAAAAAD///////wAAAAAAAAAAB8/+ACD///////////////w8D4AAAAAAAAAAAAAAAB///////4AAAAAAAAAAA7/+AAwE//////////////A8/4AAAAAAAAAAAAAAAB///////gAAAAAAAAAAB//+AAAJ//////////////Ax/gAAAAAAAAAAAAAAAAP//////AAAAAAAAAAAD//+AAAB//////////////gH8AAAAAAAAAAAAAAAAAH/////8AAAAAAAAAAAP///4OAB//////////////gDAAAAAAAAAAAAAAAAAAH/////4AAAAAAAAAAAP///8P87//////////////wDAAAAAAAAAAAAAAAAAADf////4AAAAAAAAAAAP/////////////////////wAAAAAAAAAAAAAAAAAAADf///i4AAAAAAAAAAAP/////////v///////////wAAAAAAAAAAAAAAAAAAABv//gAcAAAAAAAAAAA//////////n///////////wAAAAAAAAAAAAAAAAAAAB3/+AAcAAAAAAAAAAD///////9//j///////////gAAAAAAAAAAAAAAAAAAAA7/+AANgAAAAAAAAAH///////8//wv//////////AAAAAAAAAAAAAAAAAAAAAZ/+AAMAAAAAAAAAAH///////+f/8f//////////AAAAAAAAAAAAAAAAAAAAAM/+AABgAAAAAAAAAP////////f/84Af///////+wAAAAAAAAAAAAAAAAAAAAGf+AAAAAAAAAAAAAP////////P//+AP///////8wAAAAAAAAAAAAAAAAAAAAAP8AA/AAAAAAAAAAf////////n///AH///////ggAAAAAAAAAAAACAAAAAAAAP+A4DwAAAAAAAAAf////////n///AH//+P//8AAAAAAAAAAAAAABgAAAAAAAP+B4A8AAAAAAAAAf////////n//+AAf/4P/+IAAAAAAAAAAAAAAAgAAAAAAAH/B4AB4AAAAAAAAf////////z//8AAf/wH/84AAAAAAAAAAAAAAAAAAAAAAAD//wAj9AAAAAAAAf////////x//4AAf/AD/8QAwAAAAAAAAAAAAAAAAAAAAAA//wAgAAAAAAAAAf////////4//wAAf+AD/+AA4AAAAAAAAAAAAAAAAAAAAAAP/wAAAAAAAAAAAf////////4//AAAf8AD//AA4AAAAAAAAAAAAAAAAAAAAAABP/gAAAAAAAAAAf////////8/8AAAP4ABf/gAwAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAA/////////+fwAAAPwAAP/gA4AAAAAAAAAAAAAAAAAAAAAAAB/gAAAAAAAAAAf//////////AAAAP4AAP/wA8AAAAAAAAAAAAAAAAAAAAAAAAPgAgAAAAAAAAf/////////4AAAAHwAAP/wATAAAAAAAAAAAAAAAAAAAAAAAAHgF4AAAAAAAAP/////////w4AAAHwAAMfgALAAAAAAAAAAAAAAAAAAAAAAAADgP/+AAAAAAAH//////////4AAADwAAMfABOAAAAAAAAAAAAAAAAAAAAAAAABzP/+AAAAAAAD//////////4AAADoAAMGACNAAAAAAAAAAAAAAAAAAAAAAAAA////AAAAAAAB//////////4AAABcAAOAAEHgAAAAAAAAAAAAAAAAAAAAAAAAM///wAAAAAAB//////////wAAAAcAAGAAAPgAAAAAAAAAAAAAAAAAAAAAAAAA///4AAAAAAA//////////gAAAAMAADAAMDgAAAAAAAAAAAAAAAAAAAAAAAAA////gAAAAAAP/h///////gAAAAAABDgAeAAAAAAAAAAAAAAAAAAAAAAAAAAA////4AAAAAAHAB///////AAAAAAAB7wA+AAAAAAAAAAAAAAAAAAAAAAAAAAA////4AAAAAAAAAH/////+AAAAAAAAdwB8AAAAAAAAAAAAAAAAAAAAAAAAAAB////8AAAAAAAAAH/////+AAAAAAAAfwH8AAAAAAAAAAAAAAAAAAAAAAAAAAB////8AAAAAAAAAH/////4AAAAAAAAPwf+AYAAAAAAAAAAAAAAAAAAAAAAAAD////8AAAAAAAAAH/////wAAAAAAAAHwf8+YAAAAAAAAAAAAAAAAAAAAAAAAH/////gAAAAAAAAH/////gAAAAAAAADwf9gRwAAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAAH/////AAAAAAAAAD4P54BxgAAAAAAAAAAAAAAAAAAAAAAH//////AAAAAAAAH////+AAAAAAAAAB8P5wA74AAAAAAAAAAAAAAAAAAAAAAH//////8AAAAAAAD////8AAAAAAAAAA8D54u//AIAAAAAAAAAAAAAAAAAAAAP//////+AAAAAAAB////8AAAAAAAAAAcAB4AH/wYAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAAMABoAJ/7yAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAAHsAAAI/9hgAAAAAAAAAAAAAAAAAAAD///////wAAAAAAA////8AAAAAAAAAAD+AAAA/8AIAAAAAAAAAAAAAAAAAAAB///////gAAAAAAAf///8AAAAAAAAAAAHm5gAvOAEAAAAAAAAAAAAAAAAAAAB///////gAAAAAAAf///8AAAAAAAAAAAABjAACHAHAAAAAAAAAAAAAAAAAAAA///////AAAAAAAAf///+AAAAAAAAAAAAAAAAADgBAAAAAAAAAAAAAAAAAAAA//////+AAAAAAAAf///+AAAAAAAAAAAAAAAwCAAAAAAAAAAAAAAAAAAAAAAAf/////8AAAAAAAAf///+AQAAAAAAAAAAAAD+HAAAAAAAAAAAAAAAAAAAAAAAf/////8AAAAAAAA////+AwAAAAAAAAAAAAD+HAAAAAAAAAAAAAAAAAAAAAAAP/////4AAAAAAAA////+BwAAAAAAAAAAAB/8HgAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAA////+D4AAAAAAAAAAAD/+HwAADAAAAAAAAAAAAAAAAAAAD/////4AAAAAAAB////8PwAAAAAAAAAAAH//HwAABABAAAAAAAAAAAAAAAAAA/////4AAAAAAAB////wPwAAAAAAAAAAAP///wAAAAGAAAAAAAAAAAAAAAAAAf////4AAAAAAAA////gPwAAAAAAAAAAAf///4AAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAA////APgAAAAAAAAAAA////8AAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAf//+APgAAAAAAAAAAP////+AAIAAAAAAAAAAAAAAAAAAAAP////gAAAAAAAAf//+AfgAAAAAAAAAAf/////AAGAAAAAAAAAAAAAAAAAAAAf////gAAAAAAAAP///AfAAAAAAAAAAB//////gACAAAAAAAAAAAAAAAAAAAAf///8AAAAAAAAAP///AfAAAAAAAAAAB//////gAAAAAAAAAAAAAAAAAAAAAAf///gAAAAAAAAAP//+APAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAAAf///AAAAAAAAAAP//4AEAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAAAf///AAAAAAAAAAH//4AAAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAAAf///AAAAAAAAAAH//4AAAAAAAAAAAAA//////8AAAAAAAAAAAAAAAAAAAAAA///+AAAAAAAAAAD//4AAAAAAAAAAAAA//////8AAAAAAAAAAAAAAAAAAAAAA///8AAAAAAAAAAB//wAAAAAAAAAAAAAf/////8AAAAAAAAAAAAAAAAAAAAAA///8AAAAAAAAAAB//gAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///4AAAAAAAAAAA//AAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///wAAAAAAAAAAA/+AAAAAAAAAAAAAAf/Af//4AAAAAAAAAAAAAAAAAAAAAA///gAAAAAAAAAAA/4AAAAAAAAAAAAAAf8AH//wAAAAAAAAAAAAAAAAAAAAAA///AAAAAAAAAAAAcAAAAAAAAAAAAAAAfAAF//gAABAAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//gAABgAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/AAAAwAAAAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAyAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHYAAAA+AAAAAAAAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACYAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAADwAAAAAAAAAAAAAAAAAH/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAHAAAAAAAAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAeAAAAAAAAAAAAAAAAAAH/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAP+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAH/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP+AAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const MW = 360
const MH = 140
const LAT_TOP = 80
let MASK: Uint8Array | null = null

function land(lon: number, lat: number) {
  if (!MASK) {
    const bin = atob(MASK_B64)
    MASK = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) MASK[i] = bin.charCodeAt(i)
  }
  const x = Math.floor((((lon + 180) % 360) + 360) % 360)
  const y = Math.floor(LAT_TOP - lat)
  if (y < 0 || y >= MH) return false
  const i = y * MW + x
  return (MASK[i >> 3] >> (7 - (i & 7))) & 1
}

type RGB = [number, number, number]

const hex = (h: string): RGB => {
  let v = h.replace('#', '')
  if (v.length === 3) v = v.split('').map((c) => c + c).join('')
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: RGB, b: RGB, k: number): RGB =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)) as RGB
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

interface Arc {
  x0: number
  y0: number
  cx: number
  cy: number
  x1: number
  y1: number
  c: HeroCorridor
}
interface Packet {
  arc: number
  p: number
  speed: number
  gold: boolean
}

export function createCorridorScene(canvas: HTMLCanvasElement, opts: CorridorSceneOptions) {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return { destroy() {} }

  const deep = hex(opts.colors.deep)
  const mid = hex(opts.colors.mid)
  const bright = hex(opts.colors.bright)
  const accent = hex(opts.colors.accent)
  const white: RGB = [255, 255, 255]
  const mint = mix(bright, white, 0.5)
  const { corridors } = opts
  const target: HTMLElement = opts.eventTarget ?? canvas.parentElement ?? canvas
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const octx = opts.overlay?.getContext('2d') ?? null
  // next/font renames the family, so take whatever the page actually resolved.
  const family = getComputedStyle(canvas).fontFamily || 'ui-sans-serif, system-ui, sans-serif'
  const rtl = getComputedStyle(canvas).direction === 'rtl'

  let W = 1
  let H = 1
  let s = 1
  let hx = 0
  let hy0 = 0
  let raf = 0
  let running = false
  let visible = true
  let last = 0
  let t = reduce ? 3 : 0
  let spacing = 8
  let dots: { x: number; y: number }[] = []
  let arcs: Arc[] = []
  const packets: Packet[] = []
  const pointer = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, active: 0, target: 0 }
  let hover = -1
  let hoverK = 0
  /** Pointer on the Pakistan marker, and its 0–1 fade. */
  let onHome = false
  let homeK = 0
  let spawnT = 0

  // The map is centred on Pakistan and wraps round the globe, so every corridor arcs *into* home.
  const wrap = (d: number) => ((d + 540) % 360) - 180
  const proj = (lon: number, lat: number) => ({
    x: hx + wrap(lon - HOME.lon) * s,
    y: hy0 - (lat - HOME.lat) * s,
  })

  function layout() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (octx && opts.overlay) {
      opts.overlay.width = canvas.width
      opts.overlay.height = canvas.height
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    // Whole world on wide screens, zoomed on Pakistan and the Gulf on narrow ones.
    s = Math.max(W / 360, (H * 0.85) / MH)
    hx = HOME_X * W
    // Never leave empty band above the mask's northern edge.
    hy0 = Math.min(HOME_Y * H, (LAT_TOP - HOME.lat) * s)
    spacing = Math.max(6, Math.min(11, W / 150))
    dots = []
    for (let y = spacing / 2; y < H; y += spacing)
      for (let x = spacing / 2; x < W; x += spacing) {
        const lon = HOME.lon + (x - hx) / s
        const lat = HOME.lat - (y - hy0) / s
        if (land(lon, lat)) dots.push({ x, y })
      }
    const h = proj(HOME.lon, HOME.lat)
    arcs = corridors.map((c) => {
      const o = proj(c.lon, c.lat)
      const d = Math.hypot(h.x - o.x, h.y - o.y)
      const lift = Math.min(H * 0.45, d * 0.35)
      return { x0: o.x, y0: o.y, cx: (o.x + h.x) / 2, cy: Math.min(o.y, h.y) - lift, x1: h.x, y1: h.y, c }
    })
    if (!running) draw(0)
  }

  const qb = (a: Arc, p: number) => {
    const q = 1 - p
    return {
      x: q * q * a.x0 + 2 * q * p * a.cx + p * p * a.x1,
      y: q * q * a.y0 + 2 * q * p * a.cy + p * p * a.y1,
    }
  }

  const nearest = (x: number, y: number) => {
    let hit = -1
    let best = HIT_RADIUS
    arcs.forEach((a, i) => {
      const d = Math.hypot(a.x0 - x, a.y0 - y)
      if (d < best) {
        best = d
        hit = i
      }
    })
    return hit
  }

  function radial(x: number, y: number, r: number, c: RGB, a: number) {
    const g = ctx!.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(c, a))
    g.addColorStop(1, rgba(c, 0))
    ctx!.fillStyle = g
    ctx!.fillRect(x - r, y - r, r * 2, r * 2)
  }

  function draw(dt: number) {
    t += dt
    const k = Math.min(1, dt * 6)
    pointer.active += (pointer.target - pointer.active) * Math.min(1, dt * 4)
    pointer.sx += (pointer.x - pointer.sx) * k
    pointer.sy += (pointer.y - pointer.sy) * k
    const act = pointer.active

    const hp = proj(HOME.lon, HOME.lat)
    // Pakistan wins over a corridor origin: none sits close enough to share it.
    onHome =
      !!opts.home && act > 0.2 && Math.hypot(pointer.x - hp.x, pointer.y - hp.y) < HOME_HIT_RADIUS
    homeK = reduce ? Number(onHome) : Math.max(0, Math.min(1, homeK + (onHome ? dt : -dt) * 5))
    const hv = act > 0.2 && !onHome ? nearest(pointer.x, pointer.y) : -1
    if (hv !== hover) {
      hover = hv
      hoverK = 0
    }
    hoverK = Math.min(1, hoverK + dt * 5)
    target.style.cursor = hover >= 0 && opts.onCorridorClick ? 'pointer' : ''

    // Band: the same three stops as .hero-gradient, which shows before this runs.
    ctx!.globalCompositeOperation = 'source-over'
    const g = ctx!.createLinearGradient(0, H, W, 0)
    g.addColorStop(0, rgba(deep, 1))
    g.addColorStop(0.6, rgba(mid, 1))
    g.addColorStop(1, rgba(mix(mid, bright, 0.55), 1))
    ctx!.fillStyle = g
    ctx!.fillRect(0, 0, W, H)
    ctx!.globalCompositeOperation = 'screen'
    const M = Math.max(W, H)
    radial(W * (0.8 + Math.sin(t * 0.1) * 0.06), H * 0.1, M * 0.5, bright, 0.3)
    radial(W * (0.2 + Math.cos(t * 0.08) * 0.08), H * 0.95, M * 0.55, mid, 0.45)
    radial(hp.x, hp.y, 220 + homeK * 60, bright, 0.28 + homeK * 0.12 + Math.sin(t * 1.6) * 0.05)
    if (act > 0.01) radial(pointer.sx, pointer.sy, 260, bright, 0.28 * act)
    ctx!.globalCompositeOperation = 'source-over'

    // Map dots, brighter near the pointer and around Pakistan.
    const R = 150
    for (const d of dots) {
      let e = 0
      if (act > 0) {
        const dd = Math.hypot(d.x - pointer.sx, d.y - pointer.sy)
        if (dd < R) {
          e = 1 - dd / R
          e = e * e * act
        }
      }
      const dh = Math.hypot(d.x - hp.x, d.y - hp.y)
      if (dh < 60) e = Math.max(e, (1 - dh / 60) * 0.6)
      ctx!.fillStyle = `rgba(255,255,255,${0.16 + e * 0.55})`
      ctx!.beginPath()
      ctx!.arc(d.x, d.y, spacing * 0.17 + e * 1.4, 0, Math.PI * 2)
      ctx!.fill()
    }

    // Veil behind the headline for legibility.
    const v = ctx!.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W * 0.42, 300))
    v.addColorStop(0, rgba(deep, 0.55))
    v.addColorStop(1, rgba(deep, 0))
    ctx!.fillStyle = v
    ctx!.fillRect(0, 0, W, H)

    // Arcs and their origin markers.
    ctx!.lineCap = 'round'
    arcs.forEach((a, i) => {
      // Hovering Pakistan lifts every corridor a little; hovering one lifts it fully.
      const hl = Math.max(i === hover ? hoverK : 0, homeK * 0.55)
      ctx!.setLineDash([2, 6])
      ctx!.lineDashOffset = -t * 18
      ctx!.strokeStyle = rgba(white, 0.22 + hl * 0.5)
      ctx!.lineWidth = 1.2 + hl
      ctx!.beginPath()
      ctx!.moveTo(a.x0, a.y0)
      ctx!.quadraticCurveTo(a.cx, a.cy, a.x1, a.y1)
      ctx!.stroke()
      ctx!.setLineDash([])
      const pulse = (t * 0.7 + i * 0.37) % 1
      ctx!.strokeStyle = rgba(mint, (1 - pulse) * (0.5 + hl * 0.4))
      ctx!.lineWidth = 1.2
      ctx!.beginPath()
      ctx!.arc(a.x0, a.y0, 4 + pulse * 12, 0, Math.PI * 2)
      ctx!.stroke()
      ctx!.fillStyle = rgba(white, 0.85 + hl * 0.15)
      ctx!.beginPath()
      ctx!.arc(a.x0, a.y0, 3 + hl * 1.5, 0, Math.PI * 2)
      ctx!.fill()
    })

    // Packets travelling home. Reduced motion gets a fixed set, one per arc.
    // Faster, and more often gold, while Pakistan is hovered.
    spawnT -= dt * (1 + homeK)
    if (!reduce && spawnT <= 0 && arcs.length) {
      spawnT = 0.35
      packets.push({
        arc: Math.floor(Math.random() * arcs.length),
        p: 0,
        speed: 0.22 + Math.random() * 0.18,
        gold: Math.random() < 0.2 + homeK * 0.3,
      })
    }
    if (reduce && packets.length === 0)
      arcs.forEach((_, i) => packets.push({ arc: i, p: 0.3 + (i % 4) * 0.15, speed: 0, gold: i % 3 === 0 }))
    for (let n = packets.length - 1; n >= 0; n--) {
      const pk = packets[n]
      const a = arcs[pk.arc]
      if (!a) {
        packets.splice(n, 1)
        continue
      }
      pk.p += pk.speed * dt * (pk.arc === hover ? 1.8 : 1 + homeK * 0.8)
      if (pk.p >= 1) {
        packets.splice(n, 1)
        continue
      }
      const c = pk.gold ? accent : mint
      ctx!.lineWidth = 2
      for (let j = 0; j < 10; j++) {
        const A = qb(a, Math.max(0, pk.p - (j + 1) * 0.012))
        const B = qb(a, Math.max(0, pk.p - j * 0.012))
        ctx!.strokeStyle = rgba(c, 0.9 * (1 - j / 10))
        ctx!.beginPath()
        ctx!.moveTo(A.x, A.y)
        ctx!.lineTo(B.x, B.y)
        ctx!.stroke()
      }
      const P = qb(a, pk.p)
      radial(P.x, P.y, 10, c, 0.45)
      ctx!.fillStyle = rgba(c, 1)
      ctx!.beginPath()
      ctx!.arc(P.x, P.y, 2.4, 0, Math.PI * 2)
      ctx!.fill()
    }

    // Pakistan.
    for (let r = 0; r < 2; r++) {
      const p = (t * 0.5 + r * 0.5) % 1
      ctx!.strokeStyle = rgba(accent, (1 - p) * 0.8)
      ctx!.lineWidth = 1.6
      ctx!.beginPath()
      ctx!.arc(hp.x, hp.y, 6 + p * 26, 0, Math.PI * 2)
      ctx!.stroke()
    }
    ctx!.fillStyle = rgba(accent, 1)
    ctx!.beginPath()
    ctx!.arc(hp.x, hp.y, 5 + homeK * 1.5, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.strokeStyle = '#fff'
    ctx!.lineWidth = 2
    ctx!.stroke()

    // Hovered corridor and tooltip, on the overlay so the headline never covers them.
    const T = octx ?? ctx!
    if (octx) octx.clearRect(0, 0, W, H)
    if (hover >= 0) {
      const a = arcs[hover]
      T.globalAlpha = hoverK
      if (octx) {
        T.strokeStyle = rgba(white, 0.9)
        T.lineWidth = 2
        T.lineCap = 'round'
        T.setLineDash([2, 6])
        T.lineDashOffset = -t * 18
        T.beginPath()
        T.moveTo(a.x0, a.y0)
        T.quadraticCurveTo(a.cx, a.cy, a.x1, a.y1)
        T.stroke()
        T.setLineDash([])
        T.fillStyle = '#fff'
        T.beginPath()
        T.arc(a.x0, a.y0, 4.5, 0, Math.PI * 2)
        T.fill()
        T.fillStyle = rgba(accent, 1)
        T.beginPath()
        T.arc(a.x1, a.y1, 5, 0, Math.PI * 2)
        T.fill()
      }
      const title = a.c.label
      const sub = a.c.detail ?? ''
      const F1 = `700 13px ${family}`
      const F2 = `500 12px ${family}`
      // The canvas inherits dir="rtl" on Urdu pages, which would anchor text by its right edge.
      T.direction = 'ltr'
      T.textAlign = 'left'
      T.font = F1
      const tw = T.measureText(title).width
      T.font = F2
      const sw = T.measureText(sub).width
      const bw = Math.max(tw, sw) + 24
      const bh = sub ? 48 : 30
      let bx = a.x0 + 14
      let by = a.y0 - bh - 12
      if (bx + bw > W - 8) bx = a.x0 - bw - 14
      if (bx < 8) bx = 8
      if (by < 8) by = a.y0 + 14
      T.shadowColor = 'rgba(0,0,0,.18)'
      T.shadowBlur = 16
      T.shadowOffsetY = 4
      T.fillStyle = 'rgba(255,255,255,.97)'
      T.beginPath()
      T.roundRect(bx, by, bw, bh, 8)
      T.fill()
      T.shadowColor = 'transparent'
      T.shadowBlur = 0
      T.shadowOffsetY = 0
      T.fillStyle = rgba(deep, 1)
      T.font = F1
      T.fillText(title, bx + 12, by + 20)
      if (sub) {
        T.fillStyle = rgba(mid, 1)
        T.font = F2
        T.fillText(sub, bx + 12, by + 37)
      }
      T.globalAlpha = 1
    }
    if (homeK > 0 && opts.home) drawHomeTip(T, hp, opts.home)
  }

  /**
   * "Pakistan · Home": a card above the marker with a gold house badge and a
   * notch pointing down at it, plus a halo ring on the marker itself (drawn
   * here so it sits above the headline).
   */
  function drawHomeTip(T: CanvasRenderingContext2D, hp: { x: number; y: number }, home: HeroHome) {
    T.globalAlpha = homeK
    const lift = (1 - homeK) * 6

    if (octx) {
      T.strokeStyle = rgba(accent, 0.9)
      T.lineWidth = 2
      T.beginPath()
      T.arc(hp.x, hp.y, 11, 0, Math.PI * 2)
      T.stroke()
      T.fillStyle = rgba(accent, 1)
      T.beginPath()
      T.arc(hp.x, hp.y, 6.5, 0, Math.PI * 2)
      T.fill()
      T.strokeStyle = '#fff'
      T.lineWidth = 2
      T.stroke()
    }

    const title = home.label
    const sub = home.detail ?? ''
    const F1 = `700 14px ${family}`
    const F2 = `500 12px ${family}`
    // Urdu mirrors the card (badge on the right) and needs taller lines.
    T.direction = rtl ? 'rtl' : 'ltr'
    T.textAlign = rtl ? 'right' : 'left'
    T.font = F1
    const tw = T.measureText(title).width
    T.font = F2
    const sw = T.measureText(sub).width
    const badge = 30
    const pad = 10
    const bw = pad + badge + 10 + Math.max(tw, sw) + 14
    const bh = sub ? (rtl ? 62 : 50) : 44
    const notch = 7
    // Centred above the marker, flipped below it when there is no room.
    const below = hp.y - bh - notch - 16 < 8
    let bx = hp.x - bw / 2
    bx = Math.max(8, Math.min(W - bw - 8, bx))
    const by = below ? hp.y + notch + 16 + lift : hp.y - bh - notch - 16 - lift

    T.shadowColor = 'rgba(0,0,0,.2)'
    T.shadowBlur = 18
    T.shadowOffsetY = 5
    T.fillStyle = 'rgba(255,255,255,.98)'
    T.beginPath()
    T.roundRect(bx, by, bw, bh, 12)
    // The notch, kept over the marker even when the card is pushed off-centre.
    const nx = Math.max(bx + 16, Math.min(bx + bw - 16, hp.x))
    if (below) {
      T.moveTo(nx - notch, by)
      T.lineTo(nx, by - notch)
      T.lineTo(nx + notch, by)
    } else {
      T.moveTo(nx - notch, by + bh)
      T.lineTo(nx, by + bh + notch)
      T.lineTo(nx + notch, by + bh)
    }
    T.fill()
    T.shadowColor = 'transparent'
    T.shadowBlur = 0
    T.shadowOffsetY = 0

    // Gold badge with a house.
    const cx = rtl ? bx + bw - pad - badge / 2 : bx + pad + badge / 2
    const cy = by + bh / 2
    T.fillStyle = rgba(accent, 1)
    T.beginPath()
    T.arc(cx, cy, badge / 2, 0, Math.PI * 2)
    T.fill()
    T.strokeStyle = rgba(deep, 1)
    T.fillStyle = rgba(deep, 1)
    T.lineWidth = 1.8
    T.lineJoin = 'round'
    T.lineCap = 'round'
    T.beginPath()
    T.moveTo(cx - 7, cy - 0.5)
    T.lineTo(cx, cy - 7)
    T.lineTo(cx + 7, cy - 0.5)
    T.moveTo(cx - 5, cy - 2)
    T.lineTo(cx - 5, cy + 6)
    T.lineTo(cx + 5, cy + 6)
    T.lineTo(cx + 5, cy - 2)
    T.stroke()
    T.fillRect(cx - 1.6, cy + 1.5, 3.2, 4.5)

    const textX = rtl ? bx + bw - pad - badge - 10 : bx + pad + badge + 10
    T.fillStyle = rgba(deep, 1)
    T.font = F1
    T.fillText(title, textX, sub ? by + (rtl ? 25 : 21) : by + bh / 2 + 5)
    if (sub) {
      T.fillStyle = rgba(mid, 1)
      T.font = F2
      T.fillText(sub, textX, by + (rtl ? 50 : 38))
    }
    T.globalAlpha = 1
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    draw(dt)
    raf = requestAnimationFrame(frame)
  }
  function start() {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function stop() {
    running = false
    cancelAnimationFrame(raf)
  }
  const update = () => (visible && !document.hidden && !reduce ? start() : stop())

  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onLeave = () => {
    pointer.target = 0
    if (reduce) {
      pointer.active = 0
      draw(0)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (opts.ignore?.(e)) return onLeave()
    const { x, y } = local(e)
    if (pointer.sx < -9e3) {
      pointer.sx = x
      pointer.sy = y
    }
    pointer.x = x
    pointer.y = y
    pointer.target = x >= 0 && y >= 0 && x <= W && y <= H ? 1 : 0
    // Reduced motion has no loop, so hover redraws on demand.
    if (reduce) {
      pointer.active = pointer.target
      pointer.sx = x
      pointer.sy = y
      hoverK = 1
      draw(0)
    }
  }
  const onClick = (e: PointerEvent) => {
    if (e.button !== 0 || opts.ignore?.(e)) return
    onMove(e)
    const { x, y } = local(e)
    const hit = nearest(x, y)
    if (hit >= 0) opts.onCorridorClick?.(arcs[hit].c)
  }

  target.addEventListener('pointermove', onMove, { passive: true })
  target.addEventListener('pointerleave', onLeave, { passive: true })
  target.addEventListener('pointerup', onClick)
  const ro = new ResizeObserver(layout)
  ro.observe(canvas)
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    update()
  })
  io.observe(canvas)
  document.addEventListener('visibilitychange', update)
  layout()
  update()

  return {
    destroy() {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerleave', onLeave)
      target.removeEventListener('pointerup', onClick)
      target.style.cursor = ''
      octx?.clearRect(0, 0, W, H)
    },
  }
}
