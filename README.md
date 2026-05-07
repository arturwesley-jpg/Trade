# 🚀 Crypto Trading Bot Pro

Sistema completo de trading automatizado para criptomoedas com foco em Bitcoin, desenvolvido para negociação inteligente e gestão de risco avançada.

## ✨ Features

- 📊 **Análise Técnica Avançada** - RSI, MACD, Bandas de Bollinger, Fibonacci
- 💼 **Modo Treinamento** - Simule trades com dinheiro virtual
- 🎯 **Modo Real** - Execute trades automáticos na BingX
- 📱 **Bot Telegram** - Interface completa para trades e alertas
- 🌐 **Dashboard Web** - Visualização em tempo real com gráficos
- 🔔 **Alertas Inteligentes** - Notificações personalizadas
- 🛡️ **Gestão de Risco** - Stop loss automático e posicionamento seguro

## 🎮 Modos de Operação

### 📚 Modo Treinamento
- **100% Seguro** - Dinheiro virtual para testes
- **Backtesting** - Teste estratégias em dados históricos
- **Métricas Detalhadas** - Win rate, PnL, drawdown
- **Aprendizado Progressivo** - Evolua do básico ao avançado

### 💰 Modo Real
- **Trading ao Vivo** - Conectado à BingX API
- **Execução Automática** - Trades baseados em sinais validados
- **Gestão de Capital** - Nunca arrisque mais que 2% por trade
- **Monitoramento 24/7** - Bot vigilante do mercado

## 🚀 Quick Start

### 1. Instalação
```bash
# Clone o repositório
git clone https://github.com/usuario/crypto-trading-bot
cd crypto-trading-bot

# Execute o script de configuração
chmod +x setup.sh
./setup.sh
```

### 2. Configuração
```bash
# Edite o arquivo .env
nano .env

# Configure suas chaves:
# - BINGX_API_KEY
# - BINGX_API_SECRET
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_ALLOWED_USER_IDS
```

### 3. Iniciar
```bash
# Modo treinamento (recomendado)
npm run start:paper

# Modo real (após testes)
npm start
```

## 📱 Bot Telegram - Comandos

| Comando | Descrição |
|---------|-----------|
| `/start` | Menu principal e status |
| `/trade` | Abrir nova posição (LONG/SHORT) |
| `/close` | Fechar posição manualmente |
| `/stats` | Estatísticas completas |
| `/paper` | Ativar modo treinamento |
| `/real` | Ativar modo real |
| `/help` | Ajuda completa |

## 🖥️ Dashboard Web

Acesse `http://localhost:3000` para:

- 📊 Gráficos em tempo real
- 📈 Análise técnica completa
- 💼 Portfólio detalhado
- 📰 Feed de notícias
- ⚙️ Configurações avançadas

## 🏗️ Estrutura do Projeto

```
crypto-trading-bot/
├── backend/                # API Node.js + PostgreSQL
│   ├── src/
│   │   ├── api/           # Rotas REST
│   │   ├── services/      # Lógica de negócios
│   │   ├── models/        # Models PostgreSQL
│   │   └── websocket/     # Streaming em tempo real
├── frontend/               # React Dashboard
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Páginas principais
│   │   └── services/      # API client
├── telegram-bot/          # Bot de interface
│   ├── commands/          # Handlers de comandos
│   ├── services/          # Lógica do bot
│   └── index.js          # Entry point
└── infrastructure/        # Docker & Deploy
    ├── docker-compose.yml
    └── nginx.conf
```

## 📊 Estratégias Implementadas

### 1. Scalping (Fatiamento)
- Timeframe: 1m - 5m
- Alvo: 0.5% - 1% por trade
- Indicadores: RSI + Volume + VWAP

### 2. Swing Trading
- Timeframe: 4h - 1d
- Alvo: 3% - 5% por trade
- Indicadores: EMA + MACD + Fibonacci

### 3. Trend Following
- Timeframe: 1d - 1w
- Alvo: 10%+ por trade
- Indicadores: Moving Averages + ADX

## 🔒 Segurança

- ✅ API Keys encriptadas
- ✅ 2FA obrigatório
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Whitelist de IPs

## 📈 Métricas de Sucesso

- Win Rate > 55%
- Sharpe Ratio > 1.5
- Max Drawdown < 20%
- ROI Anual > 50%

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, PostgreSQL, Redis
- **Frontend**: React, Chart.js, Socket.io
- **Bot**: Telegraf, Node.js
- **Infra**: Docker, Kubernetes
- **APIs**: BingX, CoinGecko, TradingView

## 📚 Recursos de Apoio

- 📖 [Documentação Completa](./docs/)
- 🎥 [Vídeos Tutoriais](https://youtube.com/playlist/crypto-bot)
- 💬 [Telegram Community](https://t.me/cryptotraders)
- 🐛 [Issues & Suporte](https://github.com/support)

## ⚠️ Aviso Importante

**AVISO DE RISCO**: Trading de criptomoedas envolve risco significativo. Você pode perder todo o seu capital investido. Este bot é uma ferramenta auxiliar, não garante lucros. Sempre:

1. **Comece no modo paper** - Teste antes de usar dinheiro real
2. **Use stop loss** - Nunca negocie sem proteção
3. **Invista o que pode perder** - Jamais use dinheiro essencial
4. **Estude o mercado** - Conhecimento é sua melhor defesa

## 📄 Licença

Este projeto está licenciado sob MIT License - veja [LICENSE](LICENSE) para detalhes.

---

Desenvolvido com ❤️ por [Crypto Solutions Team](https://github.com/crypto-solutions)

⭐ Se gostou, deixe uma estrela! ⭐# TradeB
# TradeB
