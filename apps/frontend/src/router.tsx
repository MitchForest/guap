import { Outlet, Route, RouterProvider, RootRoute, createRouter, useRouter } from '@tanstack/solid-router';
import type { RoutePaths } from '@tanstack/solid-router';
import { Component, createEffect } from 'solid-js';
import AppLayout from './routes/AppLayout';
import CanvasPage from './routes/CanvasPage';
import CompoundToolPage from './routes/CompoundToolPage';
import DashboardPage from './routes/DashboardPage';
import DonatePage from './routes/DonatePage';
import EarnPage from './routes/EarnPage';
import InvestPage from './routes/InvestPage';
import LandingPage from './routes/LandingPage';
import PricingPage from './routes/PricingPage';
import RootLayout from './routes/RootLayout';
import SavePage from './routes/SavePage';
import SignInPage from './routes/SignInPage';
import SignUpPage from './routes/SignUpPage';
import VerifyEmailPage from './routes/VerifyEmailPage';
import AcceptInvitePage from './routes/AcceptInvitePage';
import SettingsLayout from './routes/settings/SettingsLayout';
import HouseholdMembersPage from './routes/settings/HouseholdMembersPage';
import HouseholdBillingPage from './routes/settings/HouseholdBillingPage';
import OrganizationRosterPage from './routes/settings/OrganizationRosterPage';
import SpendPage from './routes/SpendPage';
import WealthLadderPage from './routes/WealthLadderPage';
import GoalSelectionPage from './routes/onboarding/GoalSelectionPage';
import UseCasePage from './routes/onboarding/UseCasePage';
import ReferralPage from './routes/onboarding/ReferralPage';
import { AppPaths as StaticAppPaths } from './routerPaths';

const rootRoute = new RootRoute({
  component: RootLayout,
});

const landingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});

const pricingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/pricing',
  component: PricingPage,
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

const verifyRoute = new Route({
  getParentRoute: () => authRoute,
  path: 'verify',
  component: VerifyEmailPage,
});

const acceptInviteRoute = new Route({
  getParentRoute: () => authRoute,
  path: 'accept-invite/$invitationId',
  component: AcceptInvitePage,
});

const onboardingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'onboarding',
  component: () => <Outlet />,
});

const goalRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'goal',
  component: GoalSelectionPage,
});

const useCaseRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'use-case',
  component: UseCasePage,
});

const referralRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'referral',
  component: ReferralPage,
});

const SettingsIndexPage: Component = () => {
  const router = useRouter();
  createEffect(() => {
    router.navigate({ to: '/app/settings/members' });
  });
  return null;
};

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

const settingsRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: SettingsLayout,
});

const settingsIndexRoute = new Route({
  getParentRoute: () => settingsRoute,
  path: '/',
  component: SettingsIndexPage,
});

const settingsMembersRoute = new Route({
  getParentRoute: () => settingsRoute,
  path: 'members',
  component: HouseholdMembersPage,
});

const settingsBillingRoute = new Route({
  getParentRoute: () => settingsRoute,
  path: 'billing',
  component: HouseholdBillingPage,
});

const settingsOrganizationRoute = new Route({
  getParentRoute: () => settingsRoute,
  path: 'organization',
  component: OrganizationRosterPage,
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

const authTree = authRoute.addChildren([signInRoute, signUpRoute, verifyRoute, acceptInviteRoute]);
const onboardingTree = onboardingRoute.addChildren([goalRoute, useCaseRoute, referralRoute]);
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
  settingsRoute.addChildren([settingsIndexRoute, settingsMembersRoute, settingsBillingRoute, settingsOrganizationRoute]),
]);

const routeTree = rootRoute.addChildren([landingRoute, pricingRoute, authTree, onboardingTree, appTree]);

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
