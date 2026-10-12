import React from 'react';
import DesktopWorkArea from '../../../components/web/layout/DesktopWorkArea.jsx';
import RiderDashboardMobile from '../../mobile/rider/RiderDashboard.jsx';

export default function RiderDashboardWeb(props) {
  return (
    <DesktopWorkArea
      title="Rider"
      subtitle="Assigned deliveries, QR confirmation, and route status."
    >
      <RiderDashboardMobile {...props} />
    </DesktopWorkArea>
  );
}
