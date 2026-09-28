'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AdminNavList } from '@/components/admin-nav-list'

/**
 * Below lg, the admin sections as a drawer from the end edge (the desktop
 * sidebar is AdminSidebar). A native
 * <dialog>, so focus trapping, Escape and the backdrop come for free; the
 * slide is `.admin-drawer` in globals.css.
 */
export function AdminMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface ps-3 pe-3.5
                   text-[14px] font-semibold text-ink transition-[border-color,box-shadow]
                   hover:border-accent hover:shadow-[0_0_0_2px_var(--color-accent)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
        Menu
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Admin sections"
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="admin-drawer m-0 ms-auto h-dvh max-h-none w-[min(380px,100vw)] max-w-none bg-surface p-0 text-ink
                   shadow-[-20px_0_60px_-20px_rgba(0,0,0,.35)] backdrop:bg-[rgba(10,20,16,.45)] backdrop:backdrop-blur-[2px]"
      >
        <div className="flex h-full flex-col">
          <div className="hero-gradient flex items-center justify-between px-6 pt-6 pb-8 text-white">
            <div>
              <p className="text-[13px] text-white/75">PakRemits</p>
              <p className="font-hero text-[24px] leading-tight font-bold tracking-[-0.02em]">Admin</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <nav aria-label="Admin sections" className="-mt-4 flex-1 overflow-y-auto rounded-t-[20px] bg-surface px-3 pt-4">
            <AdminNavList onNavigate={() => setOpen(false)} />
          </nav>

          <div className="border-t border-line-2 p-4">
            <Link
              href="/"
              className="flex h-12 items-center justify-center gap-2 rounded-control bg-gold text-[15px] font-bold text-on-gold no-underline hover:bg-gold-hover"
            >
              View the live site
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M7 17L17 7M8 7h9v9" />
              </svg>
            </Link>
          </div>
        </div>
      </dialog>
    </>
  )
}
