import { Component } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
const RootLayout: Component = () => {
  return (
    <Outlet />
  );
};

export default RootLayout;
