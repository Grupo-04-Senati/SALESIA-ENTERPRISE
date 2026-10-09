import { useEffect, useRef, useState } from 'react'

interface CmdLine {
  text: string
  wait?: number
}

const DEFAULT_WAIT = 130

const LINES: CmdLine[] = [
  { text: 'Microsoft Windows [Version 10.0.22631.7218]', wait: 220 },
  { text: '(c) Microsoft Corporation. Todos los derechos reservados.' },
  { text: '' },
  { text: 'C:\\Windows\\system32> whoami', wait: 560 },
  { text: 'senati-lab\\invitado' },
  { text: '' },
  { text: 'C:\\Windows\\system32> ipconfig | findstr IPv4', wait: 460 },
  { text: '   IPv4. . . . . . . . . . . . : 192.168.1.107' },
  { text: '   Puerta de enlace predeterminada . . . : 192.168.1.1' },
  { text: '' },
  { text: 'C:\\Windows\\system32> ping senati.edu.pe -n 3', wait: 620 },
  { text: 'Resp desde 190.42.148.22: bytes=32 tiempo=41ms TTL=53' },
  { text: 'Resp desde 190.42.148.22: bytes=32 tiempo=39ms TTL=53' },
  { text: '' },
  { text: '[*] CONECTANDO AL SERVIDOR DE SENATI .............. [OK]', wait: 820 },
  { text: '[*] EVADIENDO FIREWALL (IDS/IPS) .................. [OK]', wait: 640 },
  { text: '[*] DESCARGANDO /api/v1/sales .................... 100%', wait: 940 },
  { text: '[+] REGISTROS EXTRAIDOS: 1.482.913' },
  { text: '[*] RASTREANDO UBICACION DEL OBJETIVO ............ [OK]', wait: 820 },
  { text: '[+] OBJETIVO: Zapallal, Puente Piedra, Lima 15122' },
  { text: '[+] COORDENADAS: -11.846935, -77.100032' },
  { text: '[+] VISTA SATELITAL: CARGADA' },
  { text: '[!] SENATI SABE QUE ESTAS MIRANDO LA PANTALLA', wait: 760 },
  { text: '[*] ABRIENDO GOOGLE MAPS ...', wait: 820 },
]

export default function CmdWindow({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const finishedRef = useRef(false)
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const ids: number[] = []
    let elapsed = 0
    LINES.forEach((line, index) => {
      elapsed += line.wait ?? DEFAULT_WAIT
      ids.push(window.setTimeout(() => setVisible(index + 1), elapsed))
    })
    ids.push(
      window.setTimeout(() => {
        if (finishedRef.current) return
        finishedRef.current = true
        doneRef.current()
      }, elapsed + 700),
    )
    return () => {
      for (const id of ids) window.clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    const box = boxRef.current
    if (box !== null) box.scrollTop = box.scrollHeight
  }, [visible])

  return (
    <div ref={boxRef} dir="ltr" className="prank-console">
      {LINES.slice(0, visible).map((line, index) => (
        <div key={index} className="prank-console__line">
          {line.text === '' ? ' ' : line.text}
        </div>
      ))}
      <span className="prank-cursor" aria-hidden="true" />
    </div>
  )
}
