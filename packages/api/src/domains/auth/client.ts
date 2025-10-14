import { z } from 'zod';
import type { ConvexClientInstance } from '../../core/client';
import { OrganizationKindSchema, UserRoleSchema } from '@guap/types';

const CompleteSignupSchema = z.object({
  role: UserRoleSchema,
  organizationKind: OrganizationKindSchema,
  organizationName: z.string().optional(),
});

const CompleteSignupResultSchema = z.object({
  shouldRefresh: z.boolean(),
  organizationId: z.string().optional().nullable(),
});

export type AuthCompleteSignupInput = z.infer<typeof CompleteSignupSchema>;
export type AuthCompleteSignupResult = z.infer<typeof CompleteSignupResultSchema>;

const AuthCompleteSignupMutation = 'domains/auth/mutations:completeSignup' as const;

export class AuthApi {
  constructor(private readonly client: ConvexClientInstance) {}

  async completeSignup(
    input: AuthCompleteSignupInput
  ): Promise<AuthCompleteSignupResult> {
    const parsed = CompleteSignupSchema.parse(input);
    const result = await (this.client.mutation as any)(
      AuthCompleteSignupMutation,
      parsed
    );
    return CompleteSignupResultSchema.parse(result);
  }
}

export const createAuthApi = (client: ConvexClientInstance) => new AuthApi(client);
