// components
import MainLayout from "../../Layouts/MainLayout";

// styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./ChangePassword.module.scss";
import Input from "../../interface/Input";

const mc = mapClassesCurried(maps, true);

export default function ChangePassword() {
  const classList = useClassList({
    defaultClass: "change-password",
    maps,
    string: true,
  });

  /**
   * Handle change password form submission
   *
   * @param e event object
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.currentTarget));

    console.log(data);

    try {
      if (data.newPassword !== data.repeatPassword) {
        throw new Error("Passwords do not match");
      }

      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to fetch");

      window.location.href = "/profile";
    } catch (error) {
      console.warn(error);
    }
  };

  return (
    <MainLayout className={classList}>
      <form className={mc("change-password__form")} onSubmit={handleSubmit}>
        <h1 className={mc("change-password__title")}>Change Password</h1>

        <Input name="password" label="Current Password" />
        <Input name="newPassword" label="New Password" />
        <Input name="repeatPassword" label="Repeat New Password" />

        <button type="submit" className={mc("change-password__submit")}>
          Change Password
        </button>
      </form>
    </MainLayout>
  );
}
