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
  BarChart3 
} from 'lucide-react';
import { Logo } from './Logo';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-purple-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-purple-700">
            <Logo className="h-9 w-auto" />
            <span>Lumina Notes</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-purple-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-purple-600 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-purple-600 transition-colors">About</a>
          </div>
          <button 
            onClick={onGetStarted}
            className="bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
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
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest text-purple-600 uppercase bg-purple-50 rounded-full">
              The Future of Note-Taking
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight">
              Organize your thoughts, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                visualize your data.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Lumina Notes combines the simplicity of OneNote with the power of Markdown, 
              Mermaid diagrams, and Plotly charts. Built for developers and thinkers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto bg-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-200 group"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all">
                View Demo
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
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-[2.5rem] blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden aspect-video flex items-center justify-center text-gray-300">
              <img 
                src="https://picsum.photos/seed/lumina-app/1200/800" 
                alt="App Preview" 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur p-6 rounded-2xl shadow-xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Real-time Sync</div>
                    <div className="text-sm text-gray-500">Your notes, everywhere.</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to think better</h2>
            <p className="text-gray-600">Powerful tools integrated into a seamless writing experience.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Code className="w-6 h-6 text-purple-600" />,
                title: "Markdown First",
                desc: "Full GFM support with live preview, syntax highlighting, and task lists."
              },
              {
                icon: <Globe className="w-6 h-6 text-blue-600" />,
                title: "Mermaid Diagrams",
                desc: "Turn text into flowcharts, sequence diagrams, and Gantt charts instantly."
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-indigo-600" />,
                title: "Plotly Integration",
                desc: "Embed interactive charts and data visualizations directly in your notes."
              },
              {
                icon: <Notebook className="w-6 h-6 text-pink-600" />,
                title: "Infinite Hierarchy",
                desc: "Organize with Notebooks, Sections, and Pages just like OneNote."
              },
              {
                icon: <Zap className="w-6 h-6 text-yellow-600" />,
                title: "Blazing Fast",
                desc: "Built with modern tech for instant loads and smooth interactions."
              },
              {
                icon: <Shield className="w-6 h-6 text-green-600" />,
                title: "Secure & Private",
                desc: "Your data is encrypted and stored securely in our cloud."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-600">Start for free, upgrade as you grow.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-extrabold mb-6">$0<span className="text-lg text-gray-400 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                {['Unlimited Notebooks', 'Markdown Support', 'Mermaid Diagrams', 'Local Sync'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onGetStarted}
                className="w-full py-4 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition-all"
              >
                Get Started
              </button>
            </div>
            <div className="bg-purple-600 p-10 rounded-3xl shadow-xl shadow-purple-200 flex flex-col text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Popular</div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-extrabold mb-6">$9<span className="text-lg text-purple-200 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                {['Everything in Free', 'Cloud Sync', 'Collaboration', 'Plotly Charts', 'Priority Support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-purple-100">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={onGetStarted}
                className="w-full py-4 rounded-xl bg-white text-purple-600 font-bold hover:bg-purple-50 transition-all"
              >
                Go Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:row items-center justify-between gap-8">
          <div className="flex items-center gap-2 font-bold text-xl text-purple-700">
            <Logo className="h-9 w-auto" />
            <span>Lumina Notes</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-purple-600">Privacy</a>
            <a href="#" className="hover:text-purple-600">Terms</a>
            <a href="#" className="hover:text-purple-600">Twitter</a>
            <a href="#" className="hover:text-purple-600">GitHub</a>
          </div>
          <div className="text-sm text-gray-400">
            © 2026 Lumina Notes. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
