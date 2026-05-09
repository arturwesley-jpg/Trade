# Guia prático para economizar tempo, tokens e evitar deploy quebrado com OpenClaude, Vercel e Render

**Projeto alvo:** aplicações web com frontend, backend, pacotes compartilhados, deploy em Vercel/Render e uso do OpenClaude como assistente de programação.

**Objetivo do guia:**  
evitar ciclos caros de tentativa e erro, reduzir gasto de tokens, organizar melhor a estrutura do projeto, padronizar deploy, aumentar segurança e impedir que erros simples cheguem ao ambiente de produção.

---

## 1. Ideia principal

O erro mais comum em projetos com IA não é apenas erro de código. O erro principal é usar a IA para descobrir problemas tarde demais, direto no deploy remoto.

A regra deste guia é:

> **Nunca use o OpenClaude para ficar tentando deploy remoto repetidas vezes. Primeiro valide tudo localmente. Depois faça commit, push e deploy.**

O OpenClaude deve trabalhar assim:

1. ler a estrutura do projeto;
2. entender se o erro é de frontend, backend, pacote compartilhado, variáveis ou deploy;
3. corrigir localmente;
4. rodar checagens locais;
5. só depois permitir commit/push/deploy.

---

## 2. Estrutura recomendada do projeto

Para projeto com frontend, backend e código compartilhado, recomendo estrutura de monorepo:

```txt
Trade/
  apps/
    frontend/
      package.json
      src/
      vite.config.ts ou next.config.js
      tsconfig.json

    backend/
      package.json
      src/
      tsconfig.json

  packages/
    shared/
      package.json
      src/
        index.ts

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  .env.example
  DEPLOY.md
  SECURITY.md
  predeploy-check.sh
```

### Por que essa estrutura?

Porque ela separa responsabilidades:

| Parte | Função |
|---|---|
| `apps/frontend` | interface web, painel, dashboard, páginas |
| `apps/backend` | API, autenticação, rotas, conexão com banco, workers |
| `packages/shared` | tipos, schemas, validações e funções usadas pelo frontend e backend |
| `DEPLOY.md` | manual de deploy para o OpenClaude seguir |
| `SECURITY.md` | checklist de segurança |
| `predeploy-check.sh` | script obrigatório antes de enviar para produção |

---

## 3. Gerenciador de pacotes recomendado

Use **pnpm**.

Ele é melhor para monorepos porque trabalha bem com workspaces, evita duplicação excessiva de dependências e deixa mais claro quais pacotes pertencem ao projeto.

Instalação:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

Arquivo `pnpm-workspace.yaml` na raiz:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 4. Exemplo de `package.json` da raiz

Crie ou ajuste o `package.json` principal:

```json
{
  "name": "trade-monorepo",
  "private": true,
  "packageManager": "pnpm@latest",
  "scripts": {
    "dev:front": "pnpm --filter frontend dev",
    "dev:back": "pnpm --filter backend dev",
    "build:front": "pnpm --filter frontend build",
    "build:back": "pnpm --filter backend build",
    "typecheck:front": "pnpm --filter frontend typecheck",
    "typecheck:back": "pnpm --filter backend typecheck",
    "lint:front": "pnpm --filter frontend lint",
    "lint:back": "pnpm --filter backend lint",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint",
    "build": "pnpm -r run build",
    "check": "pnpm typecheck && pnpm lint && pnpm build"
  }
}
```

Se algum app ainda não tiver `lint` ou `typecheck`, crie scripts simples nele.

Exemplo em `apps/frontend/package.json`:

```json
{
  "name": "frontend",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

Exemplo em `apps/backend/package.json`:

```json
{
  "name": "backend",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

---

## 5. Pacote compartilhado `@trade/shared`

Muitos erros de deploy aparecem assim:

```txt
Cannot find module '@trade/shared'
```

Isso geralmente significa que o pacote compartilhado não foi configurado corretamente.

Estrutura recomendada:

```txt
packages/shared/
  package.json
  src/
    index.ts
```

Arquivo `packages/shared/package.json`:

```json
{
  "name": "@trade/shared",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Depois, no frontend e no backend:

```json
{
  "dependencies": {
    "@trade/shared": "workspace:*"
  }
}
```

Exemplo de `packages/shared/src/index.ts`:

```ts
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type TradeAlert = {
  id: string;
  symbol: string;
  message: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
};
```

---

## 6. Fluxo correto com OpenClaude

### Pedido ruim

```txt
Arrume meu deploy.
```

Esse pedido é amplo demais. O OpenClaude pode gastar muito token, mexer em muitos arquivos e tentar soluções aleatórias.

### Pedido bom

```txt
Leia package.json, pnpm-workspace.yaml e tsconfig.
Rode pnpm typecheck.
Corrija somente o primeiro erro TypeScript.
Não faça deploy.
Não refatore.
Não instale bibliotecas novas sem justificar.
```

### Fluxo recomendado

Use o OpenClaude em etapas pequenas:

#### Etapa 1 — entender estrutura

```txt
Analise a estrutura do projeto.
Identifique frontend, backend, pacotes compartilhados e scripts disponíveis.
Não altere arquivos ainda.
```

#### Etapa 2 — corrigir TypeScript

```txt
Rode pnpm typecheck.
Corrija somente erros TypeScript.
Não faça deploy.
Não altere UI.
Não refatore.
```

#### Etapa 3 — corrigir build

```txt
Rode pnpm build.
Corrija somente erros de build.
Não faça deploy.
```

#### Etapa 4 — revisar deploy

```txt
Revise configuração de Vercel e Render.
Confira Root Directory, Build Command, Start Command, Output Directory e variáveis de ambiente.
Não altere código sem necessidade.
```

#### Etapa 5 — commit

```txt
Mostre os arquivos alterados.
Rode pnpm check.
Se passar, faça commit com mensagem clara.
```

---

## 7. Prompt mestre para usar no OpenClaude

Copie e cole este prompt dentro do OpenClaude no início do trabalho:

```txt
Você é meu engenheiro de projeto, build, deploy e segurança.

Contexto:
Este projeto é uma aplicação web com frontend, backend e possivelmente pacote compartilhado.
Quero economizar tokens, evitar deploy quebrado e impedir alterações desnecessárias.

Regras obrigatórias:
1. Não faça deploy antes de validação local.
2. Não tente resolver tudo de uma vez.
3. Não refatore sem necessidade.
4. Não altere UI se o problema for backend/build.
5. Não altere backend se o problema for somente frontend.
6. Não instale bibliotecas novas sem justificar.
7. Não recrie o projeto.
8. Não apague arquivos importantes sem pedir.
9. Primeiro leia:
   - package.json da raiz
   - pnpm-workspace.yaml
   - package.json do frontend
   - package.json do backend
   - tsconfig
   - DEPLOY.md
   - SECURITY.md
10. Rode os comandos locais antes de qualquer deploy:
   pnpm install
   pnpm typecheck
   pnpm build
11. Se falhar, corrija localmente.
12. Use logs curtos com tail -80 ou tail -120.
13. Priorize corrigir o primeiro erro raiz, não os sintomas.
14. Ao final, liste:
   - causa do erro
   - arquivos alterados
   - comandos executados
   - próximo passo seguro

Configuração de IA local quando necessário:
OPENAI_BASE_URL=http://localhost:20128/v1
OPENAI_API_KEY=dummy

Objetivo:
Manter frontend, backend e shared organizados, com deploy automático via GitHub, Vercel e Render, gastando o mínimo possível de token.
```

---

## 8. Script obrigatório antes de deploy

Crie na raiz:

```bash
cat > predeploy-check.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

echo "======================================================"
echo " Pré-deploy check"
echo "======================================================"

echo
echo "== Verificando pnpm =="
command -v pnpm >/dev/null 2>&1 || {
  echo "ERRO: pnpm não encontrado."
  echo "Instale com:"
  echo "  corepack enable"
  echo "  corepack prepare pnpm@latest --activate"
  exit 1
}

echo
echo "== Limpando builds antigos =="
rm -rf apps/*/dist apps/*/build packages/*/dist dist build 2>/dev/null || true

echo
echo "== Instalando dependências =="
pnpm install --frozen-lockfile

echo
echo "== Typecheck =="
pnpm -r run typecheck

echo
echo "== Lint =="
pnpm -r run lint

echo
echo "== Build =="
pnpm -r run build

echo
echo "======================================================"
echo " OK: projeto passou no pré-deploy"
echo "======================================================"
SH

chmod +x predeploy-check.sh
```

Rodar:

```bash
./predeploy-check.sh
```

Se esse script falhar, **não faça deploy**.

---

## 9. Como trabalhar com logs sem gastar token

Não cole log gigante no OpenClaude.

Use:

```bash
pnpm build 2>&1 | tail -80
```

Ou:

```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck.log
tail -120 /tmp/typecheck.log
```

Para erro de deploy, envie ao OpenClaude somente:

1. plataforma: Vercel ou Render;
2. comando que falhou;
3. últimas 80 linhas do erro;
4. arquivo citado no erro;
5. `package.json` relevante;
6. estrutura de pastas.

---

## 10. Deploy recomendado: Vercel para frontend, Render para backend

A recomendação mais simples e estável:

| Parte | Plataforma |
|---|---|
| Frontend | Vercel |
| Backend/API | Render |
| Banco | Supabase, Neon, Render PostgreSQL ou outro gerenciado |
| Cron/Jobs | Render Cron Job ou GitHub Actions |
| Código | GitHub |

### Por quê?

A Vercel é excelente para frontend, especialmente React, Vite e Next.js.  
O Render é mais natural para backend persistente, APIs, workers e serviços Node que precisam de `start command`.

---

## 11. Configuração recomendada na Vercel

Para frontend em `apps/frontend`:

```txt
Root Directory:
apps/frontend

Install Command:
pnpm install --frozen-lockfile

Build Command:
pnpm build

Output Directory:
dist
```

Para Vite, normalmente o output é `dist`.

Para Next.js, geralmente não coloque `dist`; deixe a Vercel detectar o framework.

### Atenção em monorepo

Se o frontend usa `@trade/shared`, a Vercel precisa conseguir acessar arquivos fora de `apps/frontend`.

Se der erro dizendo que não encontra `@trade/shared`, confira:

1. `pnpm-workspace.yaml` existe na raiz;
2. `@trade/shared` está em `dependencies`;
3. o projeto da Vercel está apontando corretamente para o monorepo;
4. se necessário, habilite a opção de incluir arquivos fora do Root Directory no build.

---

## 12. Configuração recomendada no Render

Para backend em `apps/backend`:

```txt
Root Directory:
apps/backend

Build Command:
pnpm install --frozen-lockfile && pnpm build

Start Command:
pnpm start
```

Mas, em monorepo, às vezes é melhor deixar o Root Directory na raiz e filtrar o comando:

```txt
Build Command:
pnpm install --frozen-lockfile && pnpm --filter backend build

Start Command:
pnpm --filter backend start
```

Use essa segunda opção se o backend depende de `packages/shared`.

---

## 13. `render.yaml` recomendado

Na raiz:

```yaml
services:
  - type: web
    name: trade-backend
    runtime: node
    rootDir: .
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter backend build
    startCommand: pnpm --filter backend start
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: OPENAI_BASE_URL
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_MODEL
        sync: false
```

### Quando usar `rootDir: .`

Use `rootDir: .` se o backend importa código de:

```txt
packages/shared
```

### Quando usar `rootDir: apps/backend`

Use `rootDir: apps/backend` se o backend é totalmente independente.

---

## 14. Variáveis de ambiente

Crie `.env.example`:

```env
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000

# Backend
PORT=3000
DATABASE_URL=

# IA / Router local
OPENAI_BASE_URL=http://localhost:20128/v1
OPENAI_API_KEY=dummy
OPENAI_MODEL=

# Segurança
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=
SESSION_SECRET=
```

`.gitignore`:

```gitignore
node_modules
dist
build
.env
.env.*
!.env.example
.vercel
.DS_Store
coverage
*.log
```

Nunca suba:

```txt
.env
chaves de API
tokens da Vercel
tokens da Render
senhas
JWT_SECRET real
DATABASE_URL real
```

---

## 15. Checklist antes de cada deploy

Antes de `git push`:

```bash
cd "$HOME/Área de trabalho/Trade"

git status

pnpm install
./predeploy-check.sh

git status
git add .
git commit -m "fix: preparar build seguro para deploy"
git push
```

Se falhar:

```bash
pnpm build 2>&1 | tail -100
```

Depois entregue esse trecho ao OpenClaude.

---

## 16. Estratégia para corrigir erros em ordem

Sempre corrija o erro raiz primeiro.

Ordem recomendada:

1. erro de workspace/import;
2. erro de dependência ausente;
3. erro de TypeScript;
4. erro de API de biblioteca;
5. erro de build;
6. erro de variável de ambiente;
7. erro de deploy remoto;
8. erro visual/UI.

### Exemplo

Se aparecer:

```txt
Cannot find module '@trade/shared'
```

Não comece corrigindo `implicit any`.

Primeiro corrija o pacote compartilhado. Muitos outros erros podem sumir depois.

---

# Segurança do projeto

Esta parte é obrigatória para qualquer app web publicado. O objetivo é reduzir risco de invasão, vazamento de dados, abuso de API, roubo de sessão e uso indevido do backend.

---

## 17. Princípios de segurança

### 17.1 Nunca confie no frontend

Tudo que vem do frontend pode ser manipulado.

Sempre valide no backend:

- parâmetros;
- corpo da requisição;
- headers;
- ID de usuário;
- permissões;
- tipo dos dados;
- tamanho dos dados.

### 17.2 Nunca coloque segredo no frontend

Variáveis com prefixo `VITE_` ficam expostas no navegador.

Pode usar no frontend:

```env
VITE_API_URL=
```

Não pode usar no frontend:

```env
VITE_OPENAI_API_KEY=
VITE_DATABASE_URL=
VITE_JWT_SECRET=
```

### 17.3 Autorização é diferente de autenticação

Autenticação responde:

> Quem é o usuário?

Autorização responde:

> O que esse usuário pode fazer?

Não basta saber que o usuário está logado. O backend precisa conferir se ele pode acessar aquele recurso.

---

## 18. Principais riscos web que você deve testar

Baseado nas práticas da OWASP, teste pelo menos estas categorias:

1. controle de acesso quebrado;
2. falhas criptográficas;
3. injeção;
4. design inseguro;
5. configuração insegura;
6. componentes vulneráveis/desatualizados;
7. falhas de identificação e autenticação;
8. falhas de integridade de software/dados;
9. falhas de logging e monitoramento;
10. SSRF, quando seu backend acessa URLs fornecidas pelo usuário.

---

## 19. Checklist de segurança antes de publicar

### 19.1 Variáveis e segredos

Verificar:

```bash
grep -R "sk-" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -R "API_KEY" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -R "DATABASE_URL" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -R "JWT_SECRET" . --exclude-dir=node_modules --exclude-dir=.git || true
```

Se aparecer segredo real, remova antes do commit.

### 19.2 Dependências vulneráveis

Rodar:

```bash
pnpm audit
```

Se usar npm:

```bash
npm audit
```

Se usar GitHub, ative Dependabot no repositório.

Arquivo `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 19.3 TypeScript estrito

No `tsconfig.json`, prefira:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

Isso evita muitos bugs que viram falhas de segurança.

---

## 20. Validação de dados com Zod

Instale:

```bash
pnpm add zod
```

Exemplo:

```ts
import { z } from "zod";

export const CreateAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  message: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high"])
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
```

No backend:

```ts
const parsed = CreateAlertSchema.safeParse(req.body);

if (!parsed.success) {
  return res.status(400).json({
    success: false,
    error: "Dados inválidos"
  });
}

const data = parsed.data;
```

Nunca processe `req.body` direto sem validar.

---

## 21. Proteção contra ataques comuns

### 21.1 CORS seguro

Não use isto em produção:

```ts
app.use(cors({ origin: "*" }));
```

Use:

```ts
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
```

No Render:

```env
CORS_ORIGIN=https://seu-frontend.vercel.app
```

### 21.2 Helmet

Para Express:

```bash
pnpm add helmet
```

Uso:

```ts
import helmet from "helmet";

app.use(helmet());
```

### 21.3 Rate limit

```bash
pnpm add express-rate-limit
```

Uso:

```ts
import rateLimit from "express-rate-limit";

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
}));
```

Para rotas sensíveis, use limite menor:

```ts
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10
}));
```

### 21.4 Limite de tamanho do body

```ts
app.use(express.json({ limit: "1mb" }));
```

Isso ajuda contra abuso de payload gigante.

### 21.5 Sanitização e queries seguras

Nunca monte SQL assim:

```ts
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

Use ORM ou query parametrizada.

Exemplo conceitual:

```ts
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

---

## 22. Testes de segurança básicos

Crie uma rotina de testes antes de produção.

### 22.1 Teste de rota sem autenticação

Verifique se endpoints privados bloqueiam acesso:

```bash
curl -i https://sua-api.render.com/api/private
```

Resultado esperado:

```txt
401 Unauthorized
```

### 22.2 Teste de usuário acessando dado de outro usuário

Se existe rota:

```txt
GET /api/users/:id/orders
```

Teste se um usuário consegue acessar o ID de outro.

Resultado esperado:

```txt
403 Forbidden
```

### 22.3 Teste de payload inválido

```bash
curl -i -X POST https://sua-api.render.com/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"symbol":"","severity":"admin"}'
```

Resultado esperado:

```txt
400 Bad Request
```

### 22.4 Teste de CORS

De origem não autorizada, a API não deve permitir credenciais.

Verifique headers:

```bash
curl -i https://sua-api.render.com/api/health \
  -H "Origin: https://site-malicioso.com"
```

Não deve retornar:

```txt
Access-Control-Allow-Origin: *
```

em rotas sensíveis.

### 22.5 Teste de rate limit

```bash
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://sua-api.render.com/api/auth/login
done
```

Depois de várias chamadas, deve aparecer:

```txt
429
```

### 22.6 Teste de headers de segurança

```bash
curl -I https://sua-api.render.com
```

Procure headers como:

```txt
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
```

Com Helmet, vários headers já são configurados.

---

## 23. Testes automatizados mínimos

Use Vitest:

```bash
pnpm add -D vitest
```

No `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Exemplo de teste de schema:

```ts
import { describe, expect, it } from "vitest";
import { CreateAlertSchema } from "@trade/shared";

describe("CreateAlertSchema", () => {
  it("rejeita severity inválida", () => {
    const result = CreateAlertSchema.safeParse({
      symbol: "BTC",
      message: "Teste",
      severity: "admin"
    });

    expect(result.success).toBe(false);
  });
});
```

Depois adicione ao pré-deploy:

```bash
pnpm -r run test
```

---

## 24. Teste de endpoint com Playwright ou Supertest

Para backend Express:

```bash
pnpm add -D supertest @types/supertest
```

Exemplo:

```ts
import request from "supertest";
import { app } from "../src/app";

describe("Healthcheck", () => {
  it("retorna 200", async () => {
    await request(app)
      .get("/api/health")
      .expect(200);
  });
});
```

Teste de rota protegida:

```ts
describe("Private route", () => {
  it("bloqueia usuário sem token", async () => {
    await request(app)
      .get("/api/private")
      .expect(401);
  });
});
```

---

## 25. Healthcheck obrigatório

No backend, crie uma rota:

```ts
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "trade-backend",
    time: new Date().toISOString()
  });
});
```

Depois do deploy:

```bash
curl https://sua-api.render.com/api/health
```

Se a healthcheck falhar, não teste o frontend ainda. Corrija o backend primeiro.

---

## 26. Logging seguro

Não logue:

```txt
senha
token
authorization header completo
cookie de sessão
DATABASE_URL
API key
JWT_SECRET
```

Exemplo ruim:

```ts
console.log(req.headers);
console.log(process.env);
```

Exemplo melhor:

```ts
console.log({
  method: req.method,
  path: req.path,
  ip: req.ip,
  userAgent: req.get("user-agent")
});
```

---

## 27. Proteção para uso de IA no backend

Se o backend chama um provedor de IA, como 9Router, OpenAI, Xiaomi MiMo ou outro, adicione proteções.

### 27.1 Limitar tamanho do prompt

```ts
if (prompt.length > 8000) {
  return res.status(400).json({
    success: false,
    error: "Prompt grande demais"
  });
}
```

### 27.2 Bloquear abuso por usuário

Crie limites por usuário:

```txt
usuário grátis: X chamadas por hora
usuário premium: Y chamadas por hora
admin: limite maior
```

### 27.3 Nunca expor chave de IA no frontend

O frontend chama seu backend.  
Seu backend chama o provedor de IA.

Fluxo correto:

```txt
Frontend -> Backend -> 9Router/provedor IA
```

Fluxo errado:

```txt
Frontend -> provedor IA direto com API key exposta
```

---

## 28. Checklist de produção

Antes de publicar:

```txt
[ ] pnpm install passou
[ ] pnpm typecheck passou
[ ] pnpm lint passou
[ ] pnpm build passou
[ ] pnpm test passou
[ ] .env.example atualizado
[ ] nenhum segredo real no Git
[ ] CORS configurado com domínio real
[ ] rate limit ativo
[ ] Helmet ativo
[ ] validação de input ativa
[ ] rotas privadas exigem autenticação
[ ] rotas privadas conferem autorização
[ ] logs não vazam segredo
[ ] healthcheck funcionando
[ ] Vercel aponta para frontend correto
[ ] Render aponta para backend correto
[ ] variáveis de ambiente existem nas plataformas
[ ] frontend usa URL real do backend
[ ] backend aceita origem real do frontend
```

---

## 29. Checklist específico para Vercel

```txt
[ ] Root Directory correto
[ ] Build Command correto
[ ] Output Directory correto
[ ] Framework detectado corretamente
[ ] Variáveis VITE_ configuradas
[ ] Não existe API key secreta no frontend
[ ] Projeto consegue acessar packages/shared se usar monorepo
[ ] Deploy Preview funciona antes da produção
```

---

## 30. Checklist específico para Render

```txt
[ ] Root Directory correto
[ ] Build Command correto
[ ] Start Command correto
[ ] NODE_ENV=production
[ ] DATABASE_URL configurada
[ ] CORS_ORIGIN configurada com domínio da Vercel
[ ] healthcheck responde
[ ] logs não mostram segredo
[ ] autoDeploy configurado corretamente
[ ] build filters configurados se for monorepo
```

---

## 31. Comandos úteis no dia a dia

### Ver status

```bash
git status
```

### Rodar tudo antes de deploy

```bash
./predeploy-check.sh
```

### Ver erro curto de build

```bash
pnpm build 2>&1 | tail -100
```

### Ver erro curto de typecheck

```bash
pnpm typecheck 2>&1 | tail -100
```

### Conferir arquivos grandes antes do commit

```bash
find . -type f -size +50M \
  -not -path "./node_modules/*" \
  -not -path "./.git/*"
```

### Conferir segredos acidentalmente no projeto

```bash
grep -R "sk-" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -R "SECRET" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -R "TOKEN" . --exclude-dir=node_modules --exclude-dir=.git || true
```

### Ver remotes Git

```bash
git remote -v
```

---

## 32. Como pedir correção ao OpenClaude quando der erro

Use este modelo:

```txt
Erro atual:
[cole somente as últimas 80 linhas]

Contexto:
- Plataforma: local / Vercel / Render
- Comando que falhou:
- Pasta onde rodei:
- Arquivo citado no erro:

Tarefa:
1. Explique a causa.
2. Corrija a menor quantidade possível de arquivos.
3. Não faça deploy.
4. Não refatore.
5. Depois rode pnpm typecheck e pnpm build.
6. Liste os arquivos alterados.
```

---

## 33. Regras para economizar token

1. Não cole logs gigantes.
2. Não peça “arrume tudo”.
3. Não deixe o OpenClaude fazer deploy antes de build local.
4. Não peça refatoração junto com correção de erro.
5. Não deixe a IA trocar biblioteca sem motivo.
6. Não misture problema de frontend com backend.
7. Sempre mande o comando exato que falhou.
8. Sempre informe a pasta onde estava.
9. Sempre peça alteração mínima.
10. Sempre rode `pnpm check` antes de commit.

---

## 34. Fluxo final recomendado

```bash
cd "$HOME/Área de trabalho/Trade"

git status

pnpm install
./predeploy-check.sh

git add .
git commit -m "fix: validar build e segurança antes do deploy"
git push
```

Depois:

1. verifique deploy da Vercel;
2. verifique deploy do Render;
3. teste `/api/health`;
4. abra frontend;
5. teste login/autenticação;
6. teste rotas protegidas;
7. monitore logs.

---

## 35. Referências úteis

- Vercel — Monorepos: https://vercel.com/docs/monorepos
- Vercel — Configuring a Build: https://vercel.com/docs/builds/configure-a-build
- Vercel — Turborepo: https://vercel.com/docs/monorepos/turborepo
- Render — Monorepo Support: https://render.com/docs/monorepo-support
- Render — Deploys: https://render.com/docs/deploys
- Render — Blueprint Spec: https://render.com/docs/blueprint-spec
- OWASP Web Security Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
- OWASP Top 10: https://owasp.org/www-project-top-ten/

---

## 36. Resumo final

O caminho mais seguro e econômico é:

```txt
OpenClaude corrige localmente
        ↓
predeploy-check.sh valida tudo
        ↓
git commit
        ↓
git push
        ↓
Vercel publica frontend
        ↓
Render publica backend
        ↓
testes de healthcheck e segurança
```

O OpenClaude deve ser usado como engenheiro de correção controlada, não como ferramenta para tentar deploy no escuro.

A meta é simples:

> **menos tentativa remota, mais validação local, mais segurança, menos token gasto.**


---

# 37. Deploy quebrado por configuração antiga na Vercel ou Render

Sim, pode acontecer.

Mas é importante entender corretamente:

> O erro normalmente não acontece porque existe uma “pasta velha” na Vercel ou no Render como se fosse hospedagem FTP antiga.  
> O erro acontece porque o projeto remoto pode estar usando **configurações antigas**, **cache de build antigo**, **variáveis antigas**, **Root Directory errado**, **comandos antigos**, **branch errada** ou **serviço conectado ao repositório errado**.

## 37.1 Exemplos de problemas causados por configuração antiga

### Na Vercel

Pode dar erro se estiver antigo ou errado:

```txt
Root Directory
Build Command
Output Directory
Framework Preset
Install Command
Environment Variables
Production Branch
Project vinculado ao repositório errado
Cache de build antigo
Variáveis de ambiente antigas
```

Exemplo clássico:

```txt
O projeto foi criado quando o frontend estava na raiz.
Depois você moveu para apps/frontend.
A Vercel continua tentando buildar a raiz.
Resultado: erro de dependência, erro de build ou dist não encontrado.
```

Outro exemplo:

```txt
Você corrigiu VITE_API_URL no código,
mas na Vercel ainda existe uma variável antiga apontando para backend antigo.
Resultado: frontend sobe, mas chama API errada.
```

### No Render

Pode dar erro se estiver antigo ou errado:

```txt
Root Directory
Build Command
Start Command
Publish Directory
Environment Variables
Auto Deploy Branch
Build Filters
Service conectado ao repo errado
Cache de build antigo
Dockerfile antigo
render.yaml divergente do painel
```

Exemplo clássico:

```txt
O backend depende de packages/shared.
Mas o Render está com Root Directory = apps/backend.
Então arquivos fora de apps/backend não ficam disponíveis.
Resultado: Cannot find module '@trade/shared'.
```

Outro exemplo:

```txt
O projeto usava npm.
Depois você mudou para pnpm.
Mas no Render o Build Command continua npm install && npm run build.
Resultado: build remoto falha mesmo funcionando localmente.
```

---

## 37.2 Regra de diagnóstico

Quando o deploy remoto falha, sempre descubra se o erro é:

```txt
[ ] erro real de código
[ ] erro de dependência
[ ] erro de monorepo
[ ] erro de variável de ambiente
[ ] erro de cache remoto
[ ] erro de configuração antiga na plataforma
[ ] erro de branch/repositório errado
```

Não assuma que é código antes de conferir configuração.

---

## 37.3 Sinais de que o problema é configuração antiga

Suspeite de Vercel/Render antigo quando:

```txt
[ ] local passa, remoto falha
[ ] pnpm build local funciona
[ ] erro remoto usa comando antigo, tipo npm install
[ ] erro remoto procura arquivo em pasta errada
[ ] erro remoto diz que não encontra @trade/shared
[ ] erro remoto usa Node antigo
[ ] frontend chama URL antiga de API
[ ] backend sobe mas usa variável errada
[ ] deploy remoto usa branch diferente da sua
[ ] você alterou Root Directory, Build Command ou env recentemente
[ ] limpar cache resolve temporariamente
```

---

## 37.4 O que conferir na Vercel

No painel da Vercel, confira:

```txt
Project Settings
  General
    Framework Preset
    Root Directory
    Build Command
    Output Directory
    Install Command

  Environment Variables
    Production
    Preview
    Development

  Git
    Connected Repository
    Production Branch
```

Para frontend Vite em monorepo, exemplo comum:

```txt
Root Directory:
apps/frontend

Install Command:
pnpm install --frozen-lockfile

Build Command:
pnpm build

Output Directory:
dist
```

Se o frontend depende de `packages/shared`, talvez seja melhor fazer build a partir da raiz, dependendo da configuração da Vercel e do workspace.

Nesse caso, uma alternativa é:

```txt
Root Directory:
.

Build Command:
pnpm install --frozen-lockfile && pnpm --filter frontend build

Output Directory:
apps/frontend/dist
```

---

## 37.5 O que conferir no Render

No painel do Render, confira:

```txt
Service Settings
  Build & Deploy
    Root Directory
    Build Command
    Start Command
    Auto Deploy
    Branch
    Build Filters

  Environment
    DATABASE_URL
    NODE_ENV
    CORS_ORIGIN
    OPENAI_BASE_URL
    OPENAI_API_KEY
    OPENAI_MODEL
```

Para backend em monorepo com `packages/shared`, recomendo começar assim:

```txt
Root Directory:
.

Build Command:
pnpm install --frozen-lockfile && pnpm --filter backend build

Start Command:
pnpm --filter backend start
```

Evite isto se o backend depende de `packages/shared`:

```txt
Root Directory:
apps/backend
```

porque o Render pode não disponibilizar arquivos fora do Root Directory durante build/runtime.

---

## 37.6 Quando limpar cache

Limpar cache é útil quando:

```txt
[ ] você mudou Build Command
[ ] você mudou Install Command
[ ] você trocou npm por pnpm
[ ] você alterou estrutura de pastas
[ ] você alterou framework
[ ] você alterou output directory
[ ] aparecem assets antigos
[ ] o build remoto parece reaproveitar dependência antiga
```

### Vercel

Na Vercel, vá em:

```txt
Project
  Deployments
    selecione o deployment
      ...
        Redeploy
          desmarque/evite usar Build Cache se disponível
```

Ou use a opção de redeploy sem reaproveitar cache quando a interface permitir.

### Render

No Render, vá em:

```txt
Service
  Manual Deploy
    Clear build cache & deploy
```

Use isso especialmente depois de trocar comando de build, gerenciador de pacotes ou estrutura do monorepo.

---

## 37.7 Quando criar projeto/serviço novo

Só crie projeto novo se:

```txt
[ ] você não sabe mais quais configurações antigas existem
[ ] o painel está confuso
[ ] o deploy está vinculado ao repositório errado
[ ] a branch está errada e você não consegue corrigir
[ ] o serviço foi criado como tipo errado
[ ] frontend foi criado como backend
[ ] backend foi criado como static site
[ ] há muitas variáveis antigas e risco de segredo vazado
```

Mas antes de apagar qualquer coisa:

```txt
[ ] exporte/copiei as variáveis de ambiente
[ ] confira domínio customizado
[ ] confira banco de dados
[ ] confira URLs usadas pelo frontend
[ ] confira deploy hooks
[ ] confira se há usuários reais usando
```

Não mande OpenClaude apagar serviços remotos automaticamente.

---

# 38. Script de auditoria de deploy Vercel/Render

Este script **não apaga nada**.  
Ele apenas analisa seu projeto local e gera um relatório Markdown com possíveis causas de deploy quebrado por configuração antiga.

Crie o arquivo:

```bash
cat > diagnosticar-deploy-vercel-render.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
REPORT="$ROOT/diagnostico-deploy-vercel-render-$(date +%Y%m%d-%H%M%S).md"

cd "$ROOT"

say() {
  printf '%s\n' "$*" | tee -a "$REPORT" >/dev/null
}

cmd_exists() {
  command -v "$1" >/dev/null 2>&1
}

json_get() {
  local file="$1"
  local expr="$2"

  if cmd_exists node; then
    node -e "
      const fs = require('fs');
      const file = process.argv[1];
      const expr = process.argv[2];
      try {
        const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
        const parts = expr.split('.');
        let cur = obj;
        for (const p of parts) cur = cur?.[p];
        if (cur === undefined || cur === null) process.exit(2);
        if (typeof cur === 'object') console.log(JSON.stringify(cur));
        else console.log(String(cur));
      } catch (e) { process.exit(1); }
    " "$file" "$expr" 2>/dev/null || true
  fi
}

detect_pkg_manager() {
  if [ -f pnpm-lock.yaml ]; then echo "pnpm"; return; fi
  if [ -f yarn.lock ]; then echo "yarn"; return; fi
  if [ -f package-lock.json ]; then echo "npm"; return; fi
  echo "desconhecido"
}

print_file_if_exists() {
  local title="$1"
  local file="$2"
  say ""
  say "## $title"
  if [ -f "$file" ]; then
    say ""
    say '```'
    sed -n '1,220p' "$file" | tee -a "$REPORT" >/dev/null
    say '```'
  else
    say ""
    say "Arquivo não encontrado: \`$file\`"
  fi
}

: > "$REPORT"

say "# Diagnóstico de deploy Vercel/Render"
say ""
say "**Data:** $(date)"
say "**Pasta analisada:** \`$ROOT\`"
say ""

say "## 1. Resumo rápido"
say ""

PKG_MANAGER="$(detect_pkg_manager)"
say "- Gerenciador detectado: **$PKG_MANAGER**"

if [ -d .git ]; then
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  REMOTE="$(git remote -v 2>/dev/null | head -5 || true)"
  LAST_COMMIT="$(git log -1 --oneline 2>/dev/null || true)"
  say "- Branch atual: \`${BRANCH:-não detectada}\`"
  say "- Último commit: \`${LAST_COMMIT:-não detectado}\`"
else
  say "- Git: não detectado"
fi

if [ -f package.json ]; then
  NAME="$(json_get package.json name)"
  say "- package.json raiz: encontrado"
  say "- Nome do pacote raiz: \`${NAME:-não informado}\`"
else
  say "- package.json raiz: NÃO encontrado"
fi

if [ -f pnpm-workspace.yaml ]; then
  say "- pnpm-workspace.yaml: encontrado"
else
  say "- pnpm-workspace.yaml: não encontrado"
fi

if [ -d apps/frontend ]; then
  say "- apps/frontend: encontrado"
else
  say "- apps/frontend: não encontrado"
fi

if [ -d apps/backend ]; then
  say "- apps/backend: encontrado"
else
  say "- apps/backend: não encontrado"
fi

if [ -d packages/shared ]; then
  say "- packages/shared: encontrado"
else
  say "- packages/shared: não encontrado"
fi

say ""
say "## 2. Possíveis alertas"
say ""

ALERTS=0

alert() {
  ALERTS=$((ALERTS+1))
  say "- [ALERTA] $*"
}

ok() {
  say "- [OK] $*"
}

if [ "$PKG_MANAGER" = "pnpm" ] && [ ! -f pnpm-workspace.yaml ]; then
  alert "Existe pnpm-lock.yaml, mas não existe pnpm-workspace.yaml. Em monorepo isso costuma quebrar @trade/shared."
fi

if [ -d packages/shared ]; then
  if grep -R "\"@trade/shared\"" apps/*/package.json >/dev/null 2>&1; then
    ok "apps parecem declarar @trade/shared."
  else
    alert "packages/shared existe, mas não encontrei @trade/shared em apps/*/package.json."
  fi
fi

if [ -f vercel.json ]; then
  ok "vercel.json encontrado."
  if grep -q "apps/frontend" vercel.json; then
    ok "vercel.json menciona apps/frontend."
  else
    alert "vercel.json não menciona apps/frontend. Confira se o Root Directory da Vercel está correto."
  fi
else
  say "- [INFO] vercel.json não encontrado. A configuração pode estar somente no painel da Vercel."
fi

if [ -d .vercel ]; then
  ok ".vercel encontrado. Projeto local já foi vinculado à Vercel."
  if [ -f .vercel/project.json ]; then
    say ""
    say "### .vercel/project.json"
    say ""
    say '```json'
    sed -n '1,160p' .vercel/project.json | tee -a "$REPORT" >/dev/null
    say '```'
  fi
else
  say "- [INFO] .vercel não encontrado. Projeto local talvez não esteja vinculado à Vercel CLI."
fi

if [ -f render.yaml ]; then
  ok "render.yaml encontrado."
  if grep -q "rootDir:" render.yaml; then
    ok "render.yaml define rootDir."
  else
    alert "render.yaml não define rootDir. Em monorepo isso pode causar build na pasta errada."
  fi
  if grep -q "pnpm" render.yaml; then
    ok "render.yaml usa pnpm."
  else
    if [ "$PKG_MANAGER" = "pnpm" ]; then
      alert "Projeto parece usar pnpm, mas render.yaml não menciona pnpm."
    fi
  fi
else
  say "- [INFO] render.yaml não encontrado. A configuração pode estar somente no painel do Render."
fi

if [ -f package.json ]; then
  if grep -q "\"check\"" package.json; then
    ok "Script check encontrado no package.json raiz."
  else
    alert "Script check não encontrado no package.json raiz. Recomendo criar pnpm check."
  fi

  if grep -q "\"build\"" package.json; then
    ok "Script build encontrado no package.json raiz."
  else
    alert "Script build não encontrado no package.json raiz."
  fi
fi

if [ -f .env ]; then
  alert "Arquivo .env existe na pasta do projeto. Confira se está no .gitignore e nunca suba para o GitHub."
fi

if [ -f .env.example ]; then
  ok ".env.example encontrado."
else
  alert ".env.example não encontrado. Isso dificulta reproduzir ambiente na Vercel/Render."
fi

say ""
say "Total de alertas: **$ALERTS**"
say ""

say "## 3. Arquivos de configuração encontrados"

print_file_if_exists "package.json raiz" "package.json"
print_file_if_exists "pnpm-workspace.yaml" "pnpm-workspace.yaml"
print_file_if_exists "vercel.json" "vercel.json"
print_file_if_exists "render.yaml" "render.yaml"
print_file_if_exists ".env.example" ".env.example"
print_file_if_exists "apps/frontend/package.json" "apps/frontend/package.json"
print_file_if_exists "apps/backend/package.json" "apps/backend/package.json"
print_file_if_exists "packages/shared/package.json" "packages/shared/package.json"

say ""
say "## 4. Git remoto"
say ""
if [ -d .git ]; then
  say '```'
  git remote -v 2>/dev/null | tee -a "$REPORT" >/dev/null || true
  say '```'
else
  say "Git não detectado."
fi

say ""
say "## 5. Comandos recomendados para validar localmente"
say ""
say '```bash'
say "pnpm install"
say "pnpm typecheck"
say "pnpm build"
say "pnpm check"
say '```'

say ""
say "## 6. Checklist manual na Vercel"
say ""
say "- Conferir se o projeto está ligado ao repositório correto."
say "- Conferir Production Branch."
say "- Conferir Root Directory."
say "- Conferir Install Command."
say "- Conferir Build Command."
say "- Conferir Output Directory."
say "- Conferir Environment Variables em Production e Preview."
say "- Fazer Redeploy sem reaproveitar cache se a interface oferecer essa opção."

say ""
say "## 7. Checklist manual no Render"
say ""
say "- Conferir se o serviço está ligado ao repositório correto."
say "- Conferir Branch."
say "- Conferir Root Directory."
say "- Conferir Build Command."
say "- Conferir Start Command."
say "- Conferir Build Filters."
say "- Conferir Environment Variables."
say "- Usar Manual Deploy > Clear build cache & deploy quando suspeitar de cache antigo."

say ""
say "## 8. Interpretação"
say ""
if [ "$ALERTS" -eq 0 ]; then
  say "Nenhum alerta óbvio foi encontrado localmente. Se o deploy remoto ainda falha, compare as configurações do painel da Vercel/Render com este relatório."
else
  say "Foram encontrados alertas locais. Corrija primeiro os itens acima antes de tentar novo deploy remoto."
fi

echo
echo "Relatório gerado em:"
echo "  $REPORT"
SH

chmod +x diagnosticar-deploy-vercel-render.sh
```

Executar na raiz do projeto:

```bash
cd "$HOME/Área de trabalho/Trade"
./diagnosticar-deploy-vercel-render.sh
```

Ou informando a pasta:

```bash
bash diagnosticar-deploy-vercel-render.sh "$HOME/Área de trabalho/Trade"
```

O script vai gerar um arquivo parecido com:

```txt
diagnostico-deploy-vercel-render-20260507-153000.md
```

Esse arquivo pode ser entregue ao OpenClaude.

---

# 39. Prompt para o OpenClaude analisar deploy antigo na Vercel/Render

Use este prompt junto com o relatório gerado pelo script acima:

```txt
Você é meu engenheiro de deploy, monorepo e diagnóstico de configuração antiga em Vercel/Render.

Contexto:
Meu deploy pode estar falhando não por erro de código, mas por configuração antiga na Vercel ou no Render.
Quero economizar tokens e evitar tentativa e erro.

Tarefa:
1. Leia o relatório diagnostico-deploy-vercel-render-*.md.
2. Leia package.json, pnpm-workspace.yaml, vercel.json, render.yaml, .env.example e package.json dos apps.
3. Descubra se o erro parece ser:
   - código quebrado;
   - dependência quebrada;
   - workspace/monorepo quebrado;
   - Root Directory errado;
   - Build Command antigo;
   - Start Command antigo;
   - Output Directory antigo;
   - variável de ambiente errada;
   - cache de build antigo;
   - branch/repositório errado.
4. Não faça deploy.
5. Não apague projeto da Vercel.
6. Não apague serviço do Render.
7. Não altere arquitetura sem necessidade.
8. Não instale biblioteca nova sem justificar.
9. Corrija primeiro a configuração local do repositório:
   - package.json;
   - pnpm-workspace.yaml;
   - render.yaml;
   - vercel.json;
   - .env.example;
   - scripts de build/check.
10. Depois rode:
    pnpm install
    pnpm typecheck
    pnpm build
    pnpm check
11. Se passar localmente, me diga exatamente o que devo conferir manualmente no painel da Vercel e no painel do Render.
12. Se suspeitar de cache antigo, recomende:
    - Vercel: Redeploy sem build cache, quando disponível.
    - Render: Manual Deploy > Clear build cache & deploy.
13. Se suspeitar de Root Directory errado, explique qual Root Directory usar e por quê.
14. Se o backend depende de packages/shared, prefira Render com Root Directory = . e comandos com pnpm --filter backend.
15. Se o frontend depende de packages/shared, explique se a Vercel deve buildar da raiz ou de apps/frontend.

Formato da resposta:
- Diagnóstico provável
- Evidências encontradas
- Arquivos que precisam mudar
- Configuração recomendada da Vercel
- Configuração recomendada do Render
- Comandos locais para validar
- Próximo passo seguro

Importante:
Não quero tentativa e erro.
Quero a menor correção possível.
```

---

# 40. Configuração recomendada se houver suspeita de projeto remoto antigo

## 40.1 Vercel frontend com monorepo simples

Use isto se o frontend não depende muito de arquivos fora da pasta dele:

```txt
Root Directory:
apps/frontend

Install Command:
pnpm install --frozen-lockfile

Build Command:
pnpm build

Output Directory:
dist
```

## 40.2 Vercel frontend que usa `packages/shared`

Use isto se a Vercel não consegue resolver `@trade/shared`:

```txt
Root Directory:
.

Install Command:
pnpm install --frozen-lockfile

Build Command:
pnpm --filter frontend build

Output Directory:
apps/frontend/dist
```

## 40.3 Render backend que usa `packages/shared`

Configuração recomendada:

```txt
Root Directory:
.

Build Command:
pnpm install --frozen-lockfile && pnpm --filter backend build

Start Command:
pnpm --filter backend start
```

## 40.4 Render backend independente

Use apenas se o backend não usa pacote compartilhado fora da pasta dele:

```txt
Root Directory:
apps/backend

Build Command:
pnpm install --frozen-lockfile && pnpm build

Start Command:
pnpm start
```

---

# 41. Procedimento seguro para “resetar” deploy sem apagar tudo

Antes de apagar projeto remoto, faça nesta ordem:

```txt
1. Rode ./diagnosticar-deploy-vercel-render.sh
2. Corrija package.json / pnpm-workspace / render.yaml / vercel.json
3. Rode pnpm check local
4. Faça commit
5. Faça push
6. Na Vercel, confira Settings
7. Na Render, confira Settings
8. Faça redeploy limpando cache quando necessário
9. Teste healthcheck
10. Só considere recriar projeto se ainda estiver inconsistente
```

---

# 42. Comando único para diagnóstico local

Na raiz do projeto:

```bash
cd "$HOME/Área de trabalho/Trade" && \
cat > diagnosticar-deploy-vercel-render.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
REPORT="$ROOT/diagnostico-deploy-vercel-render-$(date +%Y%m%d-%H%M%S).md"
cd "$ROOT"
: > "$REPORT"
say(){ printf '%s\n' "$*" | tee -a "$REPORT" >/dev/null; }
cmd_exists(){ command -v "$1" >/dev/null 2>&1; }
detect_pkg_manager(){ [ -f pnpm-lock.yaml ] && echo pnpm && return; [ -f yarn.lock ] && echo yarn && return; [ -f package-lock.json ] && echo npm && return; echo desconhecido; }
say "# Diagnóstico rápido Vercel/Render"
say ""
say "**Pasta:** \`$ROOT\`"
say "**Data:** $(date)"
say ""
say "## Resumo"
say "- Gerenciador: $(detect_pkg_manager)"
say "- Branch: $(git branch --show-current 2>/dev/null || echo 'sem git')"
say "- Último commit: $(git log -1 --oneline 2>/dev/null || echo 'sem git')"
say ""
say "## Arquivos importantes"
for f in package.json pnpm-workspace.yaml vercel.json render.yaml .env.example apps/frontend/package.json apps/backend/package.json packages/shared/package.json; do
  if [ -f "$f" ]; then
    say "- [OK] $f"
  else
    say "- [FALTA] $f"
  fi
done
say ""
say "## Alertas prováveis"
[ -f pnpm-lock.yaml ] && [ ! -f pnpm-workspace.yaml ] && say "- [ALERTA] pnpm-lock.yaml existe, mas pnpm-workspace.yaml não."
[ -d packages/shared ] && ! grep -R "\"@trade/shared\"" apps/*/package.json >/dev/null 2>&1 && say "- [ALERTA] packages/shared existe, mas @trade/shared não aparece em apps/*/package.json."
[ -f render.yaml ] && ! grep -q "pnpm" render.yaml && [ -f pnpm-lock.yaml ] && say "- [ALERTA] Projeto usa pnpm, mas render.yaml não menciona pnpm."
[ -f render.yaml ] && ! grep -q "rootDir:" render.yaml && say "- [ALERTA] render.yaml sem rootDir."
[ -f .env ] && say "- [ALERTA] .env existe. Confira .gitignore."
say ""
say "## Git remoto"
say '```'
git remote -v 2>/dev/null | tee -a "$REPORT" >/dev/null || true
say '```'
say ""
say "## Próximos passos"
say "1. Conferir Root Directory na Vercel e Render."
say "2. Conferir Build Command e Start Command."
say "3. Conferir variáveis de ambiente."
say "4. Se local passa e remoto falha, limpar build cache na plataforma."
echo "Relatório gerado em: $REPORT"
SH
chmod +x diagnosticar-deploy-vercel-render.sh && \
./diagnosticar-deploy-vercel-render.sh
```

---

# 43. Conclusão sobre arquivos antigos na Vercel/Render

A resposta prática é:

> Sim, deploy pode quebrar por herança de configuração antiga na Vercel/Render, principalmente em monorepo.

Mas a solução correta não é sair apagando tudo.

A solução correta é:

```txt
diagnosticar configuração
corrigir Root Directory / Build Command / Start Command
validar variáveis
limpar cache de build
redeploy controlado
só recriar projeto se realmente necessário
```

