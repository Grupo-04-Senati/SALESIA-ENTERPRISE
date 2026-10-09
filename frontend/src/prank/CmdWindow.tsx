import { useEffect, useRef, useState } from 'react'
import { BASE_LINES, HORROR_LINES, fillerBlock } from './cmdLines'

type Variant = 'main' | 'net' | 'dump'

interface CmdWindowProps {
  variant: Variant
  delay?: number
  terror?: boolean
}

export default function CmdWindow({ variant, delay = 0, terror = false }: CmdWindowProps) {
  const [shown, setShown] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<string[]>([])

  useEffect(() => {
    if (terror) queueRef.current = [...HORROR_LINES, ...queueRef.current]
  }, [terror])

  useEffect(() => {
    queueRef.current = [...BASE_LINES[variant]]
    let cancelled = false
    let timer = 0
    const tick = () => {
      if (cancelled) return
      if (queueRef.current.length === 0) {
        queueRef.current = ['', ...fillerBlock(variant)]
      }
      const next = queueRef.current.shift() ?? ''
      setShown((prev) => [...prev, next])
      const wait = HORROR_LINES.includes(next)
        ? 420 + Math.random() * 380
        : next === ''
          ? 130
          : 150 + Math.random() * 210
      timer = window.setTimeout(tick, wait)
    }
    timer = window.setTimeout(tick, delay + 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [variant, delay])

  useEffect(() => {
    const box = boxRef.current
    if (box !== null) box.scrollTop = box.scrollHeight
  }, [shown])

  return (
    <div ref={boxRef} dir="ltr" className="prank-console">
      {shown.map((text, index) => (
        <div key={index} className="prank-console__line">
          {text === '' ? ' ' : text}
        </div>
      ))}
      <span className="prank-cursor" aria-hidden="true" />
    </div>
  )
}
