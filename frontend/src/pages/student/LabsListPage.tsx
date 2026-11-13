import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Terminal,
  Network,
  Code2,
  Database,
  ArrowRight,
  Search,
  Clock,
  Layers,
  Sparkles,
  History,
  Loader2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { Lab, LabCategory } from '../../types/lab.types';
import LabService from '../../services/lab.service';
import { useToast } from '../../contexts/ToastContext';

export const LabsListPage: React.FC = () => {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [startingLabId, setStartingLabId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { error, success } = useToast();
  const navigate = useNavigate();

  const fetchLabs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await LabService.getLabs({
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
      });
      setLabs(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load virtual laboratories.');
      error(err.message || 'Failed to load labs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLabs();
  };

  const handleStartLab = async (lab: Lab) => {
    setStartingLabId(lab.id);
    try {
      const result = await LabService.startSession(lab.id);
      success(`Session loaded for "${lab.title}"!`, 'Virtual Lab Ready');
      navigate(`/labs/${lab.slug || lab.id}`, {
        state: { sessionId: result.session.id },
      });
    } catch (err: any) {
      error(err.message || 'Failed to launch virtual lab session.');
    } finally {
      setStartingLabId(null);
    }
  };

  const getCategoryIcon = (category: LabCategory) => {
    switch (category) {
      case 'LINUX':
        return <Terminal className="w-5 h-5 text-cyan-400" />;
      case 'NETWORKING':
        return <Network className="w-5 h-5 text-emerald-400" />;
      case 'PROGRAMMING':
        return <Code2 className="w-5 h-5 text-amber-400" />;
      case 'DATABASE':
        return <Database className="w-5 h-5 text-purple-400" />;
      default:
        return <Terminal className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getCategoryColor = (category: LabCategory) => {
    switch (category) {
      case 'LINUX':
        return 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300';
      case 'NETWORKING':
        return 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300';
      case 'PROGRAMMING':
        return 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-300';
      case 'DATABASE':
        return 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-300';
      default:
        return 'from-slate-800 to-slate-900 border-slate-700 text-slate-300';
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Modules' },
    { id: 'LINUX', label: 'Linux OS' },
    { id: 'NETWORKING', label: 'Networking' },
    { id: 'PROGRAMMING', label: 'Programming' },
    { id: 'DATABASE', label: 'SQL Database' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Isolated Educational Sandbox
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Virtual Laboratories
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Hands-on interactive environments covering Linux administration, network diagnostics,
            programming challenges, and relational SQL queries.
          </p>
        </div>

        <Link
          to="/labs/history"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition shadow-sm"
        >
          <History className="w-4 h-4 text-cyan-400" />
          My Session History
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises, topics..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
        </form>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono">Loading virtual laboratory suites...</p>
        </div>
      ) : labs.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No laboratories found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your category filter or search keywords.
          </p>
        </div>
      ) : (
        /* Laboratories Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {labs.map((lab) => {
            const isStarting = startingLabId === lab.id;

            return (
              <div
                key={lab.id}
                className="group p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-lg hover:shadow-cyan-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
                        {getCategoryIcon(lab.category)}
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-gradient-to-r ${getCategoryColor(
                            lab.category
                          )}`}
                        >
                          {lab.category}
                        </span>
                        <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors mt-1">
                          {lab.title}
                        </h3>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                      {lab.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">
                    {lab.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      ~{lab.estimatedMinutes} mins
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      {(lab as any).exerciseCount || lab.exercises?.length || 4} Exercises
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isStarting}
                    onClick={() => handleStartLab(lab)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Launch Lab
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LabsListPage;
