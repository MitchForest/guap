import { Outlet, Route, RouterProvider, RootRoute, createRouter, useRouter } from '@tanstack/solid-router';
import type { RoutePaths } from '@tanstack/solid-router';
import { Component, createEffect } from 'solid-js';
import AppLayout from '~/features/app-shell/pages/AppLayout';
import CanvasPage from '~/features/money-map/pages/CanvasPage';
import CompoundToolPage from '~/features/tools/pages/CompoundToolPage';
import DashboardPage from '~/features/dashboard/pages/DashboardPage';
import DonatePage from '~/features/donate/pages/DonatePage';
import EarnPage from '~/features/earn/pages/EarnPage';
import InvestPage from '~/features/invest/pages/InvestPage';
import LandingPage from '~/features/marketing/pages/LandingPage';
import PricingPage from '~/features/marketing/pages/PricingPage';
import RootLayout from '~/features/app-shell/pages/RootLayout';
import SavePage from '~/features/save/pages/SavePage';
import SignInPage from '~/features/auth/pages/SignInPage';
import SignUpPage from '~/features/auth/pages/SignUpPage';
import VerifyEmailPage from '~/features/auth/pages/VerifyEmailPage';
import AcceptInvitePage from '~/features/auth/pages/AcceptInvitePage';
import CompleteSignupPage from '~/features/auth/pages/CompleteSignupPage';
import SettingsLayout from '~/features/settings/pages/SettingsLayout';
import HouseholdMembersPage from '~/features/settings/pages/HouseholdMembersPage';
import HouseholdBillingPage from '~/features/settings/pages/HouseholdBillingPage';
import OrganizationRosterPage from '~/features/settings/pages/OrganizationRosterPage';
import GuardrailSettingsPage from '~/features/settings/pages/GuardrailSettingsPage';
import SpendPage from '~/features/spend/pages/SpendPage';
import WealthLadderPage from '~/features/tools/pages/WealthLadderPage';
import GoalSelectionPage from '~/features/onboarding/pages/GoalSelectionPage';
import UseCasePage from '~/features/onboarding/pages/UseCasePage';
import ReferralPage from '~/features/onboarding/pages/ReferralPage';
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

const completeSignupRoute = new Route({
  getParentRoute: () => authRoute,
  path: 'complete-signup',
  component: CompleteSignupPage,
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

const moneyMapRoute = new Route({
  getParentRoute: () => appRoute,
  path: 'money-map',
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

const settingsGuardrailsRoute = new Route({
  getParentRoute: () => settingsRoute,
  path: 'guardrails',
  component: GuardrailSettingsPage,
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

const authTree = authRoute.addChildren([
  signInRoute,
  signUpRoute,
  verifyRoute,
  acceptInviteRoute,
  completeSignupRoute,
]);
const onboardingTree = onboardingRoute.addChildren([goalRoute, useCaseRoute, referralRoute]);
const toolsTree = toolsRoute.addChildren([compoundRoute, wealthLadderRoute]);
const appTree = appRoute.addChildren([
  dashboardRoute,
  earnRoute,
  saveRoute,
  investRoute,
  spendRoute,
  donateRoute,
  moneyMapRoute,
  toolsTree,
  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsMembersRoute,
    settingsBillingRoute,
    settingsGuardrailsRoute,
    settingsOrganizationRoute,
  ]),
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
