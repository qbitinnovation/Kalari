import { format, isValid, parse } from 'date-fns'

/** Parse yyyy-MM-dd to local Date (no timezone shift). */
export function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(parsed) ? parsed : undefined
}

export function formatDisplayDateValue(value: string | Date | null | undefined, fallback = 'Date not set'): string {
  if (!value) return fallback
  const parsed = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseDateValue(value)
      : new Date(value)
  return parsed && isValid(parsed) ? format(parsed, 'MMM dd, yyyy') : fallback
}

/** Format Date to yyyy-MM-dd. */
export function formatDateValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function todayDateValue(): string {
  return formatDateValue(new Date())
}

/** Parse HH:mm to { hours, minutes }. */
export function parseTimeValue(value: string): { hours: number; minutes: number } | undefined {
  if (!value) return undefined
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined
  return { hours, minutes }
}

export function formatTimeValue(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatDisplayTimeValue(value?: string | null, fallback = 'Time not set'): string {
  const parsed = parseTimeValue(value || '')
  if (!parsed) return fallback
  const date = parse(formatTimeValue(parsed.hours, parsed.minutes), 'HH:mm', new Date())
  return format(date, 'h:mm a')
}

export function buildTimeSlots(minuteStep = 15, startHour = 6, endHour = 23): string[] {
  const slots: string[] = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += minuteStep) {
      slots.push(formatTimeValue(h, m))
    }
  }
  return slots
}
