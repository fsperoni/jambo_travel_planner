import { useAuth } from "../auth/AuthContext";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className={styles.header}>
      <span className={styles.title}>Jambo Travel Planner</span>
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
