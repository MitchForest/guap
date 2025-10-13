import type { OrganizationKind, UserRole } from '@guap/types';
import { useRouter } from '@tanstack/solid-router';
import { Component, createEffect, createSignal } from 'solid-js';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { useAuth } from '~/app/contexts/AuthContext';
import { AppPaths } from '~/app/routerPaths';
import AnimatedMoneyFlowDemo from '~/features/auth/components/signup/AnimatedMoneyFlowDemo';

const SignUpPage: Component = () => {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading } = useAuth();
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal<UserRole>('member');
  const [organizationName, setOrganizationName] = createSignal('');
  const [organizationKind, setOrganizationKind] = createSignal<OrganizationKind>('family');
  const [agreedToTerms, setAgreedToTerms] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);

  createEffect(() => {
    if (isAuthenticated()) {
      router.navigate({ to: AppPaths.app });
    }
  });

  createEffect(() => {
    const currentRole = role();
    if (currentRole !== 'owner') {
      setOrganizationName('');
    }
  });

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!agreedToTerms()) {
      setError('Please agree to the terms of service');
      return;
    }

    try {
      const trimmedEmail = email().trim();
      const trimmedName = name().trim();
      const currentRole = role();

      if (!trimmedEmail || !trimmedName) {
        setError('Name and email are required');
        return;
      }

      const payload: Parameters<typeof signUp>[0] = {
        email: trimmedEmail,
        name: trimmedName,
        role: currentRole,
      };

      if (currentRole === 'owner') {
        const orgName = organizationName().trim();
        if (!orgName) {
          setError('Organization name is required for household owners');
          return;
        }
        payload.organizationName = orgName;
        payload.organizationKind = organizationKind();
      }

      await signUp(payload);
      setSuccess('Magic link sent! Check your email to finish creating your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign up');
    }
  };

  return (
    <div class="flex min-h-screen bg-white">
      {/* Header */}
      <header class="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white">
        <div class="flex items-center justify-between px-8 py-4">
          <div class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span class="text-2xl">🪙</span>
            <span>Guap</span>
          </div>
          <Button
            type="button"
            variant="outline"
            class="rounded-full border-slate-300"
            onClick={() => router.navigate({ to: AppPaths.signIn })}
          >
            Log in
          </Button>
        </div>
      </header>

      <div class="flex w-full flex-col items-stretch pt-20 lg:flex-row">
        {/* Left Side - Form */}
        <div class="flex flex-1 items-center justify-center px-8 py-12 bg-white">
          <div class="w-full max-w-md">
            <div class="mb-10 space-y-2">
              <h1 class="text-5xl font-bold text-slate-900">Welcome To Guap!</h1>
              <p class="text-lg text-slate-600">Unlock your financial potential in minutes</p>
              <p class="text-base font-medium text-slate-700">In order to start, first create a user</p>
            </div>

            <form onSubmit={handleSubmit} class="space-y-4">
              <div class="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter your name"
                  required
                  value={name()}
                  onInput={(event) => setName(event.currentTarget.value)}
                  class="h-14 rounded-2xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900"
                />
              </div>

              <div class="space-y-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={email()}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  class="h-14 rounded-2xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900"
                />
              </div>

              <p class="text-sm text-slate-500">
                We'll send a secure link to your email. No password to remember.
              </p>

              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700">Role</label>
                <select
                  class="h-14 w-full rounded-2xl border border-slate-300 px-4 text-base text-slate-900 shadow-sm transition focus:border-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  value={role()}
                  onChange={(event) => setRole(event.currentTarget.value as UserRole)}
                >
                  <option value="member">Child</option>
                  <option value="owner">Parent / Guardian</option>
                </select>
            </div>

              {role() === 'owner' && (
                <div class="space-y-4 rounded-2xl bg-slate-50 p-4">
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700">Organization name</label>
                    <Input
                      type="text"
                      placeholder="e.g. Evergreen Academy"
                      required
                      value={organizationName()}
                      onInput={(event) => setOrganizationName(event.currentTarget.value)}
                      class="h-12 rounded-xl border border-slate-300 text-base placeholder:text-slate-400 focus:border-slate-900"
                    />
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-slate-700">Organization type</label>
                    <select
                      class="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 shadow-sm transition focus:border-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      value={organizationKind()}
                      onChange={(event) => setOrganizationKind(event.currentTarget.value as OrganizationKind)}
                    >
                      <option value="family">Homeschool / Family</option>
                      <option value="institution">School / Program</option>
                    </select>
                  </div>
                  <p class="text-sm text-slate-500">
                    We'll generate a short organization ID and access code so you can invite admins
                    and members after you confirm your email.
                  </p>
                </div>
              )}


              <label class="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={agreedToTerms()}
                  onChange={(e) => setAgreedToTerms(e.currentTarget.checked)}
                  class="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span>
                  By clicking 'Sign up', I agree to Guap's{' '}
                  <a href="#" class="font-medium text-slate-900 hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" class="font-medium text-slate-900 hover:underline">
                    Privacy Policy
                  </a>
                </span>
              </label>

              {error() && (
                <div class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                  {error()}
                </div>
              )}

              {success() && (
                <div class="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-600">
                  {success()}
                </div>
              )}

              <Button
                type="submit"
                class="h-14 w-full rounded-2xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
                disabled={isLoading() || !agreedToTerms()}
              >
                {isLoading() ? 'Creating account…' : 'Sign up'}
              </Button>
            </form>
          </div>
        </div>

        {/* Right Side - Animated Demo */}
        <div class="hidden flex-1 items-center justify-center lg:flex">
          <AnimatedMoneyFlowDemo />
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
