import { useRouter } from '@tanstack/solid-router';
import { Component, createSignal } from 'solid-js';
import { Button } from '~/shared/components/ui/button';
import { useAuth } from '~/app/contexts/AuthContext';
import { AppPaths } from '~/app/routerPaths';
import AnimatedLogo from '~/features/auth/components/auth/AnimatedLogo';

const VerifyEmailPage: Component = () => {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const [resendSuccess, setResendSuccess] = createSignal(false);
  const [resendError, setResendError] = createSignal<string | null>(null);

  // Get email from URL query params
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || 'your email';

  const handleResend = async () => {
    setResendSuccess(false);
    setResendError(null);
    try {
      await signIn(email, undefined);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  return (
    <div class="flex min-h-screen bg-white">
      {/* Left Side - Email Confirmation */}
      <div class="flex flex-1 items-center justify-center px-8 py-12">
        <div class="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <AnimatedLogo />

          {/* Heading */}
          <div class="space-y-3 text-center">
            <h1 class="text-5xl font-bold text-slate-900">
              Check your inbox!
            </h1>
            <div class="space-y-2">
              <p class="text-lg text-slate-600">We sent a magic link to:</p>
              <p class="text-lg font-mono font-semibold text-slate-900 break-all px-4">{email}</p>
            </div>
          </div>

          {/* Visual instructions */}
          <div class="surface-panel p-6">
            <div class="flex items-center justify-between gap-2 text-center">
              <div class="flex-1 flex flex-col items-center gap-2">
                <div class="size-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span class="text-2xl">📧</span>
                </div>
                <p class="text-xs font-medium text-slate-600">Check email</p>
              </div>
              <svg class="size-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div class="flex-1 flex flex-col items-center gap-2">
                <div class="size-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <span class="text-2xl">🔗</span>
                </div>
                <p class="text-xs font-medium text-slate-600">Click link</p>
              </div>
              <svg class="size-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div class="flex-1 flex flex-col items-center gap-2">
                <div class="size-12 rounded-full bg-green-100 flex items-center justify-center">
                  <span class="text-2xl">✨</span>
                </div>
                <p class="text-xs font-medium text-slate-600">You're in!</p>
              </div>
            </div>
          </div>

          {/* Resend section */}
          <div class="space-y-3">
            {resendSuccess() && (
              <div class="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                Magic link resent! Check your inbox.
              </div>
            )}
            {resendError() && (
              <div class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {resendError()}
              </div>
            )}

            <div class="text-center space-y-3">
              <p class="text-sm text-slate-600">
                Didn't receive the email?
              </p>
              <Button
                type="button"
                variant="outline"
                class="w-full rounded-2xl"
                onClick={handleResend}
                disabled={isLoading() || resendSuccess()}
              >
                {isLoading() ? 'Resending…' : 'Resend magic link'}
              </Button>
            </div>
          </div>

          {/* Back link */}
          <div class="text-center">
            <button
              type="button"
              class="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline transition-colors"
              onClick={() => router.navigate({ to: AppPaths.signIn })}
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Animated Email Journey */}
      <div class="hidden flex-1 items-center justify-center bg-dot-grid lg:flex p-12">
        <div class="relative h-96 w-full max-w-lg flex items-center justify-center">
          {/* Envelope */}
          <div class="absolute left-20 top-1/2 -translate-y-1/2 animate-fade-in">
            <div class="relative">
              <div class="size-24 rounded-lg bg-white border-4 border-slate-300 shadow-lg flex items-center justify-center">
                <span class="text-4xl">📧</span>
              </div>
              <div class="absolute inset-0 rounded-lg bg-blue-400/20 blur-xl -z-10 animate-pulse" />
            </div>
          </div>

          {/* Magic link */}
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animation: 'slideRight 3s ease-out infinite' }}>
            <div class="relative">
              <div class="size-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg">
                <span class="text-2xl">🔗</span>
              </div>
              <div class="absolute inset-0 rounded-full bg-purple-400 blur-lg animate-pulse opacity-60" />
            </div>
          </div>

          {/* Browser */}
          <div class="absolute right-20 top-1/2 -translate-y-1/2" style={{ 'animation-delay': '1.5s' }}>
            <div class="relative size-24 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg flex items-center justify-center animate-fade-in">
              <span class="text-4xl">🌐</span>
            </div>
            <div class="absolute inset-0 rounded-xl bg-purple-400/30 blur-xl -z-10 animate-pulse" />
          </div>

          {/* Instructions */}
          <div class="absolute bottom-0 left-0 right-0 text-center space-y-1">
            <p class="text-sm font-medium text-slate-700">Click the link in your email to continue</p>
            <p class="text-xs text-slate-500">The link will expire in 15 minutes</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
