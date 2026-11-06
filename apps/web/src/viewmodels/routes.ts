/**
 * Static-export route table (F4). No dynamic path segments.
 * `/auction` reads the intent hash from the `h` query string.
 * Shells live at `app/<segment>/page.shell.tsx` (`/` → `app/page.shell.tsx`).
 * MASTER owns `page.tsx` and must not be created by the shell task.
 */

export interface RouteDef {
  /** Path beginning with `/`. `/` is the Trade page. */
  path: "/" | "/auction" | "/solvers" | "/book" | "/solver" | "/evidence";
  /** Header and document title. */
  title: string;
  /** Included in the header nav. */
  nav: boolean;
  /** Query key when the page is parameterized without a dynamic segment. */
  queryKey?: "h";
}

export const routes: readonly RouteDef[] = [
  { path: "/", title: "Trade", nav: true },
  { path: "/auction", title: "Live auction", nav: false, queryKey: "h" },
  { path: "/solvers", title: "Solvers", nav: true },
  { path: "/book", title: "Book", nav: true },
  { path: "/solver", title: "Run a solver", nav: true },
  { path: "/evidence", title: "Evidence", nav: true },
];
