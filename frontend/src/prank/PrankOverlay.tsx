import { useCallback, useEffect, useRef, useState } from 'react'
import { SALA_IMAGES, SENAR_IMAGES, salaUrl, senarUrl } from './salaImages'
import { usePrank } from './PrankContext'
import CmdWindow from './CmdWindow'
import { TIMING } from './timings'

type Phase = 'idle' | 'aviso' | 'green' | 'hack'

interface Win {
  id: number
  file: string
  url: string
  x: number
  y: number
  z: number
  w: number
}

const WIN_W = 300

const WIN_H = 260

const GRID_COL_W = 290

const GRID_ROW_H = 230

const SPAWN_MAX = 50

const SPAWN_FIRST_MS = 500

const INITIAL_COUNT = 10

const MID_COUNT = 30

const END_COUNT = 50

const SEED_COUNT = 8

const GREEN_MSGS = [
  'Windows Update: instalando actualizaciones 13 de 48',
  'Preparando Windows... no apague el equipo',
  'Configurando dispositivos: teclado y mouse',
  'Verificando el disco C: 84% completado',
  'Microsoft Defender: analizando el sistema',
  'Aplicando la configuracion de seguridad del equipo',
  'Windows terminara de configurarse en unos segundos',
]

const MAP_EMBED = 'https://maps.google.com/maps?q=-11.846935%2C-77.100032&z=17&t=k&output=embed'

const MAPS_TARGET = 'https://www.google.com/maps?q=Distrito+de+Independencia,+Lima&hl=es'

const SOUND_SRC = '/aud/ms.mp3'

const NOTEPAD_MSG = 'EL TRABAJO A SIDO COMPLETADO'

const JUMP_SRC = '/eps/eps.jpeg'

const JUMP_SND = '/jumps%20de%20jefree/Jumpscare%20Sound.mp3'

const TERROR_SPOTS = [
  { text: 'لا تنظر خلفك', left: '5%', top: '9%' },
  { text: 'أنت لست وحدك هنا', left: '58%', top: '7%' },
  { text: 'عين تراقبك الآن', left: '7%', top: '37%' },
  { text: 'خلفك... خلفك...', left: '64%', top: '33%' },
  { text: 'لا تستطيع الهرب', left: '5%', top: '70%' },
  { text: 'بياناتك لنا', left: '61%', top: '65%' },
  { text: 'سنصل إليك قريباً', left: '32%', top: '19%' },
  { text: 'النهاية اقتربت', left: '37%', top: '77%' },
  { text: 'البرج يسقط', left: '22%', top: '52%' },
  { text: 'دمار سيناتي بدأ', left: '74%', top: '52%' },
  { text: 'أبراج سيناتي تشتعل', left: '46%', top: '4%' },
  { text: 'المعهد في خطر', left: '44%', top: '87%' },
]

const TERROR_CORE = [
  'لا مخرج',
  'خرج!',
  'الشيطان هنا',
  'روحك تُسرق',
  'لا تغلق الشاشة',
  'البرج يسقط الآن',
  'الهدم يبدأ',
  'سيناتي ستسقط',
]

const CSS = `.prank-tint{position:fixed;inset:0;pointer-events:none;z-index:9990;background:repeating-linear-gradient(45deg,rgba(196,12,12,.4) 0 70px,rgba(0,150,62,.4) 70px 140px)}
.prank-tint--s2{animation:prank-tint-pulse 1.4s ease-in-out infinite alternate}
.prank-tint--s3{background:repeating-linear-gradient(45deg,rgba(196,12,12,.55) 0 70px,rgba(0,150,62,.55) 70px 140px);animation:prank-tint-pulse .7s ease-in-out infinite alternate}
.prank-tint--s4{background:repeating-linear-gradient(45deg,rgba(196,12,12,.62) 0 70px,rgba(0,150,62,.62) 70px 140px);animation:prank-tint-pulse .45s ease-in-out infinite alternate}
.prank-win{position:fixed;display:flex;flex-direction:column;width:300px;max-width:92vw;background:#0b1220;border:1px solid #334155;border-radius:10px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55);font-family:system-ui,-apple-system,sans-serif;animation:prank-pop .16s ease-out}
.prank-win__bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;background:#1e293b;cursor:grab;touch-action:none;user-select:none}
.prank-win__bar:active{cursor:grabbing}
.prank-win__title{color:#94a3b8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prank-win__close{flex:none;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:#ef4444;color:#fff;font-size:12px;line-height:20px;text-align:center;cursor:pointer}
.prank-win__close:hover{background:#dc2626}
.prank-win--ad{background:#000;border:0;cursor:pointer}
.prank-win__img{display:block;width:100%;height:220px;object-fit:contain;background:#000;pointer-events:none}
.prank-win--cmd .prank-win__bar{background:#27272a;cursor:default}
.prank-win--cmd1{left:max(12px,3vw);top:6vh;width:min(620px,94vw)}
.prank-win--cmd2{right:max(12px,3vw);top:5vh;width:min(480px,92vw)}
.prank-win--cmd3{left:max(16px,18vw);bottom:4vh;width:min(560px,92vw)}
.prank-win--cmd4{left:24vw;top:30vh;width:min(520px,92vw)}
.prank-win--cmd5{right:22vw;top:38vh;width:min(470px,92vw)}
.prank-win--cmd6{left:5vw;top:46vh;width:min(500px,92vw)}
.prank-win--cmd7{right:5vw;top:12vh;width:min(460px,92vw)}
.prank-win--map{right:max(12px,3vw);bottom:5vh;width:min(400px,92vw)}
.prank-win--map .prank-win__bar{background:#14532d;cursor:default}
.prank-win--notepad{left:50%;top:42%;transform:translate(-50%,-50%);width:min(600px,92vw);background:#fff;border:1px solid #9a9a9a;box-shadow:0 26px 60px rgba(0,0,0,.5)}
.prank-win--notepad .prank-win__bar{background:#e8eaed;cursor:default}
.prank-win--notepad .prank-win__title{color:#1f2328;font-weight:600}
.prank-notepad__menu{display:flex;gap:16px;padding:5px 12px;background:#f6f7f8;border-bottom:1px solid #d6d9dd;color:#1f2328;font-size:12px}
.prank-notepad__body{padding:16px 18px;min-height:170px;background:#fff;color:#101010;font-family:'Lucida Console',Consolas,monospace;font-size:clamp(16px,2.6vw,24px);line-height:1.5;white-space:pre-wrap;word-break:break-word}
.prank-jumpscare{position:fixed;inset:0;margin:0;padding:0;line-height:0;background:#000;border:0;overflow:hidden}
.prank-jumpscare--scare{animation:prank-jump-shake .1s step-end infinite}
.prank-jumpscare img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;object-fit:contain;filter:contrast(1.35) saturate(1.25)}
.prank-jumpscare::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at center,transparent 26%,rgba(130,0,0,.62))}
.prank-jumpscare--scare::after{animation:prank-jump-pulse .3s steps(2,start) infinite}
.prank-jumpscare--f1 img{filter:invert(1) contrast(1.7)}
.prank-jumpscare--f2{background:#000}
.prank-jumpscare--f2 img{opacity:0}
.prank-jumpscare--f3{background:#3d0000}
.prank-jumpscare--f3 img{filter:sepia(.55) hue-rotate(300deg) saturate(4) contrast(1.55) brightness(1.1)}
.prank-console{height:330px;overflow-y:auto;background:#0c0c0c;padding:10px 12px;font-family:Consolas,'Cascadia Mono','Courier New',monospace;font-size:13px;line-height:1.5;color:#4ade80;white-space:pre-wrap;word-break:break-word}
.prank-win--cmd2 .prank-console{height:240px}
.prank-win--cmd3 .prank-console{height:260px}
.prank-win--cmd4 .prank-console,.prank-win--cmd6 .prank-console{height:240px}
.prank-win--cmd5 .prank-console,.prank-win--cmd7 .prank-console{height:220px}
.prank-console__line{min-height:19px}
.prank-cursor{display:inline-block;width:9px;height:15px;background:#4ade80;vertical-align:-2px;animation:prank-blink 1s steps(2,start) infinite}
.prank-map{display:block;width:100%;height:300px;border:0;background:#0c0c0c}
.prank-aviso{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,6,23,.82);font-family:system-ui,-apple-system,sans-serif}
.prank-aviso__box{max-width:min(760px,92vw);padding:26px 32px;text-align:center;background:#0f172a;border:2px solid #22c55e;border-radius:14px;box-shadow:0 0 40px rgba(34,197,94,.45);animation:prank-shake .3s ease-in-out infinite}
.prank-aviso__title{margin:0 0 10px;color:#4ade80;font-size:clamp(22px,4.4vw,46px);font-weight:900;letter-spacing:1px}
.prank-aviso__sub{margin:0;color:#e2e8f0;font-size:clamp(13px,2.2vw,20px);font-weight:600}
.prank-green{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:24px;background:#00e676;color:#04210f;font-family:'Courier New',Courier,monospace;text-align:center}
.prank-green__title{margin:0;font-size:clamp(30px,8vw,110px);font-weight:900;line-height:1.05;text-transform:uppercase;animation:prank-blink 1s steps(2,start) infinite}
.prank-green__track{width:min(620px,86vw);height:28px;overflow:hidden;background:rgba(4,33,15,.18);border:3px solid #04210f;border-radius:999px}
.prank-green__fill{display:block;width:45%;height:100%;background:#04210f;animation:prank-load 1.6s linear infinite}
.prank-green__sub{margin:0;font-size:clamp(14px,3vw,26px);font-weight:700}
.prank-terror{position:fixed;inset:0;pointer-events:none;overflow:hidden;background:repeating-linear-gradient(45deg,rgba(0,0,0,.42) 0 60px,rgba(70,0,0,.36) 60px 120px);font-family:'Segoe UI',system-ui,sans-serif}
.prank-terror--lite{background:repeating-linear-gradient(45deg,rgba(0,0,0,.26) 0 60px,rgba(70,0,0,.2) 60px 120px)}
.prank-terror--lite .prank-terror__word{font-size:clamp(18px,3vw,38px);animation:prank-pulse-lite 2.2s ease-in-out infinite alternate}
.prank-terror--early{background:repeating-linear-gradient(45deg,rgba(0,0,0,.16) 0 60px,rgba(70,0,0,.12) 60px 120px)}
.prank-terror--early .prank-terror__word{font-size:clamp(15px,2.4vw,30px);animation:prank-pulse-lite 3s ease-in-out infinite alternate}
.prank-terror__flash{position:absolute;inset:0;background:rgba(130,0,0,.5);animation:prank-strobe .24s step-end infinite}
.prank-terror__word{position:absolute;font-size:clamp(22px,4vw,52px);font-weight:900;color:#ff3b30;text-shadow:0 0 14px rgba(255,0,0,.85),0 0 44px rgba(255,0,0,.5);white-space:nowrap;transform:rotate(-7deg);animation:prank-pulse 1.1s ease-in-out infinite alternate}
.prank-terror__core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;font-size:clamp(44px,11vw,150px);font-weight:900;color:#00ff88;text-shadow:0 0 22px rgba(0,255,120,.9),0 0 60px rgba(0,255,120,.5);white-space:nowrap;animation:prank-blink .5s steps(2,start) infinite,prank-core 1.6s ease-in-out infinite alternate}
.prank-win--quake{animation:prank-quake .16s linear infinite}
@keyframes prank-pop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes prank-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-4px,2px)}75%{transform:translate(4px,-2px)}}
@keyframes prank-blink{50%{opacity:.3}}
@keyframes prank-load{from{transform:translateX(-120%)}to{transform:translateX(340%)}}
@keyframes prank-strobe{from{background:rgba(130,0,0,.52)}to{background:rgba(0,95,48,.46)}}
@keyframes prank-pulse{from{opacity:.35;transform:rotate(-7deg) scale(.94)}to{opacity:1;transform:rotate(6deg) scale(1.06)}}
@keyframes prank-pulse-lite{from{opacity:.2;transform:rotate(-7deg) scale(.96)}to{opacity:.7;transform:rotate(4deg) scale(1.02)}}
@keyframes prank-tint-pulse{from{opacity:.55}to{opacity:1}}
@keyframes prank-core{from{transform:translate(-50%,-50%) scale(.96) rotate(-2deg)}to{transform:translate(-50%,-50%) scale(1.05) rotate(2deg)}}
@keyframes prank-quake{0%{transform:translate(-3px,2px) rotate(.4deg)}50%{transform:translate(3px,-2px) rotate(-.4deg)}100%{transform:translate(-2px,-3px) rotate(.3deg)}}
@keyframes prank-jump-shake{0%{transform:translate(0,0)}25%{transform:translate(-9px,6px)}50%{transform:translate(8px,-7px)}75%{transform:translate(-7px,-5px)}100%{transform:translate(6px,8px)}}
@keyframes prank-jump-pulse{50%{opacity:.3}}`

export default function PrankOverlay() {
  const { active, setActive } = usePrank()
  const [wins, setWins] = useState<Win[]>([])
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [stage, setStage] = useState(0)
  const [coreIdx, setCoreIdx] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const [closedFixed, setClosedFixed] = useState<string[]>([])
  const [notepad, setNotepad] = useState(false)
  const [jump, setJump] = useState(false)
  const [scare, setScare] = useState(false)
  const [flick, setFlick] = useState(0)
  const phaseRef = useRef<Phase>('idle')
  const nextId = useRef(0)
  const zTop = useRef(9998)
  const prevCount = useRef(-1)
  const audio = useRef<HTMLAudioElement | null>(null)
  const jumpSnd = useRef<HTMLAudioElement | null>(null)
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)
  const clickStart = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const stageRef = useRef(0)
  const musicStart = useRef<number | null>(null)
  const pending = useRef<Win[]>([])
  const loading = useRef(false)

  const setPhase = (value: Phase) => {
    phaseRef.current = value
    setPhaseState(value)
  }

  const makeWin = (file: string, url: string, x: number, y: number, w = WIN_W): Win => {
    nextId.current += 1
    zTop.current += 1
    return { id: nextId.current, file, url, x, y, z: zTop.current, w }
  }

  const senarSeed = (): Win[] => {
    const cols = Math.max(1, Math.ceil(window.innerWidth / GRID_COL_W))
    const rows = Math.max(1, Math.ceil(window.innerHeight / GRID_ROW_H))
    const cellW = window.innerWidth / cols
    const cellH = window.innerHeight / rows
    const cells: { x: number; y: number }[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        cells.push({ x: Math.round(col * cellW), y: Math.round(row * cellH) })
      }
    }
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cells[i], cells[j]] = [cells[j], cells[i]]
    }
    return cells.slice(0, SEED_COUNT).map((cell, index) => {
      const file = SENAR_IMAGES[index % SENAR_IMAGES.length]
      return makeWin(file, senarUrl(file), cell.x, cell.y)
    })
  }

  const spawn = () => {
    setPhase('idle')
    setStage(0)
    stageRef.current = 0
    setNotepad(false)
    setJump(false)
    setScare(false)
    setFlick(0)
    const items: Win[] = SALA_IMAGES.slice(0, INITIAL_COUNT).map((file) =>
      makeWin(
        file,
        salaUrl(file),
        Math.floor(Math.random() * (Math.max(0, window.innerWidth - WIN_W) + 1)),
        Math.floor(Math.random() * (Math.max(0, window.innerHeight - WIN_H) + 1)),
      ),
    )
    pending.current = items.slice(1)
    loading.current = items.length > 1
    setWins(items.length > 0 ? [items[0]] : [])
  }

  const spawnTo = (target: number, w: number) => {
    const current = Math.max(prevCount.current, 0)
    const deficit = Math.min(target, SPAWN_MAX, current + 6) - current
    if (deficit <= 0) return
    const maxX = Math.max(0, window.innerWidth - w)
    const maxY = Math.max(0, window.innerHeight - WIN_H)
    const useSala = Math.random() < 0.5
    const pool = useSala ? SALA_IMAGES : SENAR_IMAGES
    const extras: Win[] = []
    for (let i = 0; i < deficit; i += 1) {
      const file = pool[Math.floor(Math.random() * pool.length)]
      const url = useSala ? salaUrl(file) : senarUrl(file)
      extras.push(
        makeWin(
          file,
          url,
          Math.floor(Math.random() * (maxX + 1)),
          Math.floor(Math.random() * (maxY + 1)),
          w,
        ),
      )
    }
    setWins((prev) => [...prev, ...extras])
  }

  const enterHack = () => {
    setPhase('hack')
    setWins((prev) => [...senarSeed(), ...prev])
  }

  const stopSound = () => {
    const track = audio.current
    if (track !== null) {
      track.pause()
      track.currentTime = 0
      audio.current = null
    }
    const scare = jumpSnd.current
    if (scare !== null) {
      scare.pause()
      scare.currentTime = 0
      jumpSnd.current = null
    }
  }

  const startSound = () => {
    if (audio.current !== null) return
    const track = new Audio(SOUND_SRC)
    track.volume = 0.65
    audio.current = track
    track.play().catch(() => {
      const retry = () => {
        if (audio.current !== track) return
        track.play().catch(() => {})
      }
      window.addEventListener('keydown', retry, { once: true })
      window.addEventListener('pointerdown', retry, { once: true })
    })
  }

  const openMaps = useCallback(() => {
    stopSound()
    setPhase('idle')
    setStage(0)
    stageRef.current = 0
    setWins([])
    setActive(false)
    window.location.href = MAPS_TARGET
  }, [setActive])

  useEffect(() => {
    if (!active) {
      drag.current = null
      pending.current = []
      loading.current = false
      setClosedFixed([])
      return
    }
    spawn()
  }, [active])

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      if (pending.current.length === 0) return
      const next = pending.current.splice(0, 2)
      setWins((prev) => [...prev, ...next])
      if (pending.current.length === 0) loading.current = false
    }, 260)
    return () => window.clearInterval(id)
  }, [active])

  useEffect(() => {
    const closedAll = prevCount.current > 0 && wins.length === 0
    prevCount.current = wins.length
    if (active && closedAll && phaseRef.current === 'idle' && !loading.current) setPhase('aviso')
  }, [wins, active])

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      spawn()
      if (phaseRef.current === 'idle') setPhase('aviso')
    }, TIMING.INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [active])

  useEffect(() => {
    if (phase === 'aviso') {
      const id = window.setTimeout(() => setPhase('green'), TIMING.AVISO_MS)
      return () => window.clearTimeout(id)
    }
    if (phase === 'green') {
      const id = window.setTimeout(() => enterHack(), TIMING.GREEN_MS)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [phase])

  useEffect(() => {
    if (active && phase === 'green') {
      musicStart.current = Date.now()
      startSound()
    }
    if (!active) stopSound()
    if (active && (phase === 'idle' || phase === 'aviso')) stopSound()
  }, [active, phase])

  useEffect(() => {
    if (phase !== 'hack') return undefined
    const pre = document.createElement('img')
    pre.src = JUMP_SRC
    const id = window.setInterval(() => {
      const now = Date.now()
      if (musicStart.current === null) musicStart.current = now
      const elapsed = now - musicStart.current
      const track = audio.current
      if (track !== null && track.ended) {
        openMaps()
        return
      }
      let total = TIMING.MUSIC_MS
      if (track !== null && Number.isFinite(track.duration) && track.duration > 1) {
        total = track.duration * 1000
      }
      let remaining = total - elapsed
      if (track !== null && Number.isFinite(track.duration) && track.duration > 1) {
        const audioLeft = (track.duration - track.currentTime) * 1000
        if (Number.isFinite(audioLeft)) remaining = Math.min(remaining, audioLeft)
      }
      const s4Start = total - TIMING.TERROR_LEAD_MS
      let next = 0
      if (elapsed >= s4Start) next = 4
      else if (elapsed >= s4Start * 0.78) next = 3
      else if (elapsed >= s4Start * 0.55) next = 2
      else if (elapsed >= s4Start * 0.3) next = 1
      if (next !== stageRef.current) {
        stageRef.current = next
        setStage(next)
      }
      if (remaining <= TIMING.NOTEPAD_LEAD_MS) setNotepad(true)
      if (remaining <= TIMING.JUMPSCARE_LEAD_MS) setJump(true)
      if (remaining <= TIMING.SCREAM_LEAD_MS) {
        setScare(true)
        if (jumpSnd.current === null) {
          const scream = new Audio(JUMP_SND)
          scream.volume = 0.9
          jumpSnd.current = scream
          scream.play().catch(() => {})
        }
      }
      if (remaining <= 60) {
        openMaps()
        window.clearInterval(id)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [phase, openMaps])

  useEffect(() => {
    if (phase !== 'hack') return undefined
    let timer = 0
    let cancelled = false
    const step = () => {
      if (cancelled) return
      const now = Date.now()
      if (musicStart.current === null) musicStart.current = now
      const elapsed = now - musicStart.current
      let total = TIMING.MUSIC_MS
      const track = audio.current
      if (track !== null && Number.isFinite(track.duration) && track.duration > 1) {
        total = track.duration * 1000
      }
      const span = Math.max(1, total - TIMING.GREEN_MS)
      const p = Math.min(1, Math.max(0, (elapsed - TIMING.GREEN_MS) / span))
      const target =
        p < 0.5
          ? INITIAL_COUNT + Math.round((p / 0.5) * (MID_COUNT - INITIAL_COUNT))
          : MID_COUNT + Math.round(((p - 0.5) / 0.5) * (END_COUNT - MID_COUNT))
      const w = Math.round(340 + p * 430)
      spawnTo(target, w)
      timer = window.setTimeout(step, Math.round(3800 * Math.pow(1 - p, 1.7) + 250))
    }
    timer = window.setTimeout(step, SPAWN_FIRST_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'green') return undefined
    const id = window.setInterval(() => {
      setMsgIdx((idx) => (idx + 1) % GREEN_MSGS.length)
    }, 1600)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (stage !== 4) return undefined
    const id = window.setInterval(() => {
      setCoreIdx((idx) => (idx + 1) % TERROR_CORE.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [stage])

  useEffect(() => {
    if (!active || !scare) return undefined
    const t0 = Date.now()
    let cancelled = false
    let idx = 0
    let timer = 0
    const step = () => {
      if (cancelled) return
      idx = (idx + 1) % 4
      setFlick(idx)
      const since = Date.now() - t0
      timer = window.setTimeout(step, since < 1200 ? 90 : since < 2600 ? 50 : 30)
    }
    timer = window.setTimeout(step, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active, scare])

  useEffect(() => stopSound, [])

  const close = (id: number) => {
    drag.current = null
    setWins((prev) => prev.filter((win) => win.id !== id))
  }

  const hide = (key: string) => {
    setClosedFixed((prev) => (prev.includes(key) ? prev : prev.concat(key)))
  }

  const bringFront = (id: number) => {
    zTop.current += 1
    const z = zTop.current
    setWins((prev) => prev.map((win) => (win.id === id ? { ...win, z } : win)))
  }

  if (!active) return null

  const quake = stage >= 3 ? ' prank-win--quake' : ''
  const tintClass = stage >= 2 ? ` prank-tint--s${stage}` : ''

  return (
    <>
      <style>{CSS}</style>
      <div data-prank-ui className={'prank-tint' + tintClass} />
      {wins.map((win) => (
        <div
          key={win.id}
          dir="ltr"
          data-prank-ui
          className={'prank-win prank-win--ad' + quake}
          style={{ left: win.x, top: win.y, zIndex: win.z, width: win.w }}
          onPointerDown={(event) => {
            bringFront(win.id)
            clickStart.current = { x: event.clientX, y: event.clientY, moved: false }
            drag.current = { id: win.id, dx: event.clientX - win.x, dy: event.clientY - win.y }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const start = clickStart.current
            if (start !== null && !start.moved) {
              if (
                Math.abs(event.clientX - start.x) > 6 ||
                Math.abs(event.clientY - start.y) > 6
              ) {
                start.moved = true
              }
            }
            const current = drag.current
            if (current === null || current.id !== win.id) return
            const x = Math.min(
              Math.max(event.clientX - current.dx, 0),
              Math.max(0, window.innerWidth - win.w),
            )
            const y = Math.min(
              Math.max(event.clientY - current.dy, 0),
              Math.max(0, window.innerHeight - 40),
            )
            setWins((prev) => prev.map((item) => (item.id === win.id ? { ...item, x, y } : item)))
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onClick={() => {
            const start = clickStart.current
            if (start === null || !start.moved) close(win.id)
          }}
        >
          <img
            className="prank-win__img"
            src={win.url}
            alt=""
            draggable={false}
            style={{ height: Math.round(win.w * 0.73) }}
          />
        </div>
      ))}
      {phase === 'hack' && (
        <>
          {!closedFixed.includes('cmd1') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd1' + quake}
              style={{ zIndex: 11000 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">C:\Windows\system32\cmd.exe</span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola"
                  onClick={() => hide('cmd1')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="main" stage={stage} />
            </div>
          )}
          {!closedFixed.includes('cmd2') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd2' + quake}
              style={{ zIndex: 10998 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">C:\Windows\system32\cmd.exe — sesion de red</span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de red"
                  onClick={() => hide('cmd2')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="net" delay={700} stage={stage} />
            </div>
          )}
          {!closedFixed.includes('cmd3') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd3' + quake}
              style={{ zIndex: 10997 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">sqlcmd -S SENATI-PROD -d ventas</span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de base de datos"
                  onClick={() => hide('cmd3')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="dump" delay={1500} stage={stage} />
            </div>
          )}
          {!closedFixed.includes('map') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--map' + quake}
              style={{ zIndex: 10999 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">SATELITE - ZAPALLAL, PUENTE PIEDRA</span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar mapa"
                  onClick={() => hide('map')}
                >
                  ✕
                </button>
              </div>
              <iframe
                className="prank-map"
                src={MAP_EMBED}
                title="Ubicacion del objetivo"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
          {stage >= 1 && !closedFixed.includes('cmd4') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd4' + quake}
              style={{ zIndex: 10996 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">
                  C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
                </span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de PowerShell"
                  onClick={() => hide('cmd4')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="sys" delay={400} stage={stage} />
            </div>
          )}
          {stage >= 2 && !closedFixed.includes('cmd5') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd5' + quake}
              style={{ zIndex: 10995 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">C:\Windows\system32\cmd.exe — sfc /scannow</span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de reparacion"
                  onClick={() => hide('cmd5')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="sys" delay={900} stage={stage} />
            </div>
          )}
          {stage >= 3 && !closedFixed.includes('cmd6') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd6' + quake}
              style={{ zIndex: 10994 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">
                  C:\Windows\system32\cmd.exe — DISM /RestoreHealth
                </span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de mantenimiento"
                  onClick={() => hide('cmd6')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="sys" delay={1300} stage={stage} />
            </div>
          )}
          {stage >= 4 && !closedFixed.includes('cmd7') && (
            <div
              dir="ltr"
              data-prank-ui
              className={'prank-win prank-win--cmd prank-win--cmd7' + quake}
              style={{ zIndex: 10993 }}
            >
              <div className="prank-win__bar">
                <span className="prank-win__title">
                  C:\Windows\system32\cmd.exe — recuperacion de errores
                </span>
                <button
                  type="button"
                  className="prank-win__close"
                  aria-label="Cerrar consola de recuperacion"
                  onClick={() => hide('cmd7')}
                >
                  ✕
                </button>
              </div>
              <CmdWindow variant="sys" delay={600} stage={stage} />
            </div>
          )}
          {stage >= 2 && (
            <div
              dir="rtl"
              data-prank-ui
              className={
                'prank-terror' +
                (stage === 2 ? ' prank-terror--early' : stage === 3 ? ' prank-terror--lite' : '')
              }
              style={{ zIndex: stage === 2 ? 12400 : stage === 3 ? 12500 : 13000 }}
            >
              {stage === 4 && <div className="prank-terror__flash" />}
              {TERROR_SPOTS.slice(0, stage === 2 ? 4 : stage === 3 ? 8 : 12).map((spot, index) => (
                <span
                  key={spot.text}
                  className="prank-terror__word"
                  style={{ left: spot.left, top: spot.top, animationDelay: `${index * 0.17}s` }}
                >
                  {spot.text}
                </span>
              ))}
              {stage === 4 && <p className="prank-terror__core">{TERROR_CORE[coreIdx]}</p>}
            </div>
          )}
        </>
      )}
      {notepad && !closedFixed.includes('notepad') && (
        <div
          dir="ltr"
          data-prank-ui
          className="prank-win prank-win--notepad"
          style={{ zIndex: 13500 }}
        >
          <div className="prank-win__bar">
            <span className="prank-win__title">Sin titulo - Bloc de notas</span>
            <button
              type="button"
              className="prank-win__close"
              aria-label="Cerrar bloc de notas"
              onClick={() => hide('notepad')}
            >
              ✕
            </button>
          </div>
          <div className="prank-notepad__menu">
            <span>Archivo</span>
            <span>Edicion</span>
            <span>Formato</span>
            <span>Ver</span>
            <span>Ayuda</span>
          </div>
          <div className="prank-notepad__body">
            {NOTEPAD_MSG}
            <span className="prank-cursor" />
          </div>
        </div>
      )}
      {jump && (
        <div
          dir="ltr"
          data-prank-ui
          className={
            'prank-jumpscare' +
            (scare ? ' prank-jumpscare--scare prank-jumpscare--f' + flick : '')
          }
          style={{ zIndex: 14500 }}
        >
          <img src={JUMP_SRC} alt="" draggable={false} />
        </div>
      )}
      {phase === 'aviso' && (
        <div dir="ltr" data-prank-ui className="prank-aviso" style={{ zIndex: 12000 }}>
          <div className="prank-aviso__box">
            <p className="prank-aviso__title">ROBANDO DATOS DE SENATI</p>
            <p className="prank-aviso__sub">PREPARANDO EL SISTEMA - NO CIERRE ESTA VENTANA</p>
          </div>
        </div>
      )}
      {phase === 'green' && (
        <div dir="ltr" data-prank-ui className="prank-green" style={{ zIndex: 12001 }}>
          <p className="prank-green__title">ROBANDO DATOS DE SENATI</p>
          <div className="prank-green__track">
            <span className="prank-green__fill" />
          </div>
          <p className="prank-green__sub">{GREEN_MSGS[msgIdx]}</p>
        </div>
      )}
    </>
  )
}
