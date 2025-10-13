import type { ParentComponent } from 'solid-js';
import { AppDataProvider } from '~/contexts/AppDataContext';
import { AuthProvider } from '~/contexts/AuthContext';
import { ShellProvider } from '~/contexts/ShellContext';

const AppProviders: ParentComponent = (props) => (
  <AuthProvider>
    <AppDataProvider>
      <ShellProvider>{props.children}</ShellProvider>
    </AppDataProvider>
  </AuthProvider>
);

export { AppProviders };
