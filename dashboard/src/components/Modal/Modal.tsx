import { Dialog } from "@base-ui/react";

// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Modal.module.scss";

// Types
import type { ReactElement } from "preact/compat";

export interface Props {
  className?: string;
  variant?: "transparent";
  title?: string;
  trigger?: ReactElement;
  open?: boolean;
  children?: ReactElement | ReactElement[];
  onOpenChange?: (open: boolean) => void;
}

const mc = mapClassesCurried(maps, true);

export default function Modal({
  className,
  variant,
  title,
  trigger,
  open,
  children,
  onOpenChange,
}: Props) {
  const classList = useClassList({
    defaultClass: "modal",
    className,
    variant,
    maps,
    string: true,
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger render={trigger}></Dialog.Trigger>}

      <Dialog.Portal>
        <Dialog.Backdrop className={mc("modal-overlay")} />
        <Dialog.Popup className={classList}>
          {title && (
            <Dialog.Title className={mc("modal__title")}>{title}</Dialog.Title>
          )}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
