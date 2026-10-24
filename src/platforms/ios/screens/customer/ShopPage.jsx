import React from 'react';
import BaseShopPage from '../../../../screens/mobile/customer/ShopPage.jsx';

/**
 * ShopPage (iOS Native Platform Screen)
 *
 * Preserves the exact MobileHeader, sticky charcoal background (#24272B),
 * transparent bordered search bar, white header action icons, and 
 * aligned category/compatibility filter chips as designed.
 */
export default function IosShopPage(props) {
  return <BaseShopPage {...props} platform="ios" />;
}
