import type { UserRole } from '@guap/types';
import { Accessor, Component, JSX, createContext, createSignal, useContext } from 'solid-js';

type RoleContextValue = {
  role: Accessor<UserRole>;
  setRole: (role: UserRole) => void;
};

const RoleContext = createContext<RoleContextValue>();

type RoleProviderProps = {
  children: JSX.Element;
  initialRole?: UserRole;
};

const ROLE_STORAGE_KEY = 'guap:user-role';

const RoleProvider: Component<RoleProviderProps> = (props) => {
  const storedRole =
    typeof window !== 'undefined' ? window.localStorage.getItem(ROLE_STORAGE_KEY) : null;
  const validRoles: ReadonlyArray<UserRole> = ['owner', 'admin', 'member'];
  const initialRole =
    props.initialRole ??
    (storedRole && (validRoles as ReadonlyArray<string>).includes(storedRole)
      ? (storedRole as UserRole)
      : 'member');
  const [role, setRole] = createSignal<UserRole>(initialRole);

  const updateRole = (next: UserRole) => {
    setRole(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLE_STORAGE_KEY, next);
    }
  };

  const value: RoleContextValue = {
    role,
    setRole: updateRole,
  };

  return <RoleContext.Provider value={value}>{props.children}</RoleContext.Provider>;
};

const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

export { RoleProvider, useRole };
