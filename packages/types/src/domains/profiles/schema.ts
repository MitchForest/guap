import { z } from 'zod';
import { UserRoleSchema } from '../auth';

export const ProfileRecordSchema = z.object({
  _id: z.string(),
  authId: z.string(),
  role: UserRoleSchema,
  displayName: z.string().optional(),
  email: z.string().optional(),
  householdId: z.string().nullable().optional(),
  guardianProfileId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  membershipId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProfileRecord = z.infer<typeof ProfileRecordSchema>;
