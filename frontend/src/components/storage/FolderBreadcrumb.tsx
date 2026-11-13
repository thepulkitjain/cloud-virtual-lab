import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';

export interface BreadcrumbSegment {
  id: string | null;
  name: string;
}

interface FolderBreadcrumbProps {
  breadcrumbs: BreadcrumbSegment[];
  onNavigate: (folderId: string | null) => void;
  foldersCount?: number;
  filesCount?: number;
}

export const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({
  breadcrumbs,
  onNavigate,
  foldersCount,
  filesCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs">
      <nav aria-label="Folder Breadcrumb" className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onNavigate(null)}
          className={`flex items-center gap-1.5 font-medium transition cursor-pointer ${
            breadcrumbs.length === 0
              ? 'text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>My Cloud Drive</span>
        </button>

        {breadcrumbs.map((segment, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <React.Fragment key={segment.id || index}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <button
                type="button"
                disabled={isLast}
                onClick={() => onNavigate(segment.id)}
                className={`flex items-center gap-1 font-medium transition max-w-[150px] truncate ${
                  isLast
                    ? 'text-cyan-300 font-semibold cursor-default'
                    : 'text-slate-400 hover:text-white cursor-pointer'
                }`}
              >
                <Folder className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{segment.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {(foldersCount !== undefined || filesCount !== undefined) && (
        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
          {foldersCount !== undefined && <span>{foldersCount} Folders</span>}
          {foldersCount !== undefined && filesCount !== undefined && <span>•</span>}
          {filesCount !== undefined && <span>{filesCount} Files</span>}
        </div>
      )}
    </div>
  );
};

export default FolderBreadcrumb;
