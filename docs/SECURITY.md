# Security

## Regras Obrigatorias

- Nunca commitar `.env` real.
- Rotacionar tokens ja expostos em conversa ou docs.
- `SAFE_MODE=true`.
- `PAPER_TRADING_ONLY=true`.
- `FEATURE_REAL_TRADING=false`.
- Sem trade real nesta fase.
- Chaves de exchange futuras devem ter permissoes minimas e nunca saque.
- Endpoints admin exigem auth, role e auditoria.
- Logs nao podem conter secrets.
- `/admin/*` agora exige `x-admin-token` quando `ADMIN_API_TOKEN` esta configurado.
- `ADMIN_API_TOKEN` e temporario; producao deve usar usuarios, roles, expiracao e auditoria duravel.

## Achados Criticos

- `CONFIGURAR SERVIDOR PRO TRADE..md` contem token Telegram aparente. Revogar imediatamente.
- Token GitHub e Render API key foram compartilhados na conversa. Revogar e recriar.
- API publica ainda precisa de rate limit e auth completa.
- `/audit` legado ainda deve ser protegido ou removido antes de producao.
- CORS fica permissivo se `WEB_ORIGIN` nao for configurado.

## Checklist

- [ ] Revogar tokens expostos.
- [ ] Configurar `.env` local fora do git.
- [x] Exigir token temporario antes de endpoints `/admin/*`.
- [ ] Substituir token temporario por auth com roles.
- [ ] Adicionar rate limit.
- [ ] Adicionar auditoria duravel.
- [ ] Revisar termos de uso de cada provider antes de uso comercial.
