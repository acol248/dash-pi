import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";

// styles
import maps from "./app.module.scss";

const mc = mapClassesCurried(maps, true);

export function App() {
  const classList = useClassList({ defaultClass: "app", maps, string: true });

  return (
    <div className={classList}>
      <video autoplay muted />

      <div className={mc("app__media-grid")}></div>
    </div>
  );
}
