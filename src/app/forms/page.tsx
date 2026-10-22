"use client";

import { useEffect, useState, useMemo } from "react";
import * as mdi from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface FormSubmission {
  id: string;
  formId?: string;
  formName?: string;
  submittedAt: string;
  pageUrl?: string;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    domain?: string;
    apiKeyUsed?: string;
    source?: string;
    status?: string;
    [key: string]: any;
  };
}

interface AvailableForm {
  formId: string;
  formName: string;
  count: number;
}

export default function FormsSubmissionsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [availableForms, setAvailableForms] = useState<AvailableForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSub, setSelectedSub] = useState<FormSubmission | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/forms/getdata");
      const json = await res.json();
      if (json.submissions) {
        setSubmissions(json.submissions);
      }
      if (json.availableForms) {
        setAvailableForms(json.availableForms);
      }
    } catch (err: any) {
      console.error("Failed to load submissions from /api/forms/getdata:", err);
      showToast("Failed to load submissions: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    let list = submissions;
    if (selectedFormId !== "all") {
      list = list.filter((s) => s.formId === selectedFormId);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((s) => {
      return (
        s.formName?.toLowerCase().includes(q) ||
        s.formId?.toLowerCase().includes(q) ||
        s.pageUrl?.toLowerCase().includes(q) ||
        JSON.stringify(s.data).toLowerCase().includes(q)
      );
    });
  }, [submissions, selectedFormId, search]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    try {
      const res = await fetch(`/api/forms/getdata?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Submission deleted successfully.");
        void loadData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert("Failed to delete submission: " + (errJson.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Failed to delete submission: " + err.message);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl pb-10">
      {/* Toast Notification */}
      {toast ? (
        <div className="fixed right-4 top-4 z-[9999] animate-bounce">
          <div className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xl flex items-center gap-2">
            <Icon path={mdi.mdiCheckCircleOutline} className="h-5 w-5" />
            {toast}
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Icon path={mdi.mdiTextBoxCheckOutline} className="h-7 w-7 text-indigo-600" />
            Sitecore AI Forms - Submissions Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and monitor multi-page form submissions received from Sitecore AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <Icon path={mdi.mdiRefresh} className="h-4 w-4 text-slate-600" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon path={mdi.mdiInboxArrowDownOutline} className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{submissions.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon path={mdi.mdiFormSelect} className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Connected Forms</div>
              <div className="text-2xl font-bold text-indigo-600 mt-0.5">{availableForms.length || (submissions.length > 0 ? 1 : 0)}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Icon path={mdi.mdiClockOutline} className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Latest Submission</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5 truncate max-w-[140px]">
                {submissions.length > 0
                  ? new Date(submissions[0].submittedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "--"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-form Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1 flex items-center gap-1.5">
            <Icon path={mdi.mdiFilterVariant} className="h-4 w-4 text-indigo-500" />
            Filter by Form:
          </span>
          <button
            onClick={() => setSelectedFormId("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedFormId === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Forms ({submissions.length})
          </button>
          {availableForms.map((f) => (
            <button
              key={f.formId}
              onClick={() => setSelectedFormId(f.formId)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedFormId === f.formId
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{f.formName}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] ${
                  selectedFormId === f.formId ? "bg-indigo-700 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Viewing:{" "}
          <strong className="text-slate-800">
            {selectedFormId === "all"
              ? "All Forms"
              : availableForms.find((f) => f.formId === selectedFormId)?.formName || selectedFormId}
          </strong>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm overflow-hidden border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Input
              type="text"
              placeholder="Search by submitter, email, form ID, or payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm bg-slate-50"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong>{filtered.length}</strong> of {submissions.length} submissions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-5">Form Name & ID</th>
                <th className="py-3 px-5">Submitter / Contact</th>
                <th className="py-3 px-5">Summary Fields</th>
                <th className="py-3 px-5">Source Page</th>
                <th className="py-3 px-5">Submitted At</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Icon path={mdi.mdiLoading} className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading submissions from /api/forms/getdata...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No form submissions found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const d = item.data || {};
                  const fullName =
                    d["Full name"] ||
                    d["fullName"] ||
                    d.name ||
                    d.candidateName ||
                    d.companyName ||
                    `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
                    "Anonymous";
                  const email = d.email || d.contactEmail || "--";
                  const phone = d.phone || d.telephone || "--";
                  const dateStr = new Date(item.submittedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  // Extract additional fields for preview
                  const otherEntries = Object.entries(d).filter(
                    ([k]) =>
                      !["Full name", "fullName", "name", "email", "phone", "domain", "_formId", "_formName"].includes(
                        k
                      )
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition duration-150">
                      <td className="py-3.5 px-5">
                        <Badge
                          variant="default"
                          className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
                        >
                          {item.formName || "Sitecore Form"}
                        </Badge>
                        <div
                          className="text-[11px] text-slate-400 font-mono mt-1 truncate max-w-[150px]"
                          title={item.formId}
                        >
                          ID: {item.formId}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900">{fullName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{email}</div>
                        {phone !== "--" && <div className="text-xs text-slate-400 font-mono">{phone}</div>}
                      </td>
                      <td className="py-3.5 px-5 max-w-sm">
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
                          {otherEntries.slice(0, 3).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              <span className="font-semibold text-slate-500 mr-1">{k}:</span>
                              <span className="truncate max-w-[120px]">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </span>
                          ))}
                          {otherEntries.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-medium self-center">
                              +{otherEntries.length - 3} more fields
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3.5 px-5 text-xs text-slate-600 font-mono max-w-[180px] truncate"
                        title={item.pageUrl || d.domain || "--"}
                      >
                        {item.pageUrl || d.domain || "--"}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-500 whitespace-nowrap">{dateStr}</td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSub(item)}
                          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs font-semibold mr-1"
                        >
                          Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          title="Delete submission"
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 text-xs px-2"
                        >
                          <Icon path={mdi.mdiDeleteOutline} className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon path={mdi.mdiFileDocumentOutline} className="h-5 w-5 text-indigo-600" />
                Submission Details: {selectedSub.formName || selectedSub.formId}
              </h3>
              <button
                onClick={() => setSelectedSub(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <Icon path={mdi.mdiClose} className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <strong className="text-slate-500">Form Name:</strong>{" "}
                <span className="font-semibold text-slate-900">{selectedSub.formName || "--"}</span>
              </div>
              <div>
                <strong className="text-slate-500">Submitted At:</strong>{" "}
                {new Date(selectedSub.submittedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div>
                <strong className="text-slate-500">Form ID:</strong>{" "}
                <span className="font-mono text-indigo-600 font-semibold">{selectedSub.formId}</span>
              </div>
              <div>
                <strong className="text-slate-500">Source Page:</strong>{" "}
                <span className="font-mono text-slate-700">
                  {selectedSub.pageUrl || selectedSub.data?.domain || "--"}
                </span>
              </div>
              <div>
                <strong className="text-slate-500">API Key Auth:</strong>{" "}
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[11px] font-semibold">
                  Verified (x-api-key)
                </span>
              </div>
              <div>
                <strong className="text-slate-500">Source:</strong>{" "}
                <span className="text-slate-700">{selectedSub.metadata?.source || "Sitecore Webhook"}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Submitted Form Fields:
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                {Object.entries(selectedSub.data || {}).map(([k, v]) => (
                  <div key={k} className="flex border-b border-slate-100 last:border-none p-2.5">
                    <div className="w-1/3 font-semibold text-slate-600 font-mono">{k}</div>
                    <div className="w-2/3 text-slate-900 font-medium">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Raw JSON Payload:</h4>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-[11px] overflow-x-auto font-mono max-h-48">
                {JSON.stringify(selectedSub, null, 2)}
              </pre>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedSub(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
