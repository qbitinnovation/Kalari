export const escapeReportHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type AdminReportOptions = {
  title: string;
  subtitle: string;
  body: string;
  generatedLabel: string;
  compact?: boolean;
};

const reportStyles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f8fafc;
    color: #172033;
    font-family: Inter, "Segoe UI", Arial, sans-serif;
  }
  .page {
    width: min(1120px, calc(100% - 48px));
    margin: 24px auto;
    padding: 42px;
    border: 1px solid #dbe3ee;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 24px 70px rgba(15, 23, 42, .12);
  }
  .report-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    padding-bottom: 28px;
    border-bottom: 3px solid #d97706;
  }
  .brand { display: flex; align-items: center; gap: 18px; }
  .logo {
    width: 82px;
    height: 82px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 8px;
  }
  .brand-name, h1, h2, p { margin: 0; }
  .eyebrow {
    color: #b45309;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
  }
  .brand-name { margin-top: 5px; font-size: 25px; font-weight: 900; }
  .muted { color: #64748b; }
  h1 { margin-top: 26px; font-size: 31px; line-height: 1.15; }
  .subtitle { margin-top: 8px; font-size: 14px; line-height: 1.5; }
  .generated { text-align: right; font-size: 12px; font-weight: 700; line-height: 1.5; }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin: 26px 0;
  }
  .metric, .panel {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
  }
  .metric { min-height: 92px; padding: 16px; }
  .label {
    color: #64748b;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .value { margin-top: 8px; font-size: 21px; font-weight: 900; }
  .panels { display: grid; gap: 16px; margin-bottom: 24px; }
  .panel { padding: 20px; }
  h2 { margin-bottom: 14px; font-size: 17px; font-weight: 900; }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .detail { padding: 11px 0; border-top: 1px solid #e2e8f0; }
  .detail .value { margin-top: 4px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    padding: 11px 9px;
    background: #fff7ed;
    color: #9a3412;
    text-align: left;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  td {
    padding: 12px 9px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  td strong { display: block; margin-bottom: 3px; }
  .empty { padding: 28px; color: #64748b; text-align: center; font-weight: 700; }
  .nowrap { white-space: nowrap; }
  .report-foot {
    margin-top: 28px;
    padding-top: 15px;
    border-top: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }
  .report-top {
    display: grid;
    gap: 14px;
    margin: 18px 0 14px;
  }
  .kv-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 16px;
    padding: 12px 0;
    border-top: 1px solid #e2e8f0;
  }
  .kv-grid:last-child {
    border-bottom: 1px solid #e2e8f0;
  }
  .kv-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .kv-item .label {
    margin: 0;
    font-size: 10px;
    line-height: 1.2;
  }
  .kv-item .value {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.35;
    word-break: break-word;
  }
  .bookings-section { margin-top: 4px; }
  .bookings-section h2 { margin-bottom: 8px; font-size: 14px; }
  .page.compact .report-head { padding-bottom: 16px; gap: 16px; }
  .page.compact .logo { width: 52px; height: 52px; padding: 4px; }
  .page.compact .brand-name { font-size: 20px; }
  .page.compact h1 { margin-top: 14px; font-size: 24px; }
  .page.compact .subtitle { margin-top: 4px; font-size: 13px; }
  .page.compact .report-top { margin: 12px 0 10px; gap: 10px; }
  .page.compact .kv-grid { padding: 8px 0; gap: 10px 12px; }
  .page.compact .bookings-section { margin-top: 0; }
  .page.compact .bookings-section h2 { margin-bottom: 6px; font-size: 13px; }
  .page.compact .report-foot { margin-top: 12px; padding-top: 8px; }
  @page { margin: 8mm; size: A4 landscape; }
  @media print {
    body { background: #fff; }
    .page {
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .report-head { padding-bottom: 14px; gap: 16px; }
    .logo { width: 56px; height: 56px; padding: 4px; }
    .brand-name { font-size: 18px; }
    h1 { margin-top: 12px; font-size: 22px; }
    .subtitle { margin-top: 4px; font-size: 12px; }
    .report-top { margin: 10px 0 8px; gap: 8px; }
    .metrics { margin: 0; gap: 8px; }
    .metric { min-height: auto; padding: 8px 10px; break-inside: avoid; }
    .metric .value { margin-top: 4px; font-size: 16px; }
    .kv-grid { padding: 8px 0; gap: 8px 12px; }
    .bookings-section h2 { margin-bottom: 6px; font-size: 12px; }
    table { font-size: 11px; }
    th { padding: 7px 6px; }
    td { padding: 8px 6px; }
    .report-foot { margin-top: 10px; padding-top: 8px; font-size: 10px; }
    .panel, .metric { break-inside: avoid; }
    tr { break-inside: avoid; }
  }
`;

export const buildAdminReportDocument = ({
  title,
  subtitle,
  body,
  generatedLabel,
  compact = false,
}: AdminReportOptions) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeReportHtml(title)}</title>
      <style>${reportStyles}</style>
    </head>
    <body>
      <main class="page${compact ? " compact" : ""}">
        <header class="report-head">
          <div class="brand">
            <img class="logo" src="/logo.png" alt="Kovalam Kalari logo" />
            <div>
              <p class="eyebrow">Administrative Report</p>
              <p class="brand-name">Kovalam Kalari</p>
            </div>
          </div>
          <div class="generated muted">${escapeReportHtml(generatedLabel)}</div>
        </header>
        <h1>${escapeReportHtml(title)}</h1>
        <p class="subtitle muted">${escapeReportHtml(subtitle)}</p>
        ${body}
        <footer class="report-foot">Generated from the Kovalam Kalari booking administration system.</footer>
      </main>
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () { window.print(); }, 250);
        });
      </script>
    </body>
  </html>
`;

export const openAdminReportPdf = (options: AdminReportOptions) => {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.document.write(buildAdminReportDocument(options));
  reportWindow.document.close();
  return true;
};