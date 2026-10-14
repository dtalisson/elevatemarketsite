# Elevate Services — Sistema de Licenciamento e Autenticação de Software

> Plataforma completa de **licenciamento, autenticação e proteção anti-fraude** para aplicações desktop (C++/Windows), inspirada em soluções como o KeyAuth. Inclui painel administrativo, painel de revendedores e uma API segura em Edge Functions.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Deno](https://img.shields.io/badge/Edge_Functions-Deno-000000?logo=deno&logoColor=white)

---

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Segurança](#segurança)
- [API](#api)
- [Stack](#stack)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar localmente](#como-rodar-localmente)
- [Deploy](#deploy)

---

## Sobre o projeto

O **Elevate Services** resolve um problema comum de quem distribui software pago: **garantir que apenas usuários com licença válida consigam usar o programa**, impedindo compartilhamento de chaves, troca de máquina não autorizada e tentativas de força bruta.

O sistema é composto por três partes:

1. **Painel Administrativo (web)** – gerenciamento de aplicações, licenças, usuários, logs e banimentos.
2. **Painel de Revendedores (web)** – sub-usuários com permissões limitadas para gerar e gerenciar suas próprias chaves.
3. **API de autenticação (Edge Functions)** – consumida pelo cliente desktop (loader C++) para registrar, logar, validar sessão e verificar atualizações.

---

## Funcionalidades

### Painel administrativo
| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral com métricas de licenças, usuários e atividade. |
| **Applications** | Cadastro de aplicações com `App ID`, `Secret Key` (revelada sob demanda), versão e status (online/offline). |
| **Licenses** | Geração em lote, duração configurável, reset de HWID, exclusão de chaves expiradas/não usadas. |
| **Users** | Usuários finais vinculados às licenças, com HWID, último login e expiração. |
| **Panel Users** | Criação de revendedores com validade e lista de aplicações permitidas. |
| **Online** | Usuários conectados em tempo real via heartbeat. |
| **Auth Logs / HWID Logs** | Histórico de logins, registros e divergências de hardware, com ações rápidas (resetar HWID, banir). |
| **Alerts** | Eventos de segurança reportados pelo cliente (anti-debug, adulteração etc.). |
| **Blacklist** | Banimento global e por aplicação de HWID/IP, com desbanimento pelo painel. |
| **Downloads** | Upload de builds (`.exe`/`.zip`) com links assinados e temporários. |
| **API Docs** | Documentação integrada com exemplos em C++. |

### Painel de revendedores
- Login isolado com token rotativo.
- Geração e gestão apenas das chaves que o próprio revendedor criou.
- Acesso restrito às aplicações liberadas pelo administrador.

### Cliente desktop
- Registro com chave de licença e vínculo ao hardware (HWID).
- Login em duas etapas (pre-auth + challenge).
- Heartbeat de sessão e verificação de versão com **auto-update** via URL assinada.
- Verificação de banimento antes mesmo da abertura do programa.

---

## Arquitetura

```text
┌──────────────────┐        HTTPS + HMAC        ┌───────────────────────┐
│  Cliente C++     │ ─────────────────────────▶ │  Edge Functions (Deno)│
│  (loader/app)    │ ◀───── resposta assinada ── │  login, pre-auth, ... │
└──────────────────┘                             └──────────┬────────────┘
                                                            │ service role
┌──────────────────┐     Auth + RLS              ┌──────────▼────────────┐
│ Painel Admin /   │ ──────────────────────────▶ │  PostgreSQL           │
│ Revendedor (web) │                             │  (RLS + RPCs)         │
└──────────────────┘                             └───────────────────────┘
```

---

## Segurança

- **Assinatura HMAC-SHA256** em requisições e respostas, com `timestamp` + `nonce` contra replay.
- **Login em duas etapas**: `pre-auth` gera um challenge token de uso único consumido pelo `login`.
- **HWID Lock**: a licença fica presa ao hardware do primeiro uso; o admin pode resetar.
- **Auto-blacklist**: após 3 tentativas inválidas (senha errada, chave já usada, usuário duplicado), o HWID é banido automaticamente.
- **Claim atômico de licença** + constraint `UNIQUE` impedindo que uma chave seja usada por mais de uma conta.
- **Row Level Security** em todas as tabelas; hashes de senha, secrets e tokens nunca são expostos ao cliente.
- **Funções `SECURITY DEFINER`** com checagem interna de papel (`has_role`) e permissões revogadas para usuários anônimos.
- **Rate limiting** e bloqueio de conta por tentativas.
- **Downloads privados** via URLs assinadas com expiração de 5 minutos.

---

## API

Base: `/functions/v1`

| Endpoint | Função |
|---|---|
| `POST /pre-auth` | Gera challenge token para login. |
| `POST /login` | Autentica usuário + HWID e retorna sessão. |
| `POST /register-with-license` | Cria conta consumindo uma licença. |
| `POST /validate-license` | Valida uma chave de licença. |
| `POST /validate-session` | Confirma se a sessão ainda é válida. |
| `POST /heartbeat` | Mantém o usuário online. |
| `POST /check-hwid` | Verifica se o HWID está banido. |
| `POST /app-status` | Status da aplicação, versão e link de atualização. |
| `POST /download-with-license` | Download autenticado de builds. |
| `POST /security-log` | Recebe alertas de segurança do cliente. |
| `POST /reset-hwid` | Reset de HWID (admin/revendedor). |
| `POST /create-license` | Criação de licenças via API. |
| `*/panel-user-auth`, `*/panel-user-actions` | Autenticação e ações dos revendedores. |
| `POST /admin-login`, `POST /cleanup-logs` | Login do admin e manutenção de logs. |

Exemplo de resposta de `check-hwid`:
```json
{ "banned": true, "status": "banned", "message": "Motivo do banimento" }
```

---

## Stack

- **Front-end:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router
- **Back-end:** PostgreSQL (Supabase) com RLS, Edge Functions em Deno/TypeScript
- **Cliente:** C++ (WinHTTP + nlohmann/json)
- **Testes:** Vitest + Playwright

---

## Estrutura de pastas

```text
src/
├── components/        # Layouts, rotas protegidas e componentes de UI (shadcn)
├── contexts/          # AuthContext (admin) e PanelUserContext (revendedor)
├── pages/             # Telas do painel admin, revendedor e públicas
├── integrations/      # Cliente do banco de dados
└── hooks/ lib/        # Utilitários
supabase/
├── functions/         # Edge Functions da API
└── migrations/        # Schema, RLS e funções SQL
public/                # Assets estáticos (vídeo de login, favicon)
```

---

## Como rodar localmente

```bash
git clone <url-do-repositorio>
cd elevate-services
npm install
npm run dev
```

Crie um arquivo `.env` com:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Scripts úteis: `npm run build`, `npm run lint`, `npm test`.

---

## Deploy

Compatível com **Vercel** (preset Vite):
- Build command: `npm run build`
- Output directory: `dist`
- Configure as variáveis de ambiente acima no painel da Vercel.
