import { STATUS_LABELS } from "@/types"

type StatusBadgeProps = {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
