import * as XLSX from 'xlsx';

/**
 * Service to export MotoTrack data into professional Microsoft Excel (.xlsx) workbooks
 */
export const excelService = {
  /**
   * Export product inventory to a professionally formatted Excel (.xlsx) file
   * @param {Array} products - List of product objects
   * @param {Object} options - Custom options (fileName, category, stats)
   */
  exportInventoryToExcel(products = [], options = {}) {
    try {
      const list = Array.isArray(products) ? products : [];
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = options.fileName || `mototrack_inventory_${timestamp}.xlsx`;

      // ─── 1. PRODUCTS & STOCK WORKSHEET ───
      const rows = list.map((p, index) => {
        const price = Number(p.price) || 0;
        const stock = Number(p.stock) || 0;
        const invValue = price * stock;

        let stockStatus = 'In Stock';
        if (stock === 0) {
          stockStatus = 'Out of Stock';
        } else if (stock < 5) {
          stockStatus = 'Low Stock Alert';
        }

        return {
          'No.': index + 1,
          'SKU / ID': p.id || `P-${index + 1}`,
          'Product Name': p.name || 'Unnamed Product',
          'Brand': p.brand || 'MotoTrack Genuine',
          'Category': p.category || 'General Parts',
          'Motorcycle Compatibility': p.compatibility || 'Universal',
          'Unit Price (PHP)': price,
          'Stock on Hand (Units)': stock,
          'Total Inventory Value (PHP)': invValue,
          'Stock Status': stockStatus,
          'Rating': p.rating ? Number(p.rating) : 5.0,
          'Total Reviews': p.reviews ? Number(p.reviews) : 0,
          'Featured Product': p.featured ? 'YES' : 'NO',
          'Product Description': p.description ? String(p.description).slice(0, 300) : '',
        };
      });

      const wsProducts = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      wsProducts['!cols'] = [
        { wch: 6 },  // No.
        { wch: 15 }, // SKU / ID
        { wch: 38 }, // Product Name
        { wch: 18 }, // Brand
        { wch: 22 }, // Category
        { wch: 25 }, // Motorcycle Compatibility
        { wch: 18 }, // Unit Price
        { wch: 22 }, // Stock on Hand
        { wch: 26 }, // Total Inventory Value
        { wch: 18 }, // Stock Status
        { wch: 10 }, // Rating
        { wch: 14 }, // Total Reviews
        { wch: 16 }, // Featured
        { wch: 45 }, // Description
      ];

      // ─── 2. INVENTORY SUMMARY & KPI SHEET ───
      const totalUnits = list.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
      const totalValue = list.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
      const inStockCount = list.filter((p) => (Number(p.stock) || 0) >= 5).length;
      const lowStockCount = list.filter((p) => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) < 5).length;
      const outOfStockCount = list.filter((p) => (Number(p.stock) || 0) === 0).length;

      // Group by Category
      const catMap = {};
      list.forEach((p) => {
        const c = p.category || 'Other';
        if (!catMap[c]) {
          catMap[c] = { count: 0, units: 0, value: 0 };
        }
        const s = Number(p.stock) || 0;
        const pr = Number(p.price) || 0;
        catMap[c].count += 1;
        catMap[c].units += s;
        catMap[c].value += s * pr;
      });

      const categoryRows = Object.keys(catMap).map((cat) => ({
        'Category Name': cat,
        'SKU Count': catMap[cat].count,
        'Total Units On Hand': catMap[cat].units,
        'Total Valuation (PHP)': catMap[cat].value,
      }));

      const summaryData = [
        { 'Metric': 'Report Generated', 'Value': new Date().toLocaleString() },
        { 'Metric': 'Total Catalogued SKUs', 'Value': list.length },
        { 'Metric': 'Total Physical Units on Hand', 'Value': totalUnits },
        { 'Metric': 'Total Inventory Valuation (PHP)', 'Value': `₱${totalValue.toLocaleString()}` },
        { 'Metric': 'In-Stock Products (Safe >= 5)', 'Value': inStockCount },
        { 'Metric': 'Low Stock Alert (< 5 units)', 'Value': lowStockCount },
        { 'Metric': 'Out of Stock SKUs (0 units)', 'Value': outOfStockCount },
        { 'Metric': '', 'Value': '' },
        { 'Metric': '--- CATEGORY BREAKDOWN ---', 'Value': '------------------------' },
      ];

      categoryRows.forEach((c) => {
        summaryData.push({
          'Metric': `${c['Category Name']} (${c['SKU Count']} items)`,
          'Value': `${c['Total Units On Hand']} units — ₱${c['Total Valuation (PHP)'].toLocaleString()}`,
        });
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 40 }];

      // ─── 3. CREATE WORKBOOK & SAVE ───
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Inventory Items');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Stock Summary & KPIs');

      return this._downloadWorkbook(wb, fileName);
    } catch (err) {
      console.error('[ExcelService] Failed to export inventory:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Helper to write workbook and trigger download on Web/Client
   */
  _downloadWorkbook(workbook, fileName) {
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } catch (_e) {}
        }, 1000);

        return { success: true, fileName };
      }

      return { success: true, fileName, note: 'Non-browser runtime' };
    } catch (e) {
      console.warn('[ExcelService] Download trigger failed:', e);
      return { success: false, error: e.message };
    }
  },
};
