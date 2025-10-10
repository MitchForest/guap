import { Accessor, Component, JSX, createContext, createSignal, useContext } from 'solid-js';

type ShellContextValue = {
  fullScreen: Accessor<boolean>;
  setFullScreen: (value: boolean) => void;
};

const ShellContext = createContext<ShellContextValue>();

type ShellProviderProps = {
  children: JSX.Element;
};

const ShellProvider: Component<ShellProviderProps> = (props) => {
  const [fullScreen, setFullScreen] = createSignal(false);

  const value: ShellContextValue = {
    fullScreen,
    setFullScreen,
  };

  return <ShellContext.Provider value={value}>{props.children}</ShellContext.Provider>;
};

const useShell = () => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
};

export { ShellProvider, useShell };
