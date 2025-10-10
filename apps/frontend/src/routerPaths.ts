export const AppPaths = {
  landing: '/',
  signIn: '/auth/sign-in',
  signUp: '/auth/sign-up',
  app: '/app',
  appDashboard: '/app',
  appEarn: '/app/earn',
  appSave: '/app/save',
  appInvest: '/app/invest',
  appSpend: '/app/spend',
  appDonate: '/app/donate',
  appAutomations: '/app/automations',
  appTools: '/app/tools',
  appToolsCompound: '/app/tools/compound',
  appToolsWealthLadder: '/app/tools/wealth-ladder',
} as const;

export type AppPathKey = keyof typeof AppPaths;
export type AppPathValue = (typeof AppPaths)[AppPathKey];
