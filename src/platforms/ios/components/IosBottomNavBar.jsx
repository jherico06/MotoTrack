import React from 'react';
import BottomNavBar from '../../../components/common/BottomNavBar.jsx';

/**
 * IosBottomNavBar (Apple Human Interface Guidelines)
 *
 * Unified modern 4-tab bottom navigation matching Rider Dashboard standard:
 * - Home (grid)
 * - Orders (receipt with active badge)
 * - Services (tools)
 * - Account (person)
 */
export default function IosBottomNavBar(props) {
  return <BottomNavBar {...props} platform="ios" />;
}
