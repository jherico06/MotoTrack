import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';

export default function BottomNavBar({
  activeTab = 'Home',
  onTabChange = () => {},
  wishlistCount: propWishlistCount,
  currentUser: propCurrentUser,
}) {
  const auth = useAuth();
  const wishlistCtx = useWishlist();

  const user = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const count = propWishlistCount !== undefined ? propWishlistCount : (wishlistCtx?.wishlistCount || 0);

  return (
    <View style={navStyles.bottomNavWrapper}>
      {/* 1. Home */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.75}
      >
        {activeTab === 'Home' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <BootstrapIcon
          name="house-door-fill"
          size={19}
          color={activeTab === 'Home' ? '#0C6258' : '#64748b'}
        />
        <Text
          style={[
            navStyles.bottomNavLabel,
            activeTab === 'Home' && navStyles.bottomNavLabelActive,
          ]}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* 2. Garage (PMS & Customization Booking) */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Garage')}
        activeOpacity={0.75}
      >
        {activeTab === 'Garage' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <BootstrapIcon
          name="tools"
          size={18}
          color={activeTab === 'Garage' ? '#0C6258' : '#64748b'}
        />
        <Text
          style={[
            navStyles.bottomNavLabel,
            activeTab === 'Garage' && navStyles.bottomNavLabelActive,
          ]}
        >
          Garage
        </Text>
      </TouchableOpacity>

      {/* 3. Favorites / Wishlist */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Favorites')}
        activeOpacity={0.75}
      >
        {activeTab === 'Favorites' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <View style={{ position: 'relative' }}>
          <BootstrapIcon
            name="heart-fill"
            size={19}
            color={activeTab === 'Favorites' ? '#0C6258' : '#64748b'}
          />
          {count > 0 && (
            <View style={navStyles.navBadge}>
              <Text style={navStyles.navBadgeText}>
                {count > 99 ? '99+' : count}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            navStyles.bottomNavLabel,
            activeTab === 'Favorites' && navStyles.bottomNavLabelActive,
          ]}
        >
          Favorites
        </Text>
      </TouchableOpacity>

      {/* 4. Profile / Sign In */}
      <TouchableOpacity
        style={navStyles.bottomNavItem}
        onPress={() => onTabChange('Profile')}
        activeOpacity={0.75}
      >
        {activeTab === 'Profile' ? (
          <View style={navStyles.bottomNavActiveDot} />
        ) : (
          <View style={navStyles.bottomNavActiveDotHidden} />
        )}
        <BootstrapIcon
          name="person-fill"
          size={19}
          color={activeTab === 'Profile' ? '#0C6258' : '#64748b'}
        />
        <Text
          style={[
            navStyles.bottomNavLabel,
            activeTab === 'Profile' && navStyles.bottomNavLabelActive,
          ]}
        >
          {user ? 'Profile' : 'Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const navStyles = StyleSheet.create({
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    height: Platform.OS === 'ios' ? 76 : 64,
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 1000,
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    height: '100%',
  },
  bottomNavActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0C6258',
    marginBottom: 3,
  },
  bottomNavActiveDotHidden: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  bottomNavLabelActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
});
