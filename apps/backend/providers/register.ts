import { globalProviderRegistry, virtualProvider } from '@guap/providers';

if (!globalProviderRegistry.get(virtualProvider.id)) {
  globalProviderRegistry.register(virtualProvider);
}

export const defaultProviderId = virtualProvider.id;

export const getProvider = (providerId: string = defaultProviderId) =>
  globalProviderRegistry.get(providerId) ?? virtualProvider;
