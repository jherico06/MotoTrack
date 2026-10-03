import React from 'react';
import ProfilePage from './ProfilePage.web';

/**
 * OrderPageWeb
 * Redundant standalone order page has been unified into the modern Customer Dashboard.
 * Delegates directly to ProfilePage with initialTab="orders".
 */
export default function OrderPageWeb(props) {
  return <ProfilePage {...props} initialTab="orders" />;
}
