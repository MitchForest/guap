type AnalyticsEvent = {
  name: string;
  properties?: Record<string, unknown>;
};

export const trackEvent = (event: AnalyticsEvent) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', event.name, event.properties ?? {});
  }
  // Hook for real analytics providers in future.
};
