import React from 'react';
import { motion } from 'motion/react';
import {
  Zap,
  Shield,
  Globe,
  ArrowRight,
  CheckCircle2,
  Notebook,
  Code,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Logo } from './Logo';

/** SaaS marketing page — primary brand #174a73 (Tailwind `brand-700`). */
interface LandingPageProps {
  onGetStarted: () => void;
  /** One-click demo: signs in as demo_user / demo_user */
  onViewDemo: () => void;
  viewDemoLoading?: boolean;
}

export default function LandingPage({
  onGetStarted,
  onViewDemo,
  viewDemoLoading = false,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--app-bg)] font-sans text-[var(--app-fg)] selection:bg-brand-100 dark:selection:bg-brand-900/50">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-[#174a73] dark:text-brand-300">
            <Logo className="h-9 w-auto" />
            <span>Lumina Notes</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-[var(--app-fg)]/90">
            <a href="#features" className="hover:text-[#174a73] transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-[#174a73] transition-colors">
              Pricing
            </a>
            <a href="#about" className="hover:text-[#174a73] transition-colors">
              About
            </a>
          </div>
          <button
            onClick={onGetStarted}
            className="bg-[#174a73] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-brand-800 transition-all shadow-lg shadow-brand-200"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest text-[#174a73] dark:text-brand-300 uppercase bg-brand-50 dark:bg-brand-950/60 rounded-full">
              The Future of Note-Taking
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-[var(--app-fg)] mb-6 tracking-tight">
              Organize your thoughts, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#174a73] to-brand-600 dark:from-brand-400 dark:to-brand-300">
                visualize your data.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-[var(--app-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
              Lumina Notes combines the simplicity of OneNote with the power of Markdown,
              Mermaid diagrams, and Plotly charts. Built for developers and thinkers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="w-full sm:w-auto bg-[#174a73] text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-brand-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-200 group"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                type="button"
                disabled={viewDemoLoading}
                onClick={onViewDemo}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#174a73] bg-[var(--app-surface)] px-8 py-4 text-lg font-bold text-[#174a73] transition-all hover:bg-brand-50 disabled:opacity-60 dark:border-brand-500 dark:bg-[var(--app-bg)] dark:text-brand-300 dark:hover:bg-[var(--app-surface)] sm:w-auto"
              >
                {viewDemoLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening demo…
                  </>
                ) : (
                  'View Demo'
                )}
              </button>
            </div>
          </motion.div>

          {/* App Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-[#174a73] to-brand-600 rounded-[2.5rem] blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative bg-[var(--app-surface)] rounded-2xl shadow-2xl border border-[var(--app-border)] overflow-hidden aspect-video flex items-center justify-center text-gray-300">
              <img
                src="https://picsum.photos/seed/lumina-app/1200/800"
                alt="App Preview"
                className="w-full h-full object-cover opacity-80 dark:opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/5 dark:bg-black/30 flex items-center justify-center">
                <div className="flex items-center gap-4 rounded-2xl border border-[var(--app-border)] bg-white/90 p-6 shadow-xl backdrop-blur dark:bg-[var(--app-surface)]/95">
                  <div className="w-12 h-12 bg-[#174a73] rounded-full flex items-center justify-center text-white">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900 dark:text-[var(--app-fg)]">Real-time Sync</div>
                    <div className="text-sm text-gray-500 dark:text-[var(--app-muted)]">Your notes, everywhere.</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="bg-gray-50 py-24 dark:bg-[var(--app-surface)]/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-[var(--app-fg)]">
              Everything you need to think better
            </h2>
            <p className="text-gray-600 dark:text-[var(--app-muted)]">
              Powerful tools integrated into a seamless writing experience.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Code className="w-6 h-6 text-[#174a73]" />,
                title: 'Markdown First',
                desc: 'Full GFM support with live preview, syntax highlighting, and task lists.',
              },
              {
                icon: <Globe className="w-6 h-6 text-brand-600" />,
                title: 'Mermaid Diagrams',
                desc: 'Turn text into flowcharts, sequence diagrams, and Gantt charts instantly.',
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-brand-700" />,
                title: 'Plotly Integration',
                desc: 'Embed interactive charts and data visualizations directly in your notes.',
              },
              {
                icon: <Notebook className="w-6 h-6 text-brand-600" />,
                title: 'Infinite Hierarchy',
                desc: 'Organize with Notebooks, Sections, and Pages just like OneNote.',
              },
              {
                icon: <Zap className="w-6 h-6 text-brand-500" />,
                title: 'Blazing Fast',
                desc: 'Built with modern tech for instant loads and smooth interactions.',
              },
              {
                icon: <Shield className="w-6 h-6 text-brand-800" />,
                title: 'Secure & Private',
                desc: 'Your data is encrypted and stored securely in our cloud.',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm transition-all hover:shadow-md dark:bg-[var(--app-bg)]/80"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-[var(--app-surface)]">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-[var(--app-fg)]">{feature.title}</h3>
                <p className="text-gray-600 dark:text-[var(--app-muted)] leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-[var(--app-fg)]">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-600 dark:text-[var(--app-muted)]">Start for free, upgrade as you grow.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-10 shadow-sm dark:bg-[var(--app-bg)]/80">
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-[var(--app-fg)]">Free</h3>
              <div className="text-4xl font-extrabold mb-6 text-gray-900 dark:text-[var(--app-fg)]">
                $0<span className="text-lg text-gray-400 dark:text-[var(--app-muted)] font-normal">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['Unlimited Notebooks', 'Markdown Support', 'Mermaid Diagrams', 'Local Sync'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-[var(--app-fg)]/90">
                    <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full rounded-xl border border-[var(--app-border)] py-4 font-bold text-gray-900 transition-all hover:bg-gray-50 dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-surface)]"
              >
                Get Started
              </button>
            </div>
            <div className="bg-[#174a73] p-10 rounded-3xl shadow-xl shadow-brand-200 flex flex-col text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-extrabold mb-6">
                $9<span className="text-lg text-brand-100 font-normal">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['Everything in Free', 'Cloud Sync', 'Collaboration', 'Plotly Charts', 'Priority Support'].map(
                  (item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      {item}
                    </li>
                  )
                )}
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full py-4 rounded-xl bg-white text-[#174a73] font-bold hover:bg-brand-50 transition-all"
              >
                Go Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[var(--app-border)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 font-bold text-xl text-[#174a73] dark:text-brand-300">
            <Logo className="h-9 w-auto" />
            <span>Lumina Notes</span>
          </div>
          <div className="flex flex-wrap items-center gap-8 text-sm text-gray-500 dark:text-[var(--app-muted)]">
            <a href="#" className="hover:text-[#174a73] dark:hover:text-brand-300">
              Privacy
            </a>
            <a href="#" className="hover:text-[#174a73] dark:hover:text-brand-300">
              Terms
            </a>
            <a href="#" className="hover:text-[#174a73] dark:hover:text-brand-300">
              Twitter
            </a>
            <a href="#" className="hover:text-[#174a73] dark:hover:text-brand-300">
              GitHub
            </a>
          </div>
          <div className="text-sm text-gray-400 dark:text-[var(--app-muted)]">
            © 2026 Lumina Notes. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
