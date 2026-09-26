import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { AppHeader } from "./components/AppHeader";
import { TravelPlannerPage } from "./travel/TravelPlannerPage";

export function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AppHeader />
      <main>
        <TravelPlannerPage />
      </main>
    </>
  );
}
