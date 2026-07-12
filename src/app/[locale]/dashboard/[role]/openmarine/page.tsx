"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────

type MappingRow = {
  id: number;
  schepenkring_field: string;
  openmarine_xml_path: string;
  group_label: string | null;
  is_required: boolean;
  notes: string | null;
};

type MappingGroups = Record<string, MappingRow[]>;

type InspectField = MappingRow & {
  current_value: unknown;
  populated: boolean;
};

type InspectResult = {
  yacht: { id: number; boat_name: string | null; status: string | null };
  fields: InspectField[];
  errors: string[];
  warnings: string[];
};

export default function OpenMarineIntegrationPage() {
  const [groups, setGroups] = useState<MappingGroups>({});
  const [loading, setLoading] = useState(true);
  const [yachtIdInput, setYachtIdInput] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: MappingGroups }>("/admin/openmarine/mappings");
      setGroups(res.data.data);
    } catch {
      toast.error("Kon OpenMarine mapping niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  const inspectYacht = async () => {
    const id = yachtIdInput.trim();
    if (!id) return;
    setInspecting(true);
    setInspectResult(null);
    try {
      const res = await api.get<{ data: InspectResult }>(`/admin/openmarine/mappings/inspect/${id}`);
      setInspectResult(res.data.data);
    } catch {
      toast.error("Kon jacht niet inspecteren — controleer het ID");
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">OpenMarine Integration Center</h1>
          <p className="text-sm text-slate-500">
            Elk Schepenkring-veld en waar het naartoe wordt gemapt in de OpenMarine 2.0 export.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadMappings()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Verversen
        </Button>
      </div>

      {/* Yacht inspector */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Jacht inspecteren</h2>
          <p className="text-xs text-slate-500 mt-1">
            Voer een jacht-ID in om per veld te zien of het gevuld is en waarom een export mist of dun is.
          </p>
        </div>
        <div className="px-5 py-4 flex items-center gap-3">
          <Input
            value={yachtIdInput}
            onChange={(e) => setYachtIdInput(e.target.value)}
            placeholder="Jacht ID, bijv. 1234"
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && void inspectYacht()}
          />
          <Button size="sm" onClick={() => void inspectYacht()} disabled={inspecting || !yachtIdInput.trim()}>
            {inspecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Search className="h-3.5 w-3.5 mr-2" />}
            Inspecteren
          </Button>
        </div>

        {inspectResult && (
          <div className="border-t border-slate-100">
            <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                #{inspectResult.yacht.id} — {inspectResult.yacht.boat_name ?? "Naamloos"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {inspectResult.yacht.status}
              </span>
            </div>

            {(inspectResult.errors.length > 0 || inspectResult.warnings.length > 0) && (
              <div className="px-5 py-3 space-y-1.5 border-b border-slate-100">
                {inspectResult.errors.map((e, i) => (
                  <p key={`err-${i}`} className="text-xs text-red-600 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0" /> {e}
                  </p>
                ))}
                {inspectResult.warnings.map((w, i) => (
                  <p key={`warn-${i}`} className="text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-auto">
              {inspectResult.fields.map((f) => (
                <div key={f.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {f.populated ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className={cn("h-3.5 w-3.5 flex-shrink-0", f.is_required ? "text-red-500" : "text-slate-300")} />
                      )}
                      <span className="text-sm font-mono text-slate-700 truncate">{f.schepenkring_field}</span>
                      {f.is_required && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          verplicht
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono ml-5">→ {f.openmarine_xml_path}</p>
                  </div>
                  <span className="text-xs text-slate-500 truncate max-w-[12rem] text-right">
                    {f.current_value === null || f.current_value === "" ? "—" : String(f.current_value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Mapping reference */}
      <section className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          Object.entries(groups).map(([groupLabel, rows]) => (
            <div key={groupLabel} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-800">{groupLabel}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <div key={row.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-700">{row.schepenkring_field}</span>
                        {row.is_required && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            verplicht
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">→ {row.openmarine_xml_path}</p>
                      {row.notes && <p className="text-xs text-slate-500 mt-1">{row.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
