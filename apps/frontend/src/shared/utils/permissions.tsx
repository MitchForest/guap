import type { Accessor, JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { UserRole } from '@guap/types';

export const usePermission = (
  role: Accessor<UserRole | null | undefined>,
  allowed: ReadonlyArray<UserRole>
) => {
  return createMemo(() => {
    const current = role();
    return current ? allowed.includes(current) : false;
  });
};

type PermissionGateProps = {
  can: boolean | Accessor<boolean>;
  fallback?: JSX.Element;
  children: JSX.Element;
};

export const PermissionGate = (props: PermissionGateProps) => (
  <Show when={typeof props.can === 'function' ? (props.can as Accessor<boolean>)() : props.can} fallback={props.fallback ?? null}>
    {props.children}
  </Show>
);
