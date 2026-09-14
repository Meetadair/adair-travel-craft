/**
 * The footer, on every page.
 *
 * Three groups rather than one row of links: what the company is, what the
 * traveller's account holds, and the legal pages. The cookie control sits with
 * the legal group because that is where people look for it, and withdrawing
 * consent has to be as easy as giving it.
 */
import { Link } from "@tanstack/react-router";

import { openCookieSettings } from "@/lib/cookies";

const link =
  "text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground";

const heading = "text-xs font-medium text-foreground";

export function AppFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className={heading}>Adair</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/business" className={link}>
                  For companies
                </Link>
              </li>
              <li>
                <Link to="/about" className={link}>
                  About us
                </Link>
              </li>
              <li>
                <Link to="/cooperation" className={link}>
                  Cooperation
                </Link>
              </li>
              <li>
                <Link to="/creators" className={link}>
                  For creators
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className={heading}>Your account</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/support" className={link}>
                  Help
                </Link>
              </li>
              <li>
                <Link to="/contact" className={link}>
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/invoices" className={link}>
                  Invoices
                </Link>
              </li>
              <li>
                <Link to="/credit" className={link}>
                  Credit and referrals
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className={heading}>Legal</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/privacy" className={link}>
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className={link}>
                  Terms and conditions
                </Link>
              </li>
              <li>
                <Link to="/cookies" className={link}>
                  Cookie policy
                </Link>
              </li>
              <li>
                <button type="button" onClick={openCookieSettings} className={link}>
                  Cookie settings
                </button>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Adair Kft. · Budapest
        </p>
      </div>
    </footer>
  );
}
