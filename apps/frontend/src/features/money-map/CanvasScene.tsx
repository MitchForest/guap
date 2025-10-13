import type { Accessor, Component, JSX } from 'solid-js';

type CanvasSceneProps = {
  drawerOpen: Accessor<boolean>;
  simulationPanelOpen: Accessor<boolean>;
  toolbar: JSX.Element;
  viewport: JSX.Element;
  heroOverlay?: JSX.Element;
  topRight?: JSX.Element;
  contextMenu?: JSX.Element;
  drawer?: JSX.Element;
  bottomDock?: JSX.Element;
  zoomPad?: JSX.Element;
  simulationPanel?: JSX.Element;
  modals?: JSX.Element;
};

export const CanvasScene: Component<CanvasSceneProps> = (props) => (
  <div
    class="relative h-full w-full"
    classList={{
      'pr-[360px]': props.drawerOpen(),
      'pl-[360px]': props.simulationPanelOpen(),
    }}
  >
    {props.toolbar}
    {props.viewport}
    {props.heroOverlay}
    <ShowIf present={props.topRight}>
      {(content) => (
        <div class="pointer-events-none absolute right-6 top-6 z-10 flex flex-col items-end gap-1.5">
          {content}
        </div>
      )}
    </ShowIf>
    {props.contextMenu}
    <div
      class="absolute right-0 top-0 z-40 h-full w-[360px]"
      classList={{ 'pointer-events-none': !props.drawerOpen() }}
    >
      {props.drawer}
    </div>
    {props.bottomDock}
    {props.zoomPad}
    {props.simulationPanel}
    {props.modals}
  </div>
);

type ShowIfProps = {
  present?: JSX.Element;
  children: (content: JSX.Element) => JSX.Element;
};

const ShowIf: Component<ShowIfProps> = (props) =>
  props.present ? props.children(props.present) : null;
