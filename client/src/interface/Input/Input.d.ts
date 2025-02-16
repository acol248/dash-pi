import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  variant?: string;
  label: string;
}

export type { Props };
