import MainLayout from "../../Layouts/MainLayout";

// styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Profile.module.scss";

const mc = mapClassesCurried(maps, true);

export default function Profile() {
  const classList = useClassList({
    defaultClass: "profile",
    maps,
    string: true,
  });

  return (
    <MainLayout className={classList}>
      <div className={mc("profile__inner")}>
        <a className={mc("profile__link")} href="/logout">
          Logout
        </a>
      </div>
    </MainLayout>
  );
}
