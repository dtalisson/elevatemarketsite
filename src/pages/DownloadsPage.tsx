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
import { Upload, Trash2, Download, FileArchive, Plus, Search, Filter } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterApp, setFilterApp] = useState("all");
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

  const filtered = downloads.filter(dl => {
    const matchSearch = dl.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dl.applications?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchApp = filterApp === "all" || dl.application_id === filterApp;
    return matchSearch && matchApp;
  });

  return (
    <DashboardLayout>
      <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">
          Downloads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os arquivos de download das aplicações</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterApp} onValueChange={setFilterApp}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-secondary border-border">
              <SelectValue placeholder="Todas apps" />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="all">Todas apps</SelectItem>
              {apps.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg text-xs bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="ml-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Upload</Button>
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
      </div>

      {/* Grid de cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/50 flex flex-col items-center justify-center py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.03]" />
          <FileArchive className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-foreground font-heading font-medium text-lg">Nenhum arquivo</p>
          <p className="text-sm text-muted-foreground mt-1">Faça upload do primeiro arquivo .zip</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(dl => (
            <div
              key={dl.id}
              className="group relative rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.15)]"
            >
              {/* Glow accent top */}
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Header do card */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FileArchive className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate max-w-[180px]" title={dl.file_name}>
                      {dl.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dl.applications?.name || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-3 mb-4">
                {dl.version && (
                  <span className="text-[10px] font-mono font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    v{dl.version}
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatSize(dl.file_size)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(dl.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                <button
                  onClick={() => handleDownload(dl)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(dl)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all duration-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default DownloadsPage;
