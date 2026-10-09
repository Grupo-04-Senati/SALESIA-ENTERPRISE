type Variant = 'main' | 'net' | 'dump'

const HEX = '0123456789ABCDEF'

const rnd = (max: number): number => Math.floor(Math.random() * (max + 1))

const pick = (list: string[]): string => list[rnd(list.length - 1)]

const hex = (length: number): string => Array.from({ length }, () => HEX[rnd(15)]).join('')

const ip = (): string => `${rnd(200) + 10}.${rnd(255)}.${rnd(255)}.${rnd(255)}`

const bar = (percent: number): string => {
  const filled = Math.max(1, Math.min(10, Math.round(percent / 10)))
  return '#'.repeat(filled) + '-'.repeat(10 - filled)
}

export const BASE_LINES: Record<Variant, string[]> = {
  main: [
    'Microsoft Windows [Version 10.0.22631.7218]',
    '(c) Microsoft Corporation. Todos los derechos reservados.',
    '',
    'C:\\Windows\\system32> whoami',
    'senati-lab\\invitado',
    '',
    'C:\\Windows\\system32> ipconfig | findstr IPv4',
    '   IPv4. . . . . . . . . . . . : 192.168.1.107',
    '   Puerta de enlace predeterminada . . . : 192.168.1.1',
    '',
    'C:\\Windows\\system32> ping senati.edu.pe -n 3',
    'Resp desde 190.42.148.22: bytes=32 tiempo=41ms TTL=53',
    'Resp desde 190.42.148.22: bytes=32 tiempo=39ms TTL=53',
    '',
    '[*] CONECTANDO AL SERVIDOR DE SENATI .............. [OK]',
    '[*] EVADIENDO FIREWALL (IDS/IPS) .................. [OK]',
    '[*] DESCARGANDO /api/v1/sales .................... 100%',
    '[+] REGISTROS EXTRAIDOS: 1.482.913',
    '[*] RASTREANDO UBICACION DEL OBJETIVO ............ [OK]',
    '[+] OBJETIVO: Zapallal, Puente Piedra, Lima 15122',
    '[+] COORDENADAS: -11.846935, -77.100032',
    '[+] VISTA SATELITAL: CARGADA',
    '[!] SENATI SABE QUE ESTAS MIRANDO LA PANTALLA',
    '[*] MANTENIENDO LA SESION ABIERTA ...',
  ],
  net: [
    'Microsoft Windows [Version 10.0.22631.7218]',
    '',
    'C:\\Windows\\system32> netstat -an | findstr ESTABLISHED',
    '  TCP  192.168.1.107:52344   190.42.148.22:443     ESTABLISHED',
    '  TCP  192.168.1.107:52351   200.48.12.90:3306     ESTABLISHED',
    '',
    'C:\\Windows\\system32> arp -a',
    '  192.168.1.1      00-1a-2b-3c-4d-5e    dinamico',
    '  192.168.1.107    aa-bb-cc-dd-ee-ff    dinamico',
    '',
    'C:\\Windows\\system32> nslookup senati.edu.pe',
    '  Nombre: senati.edu.pe',
    '  Address:  190.42.148.22',
    '',
    '[*] ABIERTO TUNEL SSH POR EL PUERTO 443 ........... [OK]',
    '[*] PROXIE: 10.13.37.9:9050 ...................... [OK]',
    '[+] CONEXIONES CARMADAS: 2 (activas)',
  ],
  dump: [
    'Microsoft SQL Server Command Line Tools',
    '',
    'C:\\Windows\\system32> sqlcmd -S SENATI-PROD -d ventas',
    '1> SELECT TOP 500 * FROM clientes;',
    '2> GO',
    '  id     | nombres         | documento  | saldo',
    '  1042   | Quispe Salas    | 45871239   | 129.90',
    '  1043   | Mamani Ccahuana | 41209873   |  84.50',
    '  1044   | Flores Huaman   | 47771204   | 310.00',
    '',
    '[+] 1.482.913 filas extraidas hasta ahora',
    'C:\\Windows\\system32> copy ventas_dump.sql \\\\192.168.1.107\\c$\\',
    '        1 archivo(s) copiado(s).',
    '[*] SUBIENDO COPIA A UN SERVIDOR EXTRANJERO ...... [OK]',
  ],
}

export const HORROR_LINES: string[] = [
  '[!] رؤيتنا — ESTAMOS DETRAS DE TI',
  '[!] الشيطان يكتب على هذه الشاشة',
  '[+] روحك تُرسل الآن إلى SENATI',
  '[!] لا تستطيع اغلاق هذه النافذة',
  '[+] من يقرأ هذا لا يستطيع الهرب',
  '[!] نظر خلفك... خلفك...',
  '[+] سنتولى شاشتك بعد ثوانٍ',
  '[!] عين تراقب هذه الشاشة الآن',
]

const fillerMain = (): string[] => {
  const percent = rnd(90) + 10
  const table = pick(['clientes', 'ventas', 'productos', 'pagos', 'cotizaciones'])
  return [
    `[*] DESCARGANDO tabla_${table} [${bar(percent)}] ${percent}%`,
    `[+] PAQUETE ${hex(8)} RECIBIDO (${rnd(900) + 100} KB)`,
    `[*] DECODIFICANDO ${hex(24)}`,
    `[+] SHA256: ${hex(40)}`,
    'C:\\Windows\\system32> tasklist | findstr svchost',
    `  svchost.exe   ${rnd(9000) + 1000}   Servicios`,
    '[*] OCULTANDO HUELLA EN LOS LOGS ................ [OK]',
    `[+] REGISTROS EXTRAIDOS: ${rnd(900000) + 100000}`,
    '',
  ]
}

const fillerNet = (): string[] => {
  const first = rnd(30) + 8
  const second = rnd(40) + 15
  return [
    `  TCP  ${ip()}:${rnd(60000) + 1024}   190.42.148.22:443   ESTABLISHED`,
    `[*] PAQUETES SNIFFADOS: ${rnd(90000) + 10000}`,
    'C:\\Windows\\system32> tracert -h 8 senati.edu.pe',
    '  1    <1 ms  192.168.1.1',
    `  2    ${first} ms  10.10.0.1`,
    `  3    ${second} ms  190.42.148.22`,
    `[+] TUNEL ACTIVO ${hex(4)}-${hex(4)}`,
    `[*] DNS FALSO: ${pick(['mail.senati.edu.pe', 'portal.senati.edu.pe', 'api.senati.edu.pe'])} -> ${ip()}`,
    '',
  ]
}

const fillerDump = (): string[] => {
  const percent = rnd(90) + 10
  return [
    `  ${rnd(99999)} | cliente_${rnd(9999)} | S/ ${rnd(9000) / 100}`,
    `[+] FILAS TOTALES: ${rnd(900000) + 100000}`,
    `1> SELECT COUNT(*) FROM pagos WHERE monto > ${rnd(900) + 100};`,
    `  ${rnd(9000) + 1000}`,
    `[*] VOLCANDO A ventas_${rnd(999)}.sql [${bar(percent)}] ${percent}%`,
    `[+] COPIA TERMINADA EN ${rnd(900) + 100} ms`,
    '[*] CERRANDO CONEXION AL SERVIDOR ...',
    '',
  ]
}

export const fillerBlock = (variant: Variant): string[] => {
  if (variant === 'net') return fillerNet()
  if (variant === 'dump') return fillerDump()
  return fillerMain()
}
