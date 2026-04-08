import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Wifi, LogIn, UserPlus, Key, AlertTriangle, Lock } from "lucide-react";

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
              <span>Antes de logar, chame <code className="text-primary">/pre-auth</code> para obter um <strong className="text-foreground">challenge token</strong> (handshake seguro)</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
              <span>Faça login via <code className="text-primary">/login</code> enviando o <code className="text-primary">challenge_token</code> junto com credenciais</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">5</Badge>
              <span>Durante a sessão, envie <code className="text-primary">/heartbeat</code> a cada 30s para manter a sessão e detectar <strong className="text-foreground">bans em tempo real</strong></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">6</Badge>
              <span>Se detectar debugger/dump, envie <code className="text-primary">/security-log</code> para alertar o painel</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HMAC-TOTP Authentication */}
      <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-yellow-400" />
            <CardTitle className="text-base">🔐 Autenticação HMAC-TOTP (Recomendado)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Em vez de enviar o <code className="text-primary">app_secret</code> em texto plano (visível em HTTP debuggers), 
              use <strong className="text-foreground">HMAC-TOTP</strong>: o secret nunca trafega na rede.
            </p>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-foreground mb-2">Como funciona:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>O <code className="text-primary">app_secret</code> fica embutido no binário do seu software</li>
                <li>A cada requisição, calcule: <code className="text-primary">time_step = floor(unix_timestamp / 30)</code></li>
                <li>Gere: <code className="text-primary">app_hash = HMAC-SHA256(app_secret, time_step)</code></li>
                <li>Envie <code className="text-primary">app_hash</code> + <code className="text-primary">timestamp</code> (unix seconds) no body</li>
              </ol>
            </div>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// C++ - Exemplo com OpenSSL
#include <openssl/hmac.h>
#include <ctime>
#include <sstream>
#include <iomanip>

std::string compute_app_hash(const std::string& app_secret) {
    long timestamp = std::time(nullptr);
    long time_step = timestamp / 30;
    std::string step_str = std::to_string(time_step);
    
    unsigned char hash[32];
    unsigned int len = 32;
    HMAC(EVP_sha256(), app_secret.c_str(), app_secret.size(),
         (unsigned char*)step_str.c_str(), step_str.size(), hash, &len);
    
    std::ostringstream oss;
    for (int i = 0; i < 32; i++)
        oss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    return oss.str();
}

// Uso: envie {"app_hash": compute_app_hash(SECRET), "timestamp": time(nullptr), ...}`}
            </pre>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`# Python - Exemplo
import hmac, hashlib, time

def compute_app_hash(app_secret: str) -> tuple[str, int]:
    timestamp = int(time.time())
    time_step = str(timestamp // 30)
    h = hmac.new(app_secret.encode(), time_step.encode(), hashlib.sha256).hexdigest()
    return h, timestamp

# Uso: hash, ts = compute_app_hash("seu-secret")
# body = {"app_hash": hash, "timestamp": ts, ...}`}
            </pre>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// C# - Exemplo
using System.Security.Cryptography;
using System.Text;

static (string hash, long timestamp) ComputeAppHash(string appSecret) {
    long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    long timeStep = timestamp / 30;
    
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
    byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(timeStep.ToString()));
    string hex = BitConverter.ToString(hash).Replace("-", "").ToLower();
    return (hex, timestamp);
}

// Uso: var (hash, ts) = ComputeAppHash("seu-secret");
// body = new { app_hash = hash, timestamp = ts, ... };`}
            </pre>
            <div className="rounded-lg bg-muted p-3 text-xs">
              <p className="font-medium text-foreground mb-1">⚠️ Compatibilidade</p>
              <p>O modo legado (<code className="text-primary">app_secret</code> direto) ainda funciona, mas é <strong className="text-destructive">inseguro</strong>. Migre para HMAC-TOTP o mais rápido possível.</p>
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
  "app_hash": "hmac-sha256-do-secret",   // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,               // unix seconds
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
  "app_hash": "hmac-sha256-do-secret",   // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,               // unix seconds
  "license_key": "ABC123XYZ456",
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
  "app_hash": "hmac-sha256-do-secret",   // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,               // unix seconds
  "username": "nome_do_usuario",
  "password": "senha",
  "hwid": "identificador-do-hardware",  // opcional
  "version": "1.0.0",                   // opcional
  "nonce": "random-string-unica",       // anti-replay (recomendado)
  "challenge_token": "token-do-pre-auth" // opcional
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
  "app_hash": "hmac-sha256-do-secret",  // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,              // unix seconds
  "license_key": "ABC123XYZ456",
  "hwid": "identificador-do-hardware"   // opcional
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
{`// O servidor assina: {"session":"token","username":"user","status":"active","timestamp":123,"nonce":"abc"}
// O cliente deve verificar que:
// 1. A signature NÃO é vazia
// 2. O nonce retornado é o MESMO que você enviou
// 3. O timestamp é recente (< 30 segundos)`}
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
                  <p>✅ <strong className="text-foreground">Ofusque seu código</strong> — use VMProtect, Themida (C++)</p>
                  <p>✅ <strong className="text-foreground">String encryption</strong> — não deixe URLs e secrets em plaintext no binário</p>
                  <p>✅ <strong className="text-foreground">Integrity check</strong> — verifique o hash do próprio executável em runtime</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Example - C++ Only */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">📦 Exemplo Completo de Integração (C++)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Inclui app-status + registro + login + anti-debug</p>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>
#include <windows.h>
#include <ctime>
#include <sstream>
#include <iomanip>

using json = nlohmann::json;

const std::string BASE_URL = "${baseUrl}";
const std::string APP_SECRET = "coloque-seu-app-secret-aqui"; // NUNCA trafega na rede!

// Gera HMAC-TOTP: hash que muda a cada 30 segundos
std::pair<std::string, long> compute_app_hash() {
    long timestamp = std::time(nullptr);
    long time_step = timestamp / 30;
    std::string step_str = std::to_string(time_step);
    
    unsigned char hash[32];
    unsigned int len = 32;
    HMAC(EVP_sha256(), APP_SECRET.c_str(), APP_SECRET.size(),
         (unsigned char*)step_str.c_str(), step_str.size(), hash, &len);
    
    std::ostringstream oss;
    for (int i = 0; i < 32; i++)
        oss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    return {oss.str(), timestamp};
}

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
    auto [hash, ts] = compute_app_hash();
    std::string nonce = "nonce-" + std::to_string(rand());
    auto res = post("app-status", {
        {"app_hash", hash}, {"timestamp", ts},
        {"version", version}, {"nonce", nonce}
    });
    if (res["nonce"] != nonce) ExitProcess(0);
    if (res["status"] == "disabled" || res["status"] == "outdated") {
        std::cout << res["message"] << std::endl;
        return false;
    }
    return true;
}

bool do_register(const std::string& key, const std::string& user, const std::string& pass) {
    auto [hash, ts] = compute_app_hash();
    auto res = post("register-with-license", {
        {"license_key", key}, {"app_hash", hash}, {"timestamp", ts},
        {"username", user}, {"password", pass}
    });
    return res["success"];
}

bool login(const std::string& user, const std::string& pass) {
    anti_debug();
    auto [hash, ts] = compute_app_hash();
    std::string nonce = "nonce-" + std::to_string(rand());
    auto res = post("login", {
        {"app_hash", hash}, {"timestamp", ts},
        {"username", user}, {"password", pass}, {"nonce", nonce}
    });
    if (!res["success"]) return false;
    if (res["nonce"] != nonce) ExitProcess(0);
    std::string sig = res["signature"];
    if (sig.length() != 64) ExitProcess(0);
    std::cout << "Session: " << res["session_token"] << std::endl;
    return true;
}

// Dependências: libcurl, nlohmann/json, OpenSSL
// Compilar: g++ -o app main.cpp -lcurl -lssl -lcrypto

// USO:
// if (!check_status("1.0.0")) return 1;
// do_register("SUA-KEY", "usuario", "senha");   // primeira vez
// if (login("usuario", "senha"))                 // próximas vezes
//     std::cout << "Programa liberado!" << std::endl;`}
            </pre>
          </CardContent>
        </Card>

        {/* PRE-AUTH */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-yellow-400" />
              <CardTitle className="text-base">4. Pre-Auth (Handshake)</CardTitle>
              <Badge variant="outline" className="text-[10px]">POST</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Gera um token temporário (60s) antes do login para handshake seguro</p>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2"><strong>URL:</strong> <code className="text-primary">{baseUrl}/pre-auth</code></p>
            <pre className="text-xs bg-background/50 p-3 rounded-lg overflow-x-auto border border-border/30 text-muted-foreground">
{`// Request
{
  "app_hash": "hmac-sha256-do-secret",  // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,              // unix seconds
  "username": "usuario",
  "hwid": "hardware-id"
}

// Response (200)
{
  "success": true,
  "token": "challenge-token-hex-64-chars",
  "message": "Challenge token generated"
}`}
            </pre>
          </CardContent>
        </Card>

        {/* HEARTBEAT */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-400" />
              <CardTitle className="text-base">5. Heartbeat</CardTitle>
              <Badge variant="outline" className="text-[10px]">POST</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Envie a cada 30s para manter sessão ativa e checar bans em tempo real</p>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2"><strong>URL:</strong> <code className="text-primary">{baseUrl}/heartbeat</code></p>
            <pre className="text-xs bg-background/50 p-3 rounded-lg overflow-x-auto border border-border/30 text-muted-foreground">
{`// Request
{
  "app_hash": "hmac-sha256-do-secret",  // 🔒 HMAC-TOTP (recomendado)
  "timestamp": 1712505600,              // unix seconds
  "username": "usuario",
  "hwid": "hardware-id",
  "status": "active"
}

// Response OK (200)
{ "success": true, "message": "Heartbeat OK" }

// Se banido/expirado (403) → fechar loader imediatamente
{ "success": false, "message": "License banned", "action": "close", "status": "banned" }`}
            </pre>
          </CardContent>
        </Card>

        {/* SECURITY LOG */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <CardTitle className="text-base">6. Security Log</CardTitle>
              <Badge variant="outline" className="text-[10px]">POST</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reporta ameaças detectadas pelo loader (debugger, dump, tampering)</p>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2"><strong>URL:</strong> <code className="text-primary">{baseUrl}/security-log</code></p>
            <pre className="text-xs bg-background/50 p-3 rounded-lg overflow-x-auto border border-border/30 text-muted-foreground">
{`// Request
{
  "app_secret": "seu-app-secret",
  "username": "usuario",
  "hwid": "hardware-id",
  "event_type": "DEBUGGER_DETECTED",  // ou DUMP_TOOL_DETECTED, HWID_ABUSE, SESSION_INVALIDATED, INTEGRITY_VIOLATION, MEMORY_TAMPERING
  "details": "x64dbg.exe encontrado em processo ativo",
  "timestamp": 1712457600000
}

// Response (200)
{ "success": true, "message": "Security event logged" }`}
            </pre>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;
