import { Outlet, Route, RouterProvider, RootRoute, createRouter } from '@tanstack/solid-router';
import type { RoutePaths } from '@tanstack/solid-router';
import { Component } from 'solid-js';
import AppLayout from './routes/AppLayout';
import CanvasPage from './routes/CanvasPage';
import CompoundToolPage from './routes/CompoundToolPage';
import DashboardPage from './routes/DashboardPage';
import DonatePage from './routes/DonatePage';
import EarnPage from './routes/EarnPage';
import InvestPage from './routes/InvestPage';
import LandingPage from './routes/LandingPage';
import RootLayout from './routes/RootLayout';
import SavePage from './routes/SavePage';
import SignInPage from './routes/SignInPage';
import SignUpPage from './routes/SignUpPage';
import SpendPage from './routes/SpendPage';
import WealthLadderPage from './routes/WealthLadderPage';
import { AppPaths as StaticAppPaths } from './routerPaths';

const rootRoute = new RootRoute({
  component: RootLayout,
});

const landingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});

const authRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'auth',
  component: () => <Outlet />,
});

const signInRoute = new Route({
  getParentRoute: () => authRoute,
  path: 'sign-in',
  component: SignInPage,
});

const signUpRoute = new Route({
  getParentRoute: () => authRoute,
  path: 'sign-up',
  component: SignUpPage,
});

const appRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'app',
  component: AppLayout,
});

const dashboardRoute = new Route({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
});

const earnRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'earn',
  component: EarnPage,
});

const saveRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'save',
  component: SavePage,
});

const investRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'invest',
  component: InvestPage,
});

const spendRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'spend',
  component: SpendPage,
});

const donateRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'donate',
  component: DonatePage,
});

const automationsRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'automations',
  component: CanvasPage,
});

const toolsRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'tools',
  component: () => <Outlet />,
});

const compoundRoute = new Route({
  getParentRoute: () => toolsRoute,
  path: 'compound',
  component: CompoundToolPage,
});

const wealthLadderRoute = new Route({
  getParentRoute: () => toolsRoute,
  path: 'wealth-ladder',
  component: WealthLadderPage,
});

const authTree = authRoute.addChildren([signInRoute, signUpRoute]);
const toolsTree = toolsRoute.addChildren([compoundRoute, wealthLadderRoute]);
const appTree = appRoute.addChildren([
  dashboardRoute,
  earnRoute,
  saveRoute,
  investRoute,
  spendRoute,
  donateRoute,
  automationsRoute,
  toolsTree,
]);

const routeTree = rootRoute.addChildren([landingRoute, authTree, appTree]);

export const router = createRouter({ routeTree });

type RawRoutePath = RoutePaths<typeof router.routeTree>;

export type AppRoutePath = Exclude<RawRoutePath, '/app/'>;

export const AppPaths = StaticAppPaths as Record<keyof typeof StaticAppPaths, AppRoutePath>;

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

export const AppRouter: Component = () => <RouterProvider router={router} />;
