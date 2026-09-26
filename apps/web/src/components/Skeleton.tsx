import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
}

/** A loading placeholder block. `aria-hidden` since it conveys nothing a
 *  screen reader needs — the loading *state* itself is announced by
 *  whichever `aria-live`/`role="status"` region wraps it (see
 *  TravelPlannerPage), not by the placeholder shapes themselves. */
export function Skeleton({ width = "100%", height = "1rem" }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}
