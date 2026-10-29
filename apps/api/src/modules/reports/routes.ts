import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { report, reportContext } from './service.js';
import { asyncRoute } from '../../shared/helpers/http.js';
import { z } from 'zod';
export const reportRouter = Router();
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
reportRouter.get(
  '/:name',
  asyncRoute(async (req, res) => {
    const { page, limit } = paging.parse(req.query);
    res.json({
      success: true,
      data: await report(req.user, req.params.name, req.query, page, limit),
    });
  }),
);
const safeCell = (v: unknown) => {
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
reportRouter.get(
  '/:name/export/:format',
  asyncRoute(async (req, res) => {
    const format = z.enum(['csv', 'xlsx', 'pdf']).parse(req.params.format);
    const ctx = await reportContext(req.user, req.params.name, req.query);
    const summary = await report(req.user, req.params.name, req.query, 1, 1);
    const cursor = ctx.repo.model
      .aggregate([
        ...ctx.stages,
        { $sort: { createdAt: -1, _id: 1 } },
        { $project: { tenantId: 0, deletedAt: 0, __v: 0 } },
      ])
      .cursor({ batchSize: 200 });
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.params.name}-${ctx.from}-${ctx.to}.${format}"`,
    );
    const first = await cursor.next();
    const columns = first ? Object.keys(first) : ['message'];
    if (format === 'csv') {
      res.type('text/csv');
      const row = (values: unknown[]) =>
        values.map((v) => `"${safeCell(v).replaceAll('"', '""')}"`).join(',') + '\r\n';
      const write = async (s: string) => {
        if (!res.write(s)) await new Promise<void>((resolve) => res.once('drain', resolve));
      };
      await write(row(columns));
      if (first) await write(row(columns.map((k) => first[k])));
      try {
        for await (const doc of cursor) {
          if (res.destroyed) break;
          await write(row(columns.map((k) => doc[k])));
        }
        await write(row(['Totals (paise)', JSON.stringify(summary.totals)]));
        if (summary.summary)
          await write(row(['Financial summary (paise)', JSON.stringify(summary.summary)]));
        res.end();
      } finally {
        await cursor.close();
      }
    } else if (format === 'xlsx') {
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const book = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
      const sheet = book.addWorksheet('Report');
      sheet.columns = columns.map((k) => ({ header: k, key: k, width: 24 }));
      if (first) sheet.addRow(columns.map((k) => safeCell(first[k]))).commit();
      try {
        for await (const doc of cursor) {
          if (res.destroyed) break;
          sheet.addRow(columns.map((k) => safeCell(doc[k]))).commit();
        }
        const totals = book.addWorksheet('Totals');
        totals.addRow(['All amounts in integer paise', ctx.from, ctx.to]).commit();
        for (const [k, v] of Object.entries({ ...summary.totals, ...(summary.summary ?? {}) }))
          if (k !== '_id') totals.addRow([k, String(v)]).commit();
        sheet.commit();
        totals.commit();
        await book.commit();
      } finally {
        await cursor.close();
      }
    } else {
      res.type('application/pdf');
      const pdf = new PDFDocument({ margin: 35, size: 'A4' });
      pdf.pipe(res);
      pdf.fontSize(18).text(`Annapurna · ${req.params.name}`);
      pdf.fontSize(9).text(`${ctx.from} to ${ctx.to} | Money shown in integer paise`);
      const draw = (doc: Record<string, unknown>) => {
        if (pdf.y > 700) pdf.addPage();
        pdf
          .moveDown()
          .fontSize(8)
          .text(columns.map((k) => `${k}: ${String(doc[k] ?? '')}`).join(' | '));
      };
      if (first) draw(first);
      try {
        for await (const doc of cursor) {
          if (res.destroyed) break;
          draw(doc);
        }
        pdf.moveDown().text(`Totals: ${JSON.stringify(summary.totals)}`);
        if (summary.summary) pdf.text(`Summary: ${JSON.stringify(summary.summary)}`);
        pdf.end();
      } finally {
        await cursor.close();
      }
    }
  }),
);
