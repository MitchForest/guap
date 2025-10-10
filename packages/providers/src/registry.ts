import type { ProviderAdapter } from './contracts';

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter) {
    this.providers.set(adapter.id, adapter);
  }

  unregister(providerId: string) {
    this.providers.delete(providerId);
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  list(): ProviderAdapter[] {
    return Array.from(this.providers.values());
  }
}

export const globalProviderRegistry = new ProviderRegistry();
