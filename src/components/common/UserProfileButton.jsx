import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';

export default function UserProfileButton({ currentUser, onPress, size = 40, hideOnMobile = true }) {
  const { width: windowWidth } = useWindowDimensions();
  const [imageError, setImageError] = React.useState(false);

  // Extract avatar URI from any standard field (avatar, photoUri, photoURL, avatar_url)
  const rawAvatar =
    currentUser?.avatar ||
    currentUser?.photoUri ||
    currentUser?.photoURL ||
    currentUser?.avatar_url ||
    null;

  const avatarUri =
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0 ? rawAvatar.trim() : null;

  // Reset error state when avatar changes
  React.useEffect(() => {
    setImageError(false);
  }, [avatarUri]);

  // Hide profile button on phone / small screen sizes so profile dropdown is only accessed via the sidebar
  if (hideOnMobile && windowWidth < 768) {
    return null;
  }

  const badgeSize = Math.round(size * 0.44); // ~18px for 40px avatar
  const iconSize = Math.max(9, Math.round(badgeSize * 0.52)); // ~10px

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="User profile and navigation menu"
      dataSet={{ profileButton: true }}
      {...(Platform.OS === 'web' ? { 'data-profile-button': 'true' } : {})}
    >
      <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        {avatarUri && !imageError ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.placeholderWrap, { width: size, height: size, borderRadius: size / 2 }]}>
            <BootstrapIcon name="person-fill" size={Math.round(size * 0.65)} color="#64748B" />
          </View>
        )}
      </View>

      {/* Small overlapping dark badge with white chevron down */}
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            bottom: -1,
            right: -1,
          },
        ]}
      >
        <BootstrapIcon name="chevron-down" size={iconSize} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  avatarWrap: {
    overflow: 'hidden',
    backgroundColor: '#DDE2E8',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderWrap: {
    backgroundColor: '#DDE2E8',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    backgroundColor: '#262B34',
    borderWidth: 1.5,
    borderColor: '#1E232A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.35,
    shadowRadius: 2.5,
    elevation: 4,
  },
});
