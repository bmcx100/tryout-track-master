"use client"

import Link from "next/link"
import { ListChecks, Heart, Users, ArrowUpDown, FileText, HelpCircle, Sparkles } from "lucide-react"

type CardDef = {
  iconType?: "text"
  icon?: typeof Heart
  title: string
  description: string
  href?: string
}

const howItWorksCards: CardDef[] = [
  {
    iconType: "text",
    title: "Association & Division",
    description: "Tap the badge at the top-left to switch between associations and\u00a0age\u00a0groups.",
  },
  {
    icon: ListChecks,
    title: "Tryout Sessions",
    description: "See who\u2019s continuing and who\u2019s been cut after each tryout round. Check\u00a0back\u00a0regularly.",
    href: "/continuations",
  },
  {
    icon: Users,
    title: "Teams",
    description: "View current rosters and where players were last year. Useful context for tracking and\u00a0sorting.",
    href: "/teams",
  },
]

const personalizeCards: CardDef[] = [
  {
    icon: Heart,
    title: "Heart Players",
    description: "Heart your child and other players on the Teams page to track their status on\u00a0your\u00a0dashboard.",
    href: "/teams",
  },
  {
    icon: ArrowUpDown,
    title: "Predictions",
    description: "Drag players between teams to predict where they\u2019ll land. Your predictions are private. Completed teams appear here as\u00a0they\u2019re\u00a0announced.",
    href: "/teams",
  },
  {
    icon: FileText,
    title: "Player Details",
    description: "Long-press any player for details, private notes, and to suggest corrections if a name or jersey number is\u00a0wrong.",
  },
]

function renderCard(card: CardDef, abbreviation: string) {
  const content = (
    <>
      <div className={card.iconType === "text" ? "help-card-icon help-card-icon-text" : "help-card-icon"}>
        {card.iconType === "text" ? (
          <span>{abbreviation}</span>
        ) : card.icon ? (
          <card.icon size={20} />
        ) : null}
      </div>
      <div>
        <div className="help-card-title">{card.title}</div>
        <div className="help-card-desc">{card.description}</div>
      </div>
    </>
  )

  if (card.href) {
    return (
      <Link key={card.title} href={card.href} className="help-card">
        {content}
      </Link>
    )
  }

  return (
    <div key={card.title} className="help-card">
      {content}
    </div>
  )
}

export function HelpPageClient({ abbreviation }: { abbreviation: string }) {
  return (
    <div className="help-page">
      <div className="help-header">
        <HelpCircle size={20} className="help-header-icon" />
        <h1>How It Works</h1>
      </div>
      <div className="help-cards">
        {howItWorksCards.map((card) => renderCard(card, abbreviation))}
      </div>

      <div className="help-header help-header-secondary">
        <Sparkles size={20} className="help-header-icon" />
        <h2>Personalize</h2>
      </div>
      <div className="help-cards">
        {personalizeCards.map((card) => renderCard(card, abbreviation))}
      </div>
    </div>
  )
}
