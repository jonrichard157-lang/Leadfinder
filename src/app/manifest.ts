import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OrbeLead',
    short_name: 'OrbeLead',
    description: 'Mais leads. Mais oportunidades.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0b1437',
    theme_color: '#0b1437',
    icons: [
      { src: '/brand/orbelead-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/orbelead-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
