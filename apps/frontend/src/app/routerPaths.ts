export const AppPaths = {
  landing: '/',
  pricing: '/pricing',
  signIn: '/auth/sign-in',
  signUp: '/auth/sign-up',
  onboardingGoal: '/onboarding/goal',
  onboardingUseCase: '/onboarding/use-case',
  onboardingReferral: '/onboarding/referral',
  app: '/app',
  appDashboard: '/app',
  appEarn: '/app/earn',
  appSave: '/app/save',
  appInvest: '/app/invest',
  appSpend: '/app/spend',
  appDonate: '/app/donate',
  appMoneyMap: '/app/money-map',
  appTools: '/app/tools',
  appToolsCompound: '/app/tools/compound',
  appToolsWealthLadder: '/app/tools/wealth-ladder',
  appSettings: '/app/settings',
  appSettingsMembers: '/app/settings/members',
  appSettingsBilling: '/app/settings/billing',
  appSettingsOrganization: '/app/settings/organization',
} as const;

export type AppPathKey = keyof typeof AppPaths;
export type AppPathValue = (typeof AppPaths)[AppPathKey];
