import type { ParentComponent } from 'solid-js';
import { AppDataProvider } from '~/contexts/AppDataContext';
import { AuthProvider } from '~/contexts/AuthContext';
import { RoleProvider } from '~/contexts/RoleContext';
import { ShellProvider } from '~/contexts/ShellContext';

const AppProviders: ParentComponent = (props) => (
  <RoleProvider>
    <AuthProvider>
      <AppDataProvider>
        <ShellProvider>{props.children}</ShellProvider>
      </AppDataProvider>
    </AuthProvider>
  </RoleProvider>
);

export { AppProviders };
