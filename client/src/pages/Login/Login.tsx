// components
import Input from "../../interface/Input";

// styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Login.module.scss";

const mc = mapClassesCurried(maps, true);

export default function Login() {
  const classList = useClassList({ defaultClass: "login", maps, string: true });

  /**
   * User login
   * Use form data to send a login POST request to the server
   *
   * @param e form event object
   */
  const handleLogin = async (e: Event) => {
    e.preventDefault();

    try {
      const form = e.target as HTMLFormElement;
      const data = Object.fromEntries(new FormData(form));

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Invalid credentials");

      window.location.href = "/";
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <main className={classList}>
      <form className={mc('login__form')} onSubmit={handleLogin}>
        <h1>Login</h1>

        <Input label="Username" name="username" autocomplete="off" />
        <Input
          label="Password"
          name="password"
          type="password"
          autocomplete="off"
        />

        <button type="submit">Login</button>
      </form>
    </main>
  );
}
