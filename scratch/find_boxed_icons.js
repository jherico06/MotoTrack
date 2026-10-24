const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('BootstrapIcon') || lines[i].includes('MaterialCommunityIcons') || lines[i].includes('Feather')) {
      const start = Math.max(0, i - 12);
      const slice = lines.slice(start, i + 1).join('\n');
      if (
        slice.includes('<View') &&
        (slice.includes('borderWidth') || slice.includes('borderColor')) &&
        slice.includes('backgroundColor') &&
        slice.includes('borderRadius') &&
        !slice.includes('TouchableOpacity') // exclude clickable buttons like close modal button or pill tab
      ) {
        console.log(`=== ${filePath}:${i + 1} ===`);
        console.log(lines.slice(start, i + 2).join('\n'));
      }
    }
  }
}

const targets = [
  'src/screens/web/admin/AdminDashboard.jsx',
  'src/components/admin/ModernOverviewDashboard.jsx',
  'src/components/admin/AdminSystemSettingsPanel.jsx',
  'src/components/admin/AdminProfileLogsPanel.jsx',
  'src/components/admin/AdminBookingDetailsPanel.jsx',
  'src/components/admin/AdminBookingManager.jsx',
  'src/components/admin/AdminSidebar.jsx',
  'src/components/admin/SalesAnalyticsPanel.jsx',
  'src/components/admin/SalesForecastPanel.jsx',
  'src/components/admin/PromosAdminPanel.jsx',
  'src/components/admin/CustomizationsAdminPanel.jsx',
  'src/components/admin/MotorcycleModelsAdminPanel.jsx',
  'src/components/admin/ServiceQuotationPanel.jsx',
  'src/components/admin/DashboardInsightsPanel.jsx',
  'src/components/admin/RevenueTrendChart.jsx',
  'src/components/admin/BookingCategoryPieChart.jsx',
];

for (const t of targets) {
  if (fs.existsSync(t)) {
    scanFile(t);
  }
}
