import { useEffect, useRef, useState } from 'react'

// Road geometry depends on the lane mode (see setLaneMode), so these are `let`.
let MULTI_LANE = false // two lanes each way, so cars can overtake
let ROAD_WIDTH = 44
let LANE_OFFSETS = [10] // lane centre distances from the road centre line, kerb lane first
let SNAP_RADIUS = ROAD_WIDTH * 0.8 // how close a road end must be to snap onto another road
// Stop line distance from the junction centre: far enough back that a waiting car's nose
// (half a car length, 9px) stays clear of the junction box and of cars turning through it.
let STOP_GAP = ROAD_WIDTH / 2 + 12
let TURN_RADIUS = ROAD_WIDTH / 2 + 2 // turns start/end this far from the junction centre

function setLaneMode(multi) {
  MULTI_LANE = multi
  ROAD_WIDTH = multi ? 76 : 44
  // Keep left: lane 0 hugs the kerb (normal driving), lane 1 is the overtaking lane.
  LANE_OFFSETS = multi ? [27, 9] : [10]
  SNAP_RADIUS = ROAD_WIDTH * 0.8
  STOP_GAP = ROAD_WIDTH / 2 + 12
  TURN_RADIUS = ROAD_WIDTH / 2 + 2
}

const laneOffset = (lane) => LANE_OFFSETS[Math.min(lane, LANE_OFFSETS.length - 1)]

const LANE_CHANGE_SPEED = 22 // px/s sideways while changing lane
const OVERTAKE_LOOK = 70 // start overtaking when stuck this close behind a slower car
const MIN_POINT_GAP = 10
const CLICK_TOLERANCE = 5
const TOUCH_TOLERANCE = 3 // road ends this close to another road form a junction
const MERGE_RADIUS = 6 // junction points this close together become one node
const CAR_GAP = 24 // minimum bumper-to-bumper spacing (centre to centre) when queueing
const U_TURN_BULGE = 14 // how far a dead-end U-turn loop reaches forward
const ACCEL = 60 // px/s² pulling away
const BRAKE = 90 // px/s² comfortable braking
const TURN_SPEED = 55 // px/s through junction curves
const U_TURN_SPEED = 30 // px/s round a dead-end loop
const CAR_WIDTH_CLEARANCE = 9 // a car this far off our path doesn't count as "in the way"
const PATH_STEP = 4 // px between the points checked along a car's route ahead
const DEADLOCK_TIME = 2.5 // seconds stuck nose-to-nose before a car squeezes past
const MIN_GREEN = 3 // seconds a green lasts at least
const MAX_GREEN = 10 // seconds a green can be held while cars keep coming
const YELLOW_TIME = 1.2 // seconds
const ALL_RED_TIME = 0.8 // seconds of red all round between phases
const DETECT_RANGE = 160 // how far back a light "sees" approaching cars
const LIGHT_COLORS = { green: '#22c55e', yellow: '#facc15', red: '#ef4444' }
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const GRID = 40
const CAR_COLORS = ['#34d399', '#f87171', '#60a5fa', '#fbbf24', '#c084fc', '#f472b6', '#e4e4e7']

// ---------- geometry ----------

// Build a road from raw points, precomputing cumulative lengths for fast lookups.
function makeRoad(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  return { points, cum, length: cum[cum.length - 1] }
}

// Position and heading at distance s along a road.
function pointAt(road, s) {
  const { points, cum } = road
  let i = 1
  while (i < cum.length - 1 && cum[i] < s) i++
  const a = points[i - 1]
  const b = points[i]
  const segLen = cum[i] - cum[i - 1] || 1
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / segLen))
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  }
}

// Nearest point on a single road to (x, y): { d, s }.
function nearestOnRoad(road, x, y) {
  const { points, cum } = road
  let best = { d: Infinity, s: 0 }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2))
    const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
    if (d < best.d) best = { d, s: cum[i - 1] + Math.sqrt(len2) * t }
  }
  return best
}

// Nearest road under (x, y) within `radius`: { roadIndex, s, d } or null.
function hitRoad(roads, x, y, radius = ROAD_WIDTH / 2) {
  let best = null
  roads.forEach((road, roadIndex) => {
    const n = nearestOnRoad(road, x, y)
    if (n.d <= radius && (!best || n.d < best.d)) best = { ...n, roadIndex }
  })
  return best
}

// Snap a point onto an existing road end (preferred) or road body, so new roads connect.
function snapPoint(roads, p) {
  let best = null
  for (const road of roads) {
    for (const end of [road.points[0], road.points[road.points.length - 1]]) {
      const d = Math.hypot(end.x - p.x, end.y - p.y)
      if (d < SNAP_RADIUS && (!best || d < best.d)) best = { x: end.x, y: end.y, d }
    }
  }
  if (best) return best
  const hit = hitRoad(roads, p.x, p.y, SNAP_RADIUS * 0.75)
  if (!hit) return null
  const q = pointAt(roads[hit.roadIndex], hit.s)
  return { x: q.x, y: q.y, d: hit.d }
}

// Intersection of segments ab and cd: { t, u } along each, or null.
function segmentIntersect(a, b, c, d) {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-9) return null
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null
  return { t, u }
}

// ---------- road network ----------

// Turn the drawn roads into a graph: nodes where roads cross or touch, plus every road end.
// Each road gets a sorted list of junctions { s, node } along it.
function buildGraph(roads, lights = []) {
  const raw = [] // { x, y, entries: [{ road, s }] }

  // 1. Where segments of roads cross each other (including a road crossing itself).
  const segs = []
  roads.forEach((road, r) => {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]
      const b = road.points[i]
      segs.push({
        r, i, a, b,
        s0: road.cum[i - 1],
        len: road.cum[i] - road.cum[i - 1],
        minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
      })
    }
  })
  for (let p = 0; p < segs.length; p++) {
    const A = segs[p]
    for (let q = p + 1; q < segs.length; q++) {
      const B = segs[q]
      if (A.r === B.r && Math.abs(A.i - B.i) <= 1) continue // neighbouring segments share a point
      if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) continue
      const hit = segmentIntersect(A.a, A.b, B.a, B.b)
      if (!hit) continue
      raw.push({
        x: A.a.x + (A.b.x - A.a.x) * hit.t,
        y: A.a.y + (A.b.y - A.a.y) * hit.t,
        entries: [
          { road: A.r, s: A.s0 + A.len * hit.t },
          { road: B.r, s: B.s0 + B.len * hit.u },
        ],
      })
    }
  }

  // 2. Road ends that touch another road (T-junctions and end-to-end joins).
  roads.forEach((road, r) => {
    for (const s of [0, road.length]) {
      const p = pointAt(road, s)
      roads.forEach((other, o) => {
        if (o === r) return
        const n = nearestOnRoad(other, p.x, p.y)
        if (n.d <= TOUCH_TOLERANCE) {
          raw.push({ x: p.x, y: p.y, entries: [{ road: r, s }, { road: o, s: n.s }] })
        }
      })
    }
  })

  // 3. Merge nearby points into single nodes.
  const nodes = []
  const addEntry = (node, e) => {
    if (!node.entries.some((x) => x.road === e.road && Math.abs(x.s - e.s) < MERGE_RADIUS)) {
      node.entries.push(e)
    }
  }
  for (const pt of raw) {
    let node = nodes.find((n) => Math.hypot(n.x - pt.x, n.y - pt.y) < MERGE_RADIUS)
    if (!node) {
      node = { x: pt.x, y: pt.y, entries: [] }
      nodes.push(node)
    }
    pt.entries.forEach((e) => addEntry(node, e))
  }

  // 4. Per-road junction lists, with dead-end nodes at any road end not already joined.
  const junctions = roads.map(() => [])
  for (const node of nodes) {
    for (const e of node.entries) junctions[e.road].push({ s: e.s, node })
  }
  roads.forEach((road, r) => {
    for (const s of [0, road.length]) {
      if (!junctions[r].some((j) => Math.abs(j.s - s) < 1)) {
        const p = pointAt(road, s)
        const node = { x: p.x, y: p.y, entries: [{ road: r, s }] }
        nodes.push(node)
        junctions[r].push({ s, node })
      }
    }
    junctions[r].sort((a, b) => a.s - b.s)
  })

  // 5. Arms: every way into a junction (a road + the direction cars arrive along it),
  //    with the movements (left / straight / right) possible from it.
  for (const node of nodes) {
    if (node.entries.length < 2) continue
    node.arms = []
    node.entries.forEach((e, entry) => {
      const len = roads[e.road].length
      for (const dir of [1, -1]) {
        if (dir > 0 ? e.s < 0.5 : e.s > len - 0.5) continue // no road on that side
        const heading = headingAt(roads[e.road], e.s - dir * 4, dir)
        const moves = new Set(
          listOptions(e.road, dir, e.s, node, roads).map((o) =>
            signalMove(classifyTurn(heading, headingAt(roads[o.road], o.s + o.dir * 4, o.dir))),
          ),
        )
        node.arms.push({ entry, road: e.road, s: e.s, dir, heading, moves })
      }
    })
  }

  // 6. Traffic lights on junctions where the user placed one.
  for (const node of nodes) {
    if (!node.arms) continue
    const light = lights.find((l) => Math.hypot(l.x - node.x, l.y - node.y) < MERGE_RADIUS * 2)
    if (light) node.signal = makeSignal(light, node.arms)
  }

  return { nodes, junctions }
}

// ---------- turns and signals ----------

// Direction of travel along a road at s, for a car moving in direction dir.
function headingAt(road, s, dir) {
  const a = pointAt(road, Math.min(road.length, Math.max(0, s))).angle
  return dir > 0 ? a : a + Math.PI
}

// Left / straight / right / u from the heading we arrive with and the one we leave with.
// Screen y points down, so a clockwise change of heading is a right turn.
function classifyTurn(inHeading, outHeading) {
  let d = outHeading - inHeading
  while (d > Math.PI) d -= Math.PI * 2
  while (d <= -Math.PI) d += Math.PI * 2
  if (Math.abs(d) < 0.6) return 'straight'
  if (Math.abs(d) > 2.6) return 'u'
  return d > 0 ? 'right' : 'left'
}

// A U-turn crosses oncoming traffic like a right turn, so it shares the right arrow.
const signalMove = (turn) => (turn === 'u' ? 'right' : turn)

// Ways out of a junction for a car arriving on roadIndex in direction dir (no U-turns).
function listOptions(roadIndex, dir, nodeS, node, roads) {
  const options = []
  for (const e of node.entries) {
    const len = roads[e.road].length
    for (const d of [1, -1]) {
      if (d > 0 ? e.s > len - 0.5 : e.s < 0.5) continue // nowhere to go that way
      const isUTurn = e.road === roadIndex && Math.abs(e.s - nodeS) < 1 && d === -dir
      if (!isUTurn) options.push({ road: e.road, s: e.s, dir: d })
    }
  }
  return options
}

const findArm = (node, road, s, dir) =>
  node.arms ? node.arms.findIndex((a) => a.road === road && Math.abs(a.s - s) < 1 && a.dir === dir) : -1

// Decide ahead of time where the car will go at the next junction, so it can obey
// turn arrows, ask the lights for the right movement, and only slow down if turning.
function planRoute(car, node, nodeS, roads) {
  const options = listOptions(car.roadIndex, car.dir, nodeS, node, roads)
  const option = options.length ? options[Math.floor(Math.random() * options.length)] : null
  const inHeading = headingAt(roads[car.roadIndex], nodeS - car.dir * 4, car.dir)
  const turn = option
    ? classifyTurn(inHeading, headingAt(roads[option.road], option.s + option.dir * 4, option.dir))
    : 'u'
  return { node, option, turn, arm: findArm(node, car.roadIndex, nodeS, car.dir) }
}

// Take the planned way out of a junction (or reverse if there is none).
function chooseNextRoad(car, node, roads, pick) {
  if (!pick) {
    const options = listOptions(car.roadIndex, car.dir, car.s, node, roads)
    if (options.length === 0) {
      car.dir = -car.dir
      return
    }
    pick = options[Math.floor(Math.random() * options.length)]
  }
  car.roadIndex = pick.road
  car.s = pick.s
  car.dir = pick.dir
}

// Signal programs the user can pick for a light.
const SIGNAL_MODES = [
  {
    id: 'arrow',
    label: 'Right-turn arrow',
    hint: 'Straight & left go together, then a protected right-only arrow.',
  },
  {
    id: 'road',
    label: 'All directions',
    hint: 'Each road gets green for every direction, both ways at once.',
  },
  {
    id: 'split',
    label: 'One approach at a time',
    hint: 'Each approach gets its own green for all its directions. Safest, slowest.',
  },
]
const ALL_MOVES = ['left', 'straight', 'right']

// Pair up arms that face each other (opposing traffic on a crossroads).
function pairArms(arms) {
  const used = new Set()
  const groups = []
  arms.forEach((a, i) => {
    if (used.has(i)) return
    used.add(i)
    let best = -1
    arms.forEach((b, j) => {
      if (used.has(j)) return
      if (best < 0 && classifyTurn(a.heading, b.heading + Math.PI) === 'straight') best = j
    })
    if (best >= 0) {
      used.add(best)
      groups.push([i, best])
    } else {
      groups.push([i])
    }
  })
  return groups
}

// Build the list of phases for a program. Each phase says which movements each arm may make:
// phase.allow[armIndex] = ['left', 'straight', ...].
function makePhases(mode, arms) {
  const phases = []
  if (mode === 'split') {
    arms.forEach((_, i) => phases.push({ allow: { [i]: ALL_MOVES } }))
  } else if (mode === 'road') {
    const byEntry = new Map()
    arms.forEach((a, i) => byEntry.set(a.entry, [...(byEntry.get(a.entry) ?? []), i]))
    for (const group of byEntry.values()) {
      phases.push({ allow: Object.fromEntries(group.map((i) => [i, ALL_MOVES])) })
    }
  } else {
    // 'arrow': opposing arms run straight + left together, then get a right-only arrow.
    for (const group of pairArms(arms)) {
      if (group.length === 1) {
        phases.push({ allow: { [group[0]]: ALL_MOVES } })
        continue
      }
      phases.push({ allow: Object.fromEntries(group.map((i) => [i, ['left', 'straight']])) })
      if (group.some((i) => arms[i].moves.has('right'))) {
        phases.push({ allow: Object.fromEntries(group.map((i) => [i, ['right']])) })
      }
    }
  }
  return phases
}

function makeSignal(light, arms) {
  return { light, mode: light.mode, phases: makePhases(light.mode, arms), phase: 0, stage: 'green', t: 0 }
}

// What a light shows for one movement from one arm: 'green' | 'yellow' | 'red'.
function signalFor(signal, arm, move) {
  if (signal.stage === 'allred') return 'red'
  const allowed = signal.phases[signal.phase]?.allow[arm]?.includes(signalMove(move))
  return allowed ? signal.stage : 'red'
}

// Smart timing: each light watches the cars approaching it. It holds green while cars keep
// coming (up to MAX_GREEN), changes early when nobody is using it, and skips phases that
// nobody is waiting for. With no traffic at all it just rests on its current green.
function updateSignals(graph, cars, dt) {
  for (const node of graph.nodes) {
    const sig = node.signal
    if (!sig || sig.phases.length === 0) continue
    const demand = sig.phases.map(() => false)
    for (const car of cars) {
      const a = car.approach
      if (!a || a.node !== node) continue
      sig.phases.forEach((p, i) => {
        if (p.allow[a.arm]?.includes(signalMove(a.turn))) demand[i] = true
      })
    }
    sig.demand = demand
    sig.t += dt
    if (sig.stage === 'green') {
      const othersWaiting = demand.some((d, i) => d && i !== sig.phase)
      if (othersWaiting && sig.t >= MIN_GREEN && (!demand[sig.phase] || sig.t >= MAX_GREEN)) {
        sig.stage = 'yellow'
        sig.t = 0
      }
    } else if (sig.stage === 'yellow' && sig.t >= YELLOW_TIME) {
      sig.stage = 'allred' // a moment for the junction to clear
      sig.t = 0
    } else if (sig.stage === 'allred' && sig.t >= ALL_RED_TIME) {
      const n = sig.phases.length
      let next = (sig.phase + 1) % n
      for (let k = 1; k <= n; k++) {
        const i = (sig.phase + k) % n
        if (demand[i]) {
          next = i
          break
        }
      }
      sig.phase = next
      sig.stage = 'green'
      sig.t = 0
    }
  }
}

// ---------- turning curves ----------

// Point and heading on a quadratic Bézier at parameter t.
function bezierAt(p0, p1, p2, t) {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    heading: Math.atan2(
      2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
      2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    ),
  }
}

// Build a curve from the lane we're leaving (p0) to the lane we're joining (p2).
// The control point is where the two lanes would meet, which gives a natural corner.
function makeTurn(p0, p2, node) {
  const d0 = { x: Math.cos(p0.heading), y: Math.sin(p0.heading) }
  const d2 = { x: Math.cos(p2.heading), y: Math.sin(p2.heading) }
  const denom = d0.x * d2.y - d0.y * d2.x
  let p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 } // straight on: no real corner
  if (Math.abs(denom) > 0.15) {
    const t = ((p2.x - p0.x) * d2.y - (p2.y - p0.y) * d2.x) / denom
    const c = { x: p0.x + d0.x * t, y: p0.y + d0.y * t }
    // Ignore wild control points (lanes nearly parallel or meeting far away).
    if (t > 0 && Math.hypot(c.x - node.x, c.y - node.y) < TURN_RADIUS * 2) p1 = c
  }
  // Arc length by sampling, so cars keep their speed through the corner.
  let length = 0
  let prev = p0
  for (let i = 1; i <= 12; i++) {
    const q = bezierAt(p0, p1, p2, i / 12)
    length += Math.hypot(q.x - prev.x, q.y - prev.y)
    prev = q
  }
  return { kind: 'curve', p0, p1, p2, length: Math.max(length, 1), d: 0 }
}

// U-turn loop: half an ellipse from our lane to the opposite lane, bulging forward
// towards the road end. c is the road centre point where the loop starts.
function uTurnAt(turn, t) {
  const { c, heading, r } = turn
  const th = Math.PI * t
  const fx = Math.cos(heading) // forward
  const fy = Math.sin(heading)
  const lx = Math.cos(heading - Math.PI / 2) // left (our lane's side)
  const ly = Math.sin(heading - Math.PI / 2)
  const a = r * Math.cos(th)
  const b = U_TURN_BULGE * Math.sin(th)
  const da = -r * Math.sin(th)
  const db = U_TURN_BULGE * Math.cos(th)
  return {
    x: c.x + lx * a + fx * b,
    y: c.y + ly * a + fy * b,
    heading: Math.atan2(ly * da + fy * db, lx * da + fx * db),
  }
}

// r: the car's sideways offset from the centre line (it comes out at the same offset).
function makeUTurn(c, heading, r) {
  const turn = { kind: 'u', c, heading, r, d: 0 }
  let length = 0
  let prev = uTurnAt(turn, 0)
  for (let i = 1; i <= 16; i++) {
    const q = uTurnAt(turn, i / 16)
    length += Math.hypot(q.x - prev.x, q.y - prev.y)
    prev = q
  }
  turn.length = length
  return turn
}

// Turn the car around in a loop at its current spot; it ends in the opposite lane.
function startUTurn(car, roads) {
  const p = pointAt(roads[car.roadIndex], car.s)
  const heading = car.dir > 0 ? p.angle : p.angle + Math.PI
  car.turn = makeUTurn({ x: p.x, y: p.y }, heading, carOffset(car))
  car.dir = -car.dir
}

// Sideways distance of a car from the road centre line (its lane, or between two lanes
// while changing lane).
const carOffset = (car) => car.offset ?? laneOffset(car.lane ?? 0)

// Where a car sits on screen: mid-turn on its curve, or on its road in its (left-hand) lane.
function carPose(car, roads) {
  if (car.turn) {
    const t = Math.min(1, car.turn.d / car.turn.length)
    if (car.turn.kind === 'u') return uTurnAt(car.turn, t)
    const { p0, p1, p2 } = car.turn
    return bezierAt(p0, p1, p2, t)
  }
  const p = pointAt(roads[car.roadIndex], car.s)
  const heading = car.dir > 0 ? p.angle : p.angle + Math.PI
  const off = carOffset(car)
  return {
    x: p.x + Math.cos(heading - Math.PI / 2) * off,
    y: p.y + Math.sin(heading - Math.PI / 2) * off,
    heading,
  }
}

// Rebuild the road network, carrying over which car holds which junction so a junction
// a car is driving through doesn't suddenly look free to everyone else.
function rebuildGraph(s) {
  const oldSignals = new Map(
    (s.graph?.nodes ?? []).filter((n) => n.signal).map((n) => [n.signal.light, n.signal]),
  )
  s.graph = buildGraph(s.roads, s.lights)
  // Keep each light where it was in its cycle, unless its program changed shape.
  for (const node of s.graph.nodes) {
    const old = node.signal && oldSignals.get(node.signal.light)
    if (old && old.mode === node.signal.mode && old.phases.length === node.signal.phases.length) {
      Object.assign(node.signal, { phase: old.phase, stage: old.stage, t: old.t })
    }
  }
  for (const car of s.cars) {
    if (!car.reserved) continue
    const old = car.reserved.node
    const node = s.graph.nodes.find(
      (n) => n.entries.length > 1 && Math.hypot(n.x - old.x, n.y - old.y) < MERGE_RADIUS,
    )
    if (node) {
      node.reservedBy = car
      car.reserved.node = node
    } else {
      car.reserved = null
    }
  }
}

function releaseJunction(car) {
  if (!car.reserved) return
  if (car.reserved.node.reservedBy === car) car.reserved.node.reservedBy = null
  car.reserved = null
}

// Distance a car needs to stop from its current speed.
const brakingDistance = (v) => (v * v) / (2 * BRAKE)

// Points along the route the car is about to drive (every PATH_STEP px, up to maxDist):
// the rest of its current turn, then its lane on the road, then — if it has planned
// the next junction — its lane on the road it will turn into. Each point carries the
// distance `d` from the car to it.
function pathAhead(car, roads, graph, maxDist) {
  const pts = []
  let d = 0

  if (car.turn) {
    const { turn } = car
    for (let dd = turn.d + PATH_STEP; dd < turn.length && d < maxDist; dd += PATH_STEP) {
      d += PATH_STEP
      const t = dd / turn.length
      const p = turn.kind === 'u' ? uTurnAt(turn, t) : bezierAt(turn.p0, turn.p1, turn.p2, t)
      pts.push({ x: p.x, y: p.y, d })
    }
  }

  let road = car.roadIndex
  let dir = car.dir
  let s = car.s
  let switched = false
  const js = graph.junctions[road] ?? []
  const next = dir > 0 ? js.find((j) => j.s > s + 1e-6) : js.findLast((j) => j.s < s - 1e-6)
  while (d < maxDist) {
    s += dir * PATH_STEP
    d += PATH_STEP
    // Crossing the junction we've planned for: continue along the road we'll take.
    if (!switched && next && car.plan?.node === next.node && car.plan.option &&
        (dir > 0 ? s >= next.s : s <= next.s)) {
      const o = car.plan.option
      road = o.road
      dir = o.dir
      s = o.s + o.dir * Math.abs(s - next.s)
      switched = true
    }
    if (s < 0 || s > roads[road].length) break // road ends here
    // Our target lane on this road; after a junction cars always come out in the kerb lane.
    const offset = switched ? laneOffset(0) : laneOffset(car.lane ?? 0)
    const p = carPose({ roadIndex: road, s, dir, offset }, roads)
    pts.push({ x: p.x, y: p.y, d })
  }
  return pts
}

// Never drive into another car that is on our route, whatever road it is on (crossing
// traffic, cars still clearing a junction, the queue on the road we're turning into).
// Only cars actually on the path count, so a car mid-turn isn't put off by cars waiting
// at the junction's other stop lines.
// Returns how much room there is before we'd be too close, and updates deadlock timers.
function roomInTraffic(car, dt, cars, roads, graph) {
  let room = Infinity
  if (car.ghost <= 0) {
    const lookahead = CAR_GAP + brakingDistance(car.speed) + 10
    const path = pathAhead(car, roads, graph, lookahead)
    const held = car.reserved?.node
    for (const other of cars) {
      if (other === car) continue
      // Cars queued at the stop line of a junction we hold are waiting for us, and sit
      // outside the box: don't let them block us, or we'd both wait forever.
      if (held && other.waitingFor === held) continue
      const o = other.pose
      for (const p of path) {
        if (p.d - CAR_GAP >= room) break // can't beat what we already found
        if (Math.hypot(p.x - o.x, p.y - o.y) < CAR_WIDTH_CLEARANCE) {
          room = p.d - CAR_GAP
          break
        }
      }
    }
  }

  // If two cars block each other for too long (e.g. both turning across each other),
  // let this one squeeze through briefly so traffic never freezes for good.
  if (room <= 0.5 && car.v < 1) {
    car.wait += dt
    if (car.wait > DEADLOCK_TIME) {
      car.ghost = 0.8
      car.wait = 0
    }
  } else {
    car.wait = 0
  }
  return room
}

// Ease the car's speed towards what the room ahead allows, and return how far it moves.
// Braking follows v = sqrt(2·BRAKE·room), so cars slow down smoothly and stop on the mark.
function advance(car, room, dt, maxSpeed = car.speed) {
  room = Math.max(0, room)
  const target = Math.min(maxSpeed, Math.sqrt(2 * BRAKE * room))
  car.v = car.v < target ? Math.min(target, car.v + ACCEL * dt) : target
  return Math.min(car.v * dt, room)
}

// The car has reached the start of a junction: pick where to go and set up the curve.
function startTurn(car, node, nodeS, roads, graph) {
  const p0 = carPose(car, roads)
  const before = { road: car.roadIndex, dir: car.dir, s: car.s }
  car.s = nodeS
  if (car.reserved?.node === node) car.reserved.passed = true
  const plan = car.plan?.node === node ? car.plan : null
  car.plan = null
  chooseNextRoad(car, node, roads, plan?.option)
  if (car.roadIndex === before.road && car.dir === -before.dir) {
    // No way on: loop round where we are instead.
    car.s = before.s
    car.dir = before.dir
    startUTurn(car, roads)
    return
  }

  // Exit point a short way down the new road, but never past its next junction.
  const road = roads[car.roadIndex]
  const js = graph.junctions[car.roadIndex]
  const after =
    car.dir > 0 ? js.find((j) => j.s > car.s + 1e-6) : js.findLast((j) => j.s < car.s - 1e-6)
  const room = after ? Math.abs(after.s - car.s) / 2 : car.dir > 0 ? road.length - car.s : car.s
  car.s += car.dir * Math.min(TURN_RADIUS, room)

  // Come out of the junction in the kerb lane (the curve absorbs any lane difference).
  car.lane = 0
  car.offset = laneOffset(0)
  car.turn = makeTurn(p0, carPose(car, roads), node)
  car.turn.straight = plan?.turn === 'straight' // no need to slow down going straight on
}

// Expects car.pose to be up to date for every car (set once per frame).
function moveCar(car, dt, roads, graph, cars) {
  car.v ??= 0
  car.ghost = Math.max(0, car.ghost - dt)
  car.waitingFor = null // set below if we're queued for an unsignalled junction
  car.approach = null // set below if a traffic light can see us coming

  // Free the junction we reserved once we're clear of its box.
  if (car.reserved?.passed) {
    const n = car.reserved.node
    if (Math.hypot(car.pose.x - n.x, car.pose.y - n.y) > STOP_GAP + 6) releaseJunction(car)
  }

  // Mid-turn: follow the curve, then carry on along the new road.
  if (car.turn) {
    const limit =
      car.turn.kind === 'u' ? U_TURN_SPEED : car.turn.straight ? car.speed : TURN_SPEED
    const maxSpeed = Math.min(car.speed, limit)
    car.turn.d += advance(car, roomInTraffic(car, dt, cars, roads, graph), dt, maxSpeed)
    if (car.turn.d >= car.turn.length) car.turn = null
    return
  }

  const js = graph.junctions[car.roadIndex]
  let room = Infinity // how far we can go before we must have stopped

  // Slide sideways towards our lane (lane changes, or the lane mode being switched).
  car.lane = Math.min(car.lane ?? 0, LANE_OFFSETS.length - 1)
  const targetOffset = laneOffset(car.lane)
  car.offset ??= targetOffset
  const sideways = targetOffset - car.offset
  car.offset += Math.sign(sideways) * Math.min(Math.abs(sideways), LANE_CHANGE_SPEED * dt)

  // Queue behind the nearest car ahead in our lane. A car halfway between lanes counts
  // for both, so nobody squeezes into a gap that isn't there yet.
  let leader = Infinity // distance to that car
  let leaderCar = null
  for (const other of cars) {
    if (other === car || other.turn) continue
    if (other.roadIndex !== car.roadIndex || other.dir !== car.dir) continue
    if (Math.abs(carOffset(other) - car.offset) >= 14) continue // in the other lane
    const d = (other.s - car.s) * car.dir
    if (d > 0.01 && d < leader) {
      leader = d
      leaderCar = other
    }
  }
  room = Math.min(room, leader - CAR_GAP)

  const next =
    car.dir > 0 ? js.find((j) => j.s > car.s + 1e-6) : js.findLast((j) => j.s < car.s - 1e-6)
  if (!next) {
    startUTurn(car, roads) // already at the very end of the road
    return
  }
  const gap = Math.abs(next.s - car.s)

  // Overtaking (multi-lane roads only). Keep left: pull out to the overtaking lane when
  // stuck behind a slower car, and move back to the kerb lane as soon as there's room.
  // No lane changes close to a junction.
  if (MULTI_LANE && car.offset === targetOffset) {
    const laneFree = (lane, back, front) =>
      !cars.some((o) => {
        if (o === car || o.turn || o.roadIndex !== car.roadIndex || o.dir !== car.dir) {
          return false
        }
        const near =
          Math.abs(carOffset(o) - laneOffset(lane)) < 14 ||
          Math.abs(laneOffset(o.lane ?? 0) - laneOffset(lane)) < 14
        const d = (o.s - car.s) * car.dir
        return near && d > back && d < front
      })
    const nearJunction = next.node.entries.length > 1 && gap < 110
    if (
      car.lane === 0 &&
      !nearJunction &&
      leaderCar &&
      leader < OVERTAKE_LOOK &&
      leaderCar.speed < car.speed - 8 &&
      laneFree(1, -35, 60)
    ) {
      car.lane = 1
    } else if (car.lane === 1 && laneFree(0, -35, 45)) {
      car.lane = 0
    }
  }
  const node = next.node
  const beforeLine = gap > STOP_GAP - 0.5 // cars already past the stop line keep going

  const toLine = gap - STOP_GAP

  // Know where we're going at the next junction before we get there.
  if (node.entries.length > 1 && car.plan?.node !== node) {
    car.plan = planRoute(car, node, next.s, roads)
  }

  // Traffic light: obey the light for our movement (turn arrows can differ from the main
  // green). Stop on red, and on yellow if there's room to stop comfortably.
  if (node.signal && beforeLine && car.plan?.arm >= 0) {
    if (gap < DETECT_RANGE) car.approach = { node, arm: car.plan.arm, turn: car.plan.turn }
    const state = signalFor(node.signal, car.plan.arm, car.plan.turn)
    if (state === 'red' || (state === 'yellow' && toLine >= brakingDistance(car.v) * 0.8)) {
      room = Math.min(room, toLine)
    }
  }

  // Junction without a light: one car in the junction box at a time, everyone else waits.
  // Check as soon as we'd need to start braking, so waiting cars ease to a stop.
  if (
    !node.signal &&
    node.entries.length > 1 &&
    beforeLine &&
    toLine < brakingDistance(car.v) + car.v * dt + 2
  ) {
    const holder = node.reservedBy
    const busy = holder && holder !== car && cars.includes(holder)
    // Only the front car of a queue may claim the junction; a car further back claiming
    // it would leave the front car stuck waiting for the car stuck behind it.
    const atFront = leader >= gap
    if (busy || (!atFront && car.reserved?.node !== node)) {
      room = Math.min(room, toLine)
      car.waitingFor = node
    } else {
      if (car.reserved && car.reserved.node !== node) releaseJunction(car)
      node.reservedBy = car
      car.reserved = { node, passed: false }
    }
  }

  room = Math.min(room, roomInTraffic(car, dt, cars, roads, graph))

  // Turns start a little before the junction centre; U-turn loops start just short of a
  // dead end so the loop fits inside the rounded road end.
  const isJunction = node.entries.length > 1
  const toTurn = gap - (isJunction ? TURN_RADIUS : U_TURN_BULGE + 3)

  // Ease off before a turn or dead end so the curve starts at a sensible speed.
  const turnSpeed = !isJunction
    ? U_TURN_SPEED
    : car.plan?.turn === 'straight'
      ? car.speed
      : TURN_SPEED
  const maxSpeed = Math.min(
    car.speed,
    Math.sqrt(turnSpeed * turnSpeed + 2 * BRAKE * Math.max(0, toTurn)),
  )
  const step = advance(car, room, dt, maxSpeed)

  if (toTurn > step) {
    car.s += car.dir * step
    return
  }
  car.s += car.dir * Math.max(0, toTurn)
  if (isJunction) startTurn(car, node, next.s, roads, graph)
  else startUTurn(car, roads)
}

// ---------- drawing ----------

function strokePath(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

// Background grid covering the visible part of the world; coarser when zoomed out.
function drawGrid(ctx, view, w, h) {
  let step = GRID
  while (step * view.scale < 20) step *= 2
  const left = -view.x / view.scale
  const top = -view.y / view.scale
  const right = left + w / view.scale
  const bottom = top + h / view.scale
  ctx.strokeStyle = 'rgba(39,39,42,0.7)'
  ctx.lineWidth = 1 / view.scale
  ctx.beginPath()
  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()
}

// A polyline shifted sideways by d (positive = left of the drawing direction), using the
// averaged normal at each corner so curves stay smooth.
function offsetPath(points, d) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: p.x + ((b.y - a.y) / len) * d, y: p.y - ((b.x - a.x) / len) * d }
  })
}

function drawNetwork(ctx, roads, graph) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])

  // Draw each layer for all roads before the next, so crossings blend into one surface.
  ctx.strokeStyle = '#3f3f46'
  ctx.lineWidth = ROAD_WIDTH + 4
  roads.forEach((r) => strokePath(ctx, r.points))
  ctx.strokeStyle = '#27272a'
  ctx.lineWidth = ROAD_WIDTH
  roads.forEach((r) => strokePath(ctx, r.points))
  if (MULTI_LANE) {
    // Solid centre line (no overtaking into oncoming traffic) and dashed white lane lines.
    ctx.strokeStyle = 'rgba(250,204,21,0.8)'
    ctx.lineWidth = 2
    roads.forEach((r) => strokePath(ctx, r.points))
    const divider = (LANE_OFFSETS[0] + LANE_OFFSETS[1]) / 2
    ctx.strokeStyle = 'rgba(244,244,245,0.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([8, 10])
    roads.forEach((r) => {
      strokePath(ctx, offsetPath(r.points, divider))
      strokePath(ctx, offsetPath(r.points, -divider))
    })
  } else {
    ctx.strokeStyle = 'rgba(250,204,21,0.7)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 10])
    roads.forEach((r) => strokePath(ctx, r.points))
  }
  ctx.setLineDash([])

  // Clear the lane lines out of junction boxes.
  ctx.fillStyle = '#27272a'
  for (const node of graph.nodes) {
    if (node.entries.length < 2) continue
    ctx.beginPath()
    ctx.arc(node.x, node.y, ROAD_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// One lamp of a signal head: an arrow pointing the way the movement goes.
function drawArrowLamp(ctx, x, y, heading, move, state) {
  const color = LIGHT_COLORS[state]
  ctx.fillStyle = '#09090b'
  ctx.beginPath()
  ctx.arc(x, y, 4.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heading + (move === 'left' ? -Math.PI / 2 : move === 'right' ? Math.PI / 2 : 0))
  ctx.fillStyle = color
  ctx.globalAlpha = state === 'red' ? 0.75 : 1
  if (state !== 'red') {
    ctx.shadowColor = color
    ctx.shadowBlur = 8
  }
  ctx.beginPath()
  ctx.moveTo(3.4, 0) // arrow head
  ctx.lineTo(0, -3)
  ctx.lineTo(0, -1.1)
  ctx.lineTo(-3, -1.1) // shaft
  ctx.lineTo(-3, 1.1)
  ctx.lineTo(0, 1.1)
  ctx.lineTo(0, 3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// For every arm into a signalled junction: a stop line and a signal head with one arrow
// lamp per movement possible from that arm (left / straight / right).
function drawSignals(ctx, roads, graph) {
  for (const node of graph.nodes) {
    const sig = node.signal
    if (!sig) continue
    node.arms.forEach((arm, i) => {
      const road = roads[arm.road]
      const stopS = arm.s - arm.dir * STOP_GAP
      if (stopS < 0 || stopS > road.length) return // arm too short for a stop line
      const p = pointAt(road, stopS)
      const heading = arm.dir > 0 ? p.angle : p.angle + Math.PI
      const lx = Math.cos(heading - Math.PI / 2) // towards the left kerb
      const ly = Math.sin(heading - Math.PI / 2)

      ctx.strokeStyle = 'rgba(244,244,245,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(p.x + lx * 1, p.y + ly * 1)
      ctx.lineTo(p.x + lx * (ROAD_WIDTH / 2 - 1), p.y + ly * (ROAD_WIDTH / 2 - 1))
      ctx.stroke()

      // Lamps in a row off the left kerb, read left-to-right by the driver:
      // the left arrow is outermost, the right arrow nearest the road.
      const moves = ALL_MOVES.filter((m) => arm.moves.has(m)).reverse()
      moves.forEach((move, k) => {
        const r = ROAD_WIDTH / 2 + 7 + k * 10
        drawArrowLamp(ctx, p.x + lx * r, p.y + ly * r, heading, move, signalFor(sig, i, move))
      })
    })
  }
}

// In traffic light mode, mark every junction that can take a light; ring the selected one.
function drawLightSpots(ctx, graph, time, selected) {
  ctx.lineWidth = 2
  for (const node of graph.nodes) {
    if (node.entries.length < 2) continue
    const isSelected = selected && node.signal?.light === selected
    ctx.setLineDash(isSelected ? [] : [4, 4])
    ctx.lineDashOffset = -time * 12
    ctx.strokeStyle = isSelected
      ? '#f4f4f5'
      : node.signal
        ? 'rgba(248,113,113,0.8)'
        : 'rgba(52,211,153,0.9)'
    ctx.beginPath()
    ctx.arc(node.x, node.y, ROAD_WIDTH / 2 + 4, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
}

function drawPreview(ctx, points) {
  if (points.length < 2) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(52,211,153,0.25)'
  ctx.lineWidth = ROAD_WIDTH
  strokePath(ctx, points)
}

function drawSnap(ctx, p) {
  ctx.strokeStyle = '#34d399'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p.x, p.y, ROAD_WIDTH / 2 + 2, 0, Math.PI * 2)
  ctx.stroke()
}

function drawCar(ctx, roads, car) {
  const { x, y, heading } = carPose(car, roads)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heading)
  ctx.fillStyle = car.color
  ctx.beginPath()
  ctx.roundRect(-9, -5, 18, 10, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(9,9,11,0.55)'
  ctx.fillRect(2, -4, 4, 8) // windshield
  ctx.fillStyle = '#fef9c3'
  ctx.fillRect(8, -4, 1.5, 2) // headlights
  ctx.fillRect(8, 2, 1.5, 2)
  ctx.restore()
}

// ---------- component ----------

function Traffic() {
  const canvasRef = useRef(null)
  const sim = useRef({
    roads: [],
    graph: { nodes: [], junctions: [] },
    cars: [],
    drawing: null,
    down: null,
    snap: null,
    time: 0, // simulation clock in seconds, drives the traffic lights
    lights: [], // placed traffic lights: { x, y, mode } of the junction they sit on
    selectedLight: null, // light being edited in the traffic light tool
    tool: 'road', // 'road' (draw roads / spawn vehicles), 'light' (place lights) or 'pan'
    view: { x: 0, y: 0, scale: 1 }, // screen = world * scale + (x, y)
    pointers: new Map(), // active pointers (screen coords), for two-finger pinch
    pinch: null,
    panning: null,
    space: false, // Space held: drag pans
    history: [], // actions that can be undone: { type: 'road' | 'car' | 'light' | 'clear', ... }
    future: [], // undone actions that can be redone
  })
  const [tool, setToolState] = useState('road')
  const [selected, setSelected] = useState(null) // { mode } of the selected traffic light
  const [zoom, setZoom] = useState(100)
  const [grabbing, setGrabbing] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [multiLane, setMultiLane] = useState(MULTI_LANE)

  // Switch every road between one lane and two lanes each way. Cars slide into the
  // matching lane on their own.
  const toggleLanes = () => {
    const next = !MULTI_LANE
    setLaneMode(next)
    setMultiLane(next)
    if (!next) for (const car of sim.current.cars) car.lane = 0
  }
  const [counts, setCounts] = useState({
    roads: 0,
    cars: 0,
    junctions: 0,
    lights: 0,
    canUndo: false,
    canRedo: false,
  })

  const setTool = (t) => {
    sim.current.tool = t
    setToolState(t)
    if (t !== 'light') {
      sim.current.selectedLight = null
      setSelected(null)
    }
  }

  const syncCounts = () => {
    const { roads, cars, graph, history, future, lights, selectedLight } = sim.current
    // Drop the selection if undo/redo/clear took that light away.
    const sel = selectedLight && lights.includes(selectedLight) ? selectedLight : null
    sim.current.selectedLight = sel
    setSelected(sel ? { mode: sel.mode } : null)
    setCounts({
      roads: roads.length,
      cars: cars.length,
      junctions: graph.nodes.filter((n) => n.entries.length > 1).length,
      lights: graph.nodes.filter((n) => n.signal).length,
      canUndo: history.length > 0,
      canRedo: future.length > 0,
    })
  }

  const record = (entry) => {
    sim.current.history.push(entry)
    sim.current.future = []
  }

  const undo = () => {
    const s = sim.current
    const entry = s.history.pop()
    if (!entry) return
    if (entry.type === 'road') {
      // Remove the newest road, and any vehicles currently on it.
      const index = s.roads.length - 1
      entry.road = s.roads.pop()
      entry.cars = s.cars.filter((c) => c.roadIndex === index)
      s.cars = s.cars.filter((c) => c.roadIndex !== index)
      rebuildGraph(s)
    } else if (entry.type === 'car') {
      s.cars = s.cars.filter((c) => c !== entry.car)
    } else if (entry.type === 'light') {
      s.lights = entry.added
        ? s.lights.filter((l) => l !== entry.light)
        : [...s.lights, entry.light]
      rebuildGraph(s)
    } else if (entry.type === 'lightMode') {
      entry.light.mode = entry.from
      rebuildGraph(s)
    } else if (entry.type === 'clear') {
      s.roads = entry.roads
      s.cars = entry.cars
      s.lights = entry.lights
      rebuildGraph(s)
    }
    s.future.push(entry)
    syncCounts()
  }

  const redo = () => {
    const s = sim.current
    const entry = s.future.pop()
    if (!entry) return
    if (entry.type === 'road') {
      s.roads.push(entry.road)
      s.cars.push(...entry.cars)
      rebuildGraph(s)
    } else if (entry.type === 'car') {
      s.cars.push(entry.car)
    } else if (entry.type === 'light') {
      s.lights = entry.added
        ? [...s.lights, entry.light]
        : s.lights.filter((l) => l !== entry.light)
      rebuildGraph(s)
    } else if (entry.type === 'lightMode') {
      entry.light.mode = entry.to
      rebuildGraph(s)
    } else if (entry.type === 'clear') {
      entry.roads = s.roads
      entry.cars = s.cars
      entry.lights = s.lights
      s.roads = []
      s.cars = []
      s.lights = []
      rebuildGraph(s)
    }
    s.history.push(entry)
    syncCounts()
  }

  // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes.
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault() // don't press the focused button
        sim.current.space = true
        setSpaceHeld(true)
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redoRef.current()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        sim.current.space = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let last = performance.now()
    let dpr = 1

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    // Scroll wheel / trackpad pinch zooms around the cursor.
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const speed = e.ctrlKey ? 0.01 : 0.0015 // trackpad pinch arrives as ctrl+wheel
      zoomAt(e.clientX, e.clientY, Math.exp(-delta * speed))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      sim.current.time += dt
      const { roads, graph, cars, drawing, snap, time, tool, view, selectedLight } = sim.current

      updateSignals(graph, cars, dt)
      for (const car of cars) car.pose = carPose(car, roads)
      for (const car of cars) moveCar(car, dt, roads, graph, cars)

      const w = window.innerWidth
      const h = window.innerHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // Everything below is drawn in world coordinates.
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y)
      drawGrid(ctx, view, w, h)
      drawNetwork(ctx, roads, graph)
      drawSignals(ctx, roads, graph)
      if (tool === 'light') drawLightSpots(ctx, graph, time, selectedLight)
      if (drawing) drawPreview(ctx, drawing)
      if (drawing && snap) drawSnap(ctx, snap)
      for (const car of cars) drawCar(ctx, roads, car)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('wheel', onWheel)
    }
    // zoomAt only touches refs and a state setter, so it is safe to capture once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- view: world <-> screen, zoom and pan ----
  const toWorld = (e) => {
    const v = sim.current.view
    return { x: (e.clientX - v.x) / v.scale, y: (e.clientY - v.y) / v.scale }
  }

  // Zoom by `factor`, keeping the world point under (sx, sy) fixed on screen.
  const zoomAt = (sx, sy, factor) => {
    const v = sim.current.view
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor))
    const wx = (sx - v.x) / v.scale
    const wy = (sy - v.y) / v.scale
    v.x = sx - wx * scale
    v.y = sy - wy * scale
    v.scale = scale
    setZoom(Math.round(scale * 100))
  }

  const resetView = () => {
    sim.current.view = { x: 0, y: 0, scale: 1 }
    setZoom(100)
  }

  const zoomCenter = (factor) => zoomAt(window.innerWidth / 2, window.innerHeight / 2, factor)

  // Traffic light tool: click a junction to add a light (and select it), click a light to
  // select it, click empty space to deselect.
  const toggleLightAt = (p) => {
    const s = sim.current
    let node = null
    let best = ROAD_WIDTH
    for (const n of s.graph.nodes) {
      if (n.entries.length < 2) continue
      const d = Math.hypot(n.x - p.x, n.y - p.y)
      if (d < best) {
        best = d
        node = n
      }
    }
    if (!node) {
      s.selectedLight = null
      syncCounts()
      return
    }
    const existing = s.lights.find(
      (l) => Math.hypot(l.x - node.x, l.y - node.y) < MERGE_RADIUS * 2,
    )
    if (existing) {
      s.selectedLight = existing
    } else {
      const light = { x: node.x, y: node.y, mode: 'arrow' }
      s.lights = [...s.lights, light]
      s.selectedLight = light
      record({ type: 'light', light, added: true })
      rebuildGraph(s)
    }
    syncCounts()
  }

  const setLightMode = (mode) => {
    const s = sim.current
    const light = s.selectedLight
    if (!light || light.mode === mode) return
    record({ type: 'lightMode', light, from: light.mode, to: mode })
    light.mode = mode
    rebuildGraph(s)
    syncCounts()
  }

  const removeSelectedLight = () => {
    const s = sim.current
    const light = s.selectedLight
    if (!light) return
    s.lights = s.lights.filter((l) => l !== light)
    record({ type: 'light', light, added: false })
    rebuildGraph(s)
    syncCounts()
  }

  // Two-finger touch: pinch to zoom, move both fingers to pan.
  const pinchState = () => {
    const [a, b] = [...sim.current.pointers.values()]
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onPointerDown = (e) => {
    const s = sim.current
    e.currentTarget.setPointerCapture(e.pointerId)
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (s.pointers.size === 2) {
      // Second finger down: abandon any road in progress and start pinching.
      s.drawing = null
      s.snap = null
      s.down = null
      s.panning = null
      s.pinch = pinchState()
      return
    }
    if (s.pointers.size > 2) return

    // Middle/right mouse button, Space held, or the Move tool: pan the view.
    if (e.button === 1 || e.button === 2 || s.space || s.tool === 'pan') {
      s.panning = { x: e.clientX, y: e.clientY }
      setGrabbing(true)
      return
    }

    const p = toWorld(e)
    if (s.tool === 'light') {
      toggleLightAt(p)
      return
    }
    const snapped = snapPoint(s.roads, p)
    s.down = { x: e.clientX, y: e.clientY } // screen coords, for click detection
    s.drawing = [snapped ? { x: snapped.x, y: snapped.y } : p]
    s.snap = snapped
  }

  const onPointerMove = (e) => {
    const s = sim.current
    if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (s.pinch && s.pointers.size >= 2) {
      const next = pinchState()
      zoomAt(next.mid.x, next.mid.y, next.dist / s.pinch.dist)
      s.view.x += next.mid.x - s.pinch.mid.x
      s.view.y += next.mid.y - s.pinch.mid.y
      s.pinch = next
      return
    }
    if (s.panning) {
      s.view.x += e.clientX - s.panning.x
      s.view.y += e.clientY - s.panning.y
      s.panning = { x: e.clientX, y: e.clientY }
      return
    }

    if (!s.drawing) return
    const p = toWorld(e)
    s.snap = snapPoint(s.roads, p)
    if (e.shiftKey) {
      // Shift held: straight line from the drag start to the pointer.
      s.drawing = [s.drawing[0], s.snap ? { x: s.snap.x, y: s.snap.y } : p]
      return
    }
    const prev = s.drawing[s.drawing.length - 1]
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= MIN_POINT_GAP) s.drawing.push(p)
  }

  const onPointerUp = (e) => {
    const s = sim.current
    s.pointers.delete(e.pointerId)
    if (s.pinch) {
      if (s.pointers.size < 2) s.pinch = null
      return
    }
    if (s.panning) {
      s.panning = null
      setGrabbing(false)
      return
    }

    const { down, drawing } = s
    s.drawing = null
    s.snap = null
    if (!down) return
    s.down = null
    const raw = toWorld(e)
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)

    if (moved < CLICK_TOLERANCE && drawing.length < 3) {
      // Click: spawn a car on the road under the pointer.
      const hit = hitRoad(s.roads, raw.x, raw.y)
      if (hit) {
        const car = {
          roadIndex: hit.roadIndex,
          s: hit.s,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: 60 + Math.random() * 60,
          color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
          v: 0, // current speed; car.speed is its cruising speed
          lane: 0, // 0 = kerb lane, 1 = overtaking lane (multi-lane roads)
          offset: laneOffset(0), // current sideways position, eases towards the lane's
          wait: 0, // seconds stuck behind another car
          ghost: 0, // seconds left of squeezing past (deadlock breaker)
          reserved: null, // unsignalled junction this car has claimed
        }
        // Don't spawn on top of another car.
        const pose = carPose(car, s.roads)
        const crowded = s.cars.some((c) => {
          const o = carPose(c, s.roads)
          return Math.hypot(o.x - pose.x, o.y - pose.y) < CAR_GAP - 4
        })
        if (!crowded) {
          s.cars.push(car)
          record({ type: 'car', car })
        }
      }
    } else {
      // Drag: commit the drawn road, snapping its end onto any nearby road.
      const snapped = snapPoint(s.roads, raw)
      const end = snapped ? { x: snapped.x, y: snapped.y } : raw
      let points
      if (e.shiftKey) {
        points = [drawing[0], end]
      } else {
        points = drawing.slice()
        const tail = points[points.length - 1]
        if (Math.hypot(end.x - tail.x, end.y - tail.y) < MIN_POINT_GAP / 2 && points.length > 1) {
          points[points.length - 1] = end
        } else {
          points.push(end)
        }
      }
      const road = makeRoad(points)
      if (road.length > 20) {
        s.roads.push(road)
        rebuildGraph(s)
        record({ type: 'road' })
      }
    }
    syncCounts()
  }

  const clearAll = () => {
    const s = sim.current
    if (s.roads.length === 0 && s.cars.length === 0 && s.lights.length === 0) return
    // Undo brings everything back.
    record({ type: 'clear', roads: s.roads, cars: s.cars, lights: s.lights })
    s.roads = []
    s.cars = []
    s.lights = []
    s.graph = { nodes: [], junctions: [] }
    syncCounts()
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 antialiased">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${
          grabbing
            ? 'cursor-grabbing'
            : spaceHeld || tool === 'pan'
              ? 'cursor-grab'
              : tool === 'light'
                ? 'cursor-pointer'
                : 'cursor-crosshair'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          const s = sim.current
          s.pointers.delete(e.pointerId)
          s.drawing = null
          s.snap = null
          s.down = null
          s.pinch = null
          s.panning = null
          setGrabbing(false)
        }}
        onContextMenu={(e) => e.preventDefault()} // right-drag pans
      />

      <div className="pointer-events-none absolute left-4 top-4 select-none">
        <h1 className="text-lg font-bold tracking-tight">Welcome to Traffic Simulator</h1>
        {tool === 'road' ? (
          <>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-emerald-400">Drag</span> to build a road (hold{' '}
              <span className="text-emerald-400">Shift</span> for straight) ·{' '}
              <span className="text-emerald-400">Click</span> a road to spawn a vehicle
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Start or end a road on another road to join them. Scroll or pinch to zoom; hold
              Space, or right-drag, to move around.
            </p>
          </>
        ) : tool === 'pan' ? (
          <p className="mt-1 text-sm text-zinc-400">
            <span className="text-emerald-400">Drag</span> to move around ·{' '}
            <span className="text-emerald-400">Scroll</span> or pinch to zoom
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-emerald-400">Click</span> a junction to place a traffic light ·
              click a light to change its program
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Each approach shows an arrow per direction. Lights are smart: they skip directions
              nobody is waiting for and hold green while cars keep coming.
            </p>
          </>
        )}
      </div>

      {/* Selected traffic light: program picker */}
      {tool === 'light' && selected && (
        <div className="absolute bottom-20 left-4 w-72 rounded-xl border border-zinc-800 bg-zinc-900/95 p-3 text-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Traffic light program</h2>
            <button
              onClick={() => {
                sim.current.selectedLight = null
                setSelected(null)
              }}
              className="text-zinc-500 hover:text-zinc-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1">
            {SIGNAL_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setLightMode(m.id)}
                className={`block w-full rounded-lg border px-3 py-2 text-left transition ${
                  selected.mode === m.id
                    ? 'border-emerald-400 bg-emerald-400/10'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <span
                  className={`block font-medium ${selected.mode === m.id ? 'text-emerald-400' : ''}`}
                >
                  {m.label}
                </span>
                <span className="block text-xs text-zinc-400">{m.hint}</span>
              </button>
            ))}
          </div>
          <button
            onClick={removeSelectedLight}
            className="mt-3 w-full rounded-lg border border-zinc-700 px-3 py-1.5 text-red-400 transition hover:border-red-400"
          >
            Remove light
          </button>
        </div>
      )}

      {/* Tool picker */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 text-sm backdrop-blur">
        {[
          { id: 'road', label: 'Road & vehicles' },
          { id: 'light', label: 'Traffic light' },
          { id: 'pan', label: 'Move' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition ${
              tool === t.id
                ? 'bg-emerald-400 text-zinc-950'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            {t.id === 'light' ? (
              <span className="flex flex-col gap-0.5 rounded-sm bg-zinc-950 p-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
            ) : t.id === 'pan' ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" />
              </svg>
            ) : (
              <span className="h-1 w-4 rounded-full bg-current" />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 text-sm backdrop-blur">
        <button
          onClick={() => zoomCenter(1 / 1.25)}
          title="Zoom out"
          className="h-8 w-8 rounded-lg font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          −
        </button>
        <button
          onClick={resetView}
          title="Reset view"
          className="w-14 rounded-lg py-1.5 font-mono text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          {zoom}%
        </button>
        <button
          onClick={() => zoomCenter(1.25)}
          title="Zoom in"
          className="h-8 w-8 rounded-lg font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          +
        </button>
      </div>

      <div className="absolute right-4 top-4 flex items-center gap-3 text-sm">
        <button
          role="switch"
          aria-checked={multiLane}
          onClick={toggleLanes}
          title="Two lanes each way, so faster cars can overtake"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 font-medium transition hover:border-emerald-400"
        >
          <span
            className={`relative h-4 w-7 rounded-full transition ${
              multiLane ? 'bg-emerald-400' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-zinc-950 transition-all ${
                multiLane ? 'left-3.5' : 'left-0.5'
              }`}
            />
          </span>
          Multi-lane
        </button>
        <span className="font-mono text-xs text-zinc-500">
          {counts.roads} roads · {counts.junctions} junctions · {counts.lights} lights ·{' '}
          {counts.cars} vehicles
        </span>
        <button
          onClick={undo}
          disabled={!counts.canUndo}
          title="Undo (Ctrl+Z)"
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 font-medium transition hover:border-emerald-400 hover:text-emerald-400 disabled:pointer-events-none disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!counts.canRedo}
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 font-medium transition hover:border-emerald-400 hover:text-emerald-400 disabled:pointer-events-none disabled:opacity-40"
        >
          Redo
        </button>
        <button
          onClick={clearAll}
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 font-medium transition hover:border-emerald-400 hover:text-emerald-400"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export default Traffic
