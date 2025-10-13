import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { OrganizationKindSchema, UserRoleSchema } from '@guap/types';

const RecordSignupSchema = z.object({
  email: z.string(),
  role: UserRoleSchema,
  organizationName: z.string().optional(),
  organizationKind: OrganizationKindSchema,
});

const RecordInviteSchema = z.object({
  invitationId: z.string(),
  email: z.string().optional(),
});

const BootstrapResultSchema = z.object({
  shouldRefresh: z.boolean(),
});

export type AuthSignupRecordInput = z.infer<typeof RecordSignupSchema>;
export type AuthInviteRecordInput = z.infer<typeof RecordInviteSchema>;
export type AuthBootstrapResult = z.infer<typeof BootstrapResultSchema>;

const AuthRecordMutation = 'domains/auth/mutations:record' as const;
const AuthRecordInviteMutation = 'domains/auth/mutations:recordInvite' as const;
const AuthBootstrapMutation = 'domains/auth/mutations:bootstrap' as const;

export class AuthApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async recordSignup(input: AuthSignupRecordInput): Promise<void> {
    const parsed = RecordSignupSchema.parse(input);
    await (this.client.mutation as any)(AuthRecordMutation, parsed);
  }

  async recordInvite(input: AuthInviteRecordInput): Promise<void> {
    const parsed = RecordInviteSchema.parse(input);
    await (this.client.mutation as any)(AuthRecordInviteMutation, parsed);
  }

  async bootstrap(): Promise<AuthBootstrapResult> {
    const result = await (this.client.mutation as any)(AuthBootstrapMutation, {});
    return BootstrapResultSchema.parse(result);
  }
}

export const createAuthApi = (client: ConvexClientInstance) => new AuthApi(client);
