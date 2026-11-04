'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

type Item = { href: string; label: string };

/**
 * The phone menu: a native <dialog> (focus stays inside, Escape closes, the page behind is inert) with the pages set
 * big. Without JS the button is a plain link to the footer's page list, which every page has.
 */
export function MobileMenu({ items, cta }: { items: Item[]; cta: Item }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => dialog.current?.close(), [pathname]);

  const open = (e: React.MouseEvent) => {
    const d = dialog.current;
    if (!d?.showModal) return; // very old browsers: follow the link to the footer
    e.preventDefault();
    d.showModal();
  };

  return (
    <>
      <a href="#pages" onClick={open} aria-haspopup="dialog" className="menu-btn md:hidden">
        Menu
      </a>
      <dialog ref={dialog} className="menu" aria-label="Menu" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <div className="menu-inner container-x">
          <button type="button" className="menu-close" onClick={() => dialog.current?.close()}>
            Close
          </button>
          <nav aria-label="Site">
            <ul className="menu-list">
              {items.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => dialog.current?.close()}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href={cta.href} onClick={() => dialog.current?.close()} className="btn btn-primary mt-12 self-start">
            {cta.label}
          </Link>
        </div>
      </dialog>
    </>
  );
}
