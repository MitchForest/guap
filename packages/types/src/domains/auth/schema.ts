import { z } from 'zod';
import { BetterAuthRoleValues } from '../../generated/betterAuthRoles';

export const UserRoleValues = BetterAuthRoleValues;
export const UserRoleSchema = z.enum([...UserRoleValues]);

export type UserRole = z.infer<typeof UserRoleSchema>;
