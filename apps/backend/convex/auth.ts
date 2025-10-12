import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { components } from '@guap/api/codegen/api';
import type { DataModel, Id } from '@guap/api/codegen/dataModel';
import { query } from '@guap/api/codegen/server';
import type { QueryCtx, MutationCtx } from '@guap/api/codegen/server';
import { betterAuth } from 'better-auth';
import { magicLink, organization, admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import type { UserRole } from '@guap/types';
import {
  MembershipRoleValues,
  MembershipStatusValues,
  OrganizationBillingIntervalValues,
  OrganizationBillingPlanValues,
  OrganizationKindValues,
} from '@guap/types';
import { sendMagicLinkEmail } from './magicLinkEmail';
import { sendOrganizationInvitationEmail } from './organizationInviteEmail';

const convexSiteUrl = process.env.CONVEX_SITE_URL!;
const frontendUrl = process.env.SITE_URL ?? 'http://localhost:3001';
const normalizedFrontendUrl = frontendUrl.replace(/\/+$/, '');

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_ALPHABET = '0123456789';
const NUMERIC_ALPHABET = '0123456789';

const getRandomBytes = (length: number) => {
  const buffer = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  }
  for (let index = 0; index < length; index += 1) {
    buffer[index] = Math.floor(Math.random() * 256);
  }
  return buffer;
};

const randomString = (length: number, alphabet: string) => {
  const output: Array<string> = [];
  const bytes = getRandomBytes(length);
  const maxIndex = alphabet.length;
  for (let index = 0; index < length; index += 1) {
    const charIndex = bytes[index]! % maxIndex;
    output.push(alphabet[charIndex]!);
  }
  return output.join('');
};

const generateShortCode = (length = 6) => randomString(length, SHORT_CODE_ALPHABET);
const generateJoinCode = (length = 6) => randomString(length, JOIN_CODE_ALPHABET);
const generateInviteCode = (length = 6) => randomString(length, NUMERIC_ALPHABET);
const generateInviteToken = () =>
  Array.from(getRandomBytes(16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const now = () => Date.now();

const defaultPlanForKind = (
  kind: (typeof OrganizationKindValues)[number]
): (typeof OrganizationBillingPlanValues)[number] => {
  switch (kind) {
    case 'family':
      return 'family';
    case 'internal':
      return 'standard';
    case 'institution':
    default:
      return 'standard';
  }
};

const defaultPricingForPlan = (
  plan: (typeof OrganizationBillingPlanValues)[number]
) => {
  switch (plan) {
    case 'solo':
      return {
        baseMonthlyCents: 4900,
        baseAnnualCents: 49000,
        includedSeats: 1,
      };
    case 'family':
      return {
        baseMonthlyCents: 7900,
        baseAnnualCents: 79000,
        includedSeats: 4,
      };
    case 'standard':
      return {
        includedSeats: 100,
        tiers: [
          {
            minSeats: 1,
            maxSeats: 100,
            monthlyCentsPerSeat: 1900,
            annualCentsPerSeat: 19000,
          },
          {
            minSeats: 101,
            maxSeats: null,
            monthlyCentsPerSeat: 900,
            annualCentsPerSeat: 9000,
          },
        ],
      };
    case 'high_volume':
    default:
      return {
        includedSeats: 100,
        tiers: [
          {
            minSeats: 1,
            maxSeats: 100,
            monthlyCentsPerSeat: 1900,
            annualCentsPerSeat: 19000,
          },
          {
            minSeats: 101,
            maxSeats: null,
            monthlyCentsPerSeat: 900,
            annualCentsPerSeat: 9000,
          },
        ],
      };
  }
};

const generateUniqueShortCode = async (db: MutationCtx['db'], length = 6): Promise<string> => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = generateShortCode(length);
    const existing = await db
      .query('organizations')
      .withIndex('by_short_code', (q: any) => q.eq('shortCode', candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique organization code');
};

const generateUniqueJoinCode = async (db: MutationCtx['db'], length = 6): Promise<string> => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = generateJoinCode(length);
    const existing = await db
      .query('organizations')
      .withIndex('by_join_code', (q: any) => q.eq('joinCode', candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique organization join code');
};

const generateUniqueOrganizationSlug = async (db: MutationCtx['db'], baseName: string): Promise<string> => {
  const baseSlug = slugify(baseName) || 'organization';
  let attempt = 0;
  while (attempt < 50) {
    const suffix = attempt === 0 ? '' : `-${randomString(4, '0123456789abcdef')}`;
    const candidate = `${baseSlug}${suffix}`;
    const existing = await db
      .query('organizations')
      .withIndex('by_slug', (q: any) => q.eq('slug', candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
    attempt += 1;
  }
  throw new Error('Unable to allocate unique organization slug');
};

const generateHouseholdSlug = async (db: MutationCtx['db'], organizationSlug: string): Promise<string> => {
  let attempt = 0;
  const baseSlug = `${organizationSlug}-household`;
  while (attempt < 50) {
    const suffix = attempt === 0 ? '' : `-${randomString(4, '0123456789abcdef')}`;
    const candidate = `${baseSlug}${suffix}`;
    const existing = await db
      .query('households')
      .withIndex('by_slug', (q: any) => q.eq('slug', candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
    attempt += 1;
  }
  throw new Error('Unable to allocate unique household slug for organization');
};

const getUserProfileByAuthId = async (db: MutationCtx['db'], authId: string) =>
  db
    .query('users')
    .withIndex('by_auth_id', (q: any) => q.eq('authId', authId))
    .unique();

const maybeGetUserById = async (db: MutationCtx['db'], userId: string) => {
  try {
    return await db.get(userId as Id<'users'>);
  } catch {
    return null;
  }
};

const mapMembershipRoleToUserRole = (membershipRole: string, currentRole: UserRole): UserRole => {
  if (currentRole === 'internal') {
    return currentRole;
  }
  switch (membershipRole) {
    case 'student':
      return 'student';
    case 'guardian':
      return 'guardian';
    case 'owner':
    case 'admin':
    case 'member':
      return 'admin';
    default:
      return currentRole;
  }
};

const mapMembershipRoleToHouseholdRole = (
  membershipRole: string
): (typeof MembershipRoleValues)[number] => {
  switch (membershipRole) {
    case 'guardian':
    case 'student':
    case 'internal':
      return membershipRole;
    case 'owner':
    case 'admin':
    case 'member':
    default:
      return 'admin';
  }
};

const normalizeMembershipRole = (
  role?: string,
  fallback: (typeof MembershipRoleValues)[number] = 'member'
): (typeof MembershipRoleValues)[number] =>
  role && (MembershipRoleValues as readonly string[]).includes(role as any)
    ? (role as (typeof MembershipRoleValues)[number])
    : fallback;

type HouseholdMembershipParams = {
  householdId: Id<'households'>;
  userId: Id<'users'>;
  role: (typeof MembershipRoleValues)[number];
  status?: (typeof MembershipStatusValues)[number];
  organizationMembershipId?: Id<'organizationMemberships'>;
};

const ensureHouseholdMembership = async (
  db: MutationCtx['db'],
  params: HouseholdMembershipParams
) => {
  const existing = await db
    .query('householdMemberships')
    .withIndex('by_household', (q: any) => q.eq('householdId', params.householdId))
    .filter((q: any) => q.eq(q.field('userId'), params.userId))
    .unique();

  if (existing) {
    await db.patch(existing._id, {
      role: params.role,
      status: params.status ?? existing.status ?? ('active' as (typeof MembershipStatusValues)[number]),
      organizationMembershipId: params.organizationMembershipId ?? existing.organizationMembershipId,
      updatedAt: now(),
    });
    return existing._id;
  }

  return await db.insert('householdMemberships', {
    householdId: params.householdId,
    userId: params.userId,
    role: params.role,
    status: params.status ?? ('active' as (typeof MembershipStatusValues)[number]),
    organizationMembershipId: params.organizationMembershipId,
    createdAt: now(),
    updatedAt: now(),
  });
};

const syncMembershipEffects = async (
  ctx: GenericCtx<DataModel>,
  {
    member,
    organization,
    user,
    invitationMetadata,
  }: {
    member: {
      id?: string;
      organizationId?: string;
      userId?: string | null;
      role?: string;
      status?: string;
    };
    organization?: { id: string } | null;
    user?: { id: string } | null;
    invitationMetadata?: Record<string, unknown> | null;
  }
) => {
  const db = getDb(ctx);
  const membershipId = member.id ? (member.id as Id<'organizationMemberships'>) : null;
  const organizationId = (member.organizationId ?? organization?.id) as Id<'organizations'> | undefined;
  if (!organizationId) {
    return;
  }

  const organizationDoc = await db.get(organizationId);
  if (!organizationDoc) {
    return;
  }

  let profile =
    (user?.id && (await getUserProfileByAuthId(db, user.id))) ??
    (member.userId ? await maybeGetUserById(db, member.userId) : null) ??
    (member.userId ? await getUserProfileByAuthId(db, member.userId) : null);

  if (!profile) {
    return;
  }

  if (membershipId) {
    await db.patch(membershipId, {
      userId: profile._id,
      status: member.status ?? 'active',
      updatedAt: now(),
    });
  }

  const householdTargets = new Set<Id<'households'>>();
  if (organizationDoc.primaryHouseholdId) {
    householdTargets.add(organizationDoc.primaryHouseholdId as Id<'households'>);
  }
  const metaHouseholdId = invitationMetadata?.householdId;
  if (typeof metaHouseholdId === 'string') {
    householdTargets.add(metaHouseholdId as Id<'households'>);
  }

  const membershipRole = member.role ?? 'member';
  const householdRole = mapMembershipRoleToHouseholdRole(membershipRole);

  if (householdTargets.size > 0 && membershipId) {
    for (const householdId of householdTargets) {
      await ensureHouseholdMembership(db, {
        householdId,
        userId: profile._id as Id<'users'>,
        role: householdRole,
        status: 'active',
        organizationMembershipId: membershipId,
      });
    }
  }

  const userUpdates: Record<string, unknown> = {
    updatedAt: now(),
    onboarding: undefined,
  };

  if (
    !profile.primaryOrganizationId ||
    profile.primaryOrganizationId === organizationId ||
    membershipRole === 'owner' ||
    membershipRole === 'admin'
  ) {
    userUpdates.primaryOrganizationId = organizationId;
  }

  if (membershipId) {
    userUpdates.defaultMembershipId = membershipId;
  }

  if (organizationDoc.primaryHouseholdId) {
    userUpdates.householdId = organizationDoc.primaryHouseholdId;
  } else if (typeof metaHouseholdId === 'string') {
    userUpdates.householdId = metaHouseholdId;
  }

  const nextUserRole = mapMembershipRoleToUserRole(membershipRole, profile.role as UserRole);
  if (nextUserRole !== profile.role && profile.role !== 'internal') {
    userUpdates.role = nextUserRole;
  }

  await db.patch(profile._id as Id<'users'>, userUpdates);
};

const organizationStatements = {
  organization: ['read', 'update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
} as const;

const organizationAccessControl = createAccessControl<typeof organizationStatements>(organizationStatements);

const ownerRole = organizationAccessControl.newRole({
  organization: ['read', 'update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
}) as any;

const adminRole = organizationAccessControl.newRole({
  organization: ['read', 'update'],
  member: ['create', 'update'],
  invitation: ['create', 'cancel'],
}) as any;

const teacherRole = organizationAccessControl.newRole({
  organization: ['read'],
}) as any;

const guardianRole = organizationAccessControl.newRole({
  organization: ['read'],
  invitation: ['create'],
}) as any;

const studentRole = organizationAccessControl.newRole({}) as any;

const resolveOrganizationType = (metadata?: Record<string, unknown>): 'household' | 'school' => {
  const candidate = typeof metadata?.type === 'string' ? (metadata.type as string) : undefined;
  if (candidate === 'school') {
    return 'school';
  }
  return 'household';
};

export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: true,
});

const getDb = (ctx: GenericCtx<DataModel>): MutationCtx['db'] =>
  (ctx as any).db as MutationCtx['db'];

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) =>
  betterAuth({
    logger: {
      disabled: optionsOnly,
    },
    baseURL: convexSiteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: process.env.ENABLE_EMAIL_PASSWORD_SIGN_IN === 'true',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [frontendUrl, 'http://localhost:3001'].filter(Boolean) as string[],
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url, token }) =>
          sendMagicLinkEmail({ email, url, token }),
      }),
      organization({
        ac: organizationAccessControl,
        roles: {
          owner: ownerRole,
          admin: adminRole,
          member: teacherRole,
          guardian: guardianRole,
          student: studentRole,
        },
        allowUserToCreateOrganization: true,
        schema: {
          session: {
            fields: {
              activeOrganizationId: 'activeOrganizationId',
            },
          },
          organization: {
            modelName: 'organizations',
            fields: {
              name: 'name',
              slug: 'slug',
              logo: 'logo',
              metadata: 'metadata',
              createdAt: 'createdAt',
            },
            additionalFields: {
              type: {
                type: 'string',
                input: true,
                defaultValue: 'household',
              },
              status: {
                type: 'string',
                input: true,
                defaultValue: 'active',
              },
              billingPlan: {
                type: 'string',
                input: true,
              },
              billingInterval: {
                type: 'string',
                input: true,
              },
              createdByUserId: {
                type: 'string',
                input: true,
              },
              shortCode: {
                type: 'string',
                input: true,
              },
              joinCode: {
                type: 'string',
                input: true,
              },
              updatedAt: {
                type: 'number',
                input: true,
                defaultValue: () => Date.now(),
                onUpdate: () => Date.now(),
              },
            },
          },
          member: {
            modelName: 'organizationMemberships',
            fields: {
              organizationId: 'organizationId',
              userId: 'userId',
              role: 'role',
              createdAt: 'createdAt',
            },
            additionalFields: {
              status: {
                type: 'string',
                input: true,
                defaultValue: 'active',
              },
              invitedByUserId: {
                type: 'string',
                input: true,
              },
              invitationId: {
                type: 'string',
                input: true,
              },
              updatedAt: {
                type: 'number',
                input: true,
                defaultValue: () => Date.now(),
                onUpdate: () => Date.now(),
              },
            },
          },
          invitation: {
            modelName: 'membershipInvites',
            fields: {
              organizationId: 'organizationId',
              email: 'email',
              role: 'role',
              status: 'state',
              inviterId: 'invitedByUserId',
              expiresAt: 'expiresAt',
              createdAt: 'createdAt',
            },
            additionalFields: {
              code: {
                type: 'string',
                input: true,
              },
              token: {
                type: 'string',
                input: true,
              },
              invitedAt: {
                type: 'number',
                input: true,
                defaultValue: () => Date.now(),
              },
              metadata: {
                type: 'json',
                input: true,
              },
              householdId: {
                type: 'string',
                input: true,
              },
              updatedAt: {
                type: 'number',
                input: true,
                defaultValue: () => Date.now(),
                onUpdate: () => Date.now(),
              },
              acceptedByUserId: {
                type: 'string',
                input: true,
              },
              acceptedAt: {
                type: 'number',
                input: true,
              },
              rejectedByUserId: {
                type: 'string',
                input: true,
              },
              rejectedAt: {
                type: 'number',
                input: true,
              },
              canceledByUserId: {
                type: 'string',
                input: true,
              },
              canceledAt: {
                type: 'number',
                input: true,
              },
            },
          },
        },
        sendInvitationEmail: async ({ invitation, organization, inviter }) => {
          const invitationCode = (invitation as unknown as { code?: string }).code ?? generateInviteCode();
          const invitationId = (invitation as unknown as { id?: string }).id ?? generateInviteToken();
          const acceptUrl = `${normalizedFrontendUrl}/auth/accept-invite/${invitationId}`;
          await sendOrganizationInvitationEmail({
            email: invitation.email,
            organizationName: organization.name,
            invitationCode,
            acceptUrl,
            inviterName: inviter?.user?.name ?? inviter?.user?.email ?? null,
          });
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            const db = getDb(ctx);
            const profile = await getUserProfileByAuthId(db, user.id);
            if (!profile) {
              throw new Error('User profile not found');
            }
            if (!['admin', 'internal'].includes(profile.role)) {
              throw new Error('Only admins or internal team members can create organizations');
            }

            const metadata = (organization.metadata ?? {}) as Record<string, unknown>;
            const requestedType = (organization as any).type ?? metadata.type;
            const resolvedType =
              requestedType === 'school' ? 'school' : resolveOrganizationType(metadata);

            const requestedKind = (organization as any).kind;
            const resolvedKind = OrganizationKindValues.includes(requestedKind as any)
              ? (requestedKind as (typeof OrganizationKindValues)[number])
              : resolvedType === 'school'
                ? 'institution'
                : 'family';

            const requestedPlan = (organization as any).billingPlan;
            const resolvedPlan = OrganizationBillingPlanValues.includes(requestedPlan as any)
              ? (requestedPlan as (typeof OrganizationBillingPlanValues)[number])
              : defaultPlanForKind(resolvedKind);

            const requestedInterval = (organization as any).billingInterval;
            const resolvedInterval = OrganizationBillingIntervalValues.includes(requestedInterval as any)
              ? (requestedInterval as (typeof OrganizationBillingIntervalValues)[number])
              : 'monthly';

            const pricing =
              (organization as any).pricing ?? defaultPricingForPlan(resolvedPlan);

            const name = organization.name ?? 'New Organization';
            const slug = await generateUniqueOrganizationSlug(db, organization.slug ?? name);
            const shortCode = await generateUniqueShortCode(db);
            const joinCode = await generateUniqueJoinCode(db);
            const timestamp = now();

            return {
              data: {
                ...organization,
                name,
                slug,
                metadata: {
                  ...metadata,
                  type: resolvedType,
                },
                type: resolvedType,
                kind: resolvedKind,
                status: (organization as any).status ?? 'active',
                shortCode,
                joinCode,
                billingPlan: resolvedPlan,
                billingInterval: resolvedInterval,
                pricing,
                createdAt: timestamp,
                updatedAt: timestamp,
                createdByUserId: profile._id,
              },
            };
          },
          afterCreateOrganization: async ({ organization, member, user }) => {
            const db = getDb(ctx);
            const organizationId = organization.id as Id<'organizations'>;
            const organizationDoc = await db.get(organizationId);
            if (!organizationDoc) {
              return;
            }

            if (!organizationDoc.primaryHouseholdId) {
              const householdSlug = await generateHouseholdSlug(db, organizationDoc.slug);
              const plan =
                organizationDoc.type === 'school' ? 'organization' : 'household';
              const planStatus = organizationDoc.status === 'active' ? 'active' : 'inactive';
              const planInterval = organizationDoc.billingInterval ?? 'monthly';
              const householdId = await db.insert('households', {
                name: `${organizationDoc.name} Household`,
                slug: householdSlug,
                plan,
                planStatus,
                planInterval,
                planSeats: undefined,
                linkedOrganizationId: organizationId,
                subscriptionId: undefined,
                customerId: undefined,
                createdAt: now(),
                updatedAt: now(),
              });

              await db.patch(organizationId, {
                primaryHouseholdId: householdId,
                updatedAt: now(),
              });
            }

            await syncMembershipEffects(ctx, { member, organization, user });
          },
          beforeUpdateOrganization: async ({ organization }) => ({
            data: {
              ...organization,
              updatedAt: now(),
            },
          }),
          beforeCreateInvitation: async ({ invitation, organization, inviter }) => {
            const db = getDb(ctx);
            const timestamp = now();
            const organizationId = invitation.organizationId ?? organization.id;
            const inviterAuthId = inviter?.user?.id;
            const inviterProfile = inviterAuthId
              ? await getUserProfileByAuthId(db, inviterAuthId)
              : null;

            const email = invitation.email?.trim().toLowerCase();
            if (!email) {
              throw new Error('Invitation email is required');
            }

            const expiresAt =
              invitation.expiresAt instanceof Date
                ? invitation.expiresAt.getTime()
                : invitation.expiresAt ?? undefined;

            return {
              data: {
                ...invitation,
                organizationId,
                role: normalizeMembershipRole(invitation.role, 'guardian'),
                inviterId: inviterProfile?._id ?? invitation.inviterId ?? undefined,
                email,
                code: generateInviteCode(),
                token: generateInviteToken(),
                status: 'pending',
                createdAt: timestamp,
                invitedAt: timestamp,
                updatedAt: timestamp,
                expiresAt,
                metadata: invitation.metadata ?? {},
              },
            };
          },
          beforeAddMember: async ({ member, user }) => {
            const db = getDb(ctx);
            const timestamp = now();
            const normalizedRole = normalizeMembershipRole(member.role);
            const profile = user?.id ? await getUserProfileByAuthId(db, user.id) : null;
            const resolvedUserId =
              profile?._id ??
              (member.userId ? (await maybeGetUserById(db, member.userId))?._id : undefined) ??
              member.userId;
            const createdAtValue =
              (member as any).createdAt instanceof Date
                ? (member as any).createdAt.getTime()
                : (member as any).createdAt ?? timestamp;
            const statusValue =
              (member as any).status && typeof (member as any).status === 'string'
                ? (member as any).status
                : 'active';

            return {
              data: {
                ...member,
                userId: resolvedUserId ?? member.userId,
                role: normalizedRole,
                status: statusValue,
                createdAt: createdAtValue,
                updatedAt: timestamp,
              },
            };
          },
          afterAddMember: async ({ member, organization, user }) => {
            await syncMembershipEffects(ctx, { member, organization, user });
          },
          afterAcceptInvitation: async ({ invitation, member, organization, user }) => {
            await syncMembershipEffects(ctx, {
              member,
              organization,
              user,
              invitationMetadata: (invitation.metadata as Record<string, unknown> | null) ?? null,
            });
          },
          beforeUpdateMemberRole: async ({ member }) => ({
            data: {
              ...member,
              updatedAt: now(),
            },
          }),
        },
      }),
      admin(),
      crossDomain({
        siteUrl: frontendUrl,
      }),
      convex(),
    ],
  });

export const getCurrentAuthUser = query({
  args: {},
  handler: async (ctx) => authComponent.getAuthUser(ctx as any),
});

export const requireAuth = async (ctx: GenericCtx<DataModel>) => {
  const authUser = await authComponent.getAuthUser(ctx as any);
  if (!authUser) {
    throw new Error('Authentication required');
  }
  return authUser;
};

export const requireRole = async (
  ctx: GenericCtx<DataModel>,
  allowedRoles: Array<UserRole>
) => {
  const authUser = await requireAuth(ctx);
  const db = getDb(ctx);
  const authId = (authUser as any).id as string;
  const profile = await db
    .query('users')
    .withIndex('by_auth_id', (q) => q.eq('authId', authId))
    .unique();

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new Error('Access denied');
  }

  return { authUser, profile };
};

export const requireInternal = async (ctx: GenericCtx<DataModel>) => requireRole(ctx, ['internal']);

export const requireAdminOrInternal = async (ctx: GenericCtx<DataModel>) =>
  requireRole(ctx, ['admin', 'internal']);
