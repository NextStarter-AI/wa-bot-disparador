/**
 * Bot disparador de mensagens no WhatsApp usando whatsapp-web.js
 * -----------------------------------------------------------------
 * Lê uma lista de contatos de um CSV, personaliza a mensagem e dispara
 * uma a uma com delays aleatórios (pra reduzir risco de bloqueio).
 *
 * Uso:
 *   1. npm install
 *   2. Edite CONFIG abaixo e o arquivo contatos.csv
 *   3. node index.js
 *   4. Escaneie o QR Code na primeira execução
 */

const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// ============================================================
// CONFIGURAÇÃO — ajuste aqui
// ============================================================
const CONFIG = {
  contactsFile: path.join(__dirname, "contatos.csv"),
  logFile: path.join(__dirname, "envio-log.csv"),

  // Mensagem — use {{nome}} pra personalizar (troca pelo nome do contato)
  messageTemplate: "Olá {{nome}}! Essa é uma mensagem de teste do bot. 🚀",

  // Delay entre cada mensagem (em ms) — SEMPRE aleatório, nunca fixo
  minDelayMs: 8000, // 8s
  maxDelayMs: 20000, // 20s

  // A cada X mensagens, faz uma pausa mais longa (simula comportamento humano)
  pauseEveryN: 20,
  longPauseMs: 3 * 60 * 1000, // 3 minutos

  // Se true, checa se o número existe no WhatsApp antes de enviar
  checkIsRegistered: true,
};

// ============================================================
// CLIENT
// ============================================================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  },
});

client.on("qr", (qr) => {
  console.log(
    "\nEscaneie o QR Code abaixo com o WhatsApp (Aparelhos conectados):\n",
  );
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("✔ Autenticado com sucesso.");
});

client.on("auth_failure", (msg) => {
  console.error("✖ Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  console.error("✖ Cliente desconectado:", reason);
});

client.on("ready", async () => {
  console.log("✔ Client pronto. Iniciando disparo...\n");
  try {
    await runCampaign();
  } catch (err) {
    console.error("Erro fatal na campanha:", err);
  } finally {
    console.log(
      "\nCampanha finalizada. Aguardando confirmação de entrega antes de encerrar...",
    );
    // Dá tempo da(s) última(s) mensagem(ns) realmente saírem pela rede antes de fechar o
    // navegador — sendMessage() resolve assim que a mensagem é enfileirada no WhatsApp Web,
    // não necessariamente quando ela já foi entregue.
    await new Promise((resolve) => setTimeout(resolve, 8000));
    console.log("Encerrando client.");
    await client.destroy();
    process.exit(0);
  }
});

client.initialize();

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/** Lê o CSV de contatos. Formato esperado: nome,numero
 *  numero deve conter DDI+DDD+numero, só dígitos. Ex: 5511999999999
 */
function loadContacts(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de contatos não encontrado: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8").trim();
  const lines = raw.split("\n").filter(Boolean);

  // Ignora cabeçalho se a primeira linha parecer um header
  const startIndex = /^\s*nome\s*,\s*numero/i.test(lines[0]) ? 1 : 0;

  const contacts = [];
  for (let i = startIndex; i < lines.length; i++) {
    const [nomeRaw, numeroRaw] = lines[i].split(",");
    if (!numeroRaw) continue;

    const nome = (nomeRaw || "").trim();
    const numero = numeroRaw.trim().replace(/\D/g, ""); // só dígitos

    if (numero) contacts.push({ nome, numero });
  }
  return contacts;
}

function personalize(template, nome) {
  return template.replace(/{{\s*nome\s*}}/gi, nome || "");
}

function randomDelay(min, max) {
  return new Promise((resolve) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, ms);
  });
}

function appendLog(filePath, row) {
  const header = "timestamp,numero,nome,status,detalhe\n";
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, header, "utf-8");
  }
  const line =
    [
      new Date().toISOString(),
      row.numero,
      row.nome,
      row.status,
      (row.detalhe || "").replace(/,/g, ";"),
    ].join(",") + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

// ============================================================
// CAMPANHA DE DISPARO
// ============================================================
async function runCampaign() {
  const contacts = loadContacts(CONFIG.contactsFile);
  console.log(`${contacts.length} contato(s) carregado(s).\n`);

  let enviados = 0;
  let falhas = 0;

  for (let i = 0; i < contacts.length; i++) {
    const { nome, numero } = contacts[i];
    const chatId = `${numero}@c.us`;

    try {
      if (CONFIG.checkIsRegistered) {
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
          console.log(
            `[${i + 1}/${contacts.length}] ✖ ${numero} não tem WhatsApp — pulando.`,
          );
          appendLog(CONFIG.logFile, {
            numero,
            nome,
            status: "PULADO",
            detalhe: "numero nao registrado",
          });
          falhas++;
          continue;
        }
      }

      const texto = personalize(CONFIG.messageTemplate, nome);
      await client.sendMessage(chatId, texto);

      console.log(
        `[${i + 1}/${contacts.length}] ✔ Enviado para ${nome || numero} (${numero})`,
      );
      appendLog(CONFIG.logFile, { numero, nome, status: "ENVIADO" });
      enviados++;
    } catch (err) {
      console.error(
        `[${i + 1}/${contacts.length}] ✖ Erro ao enviar para ${numero}:`,
        err.message,
      );
      appendLog(CONFIG.logFile, {
        numero,
        nome,
        status: "ERRO",
        detalhe: err.message,
      });
      falhas++;
    }

    const isLast = i === contacts.length - 1;
    if (!isLast) {
      // pausa longa a cada N mensagens
      if (CONFIG.pauseEveryN > 0 && (i + 1) % CONFIG.pauseEveryN === 0) {
        console.log(
          `\n⏸ Pausa longa de ${CONFIG.longPauseMs / 1000}s após ${i + 1} mensagens...\n`,
        );
        await randomDelay(CONFIG.longPauseMs, CONFIG.longPauseMs + 15000);
      } else {
        await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
      }
    }
  }

  console.log(
    `\nResumo: ${enviados} enviado(s), ${falhas} falha(s)/pulado(s).`,
  );
  console.log(`Log detalhado salvo em: ${CONFIG.logFile}`);
}
