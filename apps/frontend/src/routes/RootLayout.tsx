import { Component } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import TopBar from '../components/layout/TopBar';

const RootLayout: Component = () => {
  return (
    <div class="flex h-full flex-col bg-[var(--surface)]">
      <TopBar />
      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default RootLayout;
