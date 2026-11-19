import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import { ANDROID_BOTTOM_INSET } from '../../../utils/safeArea.js';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Track active tab transitions globally so both cached layers and newly mounted screens animate consistently.
let currentGlobalNavTabId = null;
let previousGlobalNavTabId = null;
const navActivationListeners = new Set();

function notifyTabActivated(tabId) {
  if (!tabId) return;
  if (tabId !== currentGlobalNavTabId) {
    previousGlobalNavTabId = currentGlobalNavTabId;
    currentGlobalNavTabId = tabId;
  }
  navActivationListeners.forEach((listener) => {
    try {
      listener(tabId);
    } catch (_e) {}
  });
}

function AnimatedNavTab({
  tab,
  tabIndex,
  prevTabIndex,
  slotWidth,
  active,
  animateOnMount,
  activationSeq,
  isCompact,
  onPress,
}) {
  const animateMountRef = useRef(animateOnMount);
  const didMountRef = useRef(false);
  const enterAnim = useRef(new Animated.Value(active && animateMountRef.current ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevTabIndexRef = useRef(prevTabIndex);
  prevTabIndexRef.current = prevTabIndex;

  useEffect(() => {
    const isMount = !didMountRef.current;
    didMountRef.current = true;
    if (!active) {
      enterAnim.setValue(0);
      slideAnim.setValue(0);
      return;
    }
    if (!isMount || animateMountRef.current) {
      const fromIdx = prevTabIndexRef.current;
      const rawOffset =
        fromIdx >= 0 && fromIdx !== tabIndex ? (fromIdx - tabIndex) * slotWidth : 0;
      const clampedOffset = Math.max(-slotWidth * 2.2, Math.min(slotWidth * 2.2, rawOffset));

      enterAnim.setValue(0);
      slideAnim.setValue(clampedOffset);

      Animated.parallel([
        Animated.timing(enterAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 210,
          friction: 22,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      enterAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [active, activationSeq, tabIndex, slotWidth, enterAnim, slideAnim]);

  const iconSize = isCompact ? 18 : 20;
  const labelFontSize = isCompact ? 9.5 : 10;
  const badgeCount = Number(tab.badge) || 0;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={styles.tabPressable}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badgeCount > 0 ? `${tab.label}, ${badgeCount}` : tab.label}
    >
      <View style={styles.tabButton}>
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeTopBar,
              {
                opacity: enterAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        ) : null}
        <View style={styles.iconBox}>
          <BootstrapIcon
            name={active ? tab.activeIcon || tab.icon : tab.icon}
            size={iconSize}
            color={active ? '#F97316' : '#94A3B8'}
          />
          {badgeCount > 0 ? (
            <View style={styles.iconBadge}>
              <Text allowFontScaling={false} style={styles.iconBadgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.tabLabel,
            { fontSize: labelFontSize, lineHeight: 13 },
            active ? styles.activeLabel : styles.inactiveLabel,
          ]}
        >
          {tab.label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * MobileBottomNavBar
 *
 * Docked charcoal bottom navigation bar with subtle top-left and top-right corner radius.
 * - Static page titles sit below every icon across equal-width columns.
 * - Active tab highlights both the filled icon and title in Racing Orange with a sliding top bar.
 */
export default function MobileBottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  tabs: propTabs,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  const isShopActive =
    activeTab === 'Home' || activeTab === 'home' || activeTab === 'Shop' || activeTab === 'shop';
  const isServicesActive =
    activeTab === 'Services' ||
    activeTab === 'services' ||
    activeTab === 'Pitstop' ||
    activeTab === 'pitstop';
  const isCustomizeActive =
    activeTab === 'Customize' ||
    activeTab === 'customize' ||
    activeTab === 'customizer' ||
    activeTab === 'Customizer';
  const isGarageActive =
    activeTab === 'Garage' ||
    activeTab === 'garage' ||
    activeTab === 'MyGarage' ||
    activeTab === 'Fleet';
  const isMoreActive =
    activeTab === 'More' ||
    activeTab === 'more' ||
    activeTab === 'menu' ||
    activeTab === 'Menu' ||
    activeTab === 'Orders' ||
    activeTab === 'orders' ||
    activeTab === 'Dashboard' ||
    activeTab === 'dashboard' ||
    activeTab === 'Profile' ||
    activeTab === 'profile' ||
    activeTab === 'Account' ||
    activeTab === 'account';

  const customerTabs = useMemo(() => {
    if (Array.isArray(propTabs) && propTabs.length > 0) {
      return propTabs;
    }
    return [
      {
        id: 'Home',
        label: 'Shop',
        icon: 'house',
        activeIcon: 'house-fill',
        isActive: isShopActive,
      },
      {
        id: 'Services',
        label: 'Services',
        icon: 'tools',
        activeIcon: 'tools',
        isActive: isServicesActive,
      },
      {
        id: 'Customize',
        label: 'Customizer',
        icon: 'magic',
        activeIcon: 'magic',
        isActive: isCustomizeActive,
      },
      {
        id: 'Garage',
        label: 'Garage',
        icon: 'motorcycle-fill',
        activeIcon: 'motorcycle-fill',
        isActive: isGarageActive,
      },
      {
        id: 'More',
        label: 'More',
        icon: 'list',
        activeIcon: 'list',
        isActive: isMoreActive,
      },
    ];
  }, [
    propTabs,
    isShopActive,
    isServicesActive,
    isCustomizeActive,
    isGarageActive,
    isMoreActive,
  ]);

  const initialPrevTabRef = useRef(previousGlobalNavTabId);
  const propActiveId = customerTabs.find((tab) => tab.isActive)?.id || activeTab;
  const [optimisticTabId, setOptimisticTabId] = useState(null);
  const [activationSeq, setActivationSeq] = useState(0);
  const [barWidth, setBarWidth] = useState(() => Math.min(Math.max(width - 20, 280), 540));
  const optimisticTimerRef = useRef(null);
  const navSwitchRafRef = useRef(null);

  useEffect(() => {
    setOptimisticTabId(null);
    if (!currentGlobalNavTabId) {
      currentGlobalNavTabId = propActiveId;
    } else if (propActiveId !== currentGlobalNavTabId) {
      previousGlobalNavTabId = currentGlobalNavTabId;
      currentGlobalNavTabId = propActiveId;
    }
  }, [propActiveId]);

  useEffect(() => {
    let rafId = null;
    const handleActivated = (activatedId) => {
      if (activatedId === propActiveId) {
        if (optimisticTimerRef.current) {
          clearTimeout(optimisticTimerRef.current);
          optimisticTimerRef.current = null;
        }
        setOptimisticTabId(null);
        if (typeof requestAnimationFrame === 'function') {
          if (rafId != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(rafId);
          }
          rafId = requestAnimationFrame(() => {
            setActivationSeq((seq) => seq + 1);
          });
        } else {
          setActivationSeq((seq) => seq + 1);
        }
      }
    };
    navActivationListeners.add(handleActivated);
    return () => {
      navActivationListeners.delete(handleActivated);
      if (rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [propActiveId]);

  useEffect(() => {
    return () => {
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current);
      }
      if (navSwitchRafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(navSwitchRafRef.current);
      }
    };
  }, []);

  const displayActiveId = optimisticTabId || propActiveId;
  const animateOnMount =
    Boolean(initialPrevTabRef.current) && initialPrevTabRef.current !== propActiveId;

  const handleTabPress = (tabId) => {
    if (tabId === displayActiveId) {
      onTabChange(tabId);
      return;
    }

    setOptimisticTabId(tabId);
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
    }
    optimisticTimerRef.current = setTimeout(() => {
      setOptimisticTabId(null);
    }, 220);
    notifyTabActivated(tabId);

    // Yield one frame on native so press/pill visual feedback commits before mounting heavy screens.
    if (Platform.OS !== 'web' && typeof requestAnimationFrame === 'function') {
      if (navSwitchRafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(navSwitchRafRef.current);
      }
      navSwitchRafRef.current = requestAnimationFrame(() => {
        navSwitchRafRef.current = null;
        onTabChange(tabId);
      });
    } else {
      onTabChange(tabId);
    }
  };

  const prevId = previousGlobalNavTabId || initialPrevTabRef.current;
  const prevTabIndex = prevId ? customerTabs.findIndex((t) => t.id === prevId) : -1;
  const slotWidth = barWidth / Math.max(1, customerTabs.length);

  return (
    <View pointerEvents="box-none" style={styles.outerWrap}>
      <View style={styles.dockedBar}>
        <View
          style={styles.pillContainer}
          onLayout={(e) => {
            const measured = e?.nativeEvent?.layout?.width;
            if (measured && Math.abs(measured - barWidth) > 2) {
              setBarWidth(measured);
            }
          }}
        >
          {customerTabs.map((tab, idx) => {
            const active = tab.id === displayActiveId || (!optimisticTabId && Boolean(tab.isActive));
            return (
              <AnimatedNavTab
                key={tab.id}
                tab={tab}
                tabIndex={idx}
                prevTabIndex={prevTabIndex}
                slotWidth={slotWidth}
                active={active}
                animateOnMount={animateOnMount}
                activationSeq={activationSeq}
                isCompact={isCompact}
                onPress={() => handleTabPress(tab.id)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dockedBar: {
    width: '100%',
    backgroundColor: '#24272B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#32373E',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : Math.max(12, ANDROID_BOTTOM_INSET + 4),
    paddingHorizontal: 4,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -6px 20px rgba(15, 23, 42, 0.22)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 14,
        }),
  },
  pillContainer: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPressable: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    width: '100%',
    position: 'relative',
    minHeight: 46,
    paddingVertical: 4,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3.5,
    backgroundColor: '#EA580C',
    borderWidth: 1.5,
    borderColor: '#24272B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: {
    ...(Platform.OS === 'web'
      ? {
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontWeight: '700',
        }
      : { fontFamily: 'GoogleSansFlex-Bold' }),
    fontSize: 9.5,
    lineHeight: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  activeTopBar: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 30,
    height: 2.5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#F97316',
  },
  tabLabel: {
    fontFamily:
      Platform.OS === 'web'
        ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        : undefined,
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  activeLabel: {
    color: '#F97316',
  },
  inactiveLabel: {
    color: '#94A3B8',
  },
});
