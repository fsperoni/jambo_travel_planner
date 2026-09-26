import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** `role="alert"` so assistive tech announces the failure as soon as it
 *  appears, without the page needing to move focus there manually. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.errorState} role="alert">
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
