import './style.css'

type Vec = { x: number; y: number }

type Mark = {
  x: number
  y: number
  radius: number
  color: string
}

type Boat = {
  pos: Vec
  vel: Vec
  heading: number
  angularVel: number
  sailTrim: number
  tack: 1 | -1
}

type RaceState = {
  marks: Mark[]
  nextMark: number
  lapsDone: number
  raceFinished: boolean
  finishTime: number | null
}

type SimState = {
  boat: Boat
  windDir: number
  windSpeed: number
  windShiftPhase: number
  tiller: number
  time: number
  race: RaceState
  splashText: string
}

const TAU = Math.PI * 2
const WORLD_W = 2400
const WORLD_H = 1800
const MARK_TOUCH = 52

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="app-shell">
    <div class="topbar">
      <div>
        <div class="title">Sailing Sim</div>
        <div class="subtitle">Browser-based top-down prototype. Believable wind, simple trim, marks, and tacking that actually matters.</div>
      </div>
      <div class="topbar-right">
        <div class="pill" id="status-pill">Ready</div>
        <div class="pill">V1: one boat, one lap, shifting breeze</div>
      </div>
    </div>
    <div class="main">
      <div class="stack">
        <div class="panel">
          <div class="panel-title">Controls</div>
          <ul class="controls-list">
            <li><strong>← / →</strong> steer</li>
            <li><strong>↑ / ↓</strong> trim sail in / ease out</li>
            <li><strong>R</strong> reset race</li>
            <li><strong>Space</strong> center camera on boat</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-title">What this prototype is modeling</div>
          <ul class="legend">
            <li>No-go zone upwind</li>
            <li>Trim efficiency depends on apparent wind angle</li>
            <li>Keel reduces sideways slip but not perfectly</li>
            <li>Rudder turns better when water is flowing past the hull</li>
            <li>Wind oscillates slowly, so headers/lifts are a thing</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-title">Telemetry</div>
          <div class="kpis">
            <div class="kpi"><div class="kpi-label">Boat speed</div><div class="kpi-value" id="kpi-speed">0.0 kt</div></div>
            <div class="kpi"><div class="kpi-label">Heading</div><div class="kpi-value" id="kpi-heading">000°</div></div>
            <div class="kpi"><div class="kpi-label">Wind</div><div class="kpi-value" id="kpi-wind">000°</div></div>
            <div class="kpi"><div class="kpi-label">VMG</div><div class="kpi-value" id="kpi-vmg">0.0 kt</div></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Notes</div>
          <ul class="notes">
            <li>Green ring = next mark.</li>
            <li>Dashed white line = course to next mark.</li>
            <li>Yellow wedge at bow = no-go zone preview.</li>
            <li>The goal is feel, not naval architecture purity.</li>
          </ul>
          <div class="btn-row" style="margin-top:12px;">
            <button id="reset-btn">Reset race</button>
            <button class="secondary" id="wind-btn">New wind seed</button>
          </div>
        </div>
      </div>

      <div class="viewport-wrap">
        <div class="canvas-shell panel">
          <canvas id="game"></canvas>
          <div class="overlay" id="overlay"><strong>Reach the green mark.</strong> Trim in on reaches, ease on runs, tack upwind.</div>
        </div>
      </div>
    </div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!
const overlay = document.querySelector<HTMLDivElement>('#overlay')!
const statusPill = document.querySelector<HTMLDivElement>('#status-pill')!
const kpiSpeed = document.querySelector<HTMLDivElement>('#kpi-speed')!
const kpiHeading = document.querySelector<HTMLDivElement>('#kpi-heading')!
const kpiWind = document.querySelector<HTMLDivElement>('#kpi-wind')!
const kpiVmg = document.querySelector<HTMLDivElement>('#kpi-vmg')!

const keys = new Set<string>()
const camera = { x: WORLD_W / 2, y: WORLD_H / 2 }

function vec(x: number, y: number): Vec {
  return { x, y }
}

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

function mul(v: Vec, s: number): Vec {
  return { x: v.x * s, y: v.y * s }
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y
}

function len(v: Vec): number {
  return Math.hypot(v.x, v.y)
}

function normalize(v: Vec): Vec {
  const l = len(v) || 1
  return { x: v.x / l, y: v.y / l }
}

function fromAngle(angle: number): Vec {
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function normalizeAngle(a: number): number {
  while (a <= -Math.PI) a += TAU
  while (a > Math.PI) a -= TAU
  return a
}

function degrees(rad: number): number {
  return ((rad * 180) / Math.PI + 360) % 360
}

function headingToUi(rad: number): string {
  return `${String(Math.round((90 - degrees(rad) + 360) % 360)).padStart(3, '0')}°`
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function makeRace(): RaceState {
  return {
    marks: [
      { x: 520, y: 420, radius: 24, color: '#ffb84d' },
      { x: 1880, y: 520, radius: 24, color: '#ff785a' },
      { x: 1720, y: 1340, radius: 24, color: '#74d99f' },
      { x: 560, y: 1240, radius: 24, color: '#7ac7ff' },
    ],
    nextMark: 0,
    lapsDone: 0,
    raceFinished: false,
    finishTime: null,
  }
}

function createState(seedShift = Math.random() * TAU): SimState {
  return {
    boat: {
      pos: vec(360, 940),
      vel: vec(0, 0),
      heading: -0.25,
      angularVel: 0,
      sailTrim: 0.58,
      tack: 1,
    },
    windDir: -1.0,
    windSpeed: 16,
    windShiftPhase: seedShift,
    tiller: 0,
    time: 0,
    race: makeRace(),
    splashText: 'Sail the course. Upwind legs should make you work for it.',
  }
}

let state = createState()

function resetRace(newWind = false): void {
  state = createState(newWind ? Math.random() * TAU : state.windShiftPhase)
  centerCamera(true)
}

function centerCamera(snap = false): void {
  if (snap) {
    camera.x = state.boat.pos.x
    camera.y = state.boat.pos.y
    return
  }
  camera.x = lerp(camera.x, state.boat.pos.x, 0.15)
  camera.y = lerp(camera.y, state.boat.pos.y, 0.15)
}

function getWindDir(t: number): number {
  return state.windDir + Math.sin(t * 0.08 + state.windShiftPhase) * 0.38 + Math.sin(t * 0.023 + state.windShiftPhase * 0.7) * 0.14
}

function update(dt: number): void {
  state.time += dt

  if (keys.has('ArrowLeft')) state.tiller -= dt * 2.2
  if (keys.has('ArrowRight')) state.tiller += dt * 2.2
  if (!keys.has('ArrowLeft') && !keys.has('ArrowRight')) state.tiller *= Math.pow(0.0001, dt)
  state.tiller = clamp(state.tiller, -1, 1)

  if (keys.has('ArrowUp')) state.boat.sailTrim += dt * 0.6
  if (keys.has('ArrowDown')) state.boat.sailTrim -= dt * 0.6
  state.boat.sailTrim = clamp(state.boat.sailTrim, 0.05, 1)

  const boat = state.boat
  const headingVec = fromAngle(boat.heading)
  const portVec = fromAngle(boat.heading - Math.PI / 2)
  const starboardVec = fromAngle(boat.heading + Math.PI / 2)
  const windDir = getWindDir(state.time)
  const trueWind = mul(fromAngle(windDir), state.windSpeed)
  const apparent = sub(trueWind, boat.vel)
  const appSpeed = len(apparent)
  const appDir = Math.atan2(apparent.y, apparent.x)
  const relWind = normalizeAngle(appDir - boat.heading)
  boat.tack = relWind >= 0 ? 1 : -1

  const absRel = Math.abs(relWind)
  const noGo = 0.7
  const driveWindow = clamp((absRel - noGo) / (Math.PI - noGo), 0, 1)
  const idealTrim = clamp((absRel - 0.35) / (Math.PI - 0.35), 0.08, 1)
  const trimError = Math.abs(boat.sailTrim - idealTrim)
  const trimEfficiency = Math.max(0, 1 - trimError * 1.8)
  const sailDrive = driveWindow * trimEfficiency

  const forwardForce = headingVec
  const sideSign = relWind >= 0 ? -1 : 1
  const sideForceDir = sideSign > 0 ? starboardVec : portVec

  const sailForceMag = appSpeed * appSpeed * 0.018 * sailDrive
  const sideForceMag = appSpeed * appSpeed * 0.010 * sailDrive * (1.15 - Math.abs(Math.cos(relWind)))

  const velocityForward = dot(boat.vel, headingVec)
  const velocitySide = dot(boat.vel, starboardVec)

  const keelGrip = clamp(0.35 + Math.abs(Math.sin(relWind)) * 0.85, 0.35, 1.05)
  const lateralDrag = mul(starboardVec, -velocitySide * (2.8 + keelGrip * 2.5))
  const hullDrag = mul(boat.vel, -(0.22 + len(boat.vel) * 0.018))
  const rudderTurn = state.tiller * clamp(Math.abs(velocityForward) / 8, 0, 1) * 2.2
  const weatherHelm = sideForceMag * (boat.tack === 1 ? 1 : -1) * 0.006

  const force = add(
    add(mul(forwardForce, sailForceMag), mul(sideForceDir, sideForceMag)),
    add(lateralDrag, hullDrag),
  )

  boat.vel = add(boat.vel, mul(force, dt))
  boat.pos = add(boat.pos, mul(boat.vel, dt * 22))
  boat.angularVel += (rudderTurn + weatherHelm - boat.angularVel * 1.9) * dt
  boat.heading = normalizeAngle(boat.heading + boat.angularVel * dt)

  boat.pos.x = clamp(boat.pos.x, 40, WORLD_W - 40)
  boat.pos.y = clamp(boat.pos.y, 40, WORLD_H - 40)

  const race = state.race
  if (!race.raceFinished) {
    const mark = race.marks[race.nextMark]
    if (distance(boat.pos, mark) <= MARK_TOUCH) {
      race.nextMark += 1
      state.splashText = `Mark ${race.nextMark} rounded.`
      if (race.nextMark >= race.marks.length) {
        race.raceFinished = true
        race.finishTime = state.time
        state.splashText = `Finished in ${state.time.toFixed(1)}s. Not bad.`
      }
    }
  }

  centerCamera()
  updateHud(relWind, windDir)
}

function updateHud(relWind: number, windDir: number): void {
  const boat = state.boat
  const mark = state.race.marks[Math.min(state.race.nextMark, state.race.marks.length - 1)]
  const toMark = normalize(sub(mark, boat.pos))
  const vmg = dot(boat.vel, toMark)
  kpiSpeed.textContent = `${(len(boat.vel) * 1.45).toFixed(1)} kt`
  kpiHeading.textContent = headingToUi(boat.heading)
  kpiWind.textContent = `${headingToUi(windDir)} / ${state.windSpeed.toFixed(0)} kt`
  kpiVmg.textContent = `${(vmg * 1.45).toFixed(1)} kt`

  const absRelDeg = Math.round(Math.abs((relWind * 180) / Math.PI))
  statusPill.textContent = state.race.raceFinished
    ? 'Finished'
    : absRelDeg < 45
      ? 'Pinching / no-go risk'
      : absRelDeg < 110
        ? 'Powered up'
        : 'Running deep'

  overlay.innerHTML = `<strong>${state.splashText}</strong> Next mark: ${state.race.raceFinished ? 'complete' : state.race.nextMark + 1 + ' / ' + state.race.marks.length}. Sail trim ${(boat.sailTrim * 100).toFixed(0)}%.`
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function worldToScreen(p: Vec): Vec {
  return {
    x: p.x - camera.x + canvas.clientWidth / 2,
    y: p.y - camera.y + canvas.clientHeight / 2,
  }
}

function drawGrid(): void {
  const step = 120
  const x0 = camera.x - canvas.clientWidth / 2
  const y0 = camera.y - canvas.clientHeight / 2
  const startX = Math.floor(x0 / step) * step
  const startY = Math.floor(y0 / step) * step

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let x = startX; x < x0 + canvas.clientWidth + step; x += step) {
    const sx = x - x0
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, canvas.clientHeight)
    ctx.stroke()
  }
  for (let y = startY; y < y0 + canvas.clientHeight + step; y += step) {
    const sy = y - y0
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(canvas.clientWidth, sy)
    ctx.stroke()
  }
}

function drawWindField(windDir: number): void {
  const dir = fromAngle(windDir)
  ctx.strokeStyle = 'rgba(230, 244, 255, 0.18)'
  ctx.lineWidth = 1.5
  for (let y = 70; y < canvas.clientHeight; y += 120) {
    for (let x = 70; x < canvas.clientWidth; x += 120) {
      const dx = dir.x * 18
      const dy = dir.y * 18
      ctx.beginPath()
      ctx.moveTo(x - dx, y - dy)
      ctx.lineTo(x + dx, y + dy)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + dx, y + dy)
      ctx.lineTo(x + dx - dir.x * 8 + dir.y * 5, y + dy - dir.y * 8 - dir.x * 5)
      ctx.moveTo(x + dx, y + dy)
      ctx.lineTo(x + dx - dir.x * 8 - dir.y * 5, y + dy - dir.y * 8 + dir.x * 5)
      ctx.stroke()
    }
  }
}

function drawCourse(): void {
  const race = state.race
  race.marks.forEach((mark, i) => {
    const s = worldToScreen(mark)
    ctx.beginPath()
    ctx.arc(s.x, s.y, mark.radius, 0, TAU)
    ctx.fillStyle = mark.color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(s.x, s.y, MARK_TOUCH, 0, TAU)
    ctx.strokeStyle = i === race.nextMark && !race.raceFinished ? 'rgba(140,255,188,0.95)' : 'rgba(255,255,255,0.15)'
    ctx.lineWidth = i === race.nextMark ? 3 : 1
    ctx.stroke()

    ctx.fillStyle = '#06111b'
    ctx.font = 'bold 16px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), s.x, s.y)
  })

  if (!race.raceFinished) {
    const next = worldToScreen(race.marks[race.nextMark])
    const boat = worldToScreen(state.boat.pos)
    ctx.setLineDash([10, 8])
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boat.x, boat.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawBoat(windDir: number): void {
  const boat = state.boat
  const p = worldToScreen(boat.pos)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(boat.heading)

  ctx.fillStyle = 'rgba(255, 212, 77, 0.12)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, 86, -0.7, 0.7)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#dbf0ff'
  ctx.lineWidth = 3
  ctx.fillStyle = '#f5fbff'
  ctx.beginPath()
  ctx.moveTo(24, 0)
  ctx.lineTo(-18, -12)
  ctx.lineTo(-28, 0)
  ctx.lineTo(-18, 12)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#9bd4ff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.lineTo(-8 - 26 * boat.sailTrim, 32 * boat.tack)
  ctx.stroke()

  ctx.strokeStyle = '#7ce3ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(-2, -20)
  ctx.stroke()

  ctx.restore()

  const w = worldToScreen(add(boat.pos, mul(fromAngle(windDir), 120)))
  ctx.strokeStyle = '#d7f0ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
  ctx.lineTo(w.x, w.y)
  ctx.stroke()
}

function drawHudCompass(windDir: number): void {
  const cx = canvas.clientWidth - 92
  const cy = 92
  ctx.beginPath()
  ctx.arc(cx, cy, 52, 0, TAU)
  ctx.fillStyle = 'rgba(5, 16, 27, 0.6)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 2
  ctx.stroke()

  const drawNeedle = (dir: number, color: string, label: string) => {
    const v = fromAngle(dir)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - v.x * 8, cy - v.y * 8)
    ctx.lineTo(cx + v.x * 38, cy + v.y * 38)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText(label, cx + v.x * 46 - 8, cy + v.y * 46 + 4)
  }

  drawNeedle(state.boat.heading, '#7ac7ff', 'B')
  drawNeedle(windDir + Math.PI, '#ffd86a', 'W')
}

function render(): void {
  const windDir = getWindDir(state.time)
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

  const water = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight)
  water.addColorStop(0, '#0e4767')
  water.addColorStop(1, '#0a2d42')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

  drawGrid()
  drawWindField(windDir)
  drawCourse()
  drawBoat(windDir)
  drawHudCompass(windDir)
}

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  update(dt)
  render()
  requestAnimationFrame(frame)
}

window.addEventListener('keydown', (e) => {
  keys.add(e.key)
  if (e.key === 'r' || e.key === 'R') resetRace(false)
  if (e.key === ' ') {
    centerCamera(true)
    e.preventDefault()
  }
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.key)
})
window.addEventListener('resize', resize)

document.querySelector<HTMLButtonElement>('#reset-btn')!.addEventListener('click', () => resetRace(false))
document.querySelector<HTMLButtonElement>('#wind-btn')!.addEventListener('click', () => resetRace(true))

resize()
centerCamera(true)
requestAnimationFrame(frame)
