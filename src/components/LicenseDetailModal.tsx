import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface LicenseDetail {
  license_key: string;
  status: string;
  expires_at?: string | null;
  activated_at?: string | null;
  created_at?: string;
  hwid?: string | null;
  claimed_by?: string | null;
  note?: string | null;
  remaining_seconds?: number | null;
  ban_reason?: string | null;
  application_name?: string;
  panel_user_name?: string;
  software_user?: {
    username: string;
    hwid: string | null;
    ip_address: string | null;
    last_login_at: string | null;
    created_at?: string;
  } | null;
}

interface Props {
  license: LicenseDetail | null;
  open: boolean;
  onClose: () => void;
}

const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

const formatDate = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      <span className={`text-xs text-foreground ${mono ? "font-mono" : ""} max-w-[280px] truncate text-right`}>{value || "—"}</span>
      {copyable && value && value !== "—" && (
        <button onClick={() => copyText(value)} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="h-3 w-3" /></button>
      )}
    </div>
  </div>
);

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  unused: "bg-muted text-muted-foreground",
  expired: "bg-warning/10 text-warning",
  banned: "bg-destructive/10 text-destructive",
};

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export const LicenseDetailModal = ({ license, open, onClose }: Props) => {
  if (!license) return null;

  const effectiveStatus = license.status === "active" && license.expires_at && new Date(license.expires_at) < new Date() ? "expired" : license.status;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            Detalhes da Licença
            <Badge className={`${statusColors[effectiveStatus] || statusColors.unused} text-[10px] border-0`}>{effectiveStatus}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* License info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 p-3 space-y-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Licença</p>
              <InfoRow label="Key" value={license.license_key} copyable mono />
              <InfoRow label="Status" value={effectiveStatus} />
              <InfoRow label="HWID" value={license.hwid} copyable mono />
              <InfoRow label="Nota" value={license.note} />
            </div>
            <div className="rounded-lg border border-border/50 p-3 space-y-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Contexto</p>
              {license.application_name && <InfoRow label="Aplicação" value={license.application_name} />}
              {license.panel_user_name && <InfoRow label="Revendedor" value={license.panel_user_name} />}
              <InfoRow label="Criada" value={formatDate(license.created_at)} />
              <InfoRow label="Ativada" value={formatDate(license.activated_at)} />
              <InfoRow label="Expira" value={formatDate(license.expires_at)} />
              {license.remaining_seconds != null && license.remaining_seconds > 0 && (
                <InfoRow label="Tempo restante" value={formatDuration(license.remaining_seconds)} />
              )}
              {license.ban_reason && <InfoRow label="Motivo ban" value={license.ban_reason} />}
            </div>
          </div>

          {/* Software user info */}
          {license.software_user && (
            <div className="rounded-lg border border-border/50 p-3 space-y-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Usuário Vinculado</p>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoRow label="Username" value={license.software_user.username} copyable mono />
                <InfoRow label="IP" value={license.software_user.ip_address} copyable mono />
                <InfoRow label="HWID" value={license.software_user.hwid} copyable mono />
                <InfoRow label="Último login" value={formatDate(license.software_user.last_login_at)} />
                <InfoRow label="Registrado" value={formatDate(license.software_user.created_at)} />
              </div>
            </div>
          )}

          {!license.software_user && license.status === "unused" && (
            <div className="rounded-lg border border-border/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">Nenhum usuário vinculado a esta licença</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
