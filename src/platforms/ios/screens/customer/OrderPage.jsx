import React from 'react';
import IosProfilePage from './ProfilePage.jsx';

/**
 * OrderPage (iOS Native Implementation - Apple Human Interface Guidelines)
 *
 * Dedicated iOS orders screen with real-time delivery telemetry,
 * map modal integration, and iOS Inset Grouped order cards.
 */
export default function IosOrderPage(props) {
  return <IosProfilePage {...props} initialTab="orders" />;
}
