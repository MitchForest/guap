import { Route, RouterProvider, RootRoute, createRouter } from '@tanstack/solid-router';
import { Component } from 'solid-js';
import CanvasPage from './routes/CanvasPage';
import RootLayout from './routes/RootLayout';

const rootRoute = new RootRoute({
  component: RootLayout,
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: CanvasPage,
});

const routeTree = rootRoute.addChildren([dashboardRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

export const AppRouter: Component = () => <RouterProvider router={router} />;
