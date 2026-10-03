import React from 'react';
import ProfilePage from './ProfilePage';

/**
 * OrderPage
 * Standalone order page has been unified into the Customer Dashboard.
 * Delegates directly to ProfilePage with initialTab="orders".
 */
export default function OrderPage(props) {
  return <ProfilePage {...props} initialTab="orders" />;
}
