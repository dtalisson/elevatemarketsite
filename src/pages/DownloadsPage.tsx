import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Trash2, Download, FileArchive, Plus } from "lucide-react";

interface Application {
  id: string;
  name: string;
}

interface DownloadEntry {
  id: string;
  application_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: string | null;
  created_at: string;
  applications?: { name: string };
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const DownloadsPage = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState("");
  const [version, setVersion] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchData = async () => {
    const [{ data: appsData }, { data: dlData }] = await Promise.all([
      supabase.from("applications").select("id, name").order("name"),
      supabase.from("downloads").select("*, applications(name)").order("created_at", { ascending: false }),
    ]);
    if (appsData) setApps(appsData);
    if (dlData) setDownloads(dlData as DownloadEntry[]);
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedApp) return;

    if (!selectedFile.name.endsWith(".zip")) {
      toast.error("Apenas arquivos .zip são permitidos");
      return;
    }

    setUploading(true);
    const filePath = `${selectedApp}/${Date.now()}_${selectedFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("downloads")
      .upload(filePath, selectedFile);

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("downloads").insert({
      application_id: selectedApp,
      file_name: selectedFile.name,
      file_path: filePath,
      file_size: selectedFile.size,
      version: version || null,
    });

    if (dbError) {
      toast.error(dbError.message);
      await supabase.storage.from("downloads").remove([filePath]);
    } else {
      toast.success("Arquivo enviado!");
      setOpen(false);
      setSelectedFile(null);
      setVersion("");
      setSelectedApp("");
      if (fileRef.current) fileRef.current.value = "";
      fetchData();
    }
    setUploading(false);
  };

  const handleDelete = async (dl: DownloadEntry) => {
    const { error: storageErr } = await supabase.storage.from("downloads").remove([dl.file_path]);
    if (storageErr) { toast.error(storageErr.message); return; }

    const { error: dbErr } = await supabase.from("downloads").delete().eq("id", dl.id);
    if (dbErr) toast.error(dbErr.message);
    else { toast.success("Removido!"); fetchData(); }
  };

  const handleDownload = (dl: DownloadEntry) => {
    const { data } = supabase.storage.from("downloads").getPublicUrl(dl.file_path);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Downloads</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os arquivos de download das aplicações</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Upload</Button>
          </DialogTrigger>
          <DialogContent className="dark">
            <DialogHeader><DialogTitle className="font-heading">Enviar Arquivo</DialogTitle></DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicação</Label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="dark">
                    {apps.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Versão (opcional)</Label>
                <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="ex: 1.0.0" />
              </div>
              <div className="space-y-2">
                <Label>Arquivo (.zip)</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={uploading || !selectedApp || !selectedFile}>
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {downloads.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <FileArchive className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-foreground font-heading font-medium">Nenhum arquivo</p>
          <p className="text-sm text-muted-foreground mt-1">Faça upload do primeiro arquivo .zip</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Arquivo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aplicação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Versão</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tamanho</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map(dl => (
                  <tr key={dl.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileArchive className="h-4 w-4 text-primary" />
                        <span className="font-mono text-xs text-foreground">{dl.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{dl.applications?.name || "—"}</td>
                    <td className="px-4 py-3">
                      {dl.version ? (
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">{dl.version}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{formatSize(dl.file_size)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(dl.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleDownload(dl)} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(dl)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DownloadsPage;
