import type { CityDescription } from "../api/types";
import styles from "./CityDescriptionCard.module.css";

interface CityDescriptionCardProps {
  cityDescription: CityDescription;
}

export function CityDescriptionCard({ cityDescription }: CityDescriptionCardProps) {
  return (
    <section className={styles.card} aria-label="About this city">
      {cityDescription.description ? (
        <>
          <p className={styles.text}>{cityDescription.description}</p>
          {cityDescription.sourceUrl && (
            <a
              href={cityDescription.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.attribution}
            >
              Read more on Wikipedia
            </a>
          )}
        </>
      ) : (
        // A missing description is a normal outcome (no Wikipedia article,
        // or an ambiguous title — see the README's trade-offs section),
        // not an error, so this isn't rendered via ErrorState.
        <p className={styles.empty}>No description available for {cityDescription.title}.</p>
      )}
    </section>
  );
}
