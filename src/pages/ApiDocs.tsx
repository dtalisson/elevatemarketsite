import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ApiDocs = () => {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project"}.supabase.co/functions/v1`;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">API</h1>
        <p className="text-sm text-muted-foreground">Documentação completa dos endpoints para integrar autenticação e licenciamento no seu software</p>
      </div>

      {/* Flow Overview */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">🔄 Fluxo de Autenticação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
              <span>Você gera uma <strong className="text-foreground">license key</strong> no painel e entrega ao cliente</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
              <span>O cliente abre seu programa e usa a key para <strong className="text-foreground">cadastrar usuário e senha</strong> (endpoint <code className="text-primary">/register-with-license</code>)</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
              <span>Nos próximos acessos, o cliente só precisa colocar <strong className="text-foreground">usuário e senha</strong> para entrar (endpoint <code className="text-primary">/login</code>)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">

        {/* REGISTER */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
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
  "license_key": "chave-de-licenca",
  "app_secret": "secret-key-da-aplicacao",
  "username": "nome_do_usuario",
  "password": "senha_segura",
  "hwid": "identificador-do-hardware"  // opcional
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (sucesso - 201)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "username": "nome_do_usuario"
  }
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS POSSÍVEIS</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos obrigatórios faltando / validação
401 — App secret inválido
403 — App desabilitada / licença banida ou expirada
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
              <Badge className="bg-blue-600 hover:bg-blue-700">POST</Badge>
              <CardTitle className="text-base">Login</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Acessos seguintes — só precisa de usuário e senha</p>
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
  "password": "senha_segura",
  "hwid": "identificador-do-hardware"  // opcional
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (sucesso - 200)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-success">
{`{
  "success": true,
  "message": "Login successful",
  "user": {
    "username": "nome_do_usuario",
    "license": {
      "status": "active",
      "expires_at": "2025-12-31T00:00:00Z"
    }
  }
}`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ERROS POSSÍVEIS</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`400 — Campos obrigatórios faltando
401 — App secret inválido / usuário ou senha errados
403 — App desabilitada / licença banida/expirada / HWID diferente`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VALIDATE LICENSE (existing) */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
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
  "license_key": "sua-license-key",
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

        {/* Integration Examples */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">📦 Exemplo de Integração</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Copie e cole no seu programa — troque APP_SECRET pela secret key da sua aplicação</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="python" className="w-full">
              <TabsList className="mb-3">
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="cpp">C++</TabsTrigger>
                <TabsTrigger value="csharp">C#</TabsTrigger>
                <TabsTrigger value="nodejs">Node.js</TabsTrigger>
              </TabsList>

              <TabsContent value="python">
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`import requests
import hashlib
import uuid

BASE_URL = "${baseUrl}"
APP_SECRET = "coloque-seu-app-secret-aqui"

def get_hwid():
    return hashlib.md5(str(uuid.getnode()).encode()).hexdigest()

# ── REGISTRO (primeira vez) ──────────────────────
def register(license_key, username, password):
    r = requests.post(f"{BASE_URL}/register-with-license", json={
        "license_key": license_key,
        "app_secret": APP_SECRET,
        "username": username,
        "password": password,
        "hwid": get_hwid()
    })
    data = r.json()
    if data["success"]:
        print("✅ Conta criada! Agora use login e senha para entrar.")
    else:
        print(f"❌ Erro: {data['message']}")
    return data

# ── LOGIN (acessos seguintes) ────────────────────
def login(username, password):
    r = requests.post(f"{BASE_URL}/login", json={
        "app_secret": APP_SECRET,
        "username": username,
        "password": password,
        "hwid": get_hwid()
    })
    data = r.json()
    if data["success"]:
        print(f"✅ Logado! Licença: {data['user']['license']['status']}")
        return True
    else:
        print(f"❌ {data['message']}")
        return False

# ── USO ──────────────────────────────────────────
# Primeira vez (com a key):
# register("SUA-LICENSE-KEY", "meu_usuario", "minha_senha")

# Próximas vezes (só login):
# if login("meu_usuario", "minha_senha"):
#     print("Programa liberado!")
# else:
#     print("Acesso negado.")`}
                </pre>
              </TabsContent>

              <TabsContent value="csharp">
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Management;

class ElevateAuth
{
    static readonly HttpClient client = new();
    static readonly string BASE_URL = "${baseUrl}";
    static readonly string APP_SECRET = "coloque-seu-app-secret-aqui";

    static string GetHWID()
    {
        var searcher = new ManagementObjectSearcher(
            "SELECT ProcessorId FROM Win32_Processor");
        foreach (var obj in searcher.Get())
            return obj["ProcessorId"]?.ToString() ?? "unknown";
        return "unknown";
    }

    // REGISTRO (primeira vez)
    public static async Task<bool> Register(
        string licenseKey, string username, string password)
    {
        var body = JsonSerializer.Serialize(new {
            license_key = licenseKey,
            app_secret = APP_SECRET,
            username,
            password,
            hwid = GetHWID()
        });
        var res = await client.PostAsync(
            $"{BASE_URL}/register-with-license",
            new StringContent(body, Encoding.UTF8, "application/json"));
        var json = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("success").GetBoolean();
    }

    // LOGIN (acessos seguintes)
    public static async Task<bool> Login(
        string username, string password)
    {
        var body = JsonSerializer.Serialize(new {
            app_secret = APP_SECRET,
            username,
            password,
            hwid = GetHWID()
        });
        var res = await client.PostAsync(
            $"{BASE_URL}/login",
            new StringContent(body, Encoding.UTF8, "application/json"));
        var json = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("success").GetBoolean();
    }
}`}
                </pre>
              </TabsContent>

              <TabsContent value="nodejs">
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`const BASE_URL = "${baseUrl}";
const APP_SECRET = "coloque-seu-app-secret-aqui";

// REGISTRO (primeira vez)
async function register(licenseKey, username, password) {
  const res = await fetch(\`\${BASE_URL}/register-with-license\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      license_key: licenseKey,
      app_secret: APP_SECRET,
      username,
      password,
    }),
  });
  const data = await res.json();
  console.log(data.success ? "✅ Registrado!" : \`❌ \${data.message}\`);
  return data;
}

// LOGIN (acessos seguintes)
async function login(username, password) {
  const res = await fetch(\`\${BASE_URL}/login\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_secret: APP_SECRET,
      username,
      password,
    }),
  });
  const data = await res.json();
  return data.success;
}

// Uso:
// await register("SUA-KEY", "usuario", "senha");
// await login("usuario", "senha");`}
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
