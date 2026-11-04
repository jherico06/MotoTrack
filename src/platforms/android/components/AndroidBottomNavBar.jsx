import React from 'react';
import BottomNavBar from '../../../components/common/BottomNavBar.jsx';

/**
 * AndroidBottomNavBar (Material Design 3)
 *
 * Unified modern 4-tab bottom navigation matching Rider Dashboard standard:
 * - Home (grid)
 * - Orders (receipt with active badge)
 * - Services (tools)
 * - Account (person)
 */
export default function AndroidBottomNavBar(props) {
  return <BottomNavBar {...props} platform="android" />;
}
