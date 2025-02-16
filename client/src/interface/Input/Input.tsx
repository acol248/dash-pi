// styles
import useClassList from "@blocdigital/useclasslist";
import maps from "./Input.module.scss";

// types
import type { Props } from "./Input.d";

export default function Input({
  className,
  variant,
  children,
  label,
  ...props
}: Props) {
  const classList = useClassList({ defaultClass: "input", maps, string: true });

  return (
    <label className={classList}>
      {label}
      <input {...props} />
    </label>
  );
}
