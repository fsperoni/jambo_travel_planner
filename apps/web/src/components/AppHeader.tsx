import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { user, logout } = useAuth();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // AppHeader mounts exactly once per successful login (App.tsx swaps
  // LoginPage out for this view) — moving focus to the new page's own
  // heading right then is standard SPA view-transition guidance, since the
  // browser otherwise leaves focus on nothing in particular once the
  // "Sign in" button that had it gets unmounted. `tabIndex={-1}` makes the
  // heading programmatically focusable without adding it to the normal Tab
  // order, where a heading doesn't belong.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <header className={styles.header}>
      <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
        Jambo Travel Planner
      </h1>
      {user && (
        <div className={styles.userInfo}>
          <span className={styles.email}>{user.email}</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
