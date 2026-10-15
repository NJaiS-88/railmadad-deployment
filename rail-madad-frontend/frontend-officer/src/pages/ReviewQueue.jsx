import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCcw, ImageOff, X, Ban, MessageSquare, Brain, Loader2 } from 'lucide-react';
import { getReviewQueue, submitClassificationOverride, getComplaintDetail, rejectReviewItem } from '../api/officerClient';
import ConfidenceMeter from '../components/ConfidenceMeter';

const CATEGORY_OPTIONS = [
  'AC / Cooling Fault', 'Electrical Fault', 'Fire Safety Concern', 'Water Leakage',
  'Catering / Pantry', 'Staff Misconduct', 'Ticketing Irregularity', 'Coach Cleanliness',
  'Mechanical Fault', 'Security Concern',
];

const RELEVANCE_STYLES = {
  unrelated: 'bg-red-50 text-red-700 border-red-200',
  partially_related: 'bg-amber-50 text-amber-700 border-amber-200',
  related: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  flagged: 'bg-rose-50 text-rose-700 border-rose-200',
};

function RelevancyBadge({ relevance }) {
  const key = String(relevance || 'related').toLowerCase();
  const label = key === 'partially_related' ? 'Partially related' : key === 'unrelated' ? 'Unrelated' : key === 'flagged' ? 'Flagged' : 'Related';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${RELEVANCE_STYLES[key] || RELEVANCE_STYLES.related}`}>
      {label}
    </span>
  );
}

function SummaryBlock({ summary }) {
  if (!summary) return null;
  if (typeof summary === 'string') {
    return <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>;
  }
  if (Array.isArray(summary)) {
    return (
      <ul className="space-y-1.5">
        {summary.map((item, i) => (
          <li key={i} className="text-xs text-slate-600 leading-relaxed">{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-3">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">{key}</p>
          {typeof value === 'object' && value !== null ? (
            <SummaryBlock summary={value} />
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">{String(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function LlmThinkingPanel({ analysis, round }) {
  if (!analysis) return null;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 text-white">
        <Brain className="w-3.5 h-3.5 text-blue-300" />
        <p className="text-[11px] font-black uppercase tracking-wide">LLM Analysis {round ? `· Round ${round}` : ''}</p>
      </div>
      <div className="p-3.5 space-y-3 bg-slate-50/60">
        <div className="flex flex-wrap gap-1.5">
          {[
            ['Relevance', String(analysis.relevance || 'related')],
            ['Sufficient', analysis.is_sufficient === false ? 'No' : 'Yes'],
            ['Has issue', analysis.has_issue === false ? 'No' : 'Yes'],
            ['Manual review', analysis.requires_manual_officer_review === true ? 'Yes' : 'No'],
            ['Urgency', String(analysis.urgency || 'Medium')],
          ].map(([label, value]) => (
            <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
              {label}: <span className="text-slate-900">{value}</span>
            </span>
          ))}
        </div>

        {analysis.decision_reasoning && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Decision reasoning</p>
            <p className="text-xs text-slate-700 leading-relaxed">{analysis.decision_reasoning}</p>
          </div>
        )}
        {analysis.are_texts_related && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Inputs correlation</p>
            <p className="text-xs text-slate-700 leading-relaxed">{analysis.are_texts_related}</p>
          </div>
        )}
        {analysis.missing_info && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Missing info</p>
            <p className="text-xs text-slate-700 leading-relaxed">{analysis.missing_info}</p>
          </div>
        )}
        {Array.isArray(analysis.keywords) && analysis.keywords.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700">{kw}</span>
              ))}
            </div>
          </div>
        )}
        {analysis.summary && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Summary</p>
            <SummaryBlock summary={analysis.summary} />
          </div>
        )}
        {Array.isArray(analysis.action_steps) && analysis.action_steps.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Suggested action steps</p>
            <ol className="list-decimal list-inside space-y-1">
              {analysis.action_steps.map((step, i) => (
                <li key={i} className="text-xs text-slate-600 leading-relaxed">{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ item, detail, loading, onClose, onConfirm, onReject }) {
  if (!item) return null;
  const conversation = detail?.followUp?.conversation || [];
  const analysisHistory = Array.isArray(detail?.analysisHistory) && detail.analysisHistory.length
    ? detail.analysisHistory
    : (detail?.llmAnalysis ? [detail.llmAnalysis] : []);

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-end z-30" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-white border-l border-slate-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{item.id}</p>
            <h2 className="text-sm font-black text-slate-900">{item.aiCategory}</h2>
            <div className="flex items-center gap-2 mt-1">
              <RelevancyBadge relevance={detail?.llmAnalysis?.relevance || item.relevance} />
              <span className="text-[10px] text-slate-400 font-semibold">{item.trainName} · Coach {item.coach}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 py-10 justify-center text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-semibold">Loading full conversation & LLM thinking...</span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600">
                <span>PNR: <span className="font-mono">{detail?.pnr || '—'}</span></span>
                <span>Severity: {detail?.severity || 'Medium'}</span>
                <span>Status: {detail?.status || 'Submitted'}</span>
                <span>Category: {detail?.category || '—'}</span>
              </div>

              {/* ── Conversation ── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Conversation</p>
                </div>
                <div className="space-y-2">
                  {detail?.description && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-sm bg-slate-900 text-white text-xs leading-relaxed">
                        {detail.description}
                      </div>
                    </div>
                  )}
                  {conversation.map((entry, i) => (
                    <div key={i} className={entry.role === 'assistant' ? 'flex justify-start' : 'flex justify-end'}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        entry.role === 'assistant'
                          ? 'rounded-tl-sm bg-blue-50 border border-blue-100 text-slate-700'
                          : 'rounded-tr-sm bg-slate-900 text-white'
                      }`}>
                        {entry.text}
                      </div>
                    </div>
                  ))}
                  {conversation.length === 0 && (
                    <p className="text-xs text-slate-400 font-medium">No follow-up conversation — only the original submission.</p>
                  )}
                </div>
              </div>

              {/* ── LLM Thinking (all rounds) ── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">LLM thinking ({analysisHistory.length} round{analysisHistory.length !== 1 ? 's' : ''})</p>
                </div>
                <div className="space-y-3">
                  {analysisHistory.map((analysis, i) => (
                    <LlmThinkingPanel key={i} analysis={analysis} round={i + 1} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-2 sticky bottom-0 bg-white">
          <button
            onClick={() => onConfirm(item)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
          >
            <CheckCircle2 className="w-4 h-4" /> Accept
          </button>
          <button
            onClick={() => onReject(item)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50"
          >
            <Ban className="w-4 h-4" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewQueue() {
  const [items, setItems] = useState([]);
  const [reassigning, setReassigning] = useState({}); // id -> selected category
  const [justResolved, setJustResolved] = useState(null); // id fading out
  const [selected, setSelected] = useState(null); // selected review item
  const [detail, setDetail] = useState(null); // full complaint detail
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    getReviewQueue().then(setItems);
  }, []);

  const removeAfterTransition = (id) => {
    setJustResolved(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setJustResolved(null);
    }, 220);
  };

  const openDetail = async (item) => {
    setSelected(item);
    setDetail(null);
    setLoadingDetail(true);
    try {
      setDetail(await getComplaintDetail(item.id));
    } catch (err) {
      alert('Failed to load complaint detail. Please try again.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleConfirm = async (item) => {
    await submitClassificationOverride(item.id, { action: 'confirm', category: item.aiCategory });
    removeAfterTransition(item.id);
    setSelected(null);
    setDetail(null);
  };

  const handleReassign = async (item) => {
    const category = reassigning[item.id] || item.aiCategoryAlt;
    await submitClassificationOverride(item.id, { action: 'reassign', category });
    removeAfterTransition(item.id);
    setSelected(null);
    setDetail(null);
  };

  const handleReject = async (item) => {
    const reason = window.prompt('Reason for rejection (optional):', '') ;
    if (reason === null) return;
    await rejectReviewItem(item.id, reason.trim() || 'Rejected by officer');
    removeAfterTransition(item.id);
    setSelected(null);
    setDetail(null);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Review queue</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {items.length} classification{items.length !== 1 ? 's' : ''} flagged for manual officer review
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Complaint</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Train / coach</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">AI category</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Confidence</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Reassign to</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-slate-100 last:border-b-0 transition-opacity duration-200 cursor-pointer hover:bg-slate-50/60 ${
                  justResolved === item.id ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={() => openDetail(item)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3 max-w-xs">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <ImageOff className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.excerpt}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.id} · {item.submittedAgo}</p>
                      <div className="mt-1"><RelevancyBadge relevance={item.relevance} /></div>
                      {item.status !== 'Submitted' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-600 mt-1">
                          {item.status === 'Verified'
                            ? 'Verified — awaiting staff'
                            : item.status === 'Routed to Department'
                              ? (item.staffName ? `Staff rejected · ${item.staffName}` : 'Routed — unassigned')
                              : item.status}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-700">{item.train}</p>
                  <p className="text-[11px] text-slate-400">{item.trainName} · Coach {item.coach}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-700">{item.aiCategory}</p>
                  <p className="text-[11px] text-slate-400">{item.department}</p>
                </td>
                <td className="px-4 py-3">
                  <ConfidenceMeter value={item.confidence} />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">flagged for review</p>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={reassigning[item.id] || ''}
                    onChange={(e) => setReassigning((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="text-xs font-semibold border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-slate-900"
                  >
                    <option value="">{item.aiCategoryAlt} (suggested)</option>
                    {CATEGORY_OPTIONS.filter((c) => c !== item.aiCategory).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleConfirm(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Ban className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleReassign(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Reassign
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Review queue is empty</p>
            <p className="text-xs text-slate-400 mt-1">Every classification met the auto-route confidence bar.</p>
          </div>
        )}
      </div>

      <DetailPanel
        item={selected}
        detail={detail}
        loading={loadingDetail}
        onClose={() => { setSelected(null); setDetail(null); }}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  );
}