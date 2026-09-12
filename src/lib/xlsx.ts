import ExcelJS from "exceljs";
import type { CellFormat, Sheet } from "./report";

const NUM_FMT: Record<CellFormat, string> = {
  date: "m/d/yyyy",
  time: "h:mm AM/PM",
  hours: "0.00",
  rate: "0.00",
  // Excel's built-in Accounting format: "$    68.75"
  money: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
};

const COLUMN_WIDTHS = [14, 11, 11, 9, 60];

/** Render the shared sheet layout as a real workbook with bold, outlines and number formats. */
export async function toXLSX(sheet: Sheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Timesheet");
  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  sheet.rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const x = ws.getCell(r + 1, c + 1);
      if (cell.formula) x.value = { formula: cell.formula.replace(/^=/, ""), result: cell.n };
      else x.value = cell.n ?? (cell.text === "" ? null : cell.text);
      if (cell.format && (cell.n != null || cell.formula)) x.numFmt = NUM_FMT[cell.format];
      if (cell.bold) x.font = { bold: true };
      if (cell.align) x.alignment = { horizontal: cell.align };
      if (cell.border) {
        const thin = { style: "thin" as const };
        x.border = {
          ...(cell.border.top && { top: thin }),
          ...(cell.border.bottom && { bottom: thin }),
          ...(cell.border.left && { left: thin }),
          ...(cell.border.right && { right: thin }),
        };
      }
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
