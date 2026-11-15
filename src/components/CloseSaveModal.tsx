import React from 'react';
import { AlertTriangle, FolderOpen, LogOut, X } from 'lucide-react';

interface CloseSaveModalProps {
  isOpen: boolean;
  missingPath: string | null;
  reason: string;
  isBusy: boolean;
  onPickNewSaveLocation: () => void;
  onDontSaveAndClose: () => void;
  onCancel: () => void;
}

export const CloseSaveModal: React.FC<CloseSaveModalProps> = ({
  isOpen,
  missingPath,
  reason,
  isBusy,
  onPickNewSaveLocation,
  onDontSaveAndClose,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-save-modal-title"
    >
      <div className="bg-white border-2 border-red-300 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="bg-red-50 px-6 py-4 border-b-2 border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="close-save-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Cannot Find Last Save File — Program Not Closed
              </h2>
              <p className="text-xs text-red-900 mt-0.5">
                Auto-save on closing could not locate your save file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Cancel Closing"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-700">
          <p className="leading-relaxed text-slate-800">{reason}</p>

          {missingPath && (
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-900 break-all">
              Expected Save File: {missingPath}
            </div>
          )}

          <p className="leading-relaxed text-slate-600">
            To protect your league data, the program cancelled closing. Choose a new
            save location on your computer or cloud folder to save and exit, or click{' '}
            <strong className="text-slate-900">Don&apos;t Save</strong> to close
            anyway.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel (Stay Open)
            </button>
            <button
              type="button"
              onClick={onDontSaveAndClose}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Don&apos;t Save
            </button>
            <button
              type="button"
              onClick={onPickNewSaveLocation}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Pick New Save Location &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
