# Bot Disparador de WhatsApp

## Sobre o projeto

Script em Node.js para disparo automatizado de mensagens no WhatsApp. Ele lê uma lista
de contatos a partir de um arquivo CSV, personaliza a mensagem com o nome de cada
pessoa e envia uma a uma de forma controlada — com delays aleatórios e pausas
periódicas para reduzir o padrão robótico de envio. Ao final, gera um log de tudo que
foi enviado, pulado ou deu erro.

Ideal como base para campanhas de comunicação, avisos e notificações via WhatsApp,
para contatos que já deram consentimento para receber mensagens.

## Stack e dependências

- **Node.js** — runtime do script
- **[whatsapp-web.js](https://docs.wwebjs.dev/)** — biblioteca que automatiza o WhatsApp Web via Puppeteer
- **Puppeteer** (instalado automaticamente como dependência do whatsapp-web.js) — controla um Chromium headless por trás dos panos
- **qrcode-terminal** — exibe o QR Code de autenticação direto no terminal
- **LocalAuth** (estratégia nativa do whatsapp-web.js) — persiste a sessão localmente, evitando escanear o QR a cada execução

## Como usar

1. Instale as dependências:
   ```
   npm install
   ```

2. Edite `contatos.csv` com sua lista real (formato `nome,numero`, número só com DDI+DDD+número, sem espaços/símbolos):
   ```
   nome,numero
   João Silva,5511999999999
   ```

3. Ajuste a mensagem e os delays em `index.js`, dentro do objeto `CONFIG`.

4. Rode:
   ```
   npm start
   ```

5. Na primeira execução vai aparecer um QR Code no terminal — escaneie com
   **WhatsApp > Aparelhos conectados > Conectar um aparelho**.
   Depois disso a sessão fica salva (pasta `.wwebjs_auth`) e não precisa escanear de novo.

## O que o script já cuida

- Delay aleatório entre mensagens (evita padrão robótico)
- Pausa longa a cada N mensagens (configurável)
- Checagem se o número tem WhatsApp antes de enviar
- Log de tudo (enviado/erro/pulado) em `envio-log.csv`
- Personalização de mensagem com `{{nome}}`

## Avisos importantes

- O WhatsApp **não permite bots/clientes não oficiais** — usar isso tem risco real de o número ser banido, especialmente em disparos para muitos contatos desconhecidos ou sem opt-in.
- Recomendado: envie só para contatos que deram consentimento (opt-in), mantenha volume baixo por dia, e use um número "aquecido" (com uso humano normal antes).
- Ajuste `minDelayMs`/`maxDelayMs` e `pauseEveryN` conforme o volume — quanto maior a lista, mais conservador deve ser o ritmo.
