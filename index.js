const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const app = express();
require("dotenv").config();

app.use(bodyParser.json());

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.SHEET_ID;

app.post("/webhook", async (req, res) => {
  const msg = req.body.message.body;
  const number = req.body.message.from;

  const parsed = parseMessage(msg);
  if (!parsed) return res.send("Mensagem inválida");

  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  const sheetData = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Movimentações!E2:E",
  });

  const lastSaldo = sheetData.data.values?.at(-1)?.[0] || 0;
  const newSaldo = parseFloat(lastSaldo) + parsed.valor;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Movimentações!A2",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[
        new Date().toLocaleDateString("pt-BR"),
        parsed.tipo,
        parsed.categoria,
        parsed.valor,
        newSaldo,
        number
      ]]
    }
  });

  console.log("Registro salvo:", parsed);
  res.send(`✅ ${parsed.tipo} salvo! Saldo atual: R$ ${newSaldo}`);
});

function parseMessage(texto) {
  const lower = texto.toLowerCase();
  const gastoMatch = lower.match(/gastei\s*([\d,.]+)\s*(com\s*(.+))?/);
  const ganhoMatch = lower.match(/recebi\s*([\d,.]+)\s*(de\s*(.+))?/);

  if (gastoMatch) {
    return {
      tipo: "Gasto",
      valor: -parseFloat(gastoMatch[1].replace(",", ".")),
      categoria: gastoMatch[3] || "Sem categoria"
    };
  } else if (ganhoMatch) {
    return {
      tipo: "Ganho",
      valor: parseFloat(ganhoMatch[1].replace(",", ".")),
      categoria: ganhoMatch[3] || "Salário"
    };
  }
  return null;
}

app.listen(3000, () => console.log("Bot rodando na porta 3000"));
