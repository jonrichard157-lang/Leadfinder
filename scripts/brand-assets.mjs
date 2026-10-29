// Gera favicon, ícones de app e imagem de perfil do OrbeLead a partir do símbolo vetorial.
// Uso: node scripts/brand-assets.mjs
// A mesma geometria está em src/components/brand/Logo.tsx — altere os dois juntos.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const NAVY = '#0B1437'

const ORBIT = `<g transform="rotate(-22 31 37)"><path d="M3 37A28 8.5 0 0 0 59 37A28 3.2 0 0 1 3 37Z"/></g><circle cx="56.96" cy="26.51" r="4.6"/>`

// Símbolo em viewBox 64x64: "O" (orbe) + órbita em gradiente + ponto (lead).
// A máscara abre um respiro no "O" onde a órbita passa na frente.
function mark(ring, id) {
  return `
  <defs>
    <linearGradient id="${id}g" x1="2" y1="48" x2="60" y2="18" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2F6BF0"/><stop offset="1" stop-color="#4F46E5"/>
    </linearGradient>
    <mask id="${id}k" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="#fff"/>
      <g fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round">${ORBIT}</g>
    </mask>
  </defs>
  <ellipse cx="28" cy="31" rx="15" ry="17" transform="rotate(-12 28 31)" fill="none" stroke="${ring}" stroke-width="9" mask="url(#${id}k)"/>
  <g fill="url(#${id}g)">${ORBIT}</g>`
}

// Ícone de app: fundo navy, "O" branco. `scale` define quanto do quadrado o símbolo ocupa.
function appIcon({ scale = 0.8, radius = 14 } = {}) {
  const offset = (64 - 64 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${NAVY}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark('#fff', 'i')}</g>
</svg>
`
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

// ICO com imagens PNG embutidas (formato aceito por todos os navegadores atuais).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((img) => img.data)])
}

const write = (rel, data) => {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
  console.log('✓', rel)
}

// Em tamanhos pequenos o símbolo ocupa mais o quadrado para continuar legível.
const dense = appIcon({ scale: 0.9, radius: 12 })
const standard = appIcon()
// iOS e redes sociais aplicam o próprio arredondamento/recorte: fundo sem cantos.
const fullBleed = appIcon({ scale: 0.72, radius: 0 })

write('src/app/icon.svg', standard)
write(
  'src/app/favicon.ico',
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(dense, size) }))))
)
write('src/app/apple-icon.png', await png(fullBleed, 180))
write('public/brand/orbelead-icon-192.png', await png(standard, 192))
write('public/brand/orbelead-icon-512.png', await png(standard, 512))
write('public/brand/orbelead-perfil-1024.png', await png(fullBleed, 1024))
write(
  'public/brand/orbelead-simbolo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark(NAVY, 'm')}</svg>\n`
)
