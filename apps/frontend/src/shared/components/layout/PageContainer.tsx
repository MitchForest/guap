import type { ParentComponent } from 'solid-js';

export const PageContainer: ParentComponent = (props) => (
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
    {props.children}
  </div>
);
