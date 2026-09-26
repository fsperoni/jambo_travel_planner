import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { AppHeader } from "./components/AppHeader";

export function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AppHeader />
      {/* The travel planner itself (city selector, weather, description)
          starts in Stage 4 — this is just enough to prove the authenticated
          view actually renders once login succeeds. */}
      <main>
        <p>You&rsquo;re signed in. The travel planner starts in Stage 4.</p>
      </main>
    </>
  );
}
