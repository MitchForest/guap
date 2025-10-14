import type { JSX, ParentComponent } from 'solid-js';
import { Show } from 'solid-js';

type FieldComponentProps = {
  form: any;
  name: string;
  label?: JSX.Element;
  description?: JSX.Element;
  children: (field: any) => JSX.Element;
};

export const FormField = (props: FieldComponentProps) => (
  <props.form.Field name={props.name}>
    {(field: any) => (
      <div class="flex flex-col gap-2">
        <Show when={props.label}>
          {(label) => (
            <label class="text-sm font-medium text-slate-700">
              {label()}
            </label>
          )}
        </Show>
        {props.children(field)}
        <Show when={props.description}>
          {(desc) => <p class="text-xs text-slate-500">{desc()}</p>}
        </Show>
        <Show when={field.state.meta.errors.length > 0}>
          <p class="text-xs text-rose-600">{String(field.state.meta.errors[0])}</p>
        </Show>
      </div>
    )}
  </props.form.Field>
);

type FormActionsProps = {
  children: JSX.Element;
  align?: 'start' | 'center' | 'end' | 'between';
};

const alignmentClass: Record<NonNullable<FormActionsProps['align']>, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

export const FormActions: ParentComponent<FormActionsProps> = (props) => (
  <div class={`flex flex-wrap gap-2 ${alignmentClass[props.align ?? 'end']}`}>
    {props.children}
  </div>
);
