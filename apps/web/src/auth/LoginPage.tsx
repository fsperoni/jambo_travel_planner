import { useState, type FormEvent } from "react";
import { toErrorMessage } from "../api/http";
import { useDelayedFlag } from "../lib/useDelayedFlag";
import { useAuth } from "./AuthContext";
import styles from "./LoginPage.module.css";

// Render's free tier spins the API down when idle, so the very first
// request after a period of inactivity can take significantly longer than
// normal. This doesn't try to detect a cold start specifically (there's no
// reliable way to from the browser) — it just reassures the user once a
// login attempt has genuinely been slow for a while, regardless of cause.
const SLOW_REQUEST_NOTICE_DELAY_MS = 4000;

export function LoginPage() {
  const { login, isSessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showSlowNotice = useDelayedFlag(isPending, SLOW_REQUEST_NOTICE_DELAY_MS);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      // On success, AuthProvider's `user` state flips to non-null and
      // App.tsx swaps this page out for the authenticated view — there's
      // nothing further to do here.
    } catch (err) {
      setErrorMessage(toErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(e) => void handleSubmit(e)} aria-label="Sign in">
        <h1 className={styles.title}>Jambo Travel Planner</h1>

        {isSessionExpired && (
          <p role="status" className={styles.notice}>
            Your session expired. Please sign in again.
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        {errorMessage && (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        )}

        {showSlowNotice && (
          <p role="status" className={styles.notice}>
            Taking longer than usual — the server may be waking up. This can take up to a minute on
            the first request.
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
