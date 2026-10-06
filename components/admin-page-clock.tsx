'use client'

import { useSyncExternalStore } from 'react'

const PKT_NOW = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** When the page was opened; the admin pages are static, so it is the browser's clock. */
const OPENED_AT = typeof window === 'undefined' ? null : PKT_NOW.format(new Date())
const subscribeNever = () => () => {}

/** The time the admin page was opened, in Pakistan time. Empty until hydrated. */
export function AdminPageClock() {
  const openedAt = useSyncExternalStore(subscribeNever, () => OPENED_AT, () => null)
  return openedAt ? <>{openedAt} PKT</> : null
}
