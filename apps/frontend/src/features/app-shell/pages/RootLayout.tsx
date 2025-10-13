import { Component } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { Toaster } from 'solid-sonner';

const RootLayout: Component = () => {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" closeButton richColors />
    </>
  );
};

export default RootLayout;
