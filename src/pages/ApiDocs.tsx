import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Wifi, LogIn, UserPlus, Key, AlertTriangle } from "lucide-react";

const ApiDocs = () => {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project"}.supabase.co/functions/v1`;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Documentação</h1>
        <p className="text-sm text-muted-foreground">Guia completo para integrar autenticação, licenciamento e verificação de status no seu software</p>
      </div>

      {/* Flow Overview */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">🔄 Fluxo Completo de Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
              <span>Ao abrir o programa, chame <code className="text-primary">/app-status</code> para verificar se o app está <strong className="text-foreground">online, desabilitado ou desatualizado</strong></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
              <span>Se o app estiver online, peça a <strong className="text-foreground">license key</strong> na primeira vez e cadastre com <code className="text-primary">/register-with-license</code></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
              <span>Nos próximos acessos, o cliente usa <strong className="text-foreground">usuário e senha</strong> para entrar via <code className="text-primary">/login</code></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
              <span>Valide o <code className="text-primary">session_token</code> e <code className="text-primary">signature</code> retornados para proteger contra <strong className="text-foreground">bypass de auth</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">

        {/* APP STATUS */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-cyan-400" />
              <Badge className="bg-cyan-600 hover:bg-cyan-700">POST</Badge>
              <CardTitle className="text-base">App Status</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Verifica se o aplicativo está online, desabilitado, em manutenção ou com versão desatualizada. <strong>Deve ser chamado ao abrir o programa.</strong></p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
                  POST {baseUrl}/app-status
                </code>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "app_secret": "secret-key-da-aplicacao",
  "version": "1.0.0",                    // versão atual do cliente
  "nonce": "random-string-unica"          // anti-replay (recomendado)
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTAS</p>
                <Tabs defaultValue="online" className="w-full">
                  <TabsList className="mb-2">
                    <TabsTrigger value="online">Online</TabsTrigger>
                    <TabsTrigger value="disabled">Desabilitado</TabsTrigger>
                    <TabsTrigger value="outdated">Desatualizado</TabsTrigger>
                  </TabsList>
                  <TabsContent value="online">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "status": "online",
  "message": "Application is online",
  "app": {
    "name": "MeuApp",
    "enabled": true,
    "current_version": "1.2.0",
    "min_version": "1.0.0",
    "update_required": false,
    "update_available": true
  },
  "timestamp": 1712505600000,
  "nonce": "abc123",
  "signature": "hmac-sha256-assinatura"
}`}
                    </pre>
                  </TabsContent>
                  <TabsContent value="disabled">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-yellow-400">
{`{
  "success": true,
  "status": "disabled",
  "message": "Aplicação desabilitada pelo administrador",
  "app": { "enabled": false, ... },
  "signature": "..."
}`}
                    </pre>
                  </TabsContent>
                  <TabsContent value="outdated">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`{
  "success": true,
  "status": "outdated",
  "message": "Atualização obrigatória. Versão mínima: 2.0.0",
  "app": { "update_required": true, ... },
  "signature": "..."
}`}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* REGISTER */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-400" />
              <Badge className="bg-green-600 hover:bg-green-700">POST</Badge>
              <CardTitle className="text-base">Registrar com Licença</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Primeira vez — o cliente usa a license key para criar usuário e senha</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
                  POST {baseUrl}/register-with-license
                </code>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "license_key": "ABC123XYZ456",
  "app_secret": "secret-key-da-aplicacao",
  "username": "nome_do_usuario",
  "password": "senha",
  "hwid": "identificador-do-hardware",  // opcional
  "version": "1.0.0"                    // opcional
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (sucesso - 201)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "User registered successfully",
  "user": { "username": "nome_do_usuario" }
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS POSSÍVEIS</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos obrigatórios faltando / validação
401 — App secret inválido
403 — App desabilitada / licença banida ou expirada / versão desatualizada
404 — Licença não encontrada
409 — Licença já usada / username já existe`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LOGIN */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-blue-400" />
              <Badge className="bg-blue-600 hover:bg-blue-700">POST</Badge>
              <CardTitle className="text-base">Login</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Acessos seguintes — retorna session token assinado com HMAC</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
                  POST {baseUrl}/login
                </code>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "app_secret": "secret-key-da-aplicacao",
  "username": "nome_do_usuario",
  "password": "senha",
  "hwid": "identificador-do-hardware",  // opcional
  "version": "1.0.0",                   // opcional
  "nonce": "random-string-unica"         // anti-replay (recomendado)
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (sucesso - 200)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "Login successful",
  "session_token": "token-de-sessao-hex-64-chars",
  "signature": "hmac-sha256-da-resposta",
  "timestamp": 1712505600000,
  "nonce": "seu-nonce-original",
  "user": {
    "username": "nome_do_usuario",
    "license": {
      "status": "active",
      "expires_at": "2025-12-31T00:00:00Z"
    }
  },
  "app": {
    "current_version": "1.1.0",
    "update_available": true
  }
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS POSSÍVEIS</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos obrigatórios faltando
401 — App secret inválido / usuário ou senha errados
403 — App desabilitada / licença banida/expirada / HWID diferente / versão desatualizada`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VALIDATE LICENSE */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-yellow-400" />
              <Badge className="bg-yellow-600 hover:bg-yellow-700">POST</Badge>
              <CardTitle className="text-base">Validar Licença (direto)</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Validação direta por license key — sem sistema de usuário/senha</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
                  POST {baseUrl}/validate-license
                </code>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "license_key": "ABC123XYZ456",
  "app_secret": "secret-key-da-aplicacao",
  "hwid": "identificador-do-hardware"  // opcional
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (sucesso)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "valid": true,
  "message": "License validated successfully",
  "license": {
    "status": "active",
    "expires_at": "2025-12-31T00:00:00Z",
    "max_uses": 1,
    "current_uses": 1
  }
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECURITY - Anti Debug */}
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <CardTitle className="text-base">🛡️ Proteção Anti-Crack / Anti-Debug</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Como proteger seu software contra x64dbg, Cheat Engine, memory patching e bypass de autenticação</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                  1. Verificação de Assinatura HMAC
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Todas as respostas do login e app-status retornam um campo <code className="text-primary">signature</code>. 
                  Essa assinatura é gerada com HMAC-SHA256 usando a service key do servidor. 
                  Um cracker <strong>não pode</strong> falsificar essa assinatura sem a chave.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`# O servidor assina: {"session":"token","username":"user","status":"active","timestamp":123,"nonce":"abc"}
# O cliente deve verificar que:
# 1. A signature NÃO é vazia
# 2. O nonce retornado é o MESMO que você enviou
# 3. O timestamp é recente (< 30 segundos)`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                  2. Nonce Anti-Replay
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Envie um <code className="text-primary">nonce</code> único (UUID ou random) em cada request. 
                  O servidor retorna o mesmo nonce na resposta. Isso impede que um cracker 
                  <strong> grave uma resposta válida e a replaye</strong>.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// Gere um nonce único por request
std::string nonce = "nonce-" + std::to_string(rand());

// Envie no request
json body = { {"nonce", nonce}, ... };

// Verifique na resposta
if (res["nonce"] != nonce) {
    // RESPOSTA FAKE! Feche o programa.
    ExitProcess(0);
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                  3. Detecção de Debugger
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Adicione verificações anti-debug no lado do cliente para detectar x64dbg, OllyDbg, Cheat Engine e similares.
                </p>
                <Tabs defaultValue="csharp_anti" className="w-full">
                  <TabsList className="mb-2">
                    <TabsTrigger value="csharp_anti">C#</TabsTrigger>
                    <TabsTrigger value="cpp_anti">C++</TabsTrigger>
                    <TabsTrigger value="python_anti">Python</TabsTrigger>
                  </TabsList>
                  <TabsContent value="csharp_anti">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`using System.Diagnostics;
using System.Runtime.InteropServices;

class AntiDebug
{
    [DllImport("kernel32.dll")]
    static extern bool IsDebuggerPresent();

    [DllImport("kernel32.dll")]
    static extern bool CheckRemoteDebuggerPresent(IntPtr hProcess, ref bool isDebuggerPresent);

    public static bool IsBeingDebugged()
    {
        // Método 1: API do Windows
        if (IsDebuggerPresent()) return true;

        // Método 2: Debugger remoto
        bool remoteDebugger = false;
        CheckRemoteDebuggerPresent(Process.GetCurrentProcess().Handle, ref remoteDebugger);
        if (remoteDebugger) return true;

        // Método 3: .NET Debugger
        if (Debugger.IsAttached) return true;

        // Método 4: Processos suspeitos
        string[] badProcesses = {
            "x64dbg", "x32dbg", "ollydbg", "ida", "ida64",
            "cheatengine", "dnspy", "de4dot", "httpdebugger",
            "fiddler", "wireshark", "processhacker"
        };
        foreach (var proc in Process.GetProcesses())
        {
            string name = proc.ProcessName.ToLower();
            foreach (var bad in badProcesses)
                if (name.Contains(bad)) return true;
        }
        return false;
    }

    // Chame no início do programa e periodicamente
    public static void Protect()
    {
        if (IsBeingDebugged())
        {
            // Feche silenciosamente
            Environment.Exit(0);
        }
    }
}`}
                    </pre>
                  </TabsContent>
                  <TabsContent value="cpp_anti">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`#include <windows.h>
#include <tlhelp32.h>
#include <string>
#include <vector>

bool IsBeingDebugged() {
    // Método 1: IsDebuggerPresent
    if (IsDebuggerPresent()) return true;

    // Método 2: CheckRemoteDebuggerPresent
    BOOL remoteDebugger = FALSE;
    CheckRemoteDebuggerPresent(GetCurrentProcess(), &remoteDebugger);
    if (remoteDebugger) return true;

    // Método 3: NtGlobalFlag (PEB)
    #ifdef _WIN64
    PPEB pPeb = (PPEB)__readgsqword(0x60);
    if (pPeb->NtGlobalFlag & 0x70) return true;
    #endif

    // Método 4: Processos suspeitos
    std::vector<std::wstring> badProcs = {
        L"x64dbg.exe", L"x32dbg.exe", L"ollydbg.exe",
        L"ida.exe", L"ida64.exe", L"cheatengine-x86_64.exe",
        L"httpdebuggerui.exe", L"fiddler.exe"
    };
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    PROCESSENTRY32W pe = { sizeof(pe) };
    if (Process32FirstW(snap, &pe)) {
        do {
            for (auto& bad : badProcs)
                if (_wcsicmp(pe.szExeFile, bad.c_str()) == 0) {
                    CloseHandle(snap);
                    return true;
                }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return false;
}

// Chame no início e em loop a cada 5 segundos
void ProtectLoop() {
    while (true) {
        if (IsBeingDebugged()) ExitProcess(0);
        Sleep(5000);
    }
}`}
                    </pre>
                  </TabsContent>
                  <TabsContent value="python_anti">
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`import sys, os, ctypes, psutil

def is_debugged():
    # Método 1: sys.gettrace
    if sys.gettrace() is not None:
        return True

    # Método 2: Windows API
    if os.name == "nt":
        if ctypes.windll.kernel32.IsDebuggerPresent():
            return True

    # Método 3: Processos suspeitos
    bad = ["x64dbg", "x32dbg", "ollydbg", "ida", "ida64",
           "cheatengine", "dnspy", "fiddler", "wireshark"]
    for proc in psutil.process_iter(['name']):
        name = proc.info['name'].lower()
        if any(b in name for b in bad):
            return True
    return False

# No início do programa:
if is_debugged():
    os._exit(0)`}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                  4. Checklist de Segurança
                </h3>
                <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                  <p>✅ <strong className="text-foreground">Envie nonce</strong> em toda request e valide na resposta</p>
                  <p>✅ <strong className="text-foreground">Verifique timestamp</strong> — rejeite respostas com mais de 30s</p>
                  <p>✅ <strong className="text-foreground">Verifique signature</strong> — não está vazia e tem 64 chars hex</p>
                  <p>✅ <strong className="text-foreground">Use HWID</strong> — trava a licença no hardware do cliente</p>
                  <p>✅ <strong className="text-foreground">Cheque app-status</strong> antes do login para poder desabilitar remotamente</p>
                  <p>✅ <strong className="text-foreground">Anti-debug</strong> — rode verificações em loop, não apenas no início</p>
                  <p>✅ <strong className="text-foreground">Ofusque seu código</strong> — use Obfuscar (.NET), VMProtect, Themida (C++)</p>
                  <p>✅ <strong className="text-foreground">String encryption</strong> — não deixe URLs e secrets em plaintext no binário</p>
                  <p>✅ <strong className="text-foreground">Integrity check</strong> — verifique o hash do próprio executável em runtime</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Examples */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">📦 Exemplo Completo de Integração</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Inclui app-status + registro + login + anti-debug</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="python" className="w-full">
              <TabsList className="mb-3">
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="csharp">C#</TabsTrigger>
                <TabsTrigger value="cpp">C++</TabsTrigger>
                <TabsTrigger value="nodejs">Node.js</TabsTrigger>
              </TabsList>

              <TabsContent value="python">
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`import requests, hashlib, uuid, sys, os, time

BASE_URL = "${baseUrl}"
APP_SECRET = "coloque-seu-app-secret-aqui"

def get_hwid():
    return hashlib.md5(str(uuid.getnode()).encode()).hexdigest()

def gen_nonce():
    return str(uuid.uuid4())

# ── ANTI-DEBUG ────────────────────────────────────
def check_debug():
    if sys.gettrace() is not None:
        os._exit(0)
    try:
        import psutil
        bad = ["x64dbg","x32dbg","ollydbg","ida","cheatengine","dnspy","fiddler"]
        for p in psutil.process_iter(['name']):
            if any(b in p.info['name'].lower() for b in bad):
                os._exit(0)
    except: pass

# ── APP STATUS ────────────────────────────────────
def check_app_status():
    check_debug()
    nonce = gen_nonce()
    r = requests.post(f"{BASE_URL}/app-status", json={
        "app_secret": APP_SECRET,
        "version": "1.0.0",
        "nonce": nonce
    })
    data = r.json()
    
    # Validações anti-crack
    if data.get("nonce") != nonce:
        print("⚠️ Resposta adulterada!")
        os._exit(0)
    if abs(time.time() * 1000 - data.get("timestamp", 0)) > 30000:
        print("⚠️ Resposta expirada!")
        os._exit(0)
    if not data.get("signature"):
        os._exit(0)
    
    if data["status"] == "disabled":
        print(f"🔴 {data['message']}")
        return False
    if data["status"] == "outdated":
        print(f"🟡 {data['message']}")
        return False
    
    print(f"🟢 App online! Versão atual: {data['app']['current_version']}")
    if data['app'].get('update_available'):
        print(f"📦 Nova versão disponível: {data['app']['current_version']}")
    return True

# ── REGISTRO (primeira vez) ───────────────────────
def register(license_key, username, password):
    r = requests.post(f"{BASE_URL}/register-with-license", json={
        "license_key": license_key,
        "app_secret": APP_SECRET,
        "username": username,
        "password": password,
        "hwid": get_hwid()
    })
    data = r.json()
    print("✅ Conta criada!" if data["success"] else f"❌ {data['message']}")
    return data

# ── LOGIN ─────────────────────────────────────────
def login(username, password):
    check_debug()
    nonce = gen_nonce()
    r = requests.post(f"{BASE_URL}/login", json={
        "app_secret": APP_SECRET,
        "username": username,
        "password": password,
        "hwid": get_hwid(),
        "nonce": nonce
    })
    data = r.json()
    
    if data.get("success"):
        # Validações anti-crack
        if data.get("nonce") != nonce:
            os._exit(0)
        if not data.get("signature") or len(data["signature"]) != 64:
            os._exit(0)
        if abs(time.time() * 1000 - data.get("timestamp", 0)) > 30000:
            os._exit(0)
        
        print(f"✅ Logado! Token: {data['session_token'][:16]}...")
        return True
    else:
        print(f"❌ {data['message']}")
        return False

# ── USO ───────────────────────────────────────────
# if not check_app_status():
#     sys.exit(1)
# register("SUA-KEY", "usuario", "senha")     # primeira vez
# if login("usuario", "senha"):               # próximas vezes
#     print("Programa liberado!")
`}
                </pre>
              </TabsContent>

              <TabsContent value="csharp">
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Management;
using System.Diagnostics;
using System.Runtime.InteropServices;

class ElevateAuth
{
    static readonly HttpClient client = new();
    static readonly string BASE_URL = "${baseUrl}";
    static readonly string APP_SECRET = "coloque-seu-app-secret-aqui";

    [DllImport("kernel32.dll")]
    static extern bool IsDebuggerPresent();

    static string GetHWID() {
        var s = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor");
        foreach (var o in s.Get()) return o["ProcessorId"]?.ToString() ?? "unknown";
        return "unknown";
    }

    static void AntiDebug() {
        if (IsDebuggerPresent() || Debugger.IsAttached)
            Environment.Exit(0);
        string[] bad = {"x64dbg","x32dbg","ollydbg","ida","cheatengine","dnspy","fiddler"};
        foreach (var p in Process.GetProcesses())
            foreach (var b in bad)
                if (p.ProcessName.ToLower().Contains(b)) Environment.Exit(0);
    }

    // APP STATUS
    public static async Task<bool> CheckStatus(string version = "1.0.0") {
        AntiDebug();
        string nonce = Guid.NewGuid().ToString();
        var body = JsonSerializer.Serialize(new { app_secret = APP_SECRET, version, nonce });
        var res = await client.PostAsync($"{BASE_URL}/app-status",
            new StringContent(body, Encoding.UTF8, "application/json"));
        var json = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var root = json.RootElement;

        if (root.GetProperty("nonce").GetString() != nonce) Environment.Exit(0);
        if (string.IsNullOrEmpty(root.GetProperty("signature").GetString())) Environment.Exit(0);

        string status = root.GetProperty("status").GetString()!;
        if (status == "disabled" || status == "outdated") {
            Console.WriteLine(root.GetProperty("message").GetString());
            return false;
        }
        return true;
    }

    // REGISTER
    public static async Task<bool> Register(string licenseKey, string user, string pass) {
        var body = JsonSerializer.Serialize(new {
            license_key = licenseKey, app_secret = APP_SECRET,
            username = user, password = pass, hwid = GetHWID()
        });
        var res = await client.PostAsync($"{BASE_URL}/register-with-license",
            new StringContent(body, Encoding.UTF8, "application/json"));
        var json = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("success").GetBoolean();
    }

    // LOGIN
    public static async Task<bool> Login(string user, string pass) {
        AntiDebug();
        string nonce = Guid.NewGuid().ToString();
        var body = JsonSerializer.Serialize(new {
            app_secret = APP_SECRET, username = user, password = pass,
            hwid = GetHWID(), nonce
        });
        var res = await client.PostAsync($"{BASE_URL}/login",
            new StringContent(body, Encoding.UTF8, "application/json"));
        var json = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var root = json.RootElement;

        if (!root.GetProperty("success").GetBoolean()) return false;
        if (root.GetProperty("nonce").GetString() != nonce) Environment.Exit(0);
        if (root.GetProperty("signature").GetString()?.Length != 64) Environment.Exit(0);

        Console.WriteLine($"Session: {root.GetProperty("session_token").GetString()}");
        return true;
    }
}`}
                </pre>
              </TabsContent>

              <TabsContent value="cpp">
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <windows.h>

using json = nlohmann::json;

const std::string BASE_URL = "${baseUrl}";
const std::string APP_SECRET = "coloque-seu-app-secret-aqui";

void anti_debug() {
    if (IsDebuggerPresent()) ExitProcess(0);
    BOOL remote = FALSE;
    CheckRemoteDebuggerPresent(GetCurrentProcess(), &remote);
    if (remote) ExitProcess(0);
}

size_t WriteCallback(void* c, size_t s, size_t n, std::string* o) {
    o->append((char*)c, s * n); return s * n;
}

json post(const std::string& endpoint, const json& body) {
    CURL* curl = curl_easy_init();
    std::string response;
    if (curl) {
        std::string url = BASE_URL + "/" + endpoint;
        std::string payload = body.dump();
        struct curl_slist* h = nullptr;
        h = curl_slist_append(h, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payload.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, h);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
        curl_easy_perform(curl);
        curl_slist_free_all(h);
        curl_easy_cleanup(curl);
    }
    return json::parse(response);
}

bool check_status(const std::string& version = "1.0.0") {
    anti_debug();
    std::string nonce = "nonce-" + std::to_string(rand());
    auto res = post("app-status", {
        {"app_secret", APP_SECRET}, {"version", version}, {"nonce", nonce}
    });
    if (res["nonce"] != nonce) ExitProcess(0);
    if (res["status"] == "disabled" || res["status"] == "outdated") {
        std::cout << res["message"] << std::endl;
        return false;
    }
    return true;
}

bool login(const std::string& user, const std::string& pass) {
    anti_debug();
    std::string nonce = "nonce-" + std::to_string(rand());
    auto res = post("login", {
        {"app_secret", APP_SECRET}, {"username", user},
        {"password", pass}, {"nonce", nonce}
    });
    if (!res["success"]) return false;
    if (res["nonce"] != nonce) ExitProcess(0);
    std::string sig = res["signature"];
    if (sig.length() != 64) ExitProcess(0);
    std::cout << "Session: " << res["session_token"] << std::endl;
    return true;
}

// Dependências: libcurl, nlohmann/json
// Compilar: g++ -o app main.cpp -lcurl`}
                </pre>
              </TabsContent>

              <TabsContent value="nodejs">
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`import crypto from "crypto";

const BASE_URL = "${baseUrl}";
const APP_SECRET = "coloque-seu-app-secret-aqui";

function genNonce() { return crypto.randomUUID(); }

async function checkAppStatus(version = "1.0.0") {
  const nonce = genNonce();
  const res = await fetch(\`\${BASE_URL}/app-status\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_secret: APP_SECRET, version, nonce }),
  });
  const data = await res.json();

  if (data.nonce !== nonce) throw new Error("Tampered response");
  if (!data.signature) throw new Error("Missing signature");
  if (Math.abs(Date.now() - data.timestamp) > 30000) throw new Error("Expired");

  console.log(\`Status: \${data.status} - \${data.message}\`);
  return data.status === "online";
}

async function register(licenseKey, username, password) {
  const res = await fetch(\`\${BASE_URL}/register-with-license\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      license_key: licenseKey, app_secret: APP_SECRET, username, password
    }),
  });
  return (await res.json()).success;
}

async function login(username, password) {
  const nonce = genNonce();
  const res = await fetch(\`\${BASE_URL}/login\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_secret: APP_SECRET, username, password, nonce
    }),
  });
  const data = await res.json();
  if (!data.success) return false;

  if (data.nonce !== nonce) throw new Error("Tampered");
  if (!data.signature || data.signature.length !== 64) throw new Error("Invalid sig");

  console.log(\`Session: \${data.session_token}\`);
  return true;
}

// USO:
// if (await checkAppStatus("1.0.0")) {
//   await register("SUA-KEY", "user", "pass");
//   await login("user", "pass");
// }`}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;
