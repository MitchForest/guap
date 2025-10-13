import { ConvexClient } from 'convex/browser';

export const createConvexClient = (url: string) => new ConvexClient(url);

export type ConvexClientInstance = ConvexClient;
