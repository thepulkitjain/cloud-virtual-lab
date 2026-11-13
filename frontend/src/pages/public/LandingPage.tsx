import React from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal,
  Shield,
  Network,
  Code2,
  Database,
  Lock,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, role } = useAuth();

  const dashboardPath = role === 'ADMIN' ? '/admin' : '/dashboard';

  const features = [
    {
      icon: Terminal,
      title: 'Linux Virtual Lab',
      desc: 'Safe sandboxed CLI with simulated POSIX directory tree, file operations, and pipeline simulations without host OS vulnerabilities.',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: Network,
      title: 'Networking Simulation Lab',
      desc: 'Interactive network troubleshooting exercises simulating ping, traceroute, ifconfig, and nslookup diagnostics.',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Code2,
      title: 'Programming Practice Lab',
      desc: 'Structured Python and JavaScript laboratory assignments with automated grading and test case evaluation.',
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: Database,
      title: 'Database & SQL Lab',
      desc: 'Relational database simulator for schema creation, joins, aggregations, and transactional queries.',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: Lock,
      title: 'AES-256-GCM Secure Storage',
      desc: 'Production-grade authenticated file encryption at rest using 96-bit cryptographic IVs and 128-bit authentication tags.',
      color: 'from-rose-500 to-pink-500',
    },
    {
      icon: Shield,
      title: 'PostgreSQL RBAC & Governance',
      desc: 'Strict role-based isolation between Students and Administrators with detailed audit trails and storage quota management.',
      color: 'from-sky-500 to-cyan-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Terminal className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              CloudLab <span className="text-cyan-400 font-mono text-xs">OS</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-medium">
              Virtual Lab & Secure Storage
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link
              to={dashboardPath}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all"
            >
              Go to Workspace
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all"
              >
                Create Account
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-6 max-w-7xl mx-auto flex-1 flex flex-col justify-center">
        {/* Background glow highlights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-cyan-500/10 via-indigo-500/15 to-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            BTech Computer Science Software Engineering Laboratory
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Centralized Cloud Virtual Lab &amp;{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
              Secure Storage
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
            A state-of-the-art educational environment providing safe virtual terminal simulations,
            multi-disciplinary hands-on computing laboratories, and AES-256-GCM encrypted cloud storage.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
                >
                  <GraduationCap className="w-4 h-4" />
                  Register as Student
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-medium text-sm transition-all"
                >
                  Sign In to Existing Account
                </Link>
              </>
            )}
          </div>

          {/* Security & Tech Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              PostgreSQL 18 + Prisma ORM
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              AES-256-GCM Storage
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              Zero Host OS Vulnerability
            </span>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full border-t border-slate-900 bg-slate-950/40">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-xs uppercase font-mono tracking-widest text-cyan-400 mb-2">
            Integrated Laboratory Modules
          </h2>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Designed for Comprehensive Computer Science Education
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 transition-all duration-300 shadow-lg hover:shadow-cyan-500/5 flex flex-col justify-between"
              >
                <div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center shadow-md mb-4`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full border-t border-slate-900">
        <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              Architectural Overview
            </span>
            <h3 className="text-2xl font-bold text-white">
              Modular Monolithic Architecture with Robust Security
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Engineered with clean separation of concerns. The frontend React single-page application
              communicates over strictly typed REST endpoints with HTTP-only cookie sessions.
              The Express backend persists data to PostgreSQL 18 with row-locking storage concurrency protection.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {['React 18', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'PostgreSQL 18', 'Prisma ORM', 'Vitest', 'AES-256-GCM'].map(
                (tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-1 rounded-md bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700/60"
                  >
                    {tech}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="w-full lg:w-auto shrink-0 flex flex-col gap-3">
            <Link
              to="/login"
              className="w-full text-center px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg transition-all"
            >
              Sign In to Laboratory
            </Link>
            <Link
              to="/register"
              className="w-full text-center px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition-all"
            >
              Register New Student
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500 font-mono">
        <p>
          Cloud Virtual Lab &amp; Secure Storage Management System • BTech Computer Science Final Project
        </p>
        <p className="text-[10px] text-slate-600 mt-1">
          PostgreSQL 18.6 • Node.js Express 5 • React 18 • AES-256-GCM Cryptographic Storage
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
