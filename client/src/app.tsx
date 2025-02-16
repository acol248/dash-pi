import { useEffect, useState } from "preact/hooks";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";

// pages
import Main from "./pages/Main";
import Login from "./pages/Login";
import Profile from "./pages/Profile";

// helpers
import { checkAuth } from "./helpers/queries";
import ChangePassword from "./pages/ChangePassword";

export function App() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // check if user is authenticated
  useEffect(() => {
    if (window.location.pathname === "/logout") {
      fetch("/api/logout").then(() => (window.location.href = "/login"));

      return;
    }

    (async () => {
      const isAuthed = await checkAuth();
      setAuthed(isAuthed);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={authed ? <Main /> : <Navigate replace to="/login" />}
        />
        <Route
          path="/profile"
          element={authed ? <Profile /> : <Navigate replace to="/login" />}
        />
        <Route
          path="/change-password"
          element={
            authed ? <ChangePassword /> : <Navigate replace to="/login" />
          }
        />
        <Route
          path="/login"
          element={authed ? <Navigate replace to="/" /> : <Login />}
        />
      </Routes>
    </Router>
  );
}
