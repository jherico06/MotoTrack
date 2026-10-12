import React from 'react';
import DesktopWorkArea from '../../../components/web/layout/DesktopWorkArea.jsx';
import MechanicDashboardMobile from '../../mobile/mechanic/MechanicDashboard.jsx';

export default function MechanicDashboardWeb(props) {
  return (
    <DesktopWorkArea
      title="Mechanic"
      subtitle="Assigned bookings, inspection, estimates, and service status."
    >
      <MechanicDashboardMobile {...props} />
    </DesktopWorkArea>
  );
}
