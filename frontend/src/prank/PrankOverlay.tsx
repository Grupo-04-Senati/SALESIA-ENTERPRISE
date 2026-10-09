import { useEffect, useRef, useState } from 'react'
import { SALA_IMAGES, salaUrl } from './salaImages'
import { usePrank } from './PrankContext'
import CmdWindow from './CmdWindow'

type Phase = 'idle' | 'aviso' | 'green' | 'hack'

interface Win {
  id: number
  file: string
  x: number
  y: number
  z: number
}

const AVISO_MS = 2500

const GREEN_MS = 7500

const INTERVAL_MS = 300000

const WIN_W = 300

const WIN_H = 260

const MAP_EMBED = 'https://maps.google.com/maps?q=-11.846935%2C-77.100032&z=17&t=k&output=embed'

const MAPS_TARGET = 'https://www.google.com/maps?q=Distrito+de+Independencia,+Lima&hl=es'

const SOUND_SRC = '/aud/ms.mp3'

const CSS = `.prank-tint{position:fixed;inset:0;pointer-events:none;z-index:9990;background:repeating-linear-gradient(45deg,rgba(196,12,12,.4) 0 70px,rgba(0,150,62,.4) 70px 140px)}
.prank-win{position:fixed;display:flex;flex-direction:column;width:300px;max-width:92vw;background:#0b1220;border:1px solid #334155;border-radius:10px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55);font-family:system-ui,-apple-system,sans-serif;animation:prank-pop .16s ease-out}
.prank-win__bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;background:#1e293b;cursor:grab;touch-action:none;user-select:none}
.prank-win__bar:active{cursor:grabbing}
.prank-win__title{color:#94a3b8;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prank-win__close{flex:none;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:#ef4444;color:#fff;font-size:12px;line-height:20px;text-align:center;cursor:pointer}
.prank-win__close:hover{background:#dc2626}
.prank-win__img{display:block;width:100%;height:220px;object-fit:contain;background:#000;pointer-events:none}
.prank-win--cmd{left:max(12px,3vw);top:8vh;width:min(660px,94vw)}
.prank-win--map{right:max(12px,3vw);bottom:6vh;width:min(400px,92vw)}
.prank-win--cmd .prank-win__bar{background:#27272a;cursor:default}
.prank-win--map .prank-win__bar{background:#14532d;cursor:default}
.prank-console{height:330px;overflow-y:auto;background:#0c0c0c;padding:10px 12px;font-family:Consolas,'Cascadia Mono','Courier New',monospace;font-size:13px;line-height:1.5;color:#4ade80;white-space:pre-wrap;word-break:break-word}
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
@keyframes prank-pop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes prank-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-4px,2px)}75%{transform:translate(4px,-2px)}}
@keyframes prank-blink{50%{opacity:.3}}
@keyframes prank-load{from{transform:translateX(-120%)}to{transform:translateX(340%)}}`

export default function PrankOverlay() {
  const { active, setActive } = usePrank()
  const [wins, setWins] = useState<Win[]>([])
  const [phase, setPhaseState] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  const nextId = useRef(0)
  const zTop = useRef(9998)
  const prevCount = useRef(-1)
  const audio = useRef<HTMLAudioElement | null>(null)
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)

  const setPhase = (value: Phase) => {
    phaseRef.current = value
    setPhaseState(value)
  }

  const spawn = () => {
    setPhase('idle')
    const maxX = Math.max(0, window.innerWidth - WIN_W)
    const maxY = Math.max(0, window.innerHeight - WIN_H)
    const items: Win[] = SALA_IMAGES.map((file) => {
      nextId.current += 1
      zTop.current += 1
      return {
        id: nextId.current,
        file,
        x: Math.floor(Math.random() * (maxX + 1)),
        y: Math.floor(Math.random() * (maxY + 1)),
        z: zTop.current,
      }
    })
    setWins(items)
  }

  const stopSound = () => {
    const track = audio.current
    if (track === null) return
    track.pause()
    track.currentTime = 0
    audio.current = null
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

  const abortHack = () => {
    stopSound()
    setPhase('idle')
  }

  const openMaps = () => {
    stopSound()
    setPhase('idle')
    setWins([])
    setActive(false)
    window.location.href = MAPS_TARGET
  }

  useEffect(() => {
    if (!active) {
      drag.current = null
      return
    }
    spawn()
  }, [active])

  useEffect(() => {
    const closedAll = prevCount.current > 0 && wins.length === 0
    prevCount.current = wins.length
    if (active && closedAll && phaseRef.current === 'idle') setPhase('aviso')
  }, [wins, active])

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      spawn()
      if (phaseRef.current === 'idle') setPhase('aviso')
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [active])

  useEffect(() => {
    if (phase === 'aviso') {
      const id = window.setTimeout(() => setPhase('green'), AVISO_MS)
      return () => window.clearTimeout(id)
    }
    if (phase === 'green') {
      const id = window.setTimeout(() => setPhase('hack'), GREEN_MS)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [phase])

  useEffect(() => {
    if (active && phase === 'green') startSound()
    if (!active) stopSound()
    if (active && (phase === 'idle' || phase === 'aviso')) stopSound()
  }, [active, phase])

  useEffect(() => stopSound, [])

  const close = (id: number) => {
    drag.current = null
    setWins((prev) => prev.filter((win) => win.id !== id))
  }

  const bringFront = (id: number) => {
    zTop.current += 1
    const z = zTop.current
    setWins((prev) => prev.map((win) => (win.id === id ? { ...win, z } : win)))
  }

  if (!active) return null

  return (
    <>
      <style>{CSS}</style>
      <div data-prank-ui className="prank-tint" />
      {wins.map((win) => (
        <div
          key={win.id}
          dir="ltr"
          data-prank-ui
          className="prank-win"
          style={{ left: win.x, top: win.y, zIndex: win.z }}
          onPointerDown={() => bringFront(win.id)}
        >
          <div
            className="prank-win__bar"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return
              drag.current = { id: win.id, dx: event.clientX - win.x, dy: event.clientY - win.y }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const current = drag.current
              if (current === null || current.id !== win.id) return
              const x = Math.min(
                Math.max(event.clientX - current.dx, 0),
                Math.max(0, window.innerWidth - WIN_W),
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
          >
            <span className="prank-win__title">{win.file}</span>
            <button
              type="button"
              className="prank-win__close"
              aria-label="Cerrar ventana"
              onClick={() => close(win.id)}
            >
              ✕
            </button>
          </div>
          <img className="prank-win__img" src={salaUrl(win.file)} alt="" draggable={false} />
        </div>
      ))}
      {phase === 'hack' && (
        <>
          <div
            dir="ltr"
            data-prank-ui
            className="prank-win prank-win--cmd"
            style={{ zIndex: 11000 }}
          >
            <div className="prank-win__bar">
              <span className="prank-win__title">C:\Windows\system32\cmd.exe</span>
              <button
                type="button"
                className="prank-win__close"
                aria-label="Cerrar consola"
                onClick={abortHack}
              >
                ✕
              </button>
            </div>
            <CmdWindow onDone={openMaps} />
          </div>
          <div
            dir="ltr"
            data-prank-ui
            className="prank-win prank-win--map"
            style={{ zIndex: 10999 }}
          >
            <div className="prank-win__bar">
              <span className="prank-win__title">SATELITE - ZAPALLAL, PUENTE PIEDRA</span>
              <button
                type="button"
                className="prank-win__close"
                aria-label="Cerrar mapa"
                onClick={abortHack}
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
        </>
      )}
      {phase === 'aviso' && (
        <div dir="ltr" data-prank-ui className="prank-aviso" style={{ zIndex: 12000 }}>
          <div className="prank-aviso__box">
            <p className="prank-aviso__title">ROBANDO DATOS DE SENATI</p>
            <p className="prank-aviso__sub">CARGANDO UNA PANTALLA VERDE Y EL MENSAJE GRANDE</p>
          </div>
        </div>
      )}
      {phase === 'green' && (
        <div dir="ltr" data-prank-ui className="prank-green" style={{ zIndex: 12001 }}>
          <p className="prank-green__title">ROBANDO DATOS DE SENATI</p>
          <div className="prank-green__track">
            <span className="prank-green__fill" />
          </div>
          <p className="prank-green__sub">CARGANDO PANTALLA VERDE…</p>
        </div>
      )}
    </>
  )
}
