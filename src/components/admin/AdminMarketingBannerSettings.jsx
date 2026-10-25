import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { fontFamily } from '../../styles/typography.js';
import { marketingBannerService } from '../../services/marketing/marketingBannerService.js';
import { auditLogService } from '../../services/system/auditLogService.js';

export default function AdminMarketingBannerSettings({
  isDarkMode = false,
  tokens = {},
  showToast = () => {},
  isDesktop = true,
}) {
  const [bannerData, setBannerData] = useState(() => marketingBannerService.getBanner());
  const [form, setForm] = useState({
    title: bannerData.title || '',
    subtitle: bannerData.subtitle || '',
    description: bannerData.description || '',
    image: bannerData.image || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'
  const [imageInputMode, setImageInputMode] = useState('file'); // 'file' | 'url'

  // Sync state when marketingBannerService changes
  useEffect(() => {
    const unsub = marketingBannerService.subscribe((updated) => {
      setBannerData(updated);
    });
    return unsub;
  }, []);

  // Fetch initial fresh data from DB
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    marketingBannerService
      .fetchBanner()
      .then((res) => {
        if (isMounted && res.banner) {
          setBannerData(res.banner);
          setForm({
            title: res.banner.title || '',
            subtitle: res.banner.subtitle || '',
            description: res.banner.description || '',
            image: res.banner.image || '',
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp,image/gif';
        input.style.display = 'none';

        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          // Check file size (max 8MB)
          if (file.size > 8 * 1024 * 1024) {
            showToast('⚠️ Image must be 8MB or smaller.');
            return;
          }

          setIsUploadingImage(true);
          showToast('Uploading hero banner image...');

          const reader = new FileReader();
          reader.onload = async () => {
            const dataUri = reader.result;
            try {
              // Upload to persistent Supabase storage via marketingBannerService
              const res = await marketingBannerService.uploadBannerImage(file || dataUri);
              if (res.success && res.url) {
                handleChange('image', res.url);
                showToast('✓ Banner image uploaded to storage successfully!');
              } else {
                // Keep local preview if upload endpoint had network issue
                handleChange('image', dataUri);
                showToast('⚠️ Storage upload warning: ' + (res.error || 'Preview loaded locally.'));
              }
            } catch (err) {
              handleChange('image', dataUri);
              showToast('⚠️ Upload error: ' + err.message);
            } finally {
              setIsUploadingImage(false);
            }
          };

          reader.onerror = () => {
            setIsUploadingImage(false);
            showToast('⚠️ Failed to read selected image file.');
          };

          reader.readAsDataURL(file);
        };

        document.body.appendChild(input);
        input.click();
        setTimeout(() => {
          try {
            document.body.removeChild(input);
          } catch (_e) {}
        }, 3000);
      } catch (err) {
        showToast('⚠️ File selection error: ' + err.message);
      }
    } else {
      showToast('⚠️ Direct file picker is available on web.');
    }
  };

  const handleResetToSaved = () => {
    setForm({
      title: bannerData.title || '',
      subtitle: bannerData.subtitle || '',
      description: bannerData.description || '',
      image: bannerData.image || '',
    });
    showToast('Changes discarded; restored to current saved banner.');
  };

  const handleSaveBanner = async () => {
    const cleanTitle = form.title.trim();
    const cleanSubtitle = form.subtitle.trim();
    const cleanDesc = form.description.trim();
    const cleanImage = form.image.trim();

    // Validation
    if (!cleanTitle) {
      showToast('⚠️ Title is required.');
      return;
    }
    if (cleanTitle.length > 250) {
      showToast('⚠️ Title cannot exceed 250 characters.');
      return;
    }
    if (!cleanSubtitle) {
      showToast('⚠️ Subtitle is required.');
      return;
    }
    if (cleanSubtitle.length > 250) {
      showToast('⚠️ Subtitle cannot exceed 250 characters.');
      return;
    }
    if (!cleanDesc) {
      showToast('⚠️ Description is required.');
      return;
    }
    if (cleanDesc.length > 1500) {
      showToast('⚠️ Description cannot exceed 1500 characters.');
      return;
    }
    if (!cleanImage) {
      showToast('⚠️ Banner image URL or file is required.');
      return;
    }

    setIsSaving(true);

    try {
      // Exactly the 5 fields: id, title, subtitle, description, image
      const res = await marketingBannerService.updateBanner({
        id: bannerData.id || 'hero-main',
        title: cleanTitle,
        subtitle: cleanSubtitle,
        description: cleanDesc,
        image: cleanImage,
      });

      if (res.success) {
        setBannerData(res.banner);
        setForm({
          title: res.banner.title,
          subtitle: res.banner.subtitle,
          description: res.banner.description,
          image: res.banner.image,
        });

        try {
          auditLogService.logSystemAction({
            action: 'MARKETING_BANNER_UPDATED',
            target: 'marketing_banners',
            details: `Admin updated marketing hero banner title: "${cleanTitle}"`,
            severity: 'INFO',
            metadata: { title: cleanTitle, subtitle: cleanSubtitle },
          });
        } catch (_e) {}

        showToast('✓ Marketing Banner saved successfully and published to landing page!');
      } else {
        showToast('⚠️ Failed to save banner: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      showToast('⚠️ Failed to save banner: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedChanges =
    form.title !== (bannerData.title || '') ||
    form.subtitle !== (bannerData.subtitle || '') ||
    form.description !== (bannerData.description || '') ||
    form.image !== (bannerData.image || '');

  const textColor = isDarkMode ? tokens.textPrimary || '#F1F5F9' : '#0F172A';
  const textMuted = isDarkMode ? tokens.textMuted || '#94A3B8' : '#64748B';
  const cardBg = isDarkMode ? tokens.bgCard || '#171C22' : '#FFFFFF';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
  const inputBg = isDarkMode ? '#11151A' : '#F8FAFC';
  const inputBorder = isDarkMode ? '#2D3748' : '#CBD5E1';

  return (
    <View style={{ gap: 24 }}>
      {/* ─── 1. Header Card ─── */}
      <View
        style={{
          backgroundColor: cardBg,
          padding: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 90, 10, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="image" size={22} color="#FF5A0A" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: textColor,
                    letterSpacing: -0.3,
                    fontFamily: fontFamily.sans,
                  }}
                >
                  Marketing Banner Management
                </Text>
                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#FF5A0A' }}>
                    Landing Page Hero
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: textMuted,
                  marginTop: 2,
                  fontFamily: fontFamily.sans,
                }}
              >
                Customize the headline, subtitle, promotional description, and background image displayed on the public storefront.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {hasUnsavedChanges && (
              <TouchableOpacity
                onPress={handleResetToSaved}
                disabled={isSaving}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#222933' : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#333D4B' : '#E2E8F0',
                  cursor: 'pointer',
                }}
              >
                <BootstrapIcon name="arrow-counterclockwise" size={14} color={textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: textMuted }}>
                  Discard
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSaveBanner}
              disabled={isSaving}
              activeOpacity={0.88}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: '#FF5A0A',
                boxShadow: '0 4px 14px rgba(255, 90, 10, 0.35)',
                cursor: 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BootstrapIcon name="check-circle" size={15} color="#FFFFFF" />
              )}
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '800',
                  color: '#FFFFFF',
                  fontFamily: fontFamily.sans,
                }}
              >
                {isSaving ? 'Publishing...' : 'Save & Publish Banner'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── 2. Live Storefront Preview Section (Required by prompt: preview before saving) ─── */}
      <View
        style={{
          backgroundColor: cardBg,
          padding: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          gap: 16,
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 90, 10, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="eye" size={16} color="#FF5A0A" />
            </View>
            <View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: textColor,
                  fontFamily: fontFamily.sans,
                }}
              >
                Live Storefront Preview
              </Text>
              <Text style={{ fontSize: 12, color: textMuted, fontFamily: fontFamily.sans }}>
                Real-time visual rendering of how your changes look on the customer landing page.
              </Text>
            </View>
          </View>

          {/* Device viewport toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDarkMode ? '#11151A' : '#F1F5F9',
              borderRadius: 8,
              padding: 3,
              gap: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => setPreviewDevice('desktop')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: previewDevice === 'desktop' ? '#FF5A0A' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <BootstrapIcon
                name="display"
                size={13}
                color={previewDevice === 'desktop' ? '#FFFFFF' : textMuted}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: previewDevice === 'desktop' ? '#FFFFFF' : textMuted,
                }}
              >
                Desktop
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPreviewDevice('mobile')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: previewDevice === 'mobile' ? '#FF5A0A' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <BootstrapIcon
                name="phone"
                size={13}
                color={previewDevice === 'mobile' ? '#FFFFFF' : textMuted}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: previewDevice === 'mobile' ? '#FFFFFF' : textMuted,
                }}
              >
                Mobile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* The Live Render Card */}
        <View
          style={{
            width: previewDevice === 'mobile' ? 380 : '100%',
            maxWidth: '100%',
            alignSelf: 'center',
            backgroundColor: '#171C22',
            borderRadius: 18,
            overflow: 'hidden',
            position: 'relative',
            minHeight: previewDevice === 'mobile' ? 380 : 340,
            borderWidth: 1,
            borderColor: '#26313B',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Background Image */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: previewDevice === 'desktop' ? '40%' : 0,
              opacity: previewDevice === 'mobile' ? 0.35 : 0.95,
              zIndex: 1,
            }}
          >
            {form.image ? (
              <Image
                source={{ uri: form.image }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#1E252D',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="image" size={48} color="#475569" />
              </View>
            )}

            {/* Gradient Overlay for text contrast */}
            {Platform.OS === 'web' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    previewDevice === 'desktop'
                      ? 'linear-gradient(90deg, #171C22 0%, #171C22 18%, rgba(23, 28, 34, 0.92) 40%, rgba(23, 28, 34, 0.3) 75%, rgba(23, 28, 34, 0) 100%)'
                      : 'linear-gradient(180deg, rgba(23, 28, 34, 0.95) 0%, rgba(23, 28, 34, 0.8) 50%, #171C22 100%)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </View>

          {/* Top-Right Tagline Badge (Desktop only) */}
          {previewDevice === 'desktop' && form.subtitle && (
            <View
              style={{
                position: 'absolute',
                top: 20,
                right: 24,
                zIndex: 3,
                alignItems: 'flex-end',
                pointerEvents: 'none',
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                {form.subtitle.split(/\s+/).slice(0, 4).map((w, i) => (
                  <Text
                    key={i}
                    style={{
                      color: i % 2 === 0 ? '#FF5A0A' : '#FFFFFF',
                      fontSize: 11,
                      fontWeight: '900',
                      letterSpacing: 2,
                      fontFamily: fontFamily.sans,
                      textTransform: 'uppercase',
                    }}
                  >
                    {w}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Left Content Area */}
          <View
            style={{
              position: 'relative',
              zIndex: 2,
              padding: previewDevice === 'desktop' ? 32 : 20,
              maxWidth: previewDevice === 'desktop' ? 560 : '100%',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: previewDevice === 'mobile' ? 380 : 340,
            }}
          >
            <View>
              {/* Eyebrow / Subtitle badge */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: '#FF5A0A',
                    fontSize: 11,
                    fontWeight: '900',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontFamily: fontFamily.sans,
                  }}
                >
                  {form.subtitle || 'MOTOTRACK'}
                </Text>
              </View>

              {/* Title */}
              <Text
                style={{
                  fontSize: previewDevice === 'desktop' ? 32 : 24,
                  fontWeight: '900',
                  color: '#FFFFFF',
                  lineHeight: previewDevice === 'desktop' ? 38 : 30,
                  letterSpacing: -0.6,
                  fontFamily: fontFamily.sans,
                  marginBottom: 12,
                }}
              >
                {form.title ? (
                  form.title.includes('\n') ? (
                    form.title.split('\n').map((part, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && '\n'}
                        <Text style={{ color: idx === 1 ? '#FF5A0A' : '#FFFFFF' }}>{part}</Text>
                      </React.Fragment>
                    ))
                  ) : (
                    form.title
                  )
                ) : (
                  <Text style={{ color: '#94A3B8' }}>Enter Banner Title</Text>
                )}
              </Text>

              {/* Description */}
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  color: '#CBD5E1',
                  fontFamily: fontFamily.sans,
                  marginBottom: 20,
                  maxWidth: 440,
                }}
              >
                {form.description || 'Enter marketing description displayed below the heading.'}
              </Text>

              {/* Buttons mockup */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    backgroundColor: '#FF5A0A',
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <BootstrapIcon name="cart3" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                    Shop Parts
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <BootstrapIcon name="tools" size={12} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>
                    Book a Service
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom trust indicators mockup */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.1)',
                marginTop: 14,
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 10.5, fontWeight: '600' }}>
                ✓ Fast & Reliable Shipping
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 10.5, fontWeight: '600' }}>
                ✓ Genuine Parts & Brands
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── 3. Banner Editor Form (Strictly 4 fields: Title, Subtitle, Description, Image; id system-managed) ─── */}
      <View
        style={{
          backgroundColor: cardBg,
          padding: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          gap: 20,
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 90, 10, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name="pencil-square" size={16} color="#FF5A0A" />
          </View>
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '800',
                color: textColor,
                fontFamily: fontFamily.sans,
              }}
            >
              Banner Fields Editor
            </Text>
            <Text style={{ fontSize: 12, color: textMuted, fontFamily: fontFamily.sans }}>
              Edit the marketing banner contents. Changes update live in the preview above and take effect upon saving.
            </Text>
          </View>
        </View>

        {/* Field 1: Banner Title */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, fontFamily: fontFamily.sans }}>
              1. Banner Title <Text style={{ color: '#FF5A0A' }}>*</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              {form.title.length}/250 characters
            </Text>
          </View>
          <TextInput
            value={form.title}
            onChangeText={(val) => handleChange('title', val)}
            placeholder="e.g. Everything Your Ride Needs"
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            maxLength={250}
            style={{
              backgroundColor: inputBg,
              borderWidth: 1,
              borderColor: inputBorder,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: textColor,
              fontFamily: fontFamily.sans,
            }}
          />
          <Text style={{ fontSize: 11, color: textMuted }}>
            Tip: Use a line break (Enter) if you want the second line to stand out in the hero headline.
          </Text>
        </View>

        {/* Field 2: Banner Subtitle */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, fontFamily: fontFamily.sans }}>
              2. Banner Subtitle <Text style={{ color: '#FF5A0A' }}>*</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              {form.subtitle.length}/250 characters
            </Text>
          </View>
          <TextInput
            value={form.subtitle}
            onChangeText={(val) => handleChange('subtitle', val)}
            placeholder="e.g. Ride More Worry Less"
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            maxLength={250}
            style={{
              backgroundColor: inputBg,
              borderWidth: 1,
              borderColor: inputBorder,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: textColor,
              fontFamily: fontFamily.sans,
            }}
          />
          <Text style={{ fontSize: 11, color: textMuted }}>
            Short supporting heading shown as the hero badge and promotional accent.
          </Text>
        </View>

        {/* Field 3: Banner Description */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, fontFamily: fontFamily.sans }}>
              3. Banner Description <Text style={{ color: '#FF5A0A' }}>*</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              {form.description.length}/1500 characters
            </Text>
          </View>
          <TextInput
            value={form.description}
            onChangeText={(val) => handleChange('description', val)}
            placeholder="e.g. Quality motorcycle parts, accessories, and professional service — all in one place."
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            maxLength={1500}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: inputBg,
              borderWidth: 1,
              borderColor: inputBorder,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: textColor,
              fontFamily: fontFamily.sans,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ fontSize: 11, color: textMuted }}>
            Marketing copy displayed directly under the main heading.
          </Text>
        </View>

        {/* Field 4: Banner Image */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, fontFamily: fontFamily.sans }}>
              4. Banner Background Image <Text style={{ color: '#FF5A0A' }}>*</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setImageInputMode('file')}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: imageInputMode === 'file' ? '#FF5A0A' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: imageInputMode === 'file' ? '#FFFFFF' : textMuted,
                  }}
                >
                  Upload File
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setImageInputMode('url')}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: imageInputMode === 'url' ? '#FF5A0A' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: imageInputMode === 'url' ? '#FFFFFF' : textMuted,
                  }}
                >
                  Direct URL
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Image Thumbnail & Upload Controls */}
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              alignItems: isDesktop ? 'center' : 'stretch',
              gap: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? '#11151A' : '#F8FAFC',
              borderWidth: 1,
              borderColor: inputBorder,
            }}
          >
            {/* Thumbnail */}
            <View
              style={{
                width: isDesktop ? 180 : '100%',
                height: 100,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: '#1E252D',
                borderWidth: 1,
                borderColor: '#334155',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {form.image ? (
                <Image
                  source={{ uri: form.image }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <BootstrapIcon name="image" size={24} color="#64748B" />
                  <Text style={{ fontSize: 11, color: '#64748B' }}>No image set</Text>
                </View>
              )}
            </View>

            {/* Upload Buttons or URL Input */}
            <View style={{ flex: 1, gap: 10 }}>
              {imageInputMode === 'file' ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      disabled={isUploadingImage}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: '#FF5A0A',
                        cursor: 'pointer',
                        opacity: isUploadingImage ? 0.7 : 1,
                      }}
                    >
                      {isUploadingImage ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <BootstrapIcon name="cloud-arrow-up" size={15} color="#FFFFFF" />
                      )}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                        {isUploadingImage ? 'Uploading Image...' : 'Choose / Replace Image'}
                      </Text>
                    </TouchableOpacity>

                    {form.image ? (
                      <TouchableOpacity
                        onPress={() => handleChange('image', '')}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#222933' : '#F1F5F9',
                          cursor: 'pointer',
                        }}
                      >
                        <BootstrapIcon name="trash" size={13} color="#EF4444" />
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EF4444' }}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 11, color: textMuted }}>
                    Supported formats: JPEG, PNG, WEBP, GIF. Maximum file size: 8 MB. Automatically uploaded and stored in Supabase storage.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <TextInput
                    value={form.image}
                    onChangeText={(val) => handleChange('image', val)}
                    placeholder="https://images.unsplash.com/photo-..."
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: inputBorder,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: textColor,
                      fontFamily: fontFamily.sans,
                    }}
                  />
                  <Text style={{ fontSize: 11, color: textMuted }}>
                    Paste a direct HTTPS URL to a high-resolution motorcycle hero banner image.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Save Bar at Bottom */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BootstrapIcon
              name={hasUnsavedChanges ? 'exclamation-circle' : 'check-circle'}
              size={14}
              color={hasUnsavedChanges ? '#F59E0B' : '#10B981'}
            />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: hasUnsavedChanges ? '#F59E0B' : '#10B981',
              }}
            >
              {hasUnsavedChanges
                ? 'You have unsaved changes. Click Save & Publish to apply.'
                : 'All changes are up to date with the database.'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSaveBanner}
            disabled={isSaving}
            activeOpacity={0.88}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 22,
              paddingVertical: 11,
              borderRadius: 10,
              backgroundColor: '#FF5A0A',
              boxShadow: '0 4px 14px rgba(255, 90, 10, 0.35)',
              cursor: 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <BootstrapIcon name="check-circle" size={15} color="#FFFFFF" />
            )}
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '800',
                color: '#FFFFFF',
                fontFamily: fontFamily.sans,
              }}
            >
              {isSaving ? 'Saving Changes...' : 'Save & Publish Banner'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
