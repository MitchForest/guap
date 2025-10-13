import type { ParentComponent } from 'solid-js';
import { AppDataProvider } from '~/app/contexts/AppDataContext';
import { AuthProvider } from '~/app/contexts/AuthContext';
import { ShellProvider } from '~/app/contexts/ShellContext';

const AppProviders: ParentComponent = (props) => (
  <AuthProvider>
    <AppDataProvider>
      <ShellProvider>{props.children}</ShellProvider>
    </AppDataProvider>
  </AuthProvider>
);

export { AppProviders };
