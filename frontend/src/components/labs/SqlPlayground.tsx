import React from 'react';
import { Database, Play, Table, Key } from 'lucide-react';

interface SqlPlaygroundProps {
  onRunQuery: (query: string) => void;
  disabled?: boolean;
}

export const SqlPlayground: React.FC<SqlPlaygroundProps> = ({ onRunQuery, disabled }) => {
  const sampleQueries = [
    { label: 'List Tables (Meta)', query: '\\dt' },
    { label: 'Describe Students', query: '\\d students' },
    { label: 'All Students', query: 'SELECT * FROM students;' },
    { label: 'High GPA Students', query: 'SELECT * FROM students WHERE gpa > 3.5;' },
    { label: 'All Courses', query: 'SELECT * FROM courses;' },
    {
      label: 'Insert Student',
      query: "INSERT INTO students (name, email, gpa, department) VALUES ('David Miller', 'david@virtuallab.edu', 3.6, 'Computer Science');",
    },
    { label: 'Update Student', query: "UPDATE students SET gpa = 3.95 WHERE name = 'Alice Smith';" },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-400" />
          SQL Schema &amp; Query Assistant
        </h4>
        <span className="text-[10px] font-mono text-purple-300 bg-purple-950/50 border border-purple-800/50 px-2 py-0.5 rounded-full">
          In-Memory SQLite Sandbox
        </span>
      </div>

      {/* Simulated Tables Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1.5">
            <Table className="w-3.5 h-3.5 text-cyan-400" />
            public.students
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            id (int PK), name (varchar), email (varchar), gpa (num), department (varchar)
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1.5">
            <Table className="w-3.5 h-3.5 text-indigo-400" />
            public.courses
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            id (int PK), code (varchar), title (varchar), credits (int)
          </p>
        </div>
      </div>

      {/* Quick Run Queries */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Quick Query Presets
        </p>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onRunQuery(item.query)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-white transition cursor-pointer font-mono text-[11px] disabled:opacity-50"
            >
              <Play className="w-3 h-3 text-purple-400" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Educational Notice */}
      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-[11px] text-purple-300 flex items-start gap-2">
        <Key className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Queries execute against an isolated educational in-memory state. Student queries cannot access, inspect, or modify the host application database or PostgreSQL tables.
        </p>
      </div>
    </div>
  );
};

export default SqlPlayground;
