import { z } from 'zod';
import { UserRoleSchema } from './schemas';

export const BetterAuthSessionUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    role: z.union([UserRoleSchema, z.literal('user')]).optional(),
    activeOrganizationId: z.string().optional(),
    organizationId: z.string().optional(),
    organizationMembershipId: z.string().optional(),
    profileId: z.string().optional(),
    householdId: z.string().optional(),
  })
  .passthrough();

export const BetterAuthSessionSchema = z
  .object({
    user: BetterAuthSessionUserSchema,
    session: z
      .object({
        user: BetterAuthSessionUserSchema.partial().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
