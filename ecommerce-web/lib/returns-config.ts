export const RETURN_WINDOW_DAYS = 7
export const REFUND_ETA = '5-7 business days'
export const AUTO_APPROVE_MAX_AMOUNT = 5000
export const AUTO_APPROVE_REASONS = ['Changed my mind', 'Wrong item', 'Damaged or defective', 'Not as described'] as const
export const MAX_OPEN_REQUESTS_PER_CUSTOMER = 5
export const PICKUP_RESCHEDULES_ALLOWED = 1
export const REQUEST_SLA_HOURS = 24
export const ATTACHMENTS_ENABLED = false

export const RETURN_REASONS = [
  { value: 'Changed my mind', label: 'Changed my mind' },
  { value: 'Wrong item', label: 'Wrong item received' },
  { value: 'Damaged or defective', label: 'Damaged or defective' },
  { value: 'Not as described', label: 'Not as described' },
  { value: 'Other', label: 'Other' },
] as const

export const AUTO_APPROVE_REASON_VALUES = AUTO_APPROVE_REASONS.map(reason => reason.toLowerCase())
