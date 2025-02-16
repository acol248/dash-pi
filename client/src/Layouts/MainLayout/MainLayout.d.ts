import type { ReactNode } from "react";

interface Props {
  className?: HTMLElement["className"];
  children: ReactNode | ReactNode[];
}

export type { Props };
