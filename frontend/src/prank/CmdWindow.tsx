import { useEffect, useRef, useState } from 'react'
import { BASE_LINES, STAGE_LINES, fillerBlock } from './cmdLines'

type Variant = 'main' | 'net' | 'dump' | 'sys'

const ARABIC = /[\u0600-\u06FF]/

const SPEED = [1, 0.9, 0.78, 0.65, 0.55]

interface CmdWindowProps {
  variant: Variant
  delay?: number
  stage?: number
}

export default function CmdWindow({ variant, delay = 0, stage = 0 }: CmdWindowProps) {
  const [shown, setShown] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<string[]>([])
  const stageRef = useRef(stage)

  useEffect(() => {
    const prev = stageRef.current
    stageRef.current = stage
    if (stage <= prev) return
    const injected: string[] = []
    for (let level = prev + 1; level <= stage; level += 1) {
      injected.push(...(STAGE_LINES[level] ?? []), '')
    }
    if (injected.length > 1) queueRef.current = [...injected, ...queueRef.current]
  }, [stage])

  useEffect(() => {
    queueRef.current = [...BASE_LINES[variant]]
    let cancelled = false
    let timer = 0
    const tick = () => {
      if (cancelled) return
      if (queueRef.current.length === 0) queueRef.current = ['', ...fillerBlock(variant)]
      const next = queueRef.current.shift() ?? ''
      setShown((prev) => [...prev, next])
      const base =
        next === ''
          ? 130
          : ARABIC.test(next)
            ? 430 + Math.random() * 370
            : 150 + Math.random() * 210
      timer = window.setTimeout(tick, base * (SPEED[stageRef.current] ?? 1))
    }
    timer = window.setTimeout(tick, delay + 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [variant, delay])

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [shown])

  return (
    <div ref={boxRef} dir="ltr" className="prank-console">
      {shown.map((line, index) => (
        <div key={index} className="prank-console__line">
          {line}
        </div>
      ))}
      <span className="prank-cursor" aria-hidden="true" />
    </div>
  )
}
