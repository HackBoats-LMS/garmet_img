'use client';

import React from 'react';
import { Sparkles, Download, RefreshCw, Eye, CheckCircle2 } from 'lucide-react';
import { StockPoseData, PoseDefinition } from '@/app/types/stock';
import { getPosesForCategory } from '@/app/utils/modelsAndPoses';

interface Props {
  stockCode: string;
  category: string;
  poses: StockPoseData[];
  modelName?: string;
  isGeneratingAll: boolean;
  generatingPoseNumber: number | null;
  onGenerateAllPoses: (targetPoses?: PoseDefinition[]) => void;
  onGenerateSinglePose: (poseNumber: number) => void;
}

export function MultiPoseAlbumGrid({
  stockCode,
  category = 'saree',
  poses,
  modelName = 'Ananya',
  isGeneratingAll,
  generatingPoseNumber,
  onGenerateAllPoses,
  onGenerateSinglePose,
}: Props) {
  const activePosesList = getPosesForCategory(category);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <span className="text-sm font-bold text-slate-900">
              AI 4-Pose Virtual Catalog Album:
            </span>
            <span className="font-mono text-xs px-2.5 py-0.5 bg-slate-100 text-slate-900 font-bold rounded-lg border border-slate-200">
              {stockCode || 'UNASSIGNED'}
            </span>
            <span className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200 font-medium capitalize">
              {category.replace('_', ' ')}
            </span>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-semibold">
              Model: {modelName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            4 photoshoot angles generated specifically for {category.replace('_', ' ')}. Click any pose to regenerate or download in high definition.
          </p>
        </div>

        {/* Batch Action Button */}
        <button
          type="button"
          onClick={() => onGenerateAllPoses(activePosesList)}
          disabled={isGeneratingAll || Boolean(generatingPoseNumber)}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
        >
          <Sparkles className={`w-4 h-4 ${isGeneratingAll ? 'animate-spin' : ''}`} />
          <span>{isGeneratingAll ? 'Generating All 4 Poses...' : '✨ Generate All 4 Poses (1-Click Batch)'}</span>
        </button>
      </div>

      {/* 4-Pose Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activePosesList.map((stdPose) => {
          const matchedPose = poses.find((p) => p.poseNumber === stdPose.number);
          const currentImg = matchedPose?.imageUrl || stdPose.defaultSample;
          const isGeneratingThis = isGeneratingAll || generatingPoseNumber === stdPose.number;

          return (
            <div
              key={stdPose.number}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between group hover:border-slate-300 hover:shadow-md transition-all"
            >
              {/* Image Preview Canvas */}
              <div className="relative aspect-[3/4] bg-slate-100 flex items-center justify-center overflow-hidden">
                {isGeneratingThis ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <div className="w-8 h-8 rounded-full border-3 border-emerald-600/30 border-t-emerald-600 animate-spin" />
                    <span className="text-xs font-semibold text-emerald-700">Synthesizing 4K Pose...</span>
                    <span className="text-[10px] text-slate-500">Takes ~30-40 seconds</span>
                  </div>
                ) : (
                  <>
                    <img
                      src={currentImg}
                      alt={stdPose.name}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur text-[10px] text-slate-800 font-bold shadow-2xs border border-slate-200">
                      Angle #{stdPose.number}
                    </div>

                    {matchedPose && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Generated
                        </span>
                      </div>
                    )}

                    {/* Quick Overlay Action Buttons */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <a
                        href={currentImg}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 shadow-md transition-transform hover:scale-105"
                        title="View Full Size Image"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <a
                        href={currentImg}
                        download={`${stockCode || 'garment'}_pose_${stdPose.number}.png`}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-transform hover:scale-105"
                        title="Download HD Photo"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* Pose Info & Generate Button */}
              <div className="p-3.5 space-y-2 border-t border-slate-100 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {stdPose.name}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-2 h-7 leading-tight">
                  {stdPose.description}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onGenerateSinglePose(stdPose.number)}
                    disabled={isGeneratingThis || isGeneratingAll}
                    className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingThis ? 'animate-spin' : ''}`} />
                    <span>{matchedPose ? 'Regenerate This Pose' : 'Generate This Pose'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

