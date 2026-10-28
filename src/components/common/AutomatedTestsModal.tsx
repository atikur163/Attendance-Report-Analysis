import React, { useState } from 'react';
import { X, Play, CheckCircle2, XCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { runAllAutomatedTests, TestResult } from '../../services/testRunner';

interface AutomatedTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutomatedTestsModal: React.FC<AutomatedTestsModalProps> = ({ isOpen, onClose }) => {
  const [suiteResult, setSuiteResult] = useState<{
    total: number;
    passed: number;
    failed: number;
    results: TestResult[];
  } | null>(() => runAllAutomatedTests());

  if (!isOpen) return null;

  const handleRerun = () => {
    setSuiteResult(runAllAutomatedTests());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Automated Business Rule Verification Suite
              </h3>
              <p className="text-xs text-slate-500">
                Testing critical university rules (Late threshold, 3-Late penalty, 60% eligibility, Course constraints)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRerun}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Rerun Tests</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Badges */}
        {suiteResult && (
          <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-4">
              <span className="font-semibold text-slate-700">
                Total Test Cases: <span className="font-bold text-slate-900">{suiteResult.total}</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Passed: {suiteResult.passed}</span>
              </span>
              {suiteResult.failed > 0 && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Failed: {suiteResult.failed}</span>
                </span>
              )}
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Compliance: {((suiteResult.passed / suiteResult.total) * 100).toFixed(0)}% Passed
            </div>
          </div>
        )}

        {/* Test Cases Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {suiteResult?.results.map(test => (
            <div
              key={test.id}
              className={`p-3.5 rounded-xl border transition-all ${
                test.passed
                  ? 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                  : 'bg-rose-50/50 border-rose-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-slate-200 text-slate-700">
                        {test.category}
                      </span>
                      <h4 className="font-semibold text-xs text-slate-900">{test.name}</h4>
                    </div>
                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="text-slate-600">
                        <span className="font-sans text-slate-400">Expected: </span>
                        <span className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {test.expected}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        <span className="font-sans text-slate-400">Actual: </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            test.passed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                          }`}
                        >
                          {test.actual}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {test.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>All mathematical rules adhere strictly to university attendance policies.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
