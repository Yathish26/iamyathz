import { useEffect, useRef, useState } from 'react'

const ROAD_WIDTH = 30
const LANE_OFFSET = 7
const MIN_POINT_GAP = 10
const CLICK_TOLERANCE = 5
const SNAP_RADIUS = ROAD_WIDTH * 0.8 // how close a road end must be to snap onto another road
const TOUCH_TOLERANCE = 3 // road ends this close to another road form a junction
const MERGE_RADIUS = 6 // junction points this close together become one node
const STOP_GAP = ROAD_WIDTH / 2 + 6 // stop line distance from the junction centre
const CAR_GAP = 24 // minimum bumper-to-bumper spacing (centre to centre) when queueing
const GREEN_TIME = 4 // seconds
const YELLOW_TIME = 1.2 // seconds
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

  // 5. Traffic lights on junctions where the user placed one.
  //    Each road through the junction gets its own green phase, in turn.
  for (const node of nodes) {
    if (node.entries.length < 2) continue
    if (!lights.some((l) => Math.hypot(l.x - node.x, l.y - node.y) < MERGE_RADIUS * 2)) continue
    const phases = node.entries.length
    const cycle = phases * (GREEN_TIME + YELLOW_TIME)
    // Offset from position so lights stay in step when the network is rebuilt.
    const offset = Math.abs(Math.round(node.x * 13 + node.y * 7)) % Math.round(cycle * 10) / 10
    node.signal = { phases, offset }
  }

  return { nodes, junctions }
}

// Light colour shown to traffic arriving along node.entries[entryIndex].
function signalState(node, entryIndex, time) {
  const phaseLen = GREEN_TIME + YELLOW_TIME
  const t = (time + node.signal.offset) % (phaseLen * node.signal.phases)
  const phase = Math.floor(t / phaseLen)
  if (phase !== entryIndex) return 'red'
  return t - phase * phaseLen < GREEN_TIME ? 'green' : 'yellow'
}

// A car arrives at a node: pick a random way onward (no U-turns unless it's a dead end).
function chooseNextRoad(car, node, roads) {
  const options = []
  for (const e of node.entries) {
    const len = roads[e.road].length
    for (const dir of [1, -1]) {
      if (dir > 0 ? e.s > len - 0.5 : e.s < 0.5) continue // nowhere to go that way
      const isUTurn = e.road === car.roadIndex && Math.abs(e.s - car.s) < 1 && dir === -car.dir
      if (!isUTurn) options.push({ road: e.road, s: e.s, dir })
    }
  }
  if (options.length === 0) {
    car.dir = -car.dir
    return
  }
  const pick = options[Math.floor(Math.random() * options.length)]
  car.roadIndex = pick.road
  car.s = pick.s
  car.dir = pick.dir
}

function moveCar(car, dt, roads, graph, cars, time) {
  const js = graph.junctions[car.roadIndex]
  let step = car.speed * dt

  // Queue behind the nearest car ahead in the same lane.
  let ahead = Infinity
  for (const other of cars) {
    if (other === car || other.roadIndex !== car.roadIndex || other.dir !== car.dir) continue
    const d = (other.s - car.s) * car.dir
    if (d > 0.01 && d < ahead) ahead = d
  }
  if (ahead < Infinity) step = Math.min(step, Math.max(0, ahead - CAR_GAP))

  const next =
    car.dir > 0 ? js.find((j) => j.s > car.s + 1e-6) : js.findLast((j) => j.s < car.s - 1e-6)
  if (!next) {
    car.dir = -car.dir
    return
  }
  const gap = Math.abs(next.s - car.s)

  // Stop at the line on red or yellow; cars already past the line keep going.
  const { signal, entries } = next.node
  if (signal && gap > STOP_GAP - 0.5) {
    const entryIndex = entries.findIndex(
      (e) => e.road === car.roadIndex && Math.abs(e.s - next.s) < 1,
    )
    if (entryIndex >= 0 && signalState(next.node, entryIndex, time) !== 'green') {
      step = Math.min(step, Math.max(0, gap - STOP_GAP))
    }
  }

  if (gap > step) {
    car.s += car.dir * step
    return
  }
  // Reached the next junction or road end: decide where to go from here.
  car.s = next.s
  chooseNextRoad(car, next.node, roads)
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
  ctx.strokeStyle = 'rgba(250,204,21,0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 10])
  roads.forEach((r) => strokePath(ctx, r.points))
  ctx.setLineDash([])

  // Clear the centre lines out of junction boxes.
  ctx.fillStyle = '#27272a'
  for (const node of graph.nodes) {
    if (node.entries.length < 2) continue
    ctx.beginPath()
    ctx.arc(node.x, node.y, ROAD_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// A stop line and light for every approach into each signalled junction.
function drawSignals(ctx, roads, graph, time) {
  for (const node of graph.nodes) {
    if (!node.signal) continue
    node.entries.forEach((e, i) => {
      const road = roads[e.road]
      const color = LIGHT_COLORS[signalState(node, i, time)]
      for (const dir of [1, -1]) {
        const stopS = e.s - dir * STOP_GAP
        if (stopS < 0 || stopS > road.length) continue // no road on that side
        const p = pointAt(road, stopS)
        const heading = dir > 0 ? p.angle : p.angle + Math.PI
        const lx = Math.cos(heading - Math.PI / 2) // towards the left kerb
        const ly = Math.sin(heading - Math.PI / 2)

        ctx.strokeStyle = 'rgba(244,244,245,0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p.x + lx * 1, p.y + ly * 1)
        ctx.lineTo(p.x + lx * (ROAD_WIDTH / 2 - 1), p.y + ly * (ROAD_WIDTH / 2 - 1))
        ctx.stroke()

        const r = ROAD_WIDTH / 2 + 7
        ctx.fillStyle = '#09090b'
        ctx.beginPath()
        ctx.arc(p.x + lx * r, p.y + ly * r, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(p.x + lx * r, p.y + ly * r, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    })
  }
}

// In traffic light mode, mark every junction that can take a light.
function drawLightSpots(ctx, graph, time) {
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = -time * 12
  for (const node of graph.nodes) {
    if (node.entries.length < 2) continue
    ctx.strokeStyle = node.signal ? 'rgba(248,113,113,0.8)' : 'rgba(52,211,153,0.9)'
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

function drawCar(ctx, road, car) {
  const p = pointAt(road, car.s)
  const heading = car.dir > 0 ? p.angle : p.angle + Math.PI
  // Keep left: shift to the left of the direction of travel.
  const ox = Math.cos(heading - Math.PI / 2) * LANE_OFFSET
  const oy = Math.sin(heading - Math.PI / 2) * LANE_OFFSET
  ctx.save()
  ctx.translate(p.x + ox, p.y + oy)
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
    lights: [], // placed traffic lights: { x, y } of the junction they sit on
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
  const [zoom, setZoom] = useState(100)
  const [grabbing, setGrabbing] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
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
  }

  const syncCounts = () => {
    const { roads, cars, graph, history, future } = sim.current
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
      s.graph = buildGraph(s.roads, s.lights)
    } else if (entry.type === 'car') {
      s.cars = s.cars.filter((c) => c !== entry.car)
    } else if (entry.type === 'light') {
      s.lights = entry.added
        ? s.lights.filter((l) => l !== entry.light)
        : [...s.lights, entry.light]
      s.graph = buildGraph(s.roads, s.lights)
    } else if (entry.type === 'clear') {
      s.roads = entry.roads
      s.cars = entry.cars
      s.lights = entry.lights
      s.graph = buildGraph(s.roads, s.lights)
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
      s.graph = buildGraph(s.roads, s.lights)
    } else if (entry.type === 'car') {
      s.cars.push(entry.car)
    } else if (entry.type === 'light') {
      s.lights = entry.added
        ? [...s.lights, entry.light]
        : s.lights.filter((l) => l !== entry.light)
      s.graph = buildGraph(s.roads, s.lights)
    } else if (entry.type === 'clear') {
      entry.roads = s.roads
      entry.cars = s.cars
      entry.lights = s.lights
      s.roads = []
      s.cars = []
      s.lights = []
      s.graph = buildGraph(s.roads, s.lights)
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
      const { roads, graph, cars, drawing, snap, time, tool, view } = sim.current

      for (const car of cars) moveCar(car, dt, roads, graph, cars, time)

      const w = window.innerWidth
      const h = window.innerHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // Everything below is drawn in world coordinates.
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y)
      drawGrid(ctx, view, w, h)
      drawNetwork(ctx, roads, graph)
      drawSignals(ctx, roads, graph, time)
      if (tool === 'light') drawLightSpots(ctx, graph, time)
      if (drawing) drawPreview(ctx, drawing)
      if (drawing && snap) drawSnap(ctx, snap)
      for (const car of cars) drawCar(ctx, roads[car.roadIndex], car)

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

  // Traffic light tool: click a junction to add a light, click again to remove it.
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
    if (!node) return
    const existing = s.lights.find(
      (l) => Math.hypot(l.x - node.x, l.y - node.y) < MERGE_RADIUS * 2,
    )
    if (existing) {
      s.lights = s.lights.filter((l) => l !== existing)
      record({ type: 'light', light: existing, added: false })
    } else {
      const light = { x: node.x, y: node.y }
      s.lights = [...s.lights, light]
      record({ type: 'light', light, added: true })
    }
    s.graph = buildGraph(s.roads, s.lights)
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
        }
        s.cars.push(car)
        record({ type: 'car', car })
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
        s.graph = buildGraph(s.roads, s.lights)
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
              click it again to remove
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Dashed rings mark junctions. Vehicles stop at red and yellow.
            </p>
          </>
        )}
      </div>

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
