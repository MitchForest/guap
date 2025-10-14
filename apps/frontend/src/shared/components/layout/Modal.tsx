import { Show, type Component, type JSX } from 'solid-js';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/shared/components/ui';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: JSX.Element;
  description?: JSX.Element;
  footer?: JSX.Element;
  children: JSX.Element;
};

export const Modal: Component<ModalProps> = (props) => (
  <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Show when={props.title}>{(title) => <DialogTitle>{title()}</DialogTitle>}</Show>
          <Show when={props.description}>
            {(description) => <DialogDescription>{description()}</DialogDescription>}
          </Show>
        </div>
        <div class="flex flex-col gap-4">{props.children}</div>
        <Show when={props.footer}>{(footer) => <div class="mt-2 flex justify-end gap-2">{footer()}</div>}</Show>
      </div>
    </DialogContent>
  </Dialog>
);
