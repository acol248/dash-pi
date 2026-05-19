import { Popover as BasePopover } from "@base-ui/react";

// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Popover.module.scss";

// Types
import type { PopoverCloseProps } from "@base-ui/react";
import type { ReactElement } from "preact/compat";

export interface Props {
  className?: string;
  title?: string;
  trigger?: ReactElement;
  open?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  children?: ReactElement | ReactElement[];
  onOpenChange?: (open: boolean) => void;
}

const mc = mapClassesCurried(maps, true);

export default function Popover({
  className,
  title,
  trigger,
  open,
  side = "bottom",
  align = "center",
  sideOffset,
  alignOffset,
  children,
  onOpenChange,
}: Props) {
  const classList = useClassList({
    defaultClass: "popover",
    className,
    maps,
    string: true,
  });

  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <BasePopover.Trigger render={trigger} />}

      <BasePopover.Portal>
        <BasePopover.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
        >
          <BasePopover.Popup className={classList}>
            {title && (
              <BasePopover.Title className={mc("popover__title")}>
                {title}
              </BasePopover.Title>
            )}
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

interface PopoverContentProps extends Omit<
  PopoverCloseProps,
  "children" | "ref"
> {
  children?: ReactElement;
}

export const PopoverClose = ({ children, ...props }: PopoverContentProps) => {
  return <BasePopover.Close {...props} render={children} />;
};
