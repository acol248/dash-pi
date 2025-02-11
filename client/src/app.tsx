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

// helpers
import { checkAuth } from "./helpers/queries";

export function App() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // check if user is authenticated
  useEffect(() => {
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
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}
