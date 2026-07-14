import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from './Logo';
import { api } from '../lib/api';

interface AuthProps {
  onAuthSuccess: (user: any, token: string) => void;
  /** Omit in Electron so Sign In has no back-to-website control. */
  onBack?: () => void;
  /** Pre-fill demo credentials (after View Demo failed or manual sign-in help) */
  prefillDemo?: boolean;
}

export default function Auth({ onAuthSuccess, onBack, prefillDemo }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    identifier: '',
    email: '',
    password: '',
    name: '',
    username: ''
  });

  useEffect(() => {
    if (prefillDemo) {
      setIsLogin(true);
      setFormData((prev) => ({
        ...prev,
        identifier: 'demo_user',
        password: 'demo_user',
      }));
    }
  }, [prefillDemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { user, token } = await api.auth.login({
          identifier: formData.identifier,
          password: formData.password
        });
        onAuthSuccess(user, token);
      } else {
        const { user, token } = await api.auth.signup({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          username: formData.username.trim() || undefined
        });
        onAuthSuccess(user, token);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--app-bg)] p-4 selection:bg-brand-100 dark:selection:bg-brand-900/40">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {onBack ? (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-[var(--app-muted)] hover:text-brand-600 dark:hover:text-brand-400 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
        ) : (
          <div className="mb-8" />
        )}

        <div className="bg-white dark:bg-[var(--app-surface)] rounded-3xl shadow-xl shadow-brand-100 dark:shadow-black/30 border border-gray-100 dark:border-[var(--app-border)] overflow-hidden">
          <div className="p-8 pb-0 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg shadow-brand-200 ring-1 ring-gray-100 dark:bg-[var(--app-bg)] dark:shadow-none dark:ring-[var(--app-border)]">
              <Logo variant="colour" className="h-full w-full object-contain" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-[var(--app-fg)]">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-[var(--app-muted)]">
              {isLogin 
                ? 'Sign in to access your notes and diagrams.' 
                : 'Start organizing your thoughts today.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-medium flex items-center gap-2 border border-red-100 dark:border-red-900/60"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-[var(--app-muted)] uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[var(--app-surface)] border border-gray-200 dark:border-[var(--app-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-[var(--app-fg)] placeholder:text-gray-400 dark:placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            {isLogin ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-[var(--app-muted)] uppercase tracking-wider ml-1">Email or username</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.identifier}
                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[var(--app-surface)] border border-gray-200 dark:border-[var(--app-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-[var(--app-fg)] placeholder:text-gray-400 dark:placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    placeholder="you@example.com or your_username"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-[var(--app-muted)] uppercase tracking-wider ml-1">Email address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-[var(--app-surface)] border border-gray-200 dark:border-[var(--app-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-[var(--app-fg)] placeholder:text-gray-400 dark:placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-[var(--app-muted)] uppercase tracking-wider ml-1">Username <span className="font-normal normal-case text-gray-400">(optional)</span></label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                    <input
                      type="text"
                      autoComplete="off"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-[var(--app-surface)] border border-gray-200 dark:border-[var(--app-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-[var(--app-fg)] placeholder:text-gray-400 dark:placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      placeholder="letters, numbers, underscore (3–32)"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-[var(--app-muted)] uppercase tracking-wider ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-[var(--app-surface)] border border-gray-200 dark:border-[var(--app-border)] rounded-xl py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-[var(--app-fg)] placeholder:text-gray-400 dark:placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="p-8 pt-0 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-medium text-gray-500 dark:text-[var(--app-muted)] hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-[var(--app-muted)]">
          By continuing, you agree to Lumina's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
