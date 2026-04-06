import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ApiDocs = () => {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project"}.supabase.co/functions/v1`;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">API</h1>
        <p className="text-sm text-muted-foreground">Documentação dos endpoints para integrar no seu software</p>
      </div>

      <div className="space-y-6">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Validar Licença</CardTitle>
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
  "hwid": "identificador-do-hardware" // opcional
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
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">RESPOSTA (erro)</p>
                <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-destructive">
{`{
  "valid": false,
  "message": "Invalid or expired license"
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Exemplo de Integração (Python)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground overflow-x-auto">
{`import requests
import hashlib
import uuid

def get_hwid():
    return hashlib.md5(str(uuid.getnode()).encode()).hexdigest()

def validate_license(license_key, app_secret):
    response = requests.post(
        "${baseUrl}/validate-license",
        json={
            "license_key": license_key,
            "app_secret": app_secret,
            "hwid": get_hwid()
        }
    )
    data = response.json()
    return data["valid"]

# Uso
if validate_license("sua-key", "seu-secret"):
    print("✅ Licença válida!")
else:
    print("❌ Licença inválida!")`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;
