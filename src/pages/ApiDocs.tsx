import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Wifi, LogIn, UserPlus, Key, AlertTriangle, Lock, Bot, Code, BookOpen, Download, RotateCcw } from "lucide-react";

const ApiDocs = () => {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project"}.supabase.co/functions/v1`;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Documentação</h1>
        <p className="text-sm text-muted-foreground">Guia completo para integrar autenticação, licenciamento e bots</p>
      </div>

      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="endpoints" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="example" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />
            Exemplo C++
          </TabsTrigger>
          <TabsTrigger value="discord" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Discord Bot
          </TabsTrigger>
        </TabsList>

        {/* ==================== ENDPOINTS TAB ==================== */}
        <TabsContent value="endpoints">
          <div className="space-y-6">

            {/* Flow Overview */}
            <Card className="border-primary/30 bg-primary/5">
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
                    <span>Antes de logar, chame <code className="text-primary">/pre-auth</code> para obter um <strong className="text-foreground">challenge token</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                    <span>Faça login via <code className="text-primary">/login</code> enviando o <code className="text-primary">challenge_token</code>. Receba um <code className="text-primary">session_token</code> com <strong className="text-foreground">expiração de 30 min</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5">5</Badge>
                    <span>Use <code className="text-primary">/validate-session</code> para verificar se o token é válido. Cada validação <strong className="text-foreground">renova a expiração</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5">6</Badge>
                    <span>Envie <code className="text-primary">/heartbeat</code> a cada 30s para manter sessão ativa e detectar <strong className="text-foreground">bans em tempo real</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5">7</Badge>
                    <span>Se detectar debugger/dump, envie <code className="text-primary">/security-log</code> para alertar o painel</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* HMAC Signing Guide */}
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-base">🔐 Autenticação HMAC (Segura)</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong className="text-destructive">IMPORTANTE:</strong> Nunca envie o <code className="text-primary">app_secret</code> diretamente. Use HMAC signing.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">COMO FUNCIONA</p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <span>1. Monte o body <strong className="text-foreground">sem o app_secret</strong></span>
                      <span>2. Gere <code className="text-primary">timestamp</code> (epoch ms) e <code className="text-primary">nonce</code> (random)</span>
                      <span>3. Ordene campos alfabeticamente (exceto app_id, signature, timestamp, nonce)</span>
                      <span>4. Calcule: <code className="text-primary">signature = HMAC-SHA256(timestamp:nonce:canonical_body, app_secret)</code></span>
                      <span>5. Envie <code className="text-primary">app_id</code>, <code className="text-primary">timestamp</code>, <code className="text-primary">nonce</code>, <code className="text-primary">signature</code> no body</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">VERIFICAÇÃO DE RESPOSTA</p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <span>Respostas incluem <code className="text-primary">_ts</code> e <code className="text-primary">_sig</code> (HMAC da resposta)</span>
                      <span>Verifique: <code className="text-primary">HMAC-SHA256(json_sem_sig, app_secret) == _sig</code></span>
                      <span>Se não bater → resposta <strong className="text-destructive">adulterada</strong> — feche o programa</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">EXEMPLO — BODY COM HMAC</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`{
  "app_id": "uuid-da-aplicacao",
  "timestamp": 1712345678000,
  "nonce": "a1b2c3d4e5f6",
  "signature": "hmac-sha256-hex-string",
  "username": "meu_usuario",
  "password": "minha_senha"
}`}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-muted-foreground">
                    <strong className="text-destructive">⚠️ Anti-Replay:</strong> O servidor rejeita requests com timestamp com mais de <strong>60 segundos</strong> de diferença.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* APP STATUS */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-cyan-400" />
                  <Badge className="bg-cyan-600 hover:bg-cyan-700">POST</Badge>
                  <CardTitle className="text-base">App Status</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verifica se o app está online, desabilitado ou desatualizado. <strong>Chamar ao abrir o programa.</strong></p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/app-status</code>
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
  }
}`}
                        </pre>
                      </TabsContent>
                      <TabsContent value="disabled">
                        <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-yellow-400">
{`{
  "success": true,
  "status": "disabled",
  "message": "Aplicação desabilitada pelo administrador"
}`}
                        </pre>
                      </TabsContent>
                      <TabsContent value="outdated">
                        <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`{
  "success": true,
  "status": "outdated",
  "message": "Atualização obrigatória. Versão mínima: 2.0.0"
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
                <p className="text-xs text-muted-foreground mt-1">Primeira vez — usa license key para criar usuário e senha</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/register-with-license</code>
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
  "hwid": "identificador-do-hardware",
  "version": "1.0.0"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (201)</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "User registered successfully",
  "user": { "username": "nome_do_usuario" }
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos obrigatórios faltando
401 — App secret inválido
403 — App desabilitada / licença banida/expirada
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
                <p className="text-xs text-muted-foreground mt-1">Retorna session token assinado com HMAC</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/login</code>
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
  "hwid": "identificador-do-hardware",
  "version": "1.0.0"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (200)</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "Login successful",
  "session_token": "token-hex-64-chars",
  "user": {
    "username": "nome_do_usuario",
    "license": { "status": "active", "expires_at": "2025-12-31T00:00:00Z" }
  }
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos faltando
401 — Credenciais inválidas
403 — App desabilitada / licença banida/expirada / HWID mismatch`}
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
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/validate-license</code>
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
  "hwid": "identificador-do-hardware"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA</p>
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

            {/* PRE-AUTH */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-400" />
                  <Badge className="bg-yellow-600 hover:bg-yellow-700">POST</Badge>
                  <CardTitle className="text-base">Pre-Auth (Handshake)</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Token temporário (60s) antes do login para handshake seguro</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/pre-auth</code>
                  </div>
                  <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// Request
{
  "app_id": "uuid", "timestamp": ..., "nonce": "...",
  "signature": "...", "username": "usuario", "hwid": "hardware-id"
}

// Response (200)
{
  "success": true,
  "token": "challenge-token-hex-64-chars",
  "message": "Challenge token generated",
  "_ts": 1712345678000, "_sig": "hmac-resposta"
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* HEARTBEAT */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-400" />
                  <Badge className="bg-green-600 hover:bg-green-700">POST</Badge>
                  <CardTitle className="text-base">Heartbeat</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Envie a cada 30s para manter sessão ativa e checar bans em tempo real</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/heartbeat</code>
                  </div>
                  <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// Request
{ "app_id": "...", "timestamp": ..., "nonce": "...", "signature": "...",
  "username": "usuario", "hwid": "hardware-id", "status": "active" }

// OK (200)
{ "success": true, "message": "Heartbeat OK", "_ts": ..., "_sig": "..." }

// Banido (403) → fechar loader
{ "success": false, "message": "License banned", "action": "close", "status": "banned" }`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* SECURITY LOG */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <Badge className="bg-red-600 hover:bg-red-700">POST</Badge>
                  <CardTitle className="text-base">Security Log</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Reporta ameaças detectadas (debugger, dump, tampering)</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/security-log</code>
                  </div>
                  <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// Request
{ "app_id": "...", "timestamp": ..., "nonce": "...", "signature": "...",
  "username": "usuario", "hwid": "hardware-id",
  "event_type": "DEBUGGER_DETECTED",
  // Tipos: DUMP_TOOL_DETECTED, DEBUGGER_DETECTED, HWID_ABUSE,
  //        SESSION_INVALIDATED, INTEGRITY_VIOLATION, MEMORY_TAMPERING
  "details": "x64dbg.exe encontrado" }

// Response (200)
{ "success": true, "message": "Security event logged", "_ts": ..., "_sig": "..." }`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* CREATE LICENSE */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-400" />
                  <Badge className="bg-purple-600 hover:bg-purple-700">POST</Badge>
                  <CardTitle className="text-base">Criar Licença (Bot/API)</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cria licenças automaticamente — ideal para bots de Discord após pagamento</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/create-license</code>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "app_secret": "secret-key-da-aplicacao",
  "plan": "monthly",
  "quantity": 1,
  "note": "Compra via Discord #12345"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">PLANOS DISPONÍVEIS</p>
                    <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm font-mono">
                      <p><code className="text-primary">"1day"</code> — 1 Dia (86.400s)</p>
                      <p><code className="text-primary">"trial"</code> — Trial 3 Dias (259.200s)</p>
                      <p><code className="text-primary">"weekly"</code> — Semanal 7 Dias (604.800s)</p>
                      <p><code className="text-primary">"monthly"</code> — Mensal 30 Dias (2.592.000s)</p>
                      <p><code className="text-primary">"lifetime"</code> — Lifetime 999 Dias (86.313.600s)</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (201)</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "1 license(s) created successfully",
  "plan": { "key": "monthly", "label": "Mensal (30 Dias)", "duration_seconds": 2592000 },
  "licenses": [
    {
      "key": "A1B2C3D4E5F6G7H8I9",
      "status": "unused",
      "duration_seconds": 2592000,
      "note": "Compra via Discord #12345"
    }
  ]
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DOWNLOAD WITH LICENSE */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-400" />
                  <Badge className="bg-emerald-600 hover:bg-emerald-700">POST</Badge>
                  <CardTitle className="text-base">Download com Licença</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Retorna URL de download assinada para o arquivo da aplicação vinculada à licença. <strong>Não requer HMAC</strong> — ideal para bots e páginas públicas.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ENDPOINT</p>
                    <code className="block rounded-lg bg-muted p-3 font-mono text-sm text-foreground">POST {baseUrl}/download-with-license</code>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">BODY</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
{`{
  "license_key": "ABC123XYZ456"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (200)</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "download": {
    "url": "https://...signed-url...",
    "file_name": "MeuApp-v1.2.exe",
    "file_size": 5242880,
    "version": "1.2.0",
    "app_name": "Aimbot"
  }
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Chave de licença inválida
404 — Licença não encontrada / Nenhum download disponível
403 — Licença suspensa ou expirada`}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-muted-foreground">
                    <strong className="text-primary">💡 Como funciona:</strong> O endpoint identifica a <code className="text-primary">application_id</code> da licença e busca o arquivo mais recente cadastrado em <strong className="text-foreground">Downloads</strong> no painel. A URL assinada expira em <strong>5 minutos</strong>.
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ==================== SEGURANÇA TAB ==================== */}
        <TabsContent value="security">
          <div className="space-y-6">

            {/* Anti Debug */}
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-400" />
                  <CardTitle className="text-base">🛡️ Proteção Anti-Crack / Anti-Debug</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Como proteger seu software contra x64dbg, Cheat Engine, memory patching e bypass</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                      1. Verificação de Assinatura HMAC
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Todas as respostas retornam <code className="text-primary">signature</code> gerada com HMAC-SHA256. Um cracker <strong>não pode</strong> falsificar sem a chave.
                    </p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`// O cliente deve verificar que:
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
                      Envie um nonce único por request. Impede que crackers <strong>gravem e repliquem</strong> respostas válidas.
                    </p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`std::string nonce = "nonce-" + std::to_string(rand());
json body = { {"nonce", nonce}, ... };

// Verifique na resposta
if (res["nonce"] != nonce) {
    ExitProcess(0); // RESPOSTA FAKE!
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                      3. Detecção de Debugger
                    </h3>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`#include <windows.h>
#include <tlhelp32.h>

bool IsBeingDebugged() {
    if (IsDebuggerPresent()) return true;
    BOOL remoteDebugger = FALSE;
    CheckRemoteDebuggerPresent(GetCurrentProcess(), &remoteDebugger);
    if (remoteDebugger) return true;

    // Processos suspeitos
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
                    CloseHandle(snap); return true;
                }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return false;
}

void ProtectLoop() {
    while (true) {
        if (IsBeingDebugged()) ExitProcess(0);
        Sleep(5000);
    }
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">📋 Checklist de Segurança</h3>
                    <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                      <p>✅ <strong className="text-foreground">Envie nonce</strong> em toda request e valide na resposta</p>
                      <p>✅ <strong className="text-foreground">Verifique timestamp</strong> — rejeite respostas com mais de 30s</p>
                      <p>✅ <strong className="text-foreground">Verifique signature</strong> — não vazia e 64 chars hex</p>
                      <p>✅ <strong className="text-foreground">Use HWID</strong> — trava licença no hardware</p>
                      <p>✅ <strong className="text-foreground">Anti-debug</strong> — em loop contínuo</p>
                      <p>✅ <strong className="text-foreground">Ofusque seu código</strong> — VMProtect, Themida</p>
                      <p>✅ <strong className="text-foreground">String encryption</strong> — não deixe URLs em plaintext</p>
                      <p>✅ <strong className="text-foreground">Integrity check</strong> — hash SHA256 do .exe em runtime</p>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Binary Security */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-base">🔒 Segurança do Binário C++</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Proteja o <code className="text-primary">secret_key</code> no .exe contra engenharia reversa
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                    <strong className="text-amber-400">⚠️</strong> O HMAC protege a comunicação, mas o <code className="text-primary">secret_key</code> está no binário. Proteja-o com as técnicas abaixo.
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">1. Encriptação do Secret Key em Runtime</h3>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`// ❌ ERRADO — "strings meubinario.exe" revela tudo
const std::string APP_SECRET = "9ee56446-...";

// ✅ CORRETO — XOR encryption
constexpr unsigned char XOR_KEY = 0x5A;
// python3 -c "s='seu-secret'; print([hex(ord(c)^0x5A) for c in s])"
static const unsigned char enc_secret[] = { 0x63, 0x65, ... };

std::string decrypt_secret() {
    std::string result(sizeof(enc_secret), '\\0');
    for (size_t i = 0; i < sizeof(enc_secret); i++)
        result[i] = enc_secret[i] ^ XOR_KEY;
    return result;
}
// Limpe com SecureZeroMemory() depois de usar!`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">2. Anti-Dump — Limpeza de Memória</h3>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`void secure_sign_request(json& body, const std::string& app_id) {
    std::string secret = decrypt_secret();
    // ... usar para HMAC ...
    SecureZeroMemory(secret.data(), secret.size()); // LIMPAR!
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">3. Integrity Check do .exe</h3>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`void check_integrity() {
    char path[MAX_PATH];
    GetModuleFileNameA(NULL, path, MAX_PATH);
    std::string current_hash = hash_file(path);
    std::string expected = decrypt_expected_hash();
    if (current_hash != expected) {
        report_security_event("INTEGRITY_VIOLATION", "Binary modified");
        ExitProcess(0);
    }
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">4. Anti-Hook (Proteção HTTP)</h3>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`bool is_function_hooked(void* func_addr) {
    unsigned char* bytes = (unsigned char*)func_addr;
    if (bytes[0] == 0xE9) return true;  // JMP rel32
    if (bytes[0] == 0xFF && bytes[1] == 0x25) return true; // JMP [addr]
    return false;
}

void check_hooks() {
    HMODULE winhttp = GetModuleHandleA("winhttp.dll");
    if (winhttp) {
        void* send = GetProcAddress(winhttp, "WinHttpSendRequest");
        if (is_function_hooked(send)) {
            report_security_event("MEMORY_TAMPERING", "WinHTTP hooked");
            ExitProcess(0);
        }
    }
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">5. Ofuscação Profissional</h3>
                    <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                      <p>🛡️ <strong className="text-foreground">VMProtect</strong> — Virtualiza funções em VM customizada <span className="text-primary">(Recomendado)</span></p>
                      <p>🛡️ <strong className="text-foreground">Themida / WinLicense</strong> — Anti-debug avançado + empacotamento</p>
                      <p>🛡️ <strong className="text-foreground">Compile-time obfuscation</strong> — constexpr + templates C++. Grátis.</p>
                      <p>🛡️ <strong className="text-foreground">UPX</strong> — Compressão básica (nível básico)</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">📋 Checklist do Binário</h3>
                    <div className="rounded-lg bg-muted p-4 space-y-1.5 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-2">Servidor (já implementado ✅)</p>
                      <p>✅ HMAC-SHA256 — secret nunca trafega</p>
                      <p>✅ Anti-replay — timestamp 60s</p>
                      <p>✅ Respostas assinadas — _sig e _ts</p>
                      <p>✅ HWID lock — licença no hardware</p>
                      <p>✅ Session tokens — 30min com renovação</p>
                      <p className="font-medium text-foreground mb-2 mt-4">Cliente C++ (implementar)</p>
                      <p>🔲 Encriptar secret_key no binário</p>
                      <p>🔲 SecureZeroMemory após cada uso</p>
                      <p>🔲 Verificar _sig de toda resposta</p>
                      <p>🔲 Integrity check do .exe</p>
                      <p>🔲 Anti-debug em loop contínuo</p>
                      <p>🔲 Anti-hook nas funções HTTP</p>
                      <p>🔲 VMProtect ou Themida no release</p>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ==================== EXEMPLO C++ TAB ==================== */}
        <TabsContent value="example">
          <div className="space-y-6">
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">📦 Exemplo Completo C++ (HMAC + Anti-Debug)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Inclui HMAC signing, verificação de resposta, app-status, registro, login e anti-debug</p>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">DEPENDÊNCIAS: libcurl, nlohmann/json, OpenSSL</p>
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

// ⚠️ NUNCA em plaintext — use decrypt_secret() (veja aba Segurança)
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

bool verify_response(const json& response) {
    if (!response.contains("_sig") || !response.contains("_ts"))
        return false;
    std::string received_sig = response["_sig"];
    json without_sig = response;
    without_sig.erase("_sig");
    return hmac_sha256(APP_SECRET, without_sig.dump()) == received_sig;
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
    if (!verify_response(res)) { ExitProcess(0); }
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
    if (!verify_response(res)) { ExitProcess(0); }
    if (!res.value("success", false)) return false;
    std::cout << "Session: " << res["session_token"].get<std::string>() << std::endl;
    return true;
}

// Compilar: g++ -o app main.cpp -lcurl -lssl -lcrypto
// USO:
// if (!check_status("1.0.0")) return 1;
// do_register("SUA-KEY", "usuario", "senha", get_hwid());
// if (login("usuario", "senha", get_hwid()))
//     std::cout << "Programa liberado!" << std::endl;`}
                  </pre>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">EXEMPLO C++ COM OPENSSL (HMAC)</p>
                  <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`#include <openssl/hmac.h>
#include <nlohmann/json.hpp>

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

json sign_request(const std::string& app_id, const std::string& app_secret,
                  json body_fields) {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
    std::string nonce = random_nonce();
    json sorted(json::value_t::object);
    for (auto& [k, v] : body_fields.items()) sorted[k] = v;
    std::string canonical = sorted.dump();
    std::string message = std::to_string(ms) + ":" + nonce + ":" + canonical;
    std::string sig = hmac_sha256(app_secret, message);

    json request = body_fields;
    request["app_id"] = app_id;
    request["timestamp"] = ms;
    request["nonce"] = nonce;
    request["signature"] = sig;
    return request;
}

bool verify_response(const json& response, const std::string& app_secret) {
    if (!response.contains("_sig") || !response.contains("_ts"))
        return false;
    std::string received_sig = response["_sig"];
    json without_sig = response;
    without_sig.erase("_sig");
    return hmac_sha256(app_secret, without_sig.dump()) == received_sig;
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== DISCORD BOT TAB ==================== */}
        <TabsContent value="discord">
          <div className="space-y-6">

            {/* Overview */}
            <Card className="border-[#5865F2]/30 bg-[#5865F2]/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#5865F2]" />
                  <CardTitle className="text-base">🤖 Integração com Discord Bot</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie licenças automaticamente após pagamento usando um bot de Discord. O bot usa o <code className="text-primary">app_secret</code> para se autenticar e o endpoint <code className="text-primary">/create-license</code> para gerar keys.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 border-[#5865F2]/50 text-[#5865F2]">1</Badge>
                    <span>Usuário paga pelo plano desejado (Mercado Pago, Stripe, PIX, etc.)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 border-[#5865F2]/50 text-[#5865F2]">2</Badge>
                    <span>Webhook de pagamento ou comando admin aciona o bot</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 border-[#5865F2]/50 text-[#5865F2]">3</Badge>
                    <span>Bot chama <code className="text-primary">POST /create-license</code> com o plano correto</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 border-[#5865F2]/50 text-[#5865F2]">4</Badge>
                    <span>Bot envia a <strong className="text-foreground">license key</strong> por DM para o comprador</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plans Table */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">📋 Planos e Duração</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Mapeamento de planos para o campo <code className="text-primary">plan</code> no endpoint</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Plano</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Valor <code className="text-primary">plan</code></th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Duração</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Segundos</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-3 font-medium text-foreground">1 Dia</td>
                        <td className="py-2 px-3"><code className="text-primary">1day</code></td>
                        <td className="py-2 px-3">24 horas</td>
                        <td className="py-2 px-3 font-mono text-xs">86.400</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-3 font-medium text-foreground">Trial</td>
                        <td className="py-2 px-3"><code className="text-primary">trial</code></td>
                        <td className="py-2 px-3">3 dias</td>
                        <td className="py-2 px-3 font-mono text-xs">259.200</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-3 font-medium text-foreground">Semanal</td>
                        <td className="py-2 px-3"><code className="text-primary">weekly</code></td>
                        <td className="py-2 px-3">7 dias</td>
                        <td className="py-2 px-3 font-mono text-xs">604.800</td>
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-3 font-medium text-foreground">Mensal</td>
                        <td className="py-2 px-3"><code className="text-primary">monthly</code></td>
                        <td className="py-2 px-3">30 dias</td>
                        <td className="py-2 px-3 font-mono text-xs">2.592.000</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-foreground">Lifetime</td>
                        <td className="py-2 px-3"><code className="text-primary">lifetime</code></td>
                        <td className="py-2 px-3">999 dias</td>
                        <td className="py-2 px-3 font-mono text-xs">86.313.600</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Setup Guide */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">⚙️ Configuração do Bot</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Passo a passo para configurar o bot</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">1. Variáveis de Ambiente do Bot</h3>
                    <p className="text-xs text-muted-foreground mb-2">Configure no seu servidor/host onde o bot roda:</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
{`# Discord
DISCORD_TOKEN=seu-token-do-bot-discord
GUILD_ID=id-do-servidor

# Elevate Auth
ELEVATE_API_URL=${baseUrl}
APP_SECRET=secret-key-da-sua-aplicacao

# O app_secret você encontra no painel em Aplicações > sua app > Secret Key`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">2. Onde encontrar o App Secret</h3>
                    <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                      <p>1. Acesse o painel → <strong className="text-foreground">Aplicações</strong></p>
                      <p>2. Clique na aplicação desejada</p>
                      <p>3. Copie o campo <strong className="text-foreground">Secret Key</strong></p>
                      <p>4. Use esse valor como <code className="text-primary">APP_SECRET</code> no bot</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bot Code - discord.js */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">🟢 Exemplo: Bot Discord.js (Node.js)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Bot completo com slash commands para criar licenças</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">INSTALAR DEPENDÊNCIAS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
{`npm init -y
npm install discord.js axios dotenv`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">index.js — BOT PRINCIPAL</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const ELEVATE_API = process.env.ELEVATE_API_URL;
const APP_SECRET = process.env.APP_SECRET;

// ========== REGISTRAR SLASH COMMANDS ==========
const commands = [
  new SlashCommandBuilder()
    .setName('criarkey')
    .setDescription('Criar uma licença para um usuário')
    .addStringOption(opt =>
      opt.setName('plano')
        .setDescription('Plano da licença')
        .setRequired(true)
        .addChoices(
          { name: '1 Dia', value: '1day' },
          { name: 'Trial (3 Dias)', value: 'trial' },
          { name: 'Semanal (7 Dias)', value: 'weekly' },
          { name: 'Mensal (30 Dias)', value: 'monthly' },
          { name: 'Lifetime (999 Dias)', value: 'lifetime' },
        ))
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário que vai receber a key (opcional)')
        .setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade de keys (1-50)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)),
  new SlashCommandBuilder()
    .setName('resethwid')
    .setDescription('Resetar o HWID de uma licença')
    .addStringOption(opt =>
      opt.setName('key')
        .setDescription('License key para resetar')
        .setRequired(true)),
];

// ========== HANDLER ==========
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'criarkey') {
    // Verificar se é admin/mod
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: '❌ Apenas administradores podem criar keys.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const plano = interaction.options.getString('plano');
    const usuario = interaction.options.getUser('usuario');
    const quantidade = interaction.options.getInteger('quantidade') || 1;

    try {
      const response = await axios.post(ELEVATE_API + '/create-license', {
        app_secret: APP_SECRET,
        plan: plano,
        quantity: quantidade,
        note: \`Discord - \${interaction.user.tag} - #\${interaction.id}\`
      });

      const { licenses, plan } = response.data;
      const keys = licenses.map(l => l.key).join('\\n');

      // Se tem um usuário alvo, envia por DM
      if (usuario) {
        try {
          await usuario.send(
            \`🔑 **Sua licença Elevate Auth**\\n\\n\` +
            \`📋 Plano: **\${plan.label}**\\n\` +
            \`🔐 Key(s):\\n\\\`\\\`\\\`\\n\${keys}\\n\\\`\\\`\\\`\\n\\n\` +
            \`Use essa key no programa para ativar.\\n\` +
            \`⚠️ Não compartilhe sua key com ninguém!\`
          );
          await interaction.editReply(
            \`✅ \${quantidade} key(s) **\${plan.label}** criada(s) e enviada(s) por DM para \${usuario.tag}\`
          );
        } catch {
          // DM fechada — mostra no canal
          await interaction.editReply(
            \`✅ Key(s) criada(s) mas não consegui enviar DM para \${usuario.tag}.\\n\` +
            \`Keys:\\n\\\`\\\`\\\`\\n\${keys}\\n\\\`\\\`\\\`\`
          );
        }
      } else {
        await interaction.editReply(
          \`✅ \${quantidade} key(s) **\${plan.label}** criada(s):\\n\\\`\\\`\\\`\\n\${keys}\\n\\\`\\\`\\\`\`
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      await interaction.editReply(\`❌ Erro ao criar key: \${msg}\`);
    }
  }

  // ========== /resethwid ==========
  if (interaction.commandName === 'resethwid') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: '❌ Apenas administradores podem resetar HWID.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const licenseKey = interaction.options.getString('key');

    try {
      const { data } = await axios.post(ELEVATE_API + '/reset-hwid', {
        app_secret: APP_SECRET,
        license_key: licenseKey
      });

      if (!data.success) {
        return interaction.editReply(\`❌ \${data.message}\`);
      }

      const users = data.users_reset.length > 0
        ? \`\\n👤 Usuários resetados: \${data.users_reset.join(', ')}\`
        : '';

      await interaction.editReply(
        \`✅ **HWID resetado com sucesso!**\\n\` +
        \`🔑 Key: \\\`\${data.license_key}\\\`\${users}\\n\\n\` +
        \`O próximo login vinculará o novo hardware.\`
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      await interaction.editReply(\`❌ Erro ao resetar HWID: \${msg}\`);
    }
  }
});


client.once('ready', async () => {
  console.log(\`Bot online: \${client.user.tag}\`);

  // Registrar commands
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log('Slash commands registrados!');
});

client.login(process.env.DISCORD_TOKEN);`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">.env DO BOT</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
{`DISCORD_TOKEN=seu-token-do-bot
GUILD_ID=id-do-servidor-discord
ELEVATE_API_URL=${baseUrl}
APP_SECRET=secret-key-da-aplicacao`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Webhook Automation */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">💰 Automação com Webhook de Pagamento</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Como criar key automaticamente quando o pagamento for confirmado</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-muted-foreground">
                    <strong className="text-primary">💡 Fluxo recomendado:</strong> Configure um webhook do seu gateway de pagamento (Mercado Pago, Stripe, etc.) apontando para um endpoint do seu bot. Quando o pagamento for aprovado, o bot cria a key e envia ao comprador.
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">EXEMPLO: ENDPOINT WEBHOOK NO BOT (Express)</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Mapeamento produto → plano
const PRODUCT_PLANS = {
  'produto_1dia': '1day',
  'produto_trial': 'trial',
  'produto_semanal': 'weekly',
  'produto_mensal': 'monthly',
  'produto_lifetime': 'lifetime',
};

app.post('/webhook/payment', async (req, res) => {
  const { status, product_id, buyer_discord_id } = req.body;

  // Verificar se pagamento foi aprovado
  if (status !== 'approved') {
    return res.json({ ok: true });
  }

  const plan = PRODUCT_PLANS[product_id];
  if (!plan) return res.status(400).json({ error: 'Unknown product' });

  try {
    // 1. Criar key via API
    const { data } = await axios.post(ELEVATE_API + '/create-license', {
      app_secret: APP_SECRET,
      plan: plan,
      note: \`Pagamento auto - \${product_id}\`
    });

    const key = data.licenses[0].key;

    // 2. Enviar key por DM no Discord
    const user = await client.users.fetch(buyer_discord_id);
    await user.send(
      \`✅ **Pagamento confirmado!**\\n\\n\` +
      \`📋 Plano: **\${data.plan.label}**\\n\` +
      \`🔐 Sua Key: \\\`\${key}\\\`\\n\\n\` +
      \`Use no programa para ativar. Não compartilhe!\`
    );

    res.json({ ok: true, key });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Webhook server na porta 3001'));`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Download Command */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">📥 Comando: Download com Licença</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Permite que o usuário baixe o loader/app diretamente pelo Discord usando sua license key</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm text-muted-foreground">
                    <strong className="text-primary">💡 Como funciona:</strong> O bot chama <code className="text-primary">POST /download-with-license</code> com a key do usuário. A API identifica a aplicação da licença e retorna o download correspondente. Se a key é do <strong className="text-foreground">Aimbot</strong>, baixa o Aimbot. Se é do <strong className="text-foreground">ESP</strong>, baixa o ESP.
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ADICIONAR AO ARRAY DE COMMANDS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`// Adicione junto com o comando /criarkey no array commands[]
new SlashCommandBuilder()
  .setName('download')
  .setDescription('Baixar o loader usando sua license key')
  .addStringOption(opt =>
    opt.setName('key')
      .setDescription('Sua license key')
      .setRequired(true)),`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">HANDLER DO COMANDO</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`// Adicione dentro do client.on('interactionCreate', ...)

if (interaction.commandName === 'download') {
  await interaction.deferReply({ ephemeral: true });

  const licenseKey = interaction.options.getString('key');

  try {
    const { data } = await axios.post(ELEVATE_API + '/download-with-license', {
      license_key: licenseKey
    });

    if (!data.success) {
      return interaction.editReply(\`❌ \${data.message || 'Key inválida'}\`);
    }

    const dl = data.download;
    const sizeMB = (dl.file_size / 1048576).toFixed(1);

    await interaction.editReply(
      \`✅ **Download pronto!**\\n\\n\` +
      \`📦 **\${dl.app_name}** \${dl.version ? \`v\${dl.version}\` : ''}\\n\` +
      \`📁 \${dl.file_name} (\${sizeMB} MB)\\n\\n\` +
      \`🔗 [Clique para baixar](\${dl.url})\\n\\n\` +
      \`⚠️ O link expira em **5 minutos**. Não compartilhe!\`
    );
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    await interaction.editReply(\`❌ Erro: \${msg}\`);
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">FLUXO COMPLETO</p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-emerald-500/50 text-emerald-400">1</Badge>
                        <span>Usuário digita <code className="text-primary">/download key:SUA-KEY-AQUI</code></span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-emerald-500/50 text-emerald-400">2</Badge>
                        <span>Bot envia a key para <code className="text-primary">/download-with-license</code></span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-emerald-500/50 text-emerald-400">3</Badge>
                        <span>API valida a licença e retorna o download da <strong className="text-foreground">aplicação vinculada</strong></span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-emerald-500/50 text-emerald-400">4</Badge>
                        <span>Bot envia o link <strong className="text-foreground">ephemeral</strong> (só o usuário vê) com expiração de 5 min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reset HWID Command */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">🔄 Comando: Reset HWID</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Permite que o admin resete o HWID de uma licença diretamente pelo Discord</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">ADICIONAR AO ARRAY DE COMMANDS</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`new SlashCommandBuilder()
  .setName('resethwid')
  .setDescription('Resetar o HWID de uma licença')
  .addStringOption(opt =>
    opt.setName('key')
      .setDescription('License key para resetar')
      .setRequired(true)),`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">HANDLER DO COMANDO</p>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
{`if (interaction.commandName === 'resethwid') {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: '❌ Apenas administradores podem resetar HWID.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const licenseKey = interaction.options.getString('key');

  try {
    const { data } = await axios.post(ELEVATE_API + '/reset-hwid', {
      app_secret: APP_SECRET,
      license_key: licenseKey
    });

    if (!data.success) {
      return interaction.editReply(\`❌ \${data.message}\`);
    }

    const users = data.users_reset.length > 0
      ? \`\\n👤 Usuários resetados: \${data.users_reset.join(', ')}\`
      : '';

    await interaction.editReply(
      \`✅ **HWID resetado com sucesso!**\\n\` +
      \`🔑 Key: \\\`\${data.license_key}\\\`\${users}\\n\\n\` +
      \`O próximo login vinculará o novo hardware.\`
    );
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    await interaction.editReply(\`❌ Erro ao resetar HWID: \${msg}\`);
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">FLUXO</p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-orange-500/50 text-orange-400">1</Badge>
                        <span>Admin digita <code className="text-primary">/resethwid key:ABC123XYZ456</code></span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-orange-500/50 text-orange-400">2</Badge>
                        <span>Bot chama <code className="text-primary">POST /reset-hwid</code> com app_secret + license_key</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-orange-500/50 text-orange-400">3</Badge>
                        <span>API limpa o HWID da licença e do <strong className="text-foreground">software_user</strong> vinculado</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 border-orange-500/50 text-orange-400">4</Badge>
                        <span>Próximo login do usuário vincula o <strong className="text-foreground">novo hardware</strong> automaticamente</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="text-base">💡 Dicas e Boas Práticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 space-y-2 text-xs text-muted-foreground">
                  <p>✅ <strong className="text-foreground">Sempre use ephemeral</strong> — keys não devem ficar visíveis no canal</p>
                  <p>✅ <strong className="text-foreground">Restrinja o comando</strong> — apenas admins devem criar keys</p>
                  <p>✅ <strong className="text-foreground">Logue tudo</strong> — o campo <code className="text-primary">note</code> registra quem criou e quando</p>
                  <p>✅ <strong className="text-foreground">Não exponha o app_secret</strong> — guarde apenas em variáveis de ambiente</p>
                  <p>✅ <strong className="text-foreground">Limite quantity</strong> — máximo 50 keys por request para evitar abuso</p>
                  <p>✅ <strong className="text-foreground">Use webhook de pagamento</strong> — automatize a criação de keys após confirmação</p>
                  <p>✅ <strong className="text-foreground">Cada app tem seu secret</strong> — configure um bot por aplicação ou use variáveis dinâmicas</p>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

      </Tabs>
    </DashboardLayout>
  );
};

export default ApiDocs;
