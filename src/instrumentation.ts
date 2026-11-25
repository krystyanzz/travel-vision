// Executado uma vez quando o servidor Next sobe: liga a coleta em segundo plano,
// sem depender de alguém abrir alguma página. Desligue com ROBOTS_IN_SERVER=0
// (por exemplo, quando o agendador roda num processo próprio com npm run robots).
// O import fica dentro do if para o compilador tirar o código Node do runtime edge.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundCollection } = await import("./instrumentation-node");
    startBackgroundCollection();
  }
}
