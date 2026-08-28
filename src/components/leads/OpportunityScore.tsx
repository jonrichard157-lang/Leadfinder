import { cn } from '@/lib/utils'

interface OpportunityScoreProps {
  score: number
  size?: 'sm' | 'md'
}

function toneFor(score: number) {
  if (score >= 75) return { ring: 'var(--color-amber-500)', text: 'var(--color-amber-600)' }
  if (score >= 50) return { ring: 'var(--color-signal-500)', text: 'var(--color-signal-700)' }
  return { ring: 'var(--color-ink-300)', text: 'var(--color-ink-500)' }
}

export function OpportunityScore({ score, size = 'md' }: OpportunityScoreProps) {
  const { ring, text } = toneFor(score)
  const dim = size === 'sm' ? 36 : 48
  const stroke = size === 'sm' ? 3 : 4
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth={stroke}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={ring}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center font-mono font-medium',
          size === 'sm' ? 'text-[10px]' : 'text-xs'
        )}
        style={{ color: text }}
      >
        {score}
      </span>
    </div>
  )
}
