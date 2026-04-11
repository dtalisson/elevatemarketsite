---
name: Admin path structure
description: Painel admin na raiz (/), download público em /download
type: constraint
---
- `elevatemarket.site/` → login + dashboard admin (rotas na raiz: /, /login, /applications, etc.)
- `elevatemarket.site/download` → página pública de download com licença
- Links da sidebar usam prefixo vazio (B = "")
- ProtectedRoute redireciona para /login
- Pós-login redireciona para /
