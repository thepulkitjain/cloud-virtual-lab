import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Award,
  Users,
  Search,
  Filter,
  BarChart3,
  ListOrdered,
  X,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Code,
  Network,
  Database,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import AdminService from '../../services/admin.service';
import LabService from '../../services/lab.service';
import {
  LabGovernanceItem,
  LabPerformanceResponse,
  CreateLabPayload,
  UpdateLabPayload,
  CreateExercisePayload,
  UpdateExercisePayload,
} from '../../types/admin.types';
import { LabCategory, LabDifficulty, LabExercise } from '../../types/lab.types';

export const LabGovernancePage: React.FC = () => {
  const { success, error } = useToast();

  // State
  const [labs, setLabs] = useState<LabGovernanceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LabCategory>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreateLabPayload>({
    title: '',
    slug: '',
    description: '',
    category: 'LINUX',
    difficulty: 'BEGINNER',
    estimatedMinutes: 30,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  const [editingLab, setEditingLab] = useState<LabGovernanceItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateLabPayload>({
    title: '',
    description: '',
    difficulty: 'BEGINNER',
    estimatedMinutes: 30,
    isActive: true,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Exercises Drawer
  const [activeExerciseLab, setActiveExerciseLab] = useState<LabGovernanceItem | null>(null);
  const [exercisesList, setExercisesList] = useState<LabExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState<boolean>(false);

  // Exercise Form Modal
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState<boolean>(false);
  const [editingExercise, setEditingExercise] = useState<LabExercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState<CreateExercisePayload>({
    orderIndex: 1,
    title: '',
    instruction: '',
    hint: '',
    expectedCommand: '',
    expectedOutput: '',
  });
  const [isSubmittingExercise, setIsSubmittingExercise] = useState<boolean>(false);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  // Performance Modal
  const [performanceLabId, setPerformanceLabId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<LabPerformanceResponse | null>(null);
  const [performancePage, setPerformancePage] = useState<number>(1);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState<boolean>(false);

  // Fetch Lab Governance
  const fetchLabs = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const data = await AdminService.getLabGovernance();
        setLabs(data);
      } catch (err: any) {
        console.error('Failed to load lab governance:', err);
        error(err.response?.data?.message || 'Failed to retrieve laboratory metrics.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [error]
  );

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  // Toggle Lab Active Status
  const handleToggleStatus = async (lab: LabGovernanceItem) => {
    const updatedStatus = !lab.isActive;
    // Optimistic UI update
    setLabs((prev) =>
      prev.map((item) => (item.id === lab.id ? { ...item, isActive: updatedStatus } : item))
    );

    try {
      await AdminService.toggleLabStatus(lab.id, updatedStatus);
      success(`Laboratory "${lab.title}" is now ${updatedStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      console.error('Failed to toggle lab status:', err);
      error(err.response?.data?.message || 'Unable to update laboratory status.');
      // Revert optimistic update
      setLabs((prev) =>
        prev.map((item) => (item.id === lab.id ? { ...item, isActive: !updatedStatus } : item))
      );
    }
  };

  // Create Lab Handler
  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.slug.trim() || !createForm.description.trim()) {
      error('Please complete all required fields.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await AdminService.createLab(createForm);
      success(`Virtual laboratory "${createForm.title}" successfully deployed!`);
      setIsCreateModalOpen(false);
      setCreateForm({
        title: '',
        slug: '',
        description: '',
        category: 'LINUX',
        difficulty: 'BEGINNER',
        estimatedMinutes: 30,
      });
      fetchLabs(true);
    } catch (err: any) {
      console.error('Failed to create laboratory:', err);
      error(err.response?.data?.message || 'Failed to create laboratory.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Edit Lab Handler
  const openEditModal = (lab: LabGovernanceItem) => {
    setEditingLab(lab);
    setEditForm({
      title: lab.title,
      description: '', // will be populated or preserved
      difficulty: lab.difficulty,
      estimatedMinutes: lab.estimatedMinutes,
      isActive: lab.isActive,
    });
  };

  const handleUpdateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLab) return;

    setIsSubmittingEdit(true);
    try {
      await AdminService.updateLab(editingLab.id, editForm);
      success(`Updated laboratory "${editForm.title || editingLab.title}".`);
      setEditingLab(null);
      fetchLabs(true);
    } catch (err: any) {
      console.error('Failed to update laboratory:', err);
      error(err.response?.data?.message || 'Failed to update laboratory.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Manage Exercises
  const openExercisesDrawer = async (lab: LabGovernanceItem) => {
    setActiveExerciseLab(lab);
    setIsLoadingExercises(true);
    try {
      const fullLab = await LabService.getLab(lab.id);
      setExercisesList(fullLab.exercises || []);
    } catch (err: any) {
      console.error('Failed to load lab exercises:', err);
      error('Failed to load exercises for this laboratory.');
    } finally {
      setIsLoadingExercises(false);
    }
  };

  const openAddExerciseModal = () => {
    setEditingExercise(null);
    setExerciseForm({
      orderIndex: exercisesList.length + 1,
      title: '',
      instruction: '',
      hint: '',
      expectedCommand: '',
      expectedOutput: '',
    });
    setIsExerciseModalOpen(true);
  };

  const openEditExerciseModal = (exercise: LabExercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      orderIndex: exercise.orderIndex,
      title: exercise.title,
      instruction: exercise.instruction,
      hint: exercise.hint || '',
      expectedCommand: exercise.expectedCommand || '',
      expectedOutput: exercise.expectedOutput || '',
    });
    setIsExerciseModalOpen(true);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExerciseLab) return;

    if (!exerciseForm.title.trim() || !exerciseForm.instruction.trim()) {
      error('Title and instruction are required.');
      return;
    }

    setIsSubmittingExercise(true);
    try {
      if (editingExercise) {
        await AdminService.updateExercise(editingExercise.id, exerciseForm as UpdateExercisePayload);
        success('Exercise updated successfully.');
      } else {
        await AdminService.createExercise(activeExerciseLab.id, exerciseForm);
        success('Exercise added successfully.');
      }
      setIsExerciseModalOpen(false);
      // Reload exercises
      const fullLab = await LabService.getLab(activeExerciseLab.id);
      setExercisesList(fullLab.exercises || []);
      fetchLabs(true);
    } catch (err: any) {
      console.error('Failed to save exercise:', err);
      error(err.response?.data?.message || 'Failed to save exercise.');
    } finally {
      setIsSubmittingExercise(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!activeExerciseLab) return;
    setDeletingExerciseId(exerciseId);
    try {
      await AdminService.deleteExercise(exerciseId);
      success('Exercise deleted successfully.');
      setExercisesList((prev) => prev.filter((ex) => ex.id !== exerciseId));
      fetchLabs(true);
    } catch (err: any) {
      console.error('Failed to delete exercise:', err);
      error(err.response?.data?.message || 'Failed to delete exercise.');
    } finally {
      setDeletingExerciseId(null);
    }
  };

  // Performance Modal
  const openPerformanceModal = async (labId: string, page = 1) => {
    setPerformanceLabId(labId);
    setPerformancePage(page);
    setIsLoadingPerformance(true);
    try {
      const data = await AdminService.getLabPerformance(labId, page, 10);
      setPerformanceData(data);
    } catch (err: any) {
      console.error('Failed to fetch performance telemetry:', err);
      error(err.response?.data?.message || 'Unable to retrieve lab performance metrics.');
      setPerformanceLabId(null);
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  // Helpers
  const getCategoryIcon = (category: LabCategory) => {
    switch (category) {
      case 'LINUX':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case 'NETWORKING':
        return <Network className="w-4 h-4 text-cyan-400" />;
      case 'PROGRAMMING':
        return <Code className="w-4 h-4 text-purple-400" />;
      case 'DATABASE':
        return <Database className="w-4 h-4 text-amber-400" />;
    }
  };

  const getDifficultyBadge = (difficulty: LabDifficulty) => {
    switch (difficulty) {
      case 'BEGINNER':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'INTERMEDIATE':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'ADVANCED':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    }
  };

  const filteredLabs = labs.filter((lab) => {
    const matchesSearch =
      lab.title.toLowerCase().includes(search.toLowerCase()) ||
      lab.slug.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || lab.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-medium mb-2">
            <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
            Virtual Laboratory Governance
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Laboratory Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain simulated lab suites, configure test exercises, monitor student completions, and adjust curriculum.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLabs(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Deploy Laboratory
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search laboratories by title or slug identifier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 text-[11px]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              <option value="LINUX" className="bg-slate-900">Linux Terminal</option>
              <option value="NETWORKING" className="bg-slate-900">Networking</option>
              <option value="PROGRAMMING" className="bg-slate-900">Programming</option>
              <option value="DATABASE" className="bg-slate-900">SQL Database</option>
            </select>
          </div>
        </div>
      </div>

      {/* Labs Grid */}
      {isLoading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading virtual laboratory suites...</p>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <FlaskConical className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No laboratories match your query</p>
          <p className="text-xs text-slate-400 mt-1">Try resetting filters or deploy a new lab suite.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredLabs.map((lab) => (
            <div
              key={lab.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                lab.isActive
                  ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-800/60 opacity-80'
              }`}
            >
              <div>
                {/* Top Badge & Toggle Switch */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                      {getCategoryIcon(lab.category)}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${getDifficultyBadge(
                        lab.difficulty
                      )}`}
                    >
                      {lab.difficulty}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {lab.estimatedMinutes} min
                    </span>
                  </div>

                  {/* Active Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lab.isActive}
                      onChange={() => handleToggleStatus(lab)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                    <span className="ml-2 text-[10px] font-mono text-slate-400">
                      {lab.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>

                {/* Title & Slug */}
                <h3 className="text-base font-bold text-white tracking-tight">{lab.title}</h3>
                <p className="text-[11px] font-mono text-cyan-400 mt-0.5">/labs/{lab.slug}</p>

                {/* Metrics Stats */}
                <div className="grid grid-cols-4 gap-2 my-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400">Exercises</span>
                    <p className="text-sm font-bold text-white mt-0.5">{lab.totalExercises}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Sessions</span>
                    <p className="text-sm font-bold text-white mt-0.5">{lab.totalSessions}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Completion</span>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">
                      {lab.completionRatePercentage}%
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Avg Score</span>
                    <p className="text-sm font-bold text-cyan-400 mt-0.5">{lab.averageScore}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  onClick={() => openPerformanceModal(lab.id)}
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition font-medium"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  Performance
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openExercisesDrawer(lab)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-teal-400" />
                    Exercises ({lab.totalExercises})
                  </button>

                  <button
                    onClick={() => openEditModal(lab)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Edit Laboratory Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -------------------- MODAL: Create Lab -------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FlaskConical className="w-4 h-4 text-cyan-400" />
                Deploy New Virtual Laboratory
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLab} className="space-y-4">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Laboratory Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Docker & Container Security"
                  value={createForm.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const autoSlug = title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, '');
                    setCreateForm((prev) => ({
                      ...prev,
                      title,
                      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Slug Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. advanced-docker-security"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Summarize the educational objectives, practical tasks, and curriculum requirements..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, category: e.target.value as LabCategory })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="LINUX">LINUX</option>
                    <option value="NETWORKING">NETWORKING</option>
                    <option value="PROGRAMMING">PROGRAMMING</option>
                    <option value="DATABASE">DATABASE</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Difficulty</label>
                  <select
                    value={createForm.difficulty}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, difficulty: e.target.value as LabDifficulty })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={createForm.estimatedMinutes}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, estimatedMinutes: parseInt(e.target.value, 10) || 30 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50"
                >
                  {isSubmittingCreate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    'Deploy Lab'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: Edit Lab -------------------- */}
      {editingLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit Laboratory Settings
              </div>
              <button onClick={() => setEditingLab(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLab} className="space-y-4">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Laboratory Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  placeholder="Enter updated description..."
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) =>
                      setEditForm({ ...editForm, difficulty: e.target.value as LabDifficulty })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Estimated Minutes</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={editForm.estimatedMinutes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, estimatedMinutes: parseInt(e.target.value, 10) || 30 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLab(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- DRAWER: Manage Exercises -------------------- */}
      {activeExerciseLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Laboratory Exercises</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activeExerciseLab.title}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openAddExerciseModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Exercise
                </button>
                <button
                  onClick={() => setActiveExerciseLab(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {isLoadingExercises ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400">Loading exercises...</p>
                </div>
              ) : exercisesList.length === 0 ? (
                <div className="py-16 text-center">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">No exercises configured</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Add Exercise" above to attach student tasks to this laboratory.
                  </p>
                </div>
              ) : (
                exercisesList.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold flex items-center justify-center text-[11px]">
                          {exercise.orderIndex}
                        </span>
                        <h4 className="font-semibold text-white text-sm">{exercise.title}</h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditExerciseModal(exercise)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Edit Exercise"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(exercise.id)}
                          disabled={deletingExerciseId === exercise.id}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition disabled:opacity-40"
                          title="Delete Exercise"
                        >
                          {deletingExerciseId === exercise.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">
                      {exercise.instruction}
                    </p>

                    {exercise.hint && (
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[10px]">
                        <span className="font-semibold text-amber-400">Hint:</span> {exercise.hint}
                      </div>
                    )}

                    {(exercise.expectedCommand || exercise.expectedOutput) && (
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {exercise.expectedCommand && (
                          <div className="truncate">
                            <span className="text-slate-500">Cmd:</span>{' '}
                            <span className="text-cyan-300">{exercise.expectedCommand}</span>
                          </div>
                        )}
                        {exercise.expectedOutput && (
                          <div className="truncate">
                            <span className="text-slate-500">Output:</span>{' '}
                            <span className="text-emerald-300">{exercise.expectedOutput}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- SUB-MODAL: Add / Edit Exercise -------------------- */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ListOrdered className="w-4 h-4 text-teal-400" />
                {editingExercise ? 'Edit Exercise' : 'Add New Exercise'}
              </div>
              <button
                onClick={() => setIsExerciseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExercise} className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 font-medium block mb-1">Index *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={exerciseForm.orderIndex}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        orderIndex: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-slate-300 font-medium block mb-1">Exercise Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inspect Current Working Directory"
                    value={exerciseForm.title}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Instruction *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide explicit instructions for the student..."
                  value={exerciseForm.instruction}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, instruction: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Educational Hint</label>
                <input
                  type="text"
                  placeholder="Optional hint if the student gets stuck..."
                  value={exerciseForm.hint || ''}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, hint: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Expected Command</label>
                <input
                  type="text"
                  placeholder="e.g. pwd or ls -la"
                  value={exerciseForm.expectedCommand || ''}
                  onChange={(e) =>
                    setExerciseForm({ ...exerciseForm, expectedCommand: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-cyan-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Expected Output Keyword</label>
                <input
                  type="text"
                  placeholder="Substring to verify against terminal output..."
                  value={exerciseForm.expectedOutput || ''}
                  onChange={(e) =>
                    setExerciseForm({ ...exerciseForm, expectedOutput: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-emerald-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExerciseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExercise}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50"
                >
                  {isSubmittingExercise ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Exercise'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: Student Performance -------------------- */}
      {performanceLabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Student Performance Telemetry</h3>
                  <p className="text-xs text-slate-400">
                    {performanceData?.lab.title || 'Laboratory Metrics'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPerformanceLabId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {isLoadingPerformance || !performanceData ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400">Loading performance data...</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-cyan-400" /> Sessions
                      </span>
                      <p className="text-base font-bold text-white mt-1">
                        {performanceData.metrics.totalSessions}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
                      </span>
                      <p className="text-base font-bold text-emerald-400 mt-1">
                        {performanceData.metrics.completedSessions}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" /> Pass Rate
                      </span>
                      <p className="text-base font-bold text-cyan-300 mt-1">
                        {performanceData.metrics.completionRatePercentage}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Award className="w-3 h-3 text-amber-400" /> Avg Score
                      </span>
                      <p className="text-base font-bold text-amber-300 mt-1">
                        {performanceData.metrics.averageScore}
                      </p>
                    </div>
                  </div>

                  {/* Student Sessions Table */}
                  <div>
                    <h5 className="font-semibold text-white mb-2 text-xs">Student Sessions</h5>
                    {performanceData.sessions.length === 0 ? (
                      <p className="text-slate-500 text-[11px] py-4 text-center italic">
                        No students have enrolled or completed sessions in this laboratory yet.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-[11px]">
                              <th className="py-2.5 px-3">Student</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-center">Score</th>
                              <th className="py-2.5 px-3 text-center">Passed</th>
                              <th className="py-2.5 px-3">Started</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {performanceData.sessions.map((session) => (
                              <tr key={session.id} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3">
                                  <p className="font-semibold text-white">{session.user.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {session.user.studentId || session.user.email}
                                  </p>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                      session.status === 'COMPLETED'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : session.status === 'IN_PROGRESS'
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {session.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-white font-mono">
                                  {session.score}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                                  {session.passedExercisesCount}
                                </td>
                                <td className="py-2.5 px-3 text-[10px] text-slate-400">
                                  {new Date(session.startedAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              {performanceData && performanceData.pagination.totalPages > 1 ? (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => openPerformanceModal(performanceLabId!, performancePage - 1)}
                    disabled={performancePage <= 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-slate-400">
                    Page {performancePage} of {performanceData.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => openPerformanceModal(performanceLabId!, performancePage + 1)}
                    disabled={performancePage >= performanceData.pagination.totalPages}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div />
              )}
              <button
                onClick={() => setPerformanceLabId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabGovernancePage;
