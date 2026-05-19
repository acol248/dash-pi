import { AlertDialog } from "@base-ui/react";

// Styles
import useClassList, { mapClassesCurried } from "@blocdigital/useclasslist";
import maps from "./Alert.module.scss";

// Types
import type { ReactElement } from "preact/compat";

export interface Props {
  className?: string;
  trigger?: ReactElement;
  title: string;
  description?: string;
  open?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

const mc = mapClassesCurried(maps, true);

export default function Alert({
  className,
  trigger,
  title,
  description,
  open,
  onCancel,
  onConfirm,
}: Props) {
  const classList = useClassList({
    defaultClass: "alert",
    className,
    maps,
    string: true,
  });

  return (
    <AlertDialog.Root open={open} onOpenChange={onCancel}>
      {trigger && <AlertDialog.Trigger render={trigger} />}

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={mc("alert-backdrop")} />
        <AlertDialog.Popup className={classList}>
          <AlertDialog.Title className={mc("alert__title")}>
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className={mc("alert__description")}>
              {description}
            </AlertDialog.Description>
          )}

          <div className={mc("alert__actions")}>
            {trigger ? (
              <>
                <AlertDialog.Close onClick={onCancel}>Cancel</AlertDialog.Close>
                <AlertDialog.Close onClick={onConfirm}>
                  Confirm
                </AlertDialog.Close>
              </>
            ) : (
              <>
                <button onClick={onCancel}>Cancel</button>
                <button onClick={onConfirm}>Confirm</button>
              </>
            )}
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
