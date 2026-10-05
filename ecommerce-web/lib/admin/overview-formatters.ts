import { money } from '@/lib/formatters'

export const moneyTooltip = (value: unknown) => [money(Number(value ?? 0)), 'Revenue'] as [string, string]

export function compactDay(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
