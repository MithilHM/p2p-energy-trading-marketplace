/**
 * Bengaluru geography for the peer network. Real localities + lat/long so the
 * geospatial map and the offline fallback both place peers across the city.
 */
import { makeRng } from '../data/generators'
import type { RosterNode, RosterNodeKind } from './events'

export const BLR_CENTER = { lng: 77.5946, lat: 12.9716 }
// bbox covering the localities below (also used for the offline projection)
export const BLR_BBOX = { minLng: 77.48, maxLng: 77.78, minLat: 12.83, maxLat: 13.14 }

interface Locality {
  name: string
  lng: number
  lat: number
}

export const LOCALITIES: Locality[] = [
  { name: 'Koramangala', lng: 77.6309, lat: 12.9352 },
  { name: 'Indiranagar', lng: 77.6408, lat: 12.9719 },
  { name: 'Whitefield', lng: 77.75, lat: 12.9698 },
  { name: 'HSR Layout', lng: 77.6446, lat: 12.9116 },
  { name: 'Jayanagar', lng: 77.5833, lat: 12.925 },
  { name: 'Electronic City', lng: 77.677, lat: 12.8452 },
  { name: 'Malleshwaram', lng: 77.565, lat: 13.0035 },
  { name: 'Hebbal', lng: 77.597, lat: 13.0358 },
  { name: 'JP Nagar', lng: 77.5854, lat: 12.9063 },
  { name: 'Marathahalli', lng: 77.6974, lat: 12.9569 },
  { name: 'BTM Layout', lng: 77.6101, lat: 12.9166 },
  { name: 'Yelahanka', lng: 77.5963, lat: 13.1007 },
  { name: 'Banashankari', lng: 77.556, lat: 12.9255 },
  { name: 'Rajajinagar', lng: 77.556, lat: 12.9916 },
  { name: 'Bellandur', lng: 77.6762, lat: 12.9259 },
]

const HUB = { name: 'City Grid Hub', lng: 77.609, lat: 12.9759 } // ~MG Road / CBD

const PRODUCER_KINDS: RosterNodeKind[] = ['solar', 'solar', 'solar', 'wind', 'battery']
const CONSUMER_KINDS: RosterNodeKind[] = ['home', 'home', 'commercial', 'industrial']

function producerName(kind: RosterNodeKind, area: string, n: number) {
  if (kind === 'wind') return `${area} Wind ${n}`
  if (kind === 'battery') return `${area} Battery Hub ${n}`
  return `${area} Rooftop Solar ${n}`
}
function consumerName(kind: RosterNodeKind, area: string, n: number) {
  if (kind === 'industrial') return `${area} Factory ${n}`
  if (kind === 'commercial') return `${area} Mall ${n}`
  return `${area} Home ${n}`
}

function toXY(lng: number, lat: number) {
  const x = (lng - BLR_BBOX.minLng) / (BLR_BBOX.maxLng - BLR_BBOX.minLng)
  // invert lat so north is up in the fallback canvas
  const y = 1 - (lat - BLR_BBOX.minLat) / (BLR_BBOX.maxLat - BLR_BBOX.minLat)
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
}

/** Deterministically build ~180 peers scattered across Bengaluru localities. */
export function makeBengaluruRoster(seed = 42): RosterNode[] {
  const rng = makeRng(seed)
  const nodes: RosterNode[] = []
  const jitter = () => (rng() - 0.5) * 0.045 // ~5km spread around a locality

  const place = (i: number, side: 'producer' | 'consumer' | 'prosumer') => {
    const loc = LOCALITIES[Math.floor(rng() * LOCALITIES.length)]
    const lng = loc.lng + jitter()
    const lat = loc.lat + jitter() * 0.7
    const { x, y } = toXY(lng, lat)
    let kind: RosterNodeKind
    let name: string
    if (side === 'producer') {
      kind = PRODUCER_KINDS[Math.floor(rng() * PRODUCER_KINDS.length)]
      name = producerName(kind, loc.name, i)
    } else if (side === 'consumer') {
      kind = CONSUMER_KINDS[Math.floor(rng() * CONSUMER_KINDS.length)]
      name = consumerName(kind, loc.name, i)
    } else {
      kind = 'prosumer'
      name = `${loc.name} Prosumer ${i}`
    }
    nodes.push({
      id: '',
      name,
      kind,
      // prosumers trade on the supply side
      side: side === 'consumer' ? 'consumer' : 'producer',
      x,
      y,
      lng,
      lat,
      area: loc.name,
      capacityKw:
        side === 'producer'
          ? Math.round(8 + rng() * 42)
          : side === 'prosumer'
          ? Math.round(4 + rng() * 14)
          : Math.round(3 + rng() * 20),
    })
  }

  for (let i = 1; i <= 60; i++) place(i, 'producer')
  for (let i = 1; i <= 30; i++) place(i, 'prosumer')
  for (let i = 1; i <= 90; i++) place(i, 'consumer')

  // assign stable ids by side
  let p = 1
  let x = 1
  let c = 1
  for (const n of nodes) {
    if (n.side === 'consumer') n.id = `C${String(c++).padStart(3, '0')}`
    else if (n.kind === 'prosumer') n.id = `X${String(x++).padStart(3, '0')}`
    else n.id = `P${String(p++).padStart(3, '0')}`
  }

  const hubXY = toXY(HUB.lng, HUB.lat)
  nodes.push({
    id: 'HUB',
    name: HUB.name,
    kind: 'battery',
    side: 'hub',
    x: hubXY.x,
    y: hubXY.y,
    lng: HUB.lng,
    lat: HUB.lat,
    area: 'MG Road',
    capacityKw: 0,
  })

  return nodes
}
