'use client'

import { useEffect } from 'react'

/**
 * Reveals `.card-rise` cards as they scroll into view: each one rises and
 * fades in once, on a timed transition (globals.css), so the movement is
 * noticeable at any scroll speed. (A scroll-linked animation finished while
 * the card was still at the bottom edge and went unseen.)
 *
 * Mounted once in the layout. Cards are only ever hidden after this runs, so
 * without JavaScript, or before hydration, everything is simply visible.
 * Cards already on screen when it starts are shown at once rather than
 * animated, so nothing flashes. A MutationObserver picks up cards that arrive
 * later (client navigation, a list that renders after a fetch).
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    // Per run, not an attribute on the element: a rerun (React Strict Mode
    // runs effects twice in development) must start from scratch.
    const tracked = new WeakSet<Element>()

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          io.unobserve(entry.target)
        }
      },
      // 15% of the card on screen, and not in the last sliver of the viewport.
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
    )

    const track = (el: Element) => {
      if (el.classList.contains('is-revealed') || tracked.has(el)) return
      tracked.add(el)
      const rect = el.getBoundingClientRect()
      // Already in view: show it now, without the entrance.
      if (rect.top < window.innerHeight && rect.bottom > 0 && !root.classList.contains('reveal-ready')) {
        el.classList.add('is-revealed')
        return
      }
      io.observe(el)
    }

    document.querySelectorAll('.card-rise').forEach(track)
    // From here on, untracked cards start hidden until they are revealed.
    root.classList.add('reveal-ready')

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations)
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          if (node.matches('.card-rise')) track(node)
          node.querySelectorAll('.card-rise').forEach(track)
        })
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])

  return null
}
