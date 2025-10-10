import type { ApiFromModules } from 'convex/server';
import type api from '../codegen/api';

export type { ApiFromModules };
export type BackendApi = typeof api;
