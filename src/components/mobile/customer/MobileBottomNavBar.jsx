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

function AnimatedNavTab({ tab, active, animateOnMount, activationSeq, isCompact, onPress }) {
  const animateMountRef = useRef(animateOnMount);
  const didMountRef = useRef(false);
  const enterAnim = useRef(new Animated.Value(active && animateMountRef.current ? 0 : 1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isMount = !didMountRef.current;
    didMountRef.current = true;
    if (!active) {
      enterAnim.setValue(0);
      return;
    }
    if (!isMount || animateMountRef.current) {
      enterAnim.setValue(0);
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 165,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      enterAnim.setValue(1);
    }
  }, [active, activationSeq, enterAnim]);

  const handlePressIn = () => {
    Animated.timing(pressScale, {
      toValue: 0.95,
      duration: 60,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressScale, {
      toValue: 1,
      duration: 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const pillOpacity = enterAnim;
  const pillScale = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const labelTranslateX = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={4}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Animated.View
        style={[
          styles.tabButton,
          active
            ? { paddingHorizontal: isCompact ? 11 : 14 }
            : { paddingHorizontal: isCompact ? 6 : 9 },
          { transform: [{ scale: pressScale }] },
        ]}
      >
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePillBg,
              {
                opacity: pillOpacity,
                transform: [{ scale: pillScale }],
              },
            ]}
          />
        ) : null}
        <BootstrapIcon
          name={active ? tab.activeIcon || tab.icon : tab.icon}
          size={active ? (isCompact ? 16 : 18) : (isCompact ? 18 : 19)}
          color={active ? '#FFFFFF' : '#E2E8F0'}
        />
        {active ? (
          <Animated.View
            style={[
              styles.labelWrap,
              {
                opacity: enterAnim,
                transform: [{ translateX: labelTranslateX }],
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.activeLabel,
                { fontSize: isCompact ? 11.5 : 12.5 },
              ]}
            >
              {tab.label}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * MobileBottomNavBar
 *
 * Floating charcoal pill bottom navigation bar.
 * - Active tab expands into a raised charcoal-slate inner pill with filled white icon + label.
 * - Inactive tabs show clean outline white/silver icons with no cluttered badges or numbers.
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
  const isOrdersActive = activeTab === 'Orders' || activeTab === 'orders';
  const isMoreActive =
    activeTab === 'More' ||
    activeTab === 'more' ||
    activeTab === 'menu' ||
    activeTab === 'Menu' ||
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
        activeIcon: 'wrench-adjustable',
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
        id: 'Orders',
        label: 'Orders',
        icon: 'box-seam',
        activeIcon: 'box-seam-fill',
        isActive: isOrdersActive,
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
    isOrdersActive,
    isMoreActive,
  ]);

  const initialPrevTabRef = useRef(previousGlobalNavTabId);
  const propActiveId = customerTabs.find((tab) => tab.isActive)?.id || activeTab;
  const [optimisticTabId, setOptimisticTabId] = useState(null);
  const [activationSeq, setActivationSeq] = useState(0);
  const optimisticTimerRef = useRef(null);

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
    };
  }, []);

  const displayActiveId = optimisticTabId || propActiveId;
  const animateOnMount =
    Boolean(initialPrevTabRef.current) && initialPrevTabRef.current !== propActiveId;

  const handleTabPress = (tabId) => {
    if (tabId !== displayActiveId) {
      setOptimisticTabId(tabId);
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current);
      }
      optimisticTimerRef.current = setTimeout(() => {
        setOptimisticTabId(null);
      }, 380);
      notifyTabActivated(tabId);
    }
    onTabChange(tabId);
  };

  return (
    <View pointerEvents="box-none" style={styles.outerWrap}>
      <View style={styles.pillContainer}>
        {customerTabs.map((tab) => {
          const active = tab.id === displayActiveId || (!optimisticTabId && Boolean(tab.isActive));
          return (
            <AnimatedNavTab
              key={tab.id}
              tab={tab}
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
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 18 : Math.max(12, ANDROID_BOTTOM_INSET + 6),
    alignItems: 'center',
    zIndex: 100,
  },
  pillContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#1C1F24',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 26px rgba(15, 23, 42, 0.24)' }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.24,
          shadowRadius: 16,
          elevation: 12,
        }),
  },
  tabButton: {
    position: 'relative',
    minHeight: 40,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePillBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#31353E',
    borderRadius: 999,
  },
  labelWrap: {
    marginLeft: 6,
    justifyContent: 'center',
  },
  activeLabel: {
    fontFamily:
      Platform.OS === 'web'
        ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        : undefined,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
