import React, { useState } from 'react';
import { Columns, ExternalLink, RefreshCw, Layers, Zap } from 'lucide-react';

export const LegacyCompareTab: React.FC = () => {
  const [subMode, setSubMode] = useState<'split' | 'v1' | 'v2'>('split');
  const [v1Key, setV1Key] = useState(1);
  const [v2Key, setV2Key] = useState(1);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Original Saved Codebases (V1 vs. V2 Live Comparison)
          </h2>
          <p className="text-xs text-slate-500">
            Both original HTML files (<code className="font-mono">legacy_tracker.html</code> & <code className="font-mono">legacy_tracker_v2.html</code>) remain untouched and live-runnable here.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setSubMode('split')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              subMode === 'split'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Side-by-Side
          </button>
          <button
            type="button"
            onClick={() => setSubMode('v1')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              subMode === 'v1'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Version 1 Only
          </button>
          <button
            type="button"
            onClick={() => setSubMode('v2')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              subMode === 'v2'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Version 2 Only
          </button>
        </div>
      </div>

      {subMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[740px]">
          {/* V1 */}
          <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Version 1: Advanced Bowling League Tracker (legacy_tracker.html)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setV1Key((k) => k + 1)}
                  title="Reload Version 1"
                  className="p-1 text-slate-600 hover:text-slate-900 rounded"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <a
                  href="/legacy_tracker.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  Open Tab <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <iframe
              key={v1Key}
              src="/legacy_tracker.html"
              title="Version 1 - Advanced Bowling League Tracker"
              className="w-full h-full border-0 bg-white"
            />
          </div>

          {/* V2 */}
          <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Version 2: Thursday Night Rollers (legacy_tracker_v2.html)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setV2Key((k) => k + 1)}
                  title="Reload Version 2"
                  className="p-1 text-slate-600 hover:text-slate-900 rounded"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <a
                  href="/legacy_tracker_v2.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  Open Tab <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <iframe
              key={v2Key}
              src="/legacy_tracker_v2.html"
              title="Version 2 - Thursday Night Rollers Tracker"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>
      )}

      {subMode === 'v1' && (
        <div className="h-[740px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <iframe
            src="/legacy_tracker.html"
            title="Version 1 Full"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      )}

      {subMode === 'v2' && (
        <div className="h-[740px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <iframe
            src="/legacy_tracker_v2.html"
            title="Version 2 Full"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      )}
    </div>
  );
};
