import { LandingHeader } from '@/components/landing/LandingHeader'
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { Footer } from '@/components/landing/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-ink-50)]">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Faq />
      <Footer />
    </div>
  )
}
