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
              <span>Faça login via <code className="text-primary">/login</code> enviando o <code className="text-primary">challenge_token</code> junto com credenciais. Receba um <code className="text-primary">session_token</code> com <strong className="text-foreground">expiração de 30 min</strong></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">5</Badge>
              <span>Use <code className="text-primary">/validate-session</code> para verificar se o token ainda é válido. Cada validação <strong className="text-foreground">renova a expiração</strong> automaticamente</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">6</Badge>
              <span>Envie <code className="text-primary">/heartbeat</code> a cada 30s com o <code className="text-primary">session_token</code> para manter sessão ativa e detectar <strong className="text-foreground">bans em tempo real</strong></span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">7</Badge>
              <span>Se detectar debugger/dump, envie <code className="text-primary">/security-log</code> para alertar o painel</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HMAC Signing Guide */}
      <Card className="mb-6 border-destructive/30 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-destructive" />
            <CardTitle className="text-base">🔐 Autenticação HMAC (Segura)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <strong className="text-destructive">IMPORTANTE:</strong> Nunca envie o <code className="text-primary">app_secret</code> diretamente na requisição. Use HMAC signing para provar que você possui o secret sem expô-lo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">COMO FUNCIONA</p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>1. O cliente monta o body da requisição <strong className="text-foreground">sem o app_secret</strong></span>
                <span>2. Gera um <code className="text-primary">timestamp</code> (epoch ms) e um <code className="text-primary">nonce</code> (string aleatória)</span>
                <span>3. Ordena os campos do body alfabeticamente (exceto app_id, signature, timestamp, nonce)</span>
                <span>4. Calcula: <code className="text-primary">signature = HMAC-SHA256(timestamp:nonce:canonical_body, app_secret)</code></span>
                <span>5. Envia <code className="text-primary">app_id</code>, <code className="text-primary">timestamp</code>, <code className="text-primary">nonce</code>, <code className="text-primary">signature</code> no body</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">VERIFICAÇÃO DE RESPOSTA</p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>Todas as respostas incluem <code className="text-primary">_ts</code> (timestamp) e <code className="text-primary">_sig</code> (HMAC da resposta)</span>
                <span>O cliente deve verificar: <code className="text-primary">HMAC-SHA256(json_sem_sig, app_secret) == _sig</code></span>
                <span>Se não bater, a resposta foi <strong className="text-destructive">adulterada</strong> — ignore e feche o programa</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">EXEMPLO — BODY COM HMAC</p>
              <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`{
  "app_id": "uuid-da-aplicacao",          // ID público (não o secret!)
  "timestamp": 1712345678000,             // epoch ms (Date.now())
  "nonce": "a1b2c3d4e5f6",               // string aleatória única
  "signature": "hmac-sha256-hex-string",  // HMAC calculado
  "username": "meu_usuario",             // campos do endpoint
  "password": "minha_senha"
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">EXEMPLO C++ (com OpenSSL)</p>
              <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`#include <openssl/hmac.h>
#include <nlohmann/json.hpp>
#include <chrono>
#include <random>
#include <sstream>
#include <iomanip>

using json = nlohmann::json;

std::string hmac_sha256(const std::string& key, const std::string& msg) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int len = 0;
    HMAC(EVP_sha256(), key.c_str(), key.size(),
         (unsigned char*)msg.c_str(), msg.size(), hash, &len);
    std::ostringstream ss;
    for (unsigned int i = 0; i < len; i++)
        ss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    return ss.str();
}

std::string random_nonce(int len = 16) {
    static const char chars[] = "abcdef0123456789";
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dist(0, sizeof(chars)-2);
    std::string nonce;
    for (int i = 0; i < len; i++) nonce += chars[dist(gen)];
    return nonce;
}

// Monta body assinado para qualquer endpoint
json sign_request(const std::string& app_id, const std::string& app_secret,
                  json body_fields) {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
    std::string nonce = random_nonce();

    // Canonical: ordenar body_fields por chave, stringify
    json sorted(json::value_t::object);
    for (auto& [k, v] : body_fields.items()) sorted[k] = v;
    std::string canonical = sorted.dump();

    // message = "timestamp:nonce:canonical"
    std::string message = std::to_string(ms) + ":" + nonce + ":" + canonical;
    std::string sig = hmac_sha256(app_secret, message);

    // Montar body final
    json request = body_fields;
    request["app_id"] = app_id;
    request["timestamp"] = ms;
    request["nonce"] = nonce;
    request["signature"] = sig;
    return request;
}

// Verificar resposta do servidor
bool verify_response(const json& response, const std::string& app_secret) {
    if (!response.contains("_sig") || !response.contains("_ts"))
        return false;
    std::string received_sig = response["_sig"];
    json without_sig = response;
    without_sig.erase("_sig");
    std::string payload = without_sig.dump();
    std::string expected = hmac_sha256(app_secret, payload);
    return expected == received_sig;
}

// Uso:
// json body = sign_request(APP_ID, APP_SECRET, {
//     {"username", "meu_user"},
//     {"password", "minha_senha"},
//     {"hwid", get_hwid()}
// });
// auto resp = http_post(url + "/login", body.dump());
// json result = json::parse(resp);
// if (!verify_response(result, APP_SECRET)) { exit(1); }`}
              </pre>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-muted-foreground">
              <strong className="text-destructive">⚠️ Anti-Replay:</strong> O servidor rejeita requests com timestamp com mais de <strong>60 segundos</strong> de diferença. Mantenha o relógio do sistema sincronizado.
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
  "app_id": "uuid-da-aplicacao",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
  "version": "1.0.0"
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
  "app_id": "uuid-da-aplicacao",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
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
  "app_id": "uuid-da-aplicacao",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
  "username": "nome_do_usuario",
  "password": "senha",
  "hwid": "identificador-do-hardware",  // opcional
  "version": "1.0.0"                    // opcional
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

        {/* CLIENT BINARY SECURITY */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">🔒 Segurança do Binário C++</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O servidor está protegido com HMAC, mas o <code className="text-primary">secret_key</code> vive no seu .exe — proteja-o contra engenharia reversa
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                <strong className="text-amber-400">⚠️ Por que isso importa?</strong> O HMAC protege a comunicação, mas o <code className="text-primary">secret_key</code> está embutido no seu binário. Com ferramentas como IDA Pro ou x64dbg, um atacante avançado pode extraí-lo. As técnicas abaixo dificultam significativamente essa extração.
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  1. Encriptação do Secret Key em Runtime
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  <strong className="text-destructive">NUNCA</strong> deixe o secret_key como string literal no binário. Um simples <code className="text-primary">strings meubinario.exe</code> revelaria tudo. Use XOR ou AES para decriptar apenas em runtime.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`// ❌ ERRADO — qualquer um encontra com "strings" ou HxD
const std::string APP_SECRET = "9ee56446-5150-4e9e-bfc0-b21b505cebfd";

// ✅ CORRETO — XOR encryption em compile-time
constexpr unsigned char XOR_KEY = 0x5A;

// Gere os bytes com:
// python3 -c "s='seu-secret'; print([hex(ord(c)^0x5A) for c in s])"
static const unsigned char enc_secret[] = {
    0x63, 0x65, 0x65, 0x0E, 0x66, 0x0C, 0x0C, 0x0E, /* ... resto */
};

std::string decrypt_secret() {
    std::string result(sizeof(enc_secret), '\\0');
    for (size_t i = 0; i < sizeof(enc_secret); i++)
        result[i] = enc_secret[i] ^ XOR_KEY;
    return result;
}

// Use decrypt_secret() só quando precisar assinar
// Limpe da memória logo depois com SecureZeroMemory()`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  2. Limpeza de Memória (Anti-Dump)
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Após usar o secret_key para gerar o HMAC, <strong>limpe imediatamente</strong> da memória para dificultar dumps.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`void secure_sign_request(json& body, const std::string& app_id) {
    // 1. Decriptar secret apenas quando necessário
    std::string secret = decrypt_secret();
    
    // 2. Gerar assinatura HMAC
    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    std::string nonce = random_nonce();
    
    json canonical;
    for (auto& [k, v] : body.items()) canonical[k] = v;
    std::string message = std::to_string(now_ms) + ":" + nonce + ":" + canonical.dump();
    std::string sig = hmac_sha256(secret, message);
    
    // 3. LIMPAR o secret da memória IMEDIATAMENTE
    SecureZeroMemory(secret.data(), secret.size());
    
    // 4. Montar body final
    body["app_id"] = app_id;
    body["timestamp"] = now_ms;
    body["nonce"] = nonce;
    body["signature"] = sig;
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  3. Integrity Check (Auto-Verificação do .exe)
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Calcule o hash do próprio executável em runtime. Se alguém patchar o .exe, o hash muda e o programa fecha.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`#include <fstream>
#include <openssl/sha.h>

std::string hash_file(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return "";
    SHA256_CTX ctx;
    SHA256_Init(&ctx);
    char buf[8192];
    while (f.read(buf, sizeof(buf)))
        SHA256_Update(&ctx, buf, f.gcount());
    SHA256_Update(&ctx, buf, f.gcount());
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_Final(hash, &ctx);
    std::ostringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++)
        ss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    return ss.str();
}

void check_integrity() {
    char path[MAX_PATH];
    GetModuleFileNameA(NULL, path, MAX_PATH);
    std::string current_hash = hash_file(path);
    
    // Compare com o hash esperado (atualize a cada build)
    // Armazene encriptado, não em plaintext!
    std::string expected = decrypt_expected_hash();
    
    if (current_hash != expected) {
        // Binário foi modificado — reporte e feche
        report_security_event("INTEGRITY_VIOLATION",
            "Binary hash mismatch: " + current_hash);
        ExitProcess(0);
    }
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  4. Anti-Hook (Proteção de Funções HTTP)
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Crackers podem hookear <code className="text-primary">WinHttpSendRequest</code> para interceptar dados antes do HTTPS. Verifique os primeiros bytes de funções críticas.
                </p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`bool is_function_hooked(void* func_addr) {
    unsigned char* bytes = (unsigned char*)func_addr;
    if (bytes[0] == 0xE9) return true;                    // JMP rel32
    if (bytes[0] == 0xFF && bytes[1] == 0x25) return true; // JMP [addr]
    if (bytes[0] == 0x68) return true;                    // PUSH addr
    return false;
}

void check_hooks() {
    HMODULE winhttp = GetModuleHandleA("winhttp.dll");
    if (winhttp) {
        void* send = GetProcAddress(winhttp, "WinHttpSendRequest");
        void* recv = GetProcAddress(winhttp, "WinHttpReceiveResponse");
        if (is_function_hooked(send) || is_function_hooked(recv)) {
            report_security_event("MEMORY_TAMPERING",
                "WinHTTP functions hooked");
            ExitProcess(0);
        }
    }
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  5. Ofuscação Profissional
                </h3>
                <p className="text-xs text-muted-foreground">
                  Para proteção máxima, use uma dessas ferramentas <strong>após compilar</strong> o .exe:
                </p>
                <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground mt-2">
                  <p>🛡️ <strong className="text-foreground">VMProtect</strong> — Virtualiza funções críticas em uma VM customizada. O código real nunca existe descompilável em memória. <span className="text-primary">(Recomendado)</span></p>
                  <p>🛡️ <strong className="text-foreground">Themida / WinLicense</strong> — Anti-debug avançado + empacotamento. Boa integração com loaders.</p>
                  <p>🛡️ <strong className="text-foreground">Compile-time obfuscation</strong> — Use <code className="text-primary">constexpr</code> e templates C++ para ofuscar strings em tempo de compilação. Grátis.</p>
                  <p>🛡️ <strong className="text-foreground">UPX</strong> — Compressão básica (fácil de unpackar, mas dificulta análise rápida). Nível básico.</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">📋 Checklist Completo de Segurança</h3>
                <div className="rounded-lg bg-muted p-4 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Servidor (já implementado ✅)</p>
                  <p>✅ HMAC-SHA256 — secret nunca trafega na rede</p>
                  <p>✅ Anti-replay — timestamp com janela de 60s</p>
                  <p>✅ Respostas assinadas — _sig e _ts em toda resposta</p>
                  <p>✅ HWID lock — licença travada no hardware</p>
                  <p>✅ Session tokens — expiração de 30min com renovação</p>
                  <p>✅ Pre-auth handshake — challenge token antes do login</p>
                  
                  <p className="font-medium text-foreground mb-2 mt-4">Cliente C++ (implementar no seu lado)</p>
                  <p>🔲 Encriptar secret_key no binário (XOR/AES, não plaintext)</p>
                  <p>🔲 SecureZeroMemory após cada uso do secret</p>
                  <p>🔲 Verificar _sig de toda resposta do servidor</p>
                  <p>🔲 Integrity check do próprio .exe (hash SHA256)</p>
                  <p>🔲 Anti-debug em loop contínuo (não só no início)</p>
                  <p>🔲 Anti-hook nas funções HTTP (WinHTTP/curl)</p>
                  <p>🔲 Reportar ameaças via /security-log</p>
                  <p>🔲 VMProtect ou Themida no build final de release</p>
                  <p>🔲 Nunca logar dados sensíveis (cout, printf, logs)</p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Integration Example - C++ Only */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">📦 Exemplo Completo de Integração (C++ com HMAC)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Inclui HMAC signing + verificação de resposta + app-status + registro + login + anti-debug</p>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`#include <iostream>
#include <string>
#include <chrono>
#include <random>
#include <sstream>
#include <iomanip>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>
#include <windows.h>

using json = nlohmann::json;

const std::string BASE_URL = "${baseUrl}";
const std::string APP_ID = "seu-app-id-uuid";

// ⚠️ NUNCA deixe em plaintext — use decrypt_secret() (veja seção acima)
// Aqui está em texto só para fins didáticos
const std::string APP_SECRET = "seu-secret-key-uuid";

// ========== HMAC UTILS ==========

std::string hmac_sha256(const std::string& key, const std::string& msg) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int len = 0;
    HMAC(EVP_sha256(), key.c_str(), key.size(),
         (unsigned char*)msg.c_str(), msg.size(), hash, &len);
    std::ostringstream ss;
    for (unsigned int i = 0; i < len; i++)
        ss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    return ss.str();
}

std::string random_nonce(int len = 16) {
    static const char chars[] = "abcdef0123456789";
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dist(0, sizeof(chars)-2);
    std::string nonce;
    for (int i = 0; i < len; i++) nonce += chars[dist(gen)];
    return nonce;
}

// Assina request com HMAC (secret nunca sai do cliente)
json sign_request(json body_fields) {
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    std::string nonce = random_nonce();

    json sorted(json::value_t::object);
    for (auto& [k, v] : body_fields.items()) sorted[k] = v;
    std::string canonical = sorted.dump();
    std::string message = std::to_string(ms) + ":" + nonce + ":" + canonical;
    std::string sig = hmac_sha256(APP_SECRET, message);

    json request = body_fields;
    request["app_id"] = APP_ID;
    request["timestamp"] = ms;
    request["nonce"] = nonce;
    request["signature"] = sig;
    return request;
}

// Verifica assinatura da resposta do servidor
bool verify_response(const json& response) {
    if (!response.contains("_sig") || !response.contains("_ts"))
        return false;
    std::string received_sig = response["_sig"];
    json without_sig = response;
    without_sig.erase("_sig");
    std::string payload = without_sig.dump();
    return hmac_sha256(APP_SECRET, payload) == received_sig;
}

// ========== HTTP + ANTI-DEBUG ==========

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

// ========== API CALLS ==========

bool check_status(const std::string& version = "1.0.0") {
    anti_debug();
    auto body = sign_request({{"version", version}});
    auto res = post("app-status", body);

    // Verificar assinatura da resposta!
    if (!verify_response(res)) {
        std::cerr << "Resposta adulterada!" << std::endl;
        ExitProcess(0);
    }

    if (res["status"] == "disabled" || res["status"] == "outdated") {
        std::cout << res["message"].get<std::string>() << std::endl;
        return false;
    }
    return true;
}

bool do_register(const std::string& key, const std::string& user,
                 const std::string& pass, const std::string& hwid = "") {
    auto body = sign_request({
        {"license_key", key}, {"username", user},
        {"password", pass}, {"hwid", hwid}
    });
    auto res = post("register-with-license", body);
    if (!verify_response(res)) ExitProcess(0);
    return res.value("success", false);
}

bool login(const std::string& user, const std::string& pass,
           const std::string& hwid = "") {
    anti_debug();
    auto body = sign_request({
        {"username", user}, {"password", pass}, {"hwid", hwid}
    });
    auto res = post("login", body);

    if (!verify_response(res)) {
        std::cerr << "Resposta do login adulterada!" << std::endl;
        ExitProcess(0);
    }

    if (!res.value("success", false)) return false;
    std::cout << "Session: " << res["session_token"].get<std::string>() << std::endl;
    return true;
}

// Dependências: libcurl, nlohmann/json, OpenSSL
// Compilar: g++ -o app main.cpp -lcurl -lssl -lcrypto

// USO:
// if (!check_status("1.0.0")) return 1;
// do_register("SUA-KEY", "usuario", "senha", get_hwid());  // primeira vez
// if (login("usuario", "senha", get_hwid()))                // próximas vezes
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
{`// Request (com HMAC signing)
{
  "app_id": "seu-app-id-uuid",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
  "username": "usuario",
  "hwid": "hardware-id"
}

// Response (200)
{
  "success": true,
  "token": "challenge-token-hex-64-chars",
  "message": "Challenge token generated",
  "_ts": 1712345678000,
  "_sig": "hmac-resposta"
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
{`// Request (com HMAC signing)
{
  "app_id": "seu-app-id-uuid",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
  "username": "usuario",
  "hwid": "hardware-id",
  "status": "active"
}

// Response OK (200) — verificar _sig!
{ "success": true, "message": "Heartbeat OK", "_ts": ..., "_sig": "..." }

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
{`// Request (com HMAC signing)
{
  "app_id": "seu-app-id-uuid",
  "timestamp": 1712345678000,
  "nonce": "random-hex",
  "signature": "hmac-sha256-hex",
  "username": "usuario",
  "hwid": "hardware-id",
  "event_type": "DEBUGGER_DETECTED",
  // Tipos: DUMP_TOOL_DETECTED, DEBUGGER_DETECTED, HWID_ABUSE,
  //        SESSION_INVALIDATED, INTEGRITY_VIOLATION, MEMORY_TAMPERING
  "details": "x64dbg.exe encontrado em processo ativo"
}

// Response (200) — verificar _sig!
{ "success": true, "message": "Security event logged", "_ts": ..., "_sig": "..." }`}
            </pre>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;
