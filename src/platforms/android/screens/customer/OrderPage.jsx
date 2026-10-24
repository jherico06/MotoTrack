import React from 'react';
import AndroidProfilePage from './ProfilePage.jsx';

/**
 * OrderPage (Android Native Implementation - Material Design 3)
 *
 * Dedicated Android orders screen with M3 Elevated Cards,
 * status chip pills, native ripple feedback, and tracking telemetry.
 */
export default function AndroidOrderPage(props) {
  return <AndroidProfilePage {...props} initialTab="orders" />;
}
