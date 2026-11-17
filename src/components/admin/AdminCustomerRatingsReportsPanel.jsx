import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import {
  ratingsReportsService,
  REPORT_CATEGORIES,
  REPORT_STATUSES,
} from '../../services/feedback/ratingsReportsService.js';

// Initials Avatar Color Map
const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
  { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' },
];

const DARK_AVATAR_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.16)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.30)' },
  { bg: 'rgba(245, 185, 66, 0.16)', text: '#F5B942', border: 'rgba(245, 185, 66, 0.30)' },
  { bg: 'rgba(0, 201, 141, 0.16)', text: '#00C98D', border: 'rgba(0, 201, 141, 0.30)' },
  { bg: 'rgba(168, 85, 247, 0.16)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.30)' },
  { bg: 'rgba(240, 68, 68, 0.16)', text: '#F87171', border: 'rgba(240, 68, 68, 0.30)' },
  { bg: '#3A241B', text: '#FF5A00', border: '#8A3D19' },
];

function getAvatarColor(name = '', isDarkMode = false) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = isDarkMode ? DARK_AVATAR_COLORS : AVATAR_COLORS;
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}

export default function AdminCustomerRatingsReportsPanel({
  isDarkMode = false,
  tokens: _tokens = {},
  isDesktop = true,
  currentUser = null,
  showToast = () => {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = !isDesktop || windowWidth < 880;

  // ── Data & Loading State ──
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    totalRatings: 0,
    reportsCount: 0,
    averageRating: 0,
    actionRequiredCount: 0,
    dueTodayCount: 0,
    resolvedCount: 0,
    resolvedRate: 0,
    urgentReport: null,
    urgentNeedsResponse: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [_errorMsg, setErrorMsg] = useState('');

  // ── Filter & Search State ──
  const [filterType, setFilterType] = useState('all'); // 'all' | 'rating_review' | 'customer_report'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'New' | 'Under Review' | 'Resolved' | 'Dismissed'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'rating_high' | 'rating_low'
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // ── Selected Item for Detail Drawer ──
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerStatus, setDrawerStatus] = useState('New');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  const adminName = currentUser?.name || currentUser?.fullName || currentUser?.email || 'Admin';

  // ── Load Data ──
  const loadData = useCallback(
    async (force = false) => {
      try {
        if (force) setIsRefreshing(true);
        setErrorMsg('');

        const [statsRes, queryRes] = await Promise.all([
          ratingsReportsService.getOverviewStats({ force }),
          ratingsReportsService.getSubmissions({
            filterType,
            statusFilter,
            categoryFilter,
            searchQuery,
            sortBy,
            page: 1,
            limit: 50,
            force,
          }),
        ]);

        if (statsRes) setStats(statsRes);
        if (queryRes?.items) setSubmissions(queryRes.items);
      } catch (err) {
        console.warn('Failed to load ratings & reports:', err);
        setErrorMsg(err?.message || 'Unable to retrieve customer ratings and reports.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filterType, statusFilter, categoryFilter, searchQuery, sortBy]
  );

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [statsRes, queryRes] = await Promise.all([
          ratingsReportsService.getOverviewStats({ force: false }),
          ratingsReportsService.getSubmissions({
            filterType,
            statusFilter,
            categoryFilter,
            searchQuery,
            sortBy,
            page: 1,
            limit: 50,
          }),
        ]);
        if (isMounted) {
          if (statsRes) setStats(statsRes);
          if (queryRes?.items) setSubmissions(queryRes.items);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err?.message || 'Unable to retrieve customer ratings and reports.');
          setIsLoading(false);
        }
      }
    })();

    // Live subscription: when a customer submits a problem report or review, update right there!
    const unsubscribe = ratingsReportsService.subscribe((event) => {
      if (isMounted) {
        loadData(true);
        if (event?.type === 'NEW_REPORT' && event?.report) {
          showToast?.(`New customer report received from ${event.report.customerName}`);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [filterType, statusFilter, categoryFilter, searchQuery, sortBy, loadData, showToast]);

  // Open item drawer
  const handleOpenItem = (item) => {
    setSelectedItem(item);
    setDrawerStatus(item.status || 'New');
    setDrawerNotes(item.adminNotes || '');
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
  };

  // Review urgent report directly
  const handleReviewSafetyReport = () => {
    const target = stats.urgentReport || submissions.find((s) => s.isUrgent) || submissions[0];
    if (target) {
      handleOpenItem(target);
    }
  };

  // Save changes from drawer
  const handleSaveDrawerStatus = async (overrideStatus) => {
    if (!selectedItem || isSavingDrawer) return;
    const targetStatus = overrideStatus || drawerStatus;
    setIsSavingDrawer(true);

    try {
      const res = await ratingsReportsService.updateSubmissionStatus(selectedItem.id, {
        status: targetStatus,
        adminNotes: drawerNotes.trim(),
        adminName,
      });

      if (res.success) {
        // Update local item list immediately
        setSubmissions((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  status: targetStatus,
                  adminNotes: drawerNotes.trim(),
                  reviewedBy: adminName,
                  reviewedAt: new Date().toISOString(),
                }
              : item
          )
        );

        // Update selected item in place
        setSelectedItem((prev) => ({
          ...prev,
          status: targetStatus,
          adminNotes: drawerNotes.trim(),
          reviewedBy: adminName,
          reviewedAt: new Date().toISOString(),
        }));

        setDrawerStatus(targetStatus);

        // Refresh overview stats silently
        ratingsReportsService
          .getOverviewStats({ force: true })
          .then(setStats)
          .catch(() => {});
        showToast?.(`Case marked as ${targetStatus}.`);
      }
    } catch (e) {
      showToast?.('Error saving status update: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsSavingDrawer(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const headers = [
        'ID',
        'Customer',
        'Email',
        'Type',
        'Rating',
        'Category',
        'Message',
        'Reference',
        'Status',
        'Date',
      ];
      const rows = submissions.map((s) => [
        `"${s.id}"`,
        `"${(s.customerName || '').replace(/"/g, '""')}"`,
        `"${(s.customerEmail || '').replace(/"/g, '""')}"`,
        `"${s.submissionType === 'rating_review' ? 'Rating' : 'Report'}"`,
        `"${s.rating != null ? s.rating : ''}"`,
        `"${(s.category || '').replace(/"/g, '""')}"`,
        `"${(s.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(s.transactionId || s.transactionRef || '').replace(/"/g, '""')}"`,
        `"${s.status || ''}"`,
        `"${s.createdAt || ''}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.document) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `mototrack_ratings_reports_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast?.('Ratings & reports data exported to CSV.');
      } else {
        showToast?.('Export file generated.');
      }
    } catch (e) {
      showToast?.('Export failed: ' + e?.message);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 4) return 'Today, 8:45 AM';
      if (diffHours < 24) return 'Today, 2:10 AM';
      if (diffHours < 48) return 'Yesterday';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_e) {
      return dateStr;
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    if (isDarkMode) {
      switch (status) {
        case REPORT_STATUSES.NEW:
          return {
            bg: 'rgba(245, 185, 66, 0.15)',
            text: '#F5B942',
            border: 'rgba(245, 185, 66, 0.30)',
            dot: '#F5B942',
            label: 'New',
          };
        case REPORT_STATUSES.UNDER_REVIEW:
          return {
            bg: 'rgba(59, 130, 246, 0.15)',
            text: '#60A5FA',
            border: 'rgba(59, 130, 246, 0.30)',
            dot: '#3B82F6',
            label: 'In Review',
          };
        case REPORT_STATUSES.RESOLVED:
          return {
            bg: 'rgba(0, 201, 141, 0.15)',
            text: '#00C98D',
            border: 'rgba(0, 201, 141, 0.30)',
            dot: '#00C98D',
            label: 'Resolved',
          };
        case REPORT_STATUSES.DISMISSED:
          return {
            bg: '#202124',
            text: '#A1A1AA',
            border: '#303236',
            dot: '#71717A',
            label: 'Dismissed',
          };
        default:
          return {
            bg: '#202124',
            text: '#A1A1AA',
            border: '#303236',
            dot: '#71717A',
            label: status || 'New',
          };
      }
    }
    switch (status) {
      case REPORT_STATUSES.NEW:
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A', dot: '#F59E0B', label: 'New' };
      case REPORT_STATUSES.UNDER_REVIEW:
        return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6', label: 'In Review' };
      case REPORT_STATUSES.RESOLVED:
        return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981', label: 'Resolved' };
      case REPORT_STATUSES.DISMISSED:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', dot: '#94A3B8', label: 'Dismissed' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0', dot: '#94A3B8', label: status || 'New' };
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilterType('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setSortBy('newest');
  };

  const isFiltered =
    filterType !== 'all' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    sortBy !== 'newest';

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* ─────────────────────────────────────────────────────────────
          1. PAGE HEADER
      ────────────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { justifyContent: 'flex-end', marginBottom: 16 }]}>
        <View style={styles.headerActions}>
          {/* Secondary Export Button */}
          <TouchableOpacity
            style={[styles.exportBtn, isDarkMode && styles.exportBtnDark]}
            onPress={handleExportCSV}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="box-arrow-up-right" size={13} color={isDarkMode ? '#FAFAFA' : '#1E293B'} />
            <Text style={[styles.exportBtnText, isDarkMode && styles.textLight]}>Export</Text>
          </TouchableOpacity>

          {/* Primary Orange Refresh Data Button */}
          <TouchableOpacity
            style={[styles.refreshBtn, isRefreshing && { opacity: 0.8 }]}
            onPress={() => loadData(true)}
            disabled={isRefreshing}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="arrow-clockwise"
              size={14}
              color="#FFFFFF"
              style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : {}}
            />
            <Text style={styles.refreshBtnText}>{isRefreshing ? 'Refreshing...' : 'Refresh data'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. PRIORITY NOTIFICATION BANNER (Only displays when real unresolved urgent report exists)
      ────────────────────────────────────────────────────────────── */}
      {stats.urgentReport && (
        <View
          style={[
            styles.priorityBanner,
            isDarkMode && {
              backgroundColor: 'rgba(240, 68, 68, 0.10)',
              borderColor: 'rgba(240, 68, 68, 0.28)',
            },
          ]}
        >
          <View style={styles.priorityBannerLeft}>
            <View
              style={[
                styles.priorityWarningIcon,
                isDarkMode && { backgroundColor: 'rgba(240, 68, 68, 0.16)' },
              ]}
            >
              <BootstrapIcon
                name="exclamation-triangle-fill"
                size={17}
                color={isDarkMode ? '#F04444' : '#DC2626'}
              />
            </View>
            <View style={styles.priorityTextWrap}>
              <View style={styles.priorityTitleRow}>
                <Text style={[styles.priorityHeadline, isDarkMode && { color: '#FCA5A5' }]}>
                  {stats.urgentReport.isUrgent
                    ? 'High-priority customer report needs response'
                    : 'Customer issue report needs response'}
                </Text>
                <View style={styles.urgentSafetyChip}>
                  <Text style={styles.urgentSafetyChipText}>NEW REPORT</Text>
                </View>
              </View>
              <Text style={[styles.priorityDescription, isDarkMode && { color: '#A1A1AA' }]}>
                {stats.urgentReport.customerName} submitted a{' '}
                {REPORT_CATEGORIES[stats.urgentReport.category?.toUpperCase()]?.label ||
                  stats.urgentReport.category}{' '}
                report: "{stats.urgentReport.message.slice(0, 140)}"
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.priorityActionBtn}
            onPress={handleReviewSafetyReport}
            activeOpacity={0.85}
          >
            <Text style={styles.priorityActionBtnText}>Review now</Text>
            <BootstrapIcon name="arrow-right-short" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. FOUR SUMMARY CARDS
      ────────────────────────────────────────────────────────────── */}
      <View style={styles.summaryGrid}>
        {/* Card 1: Total Feedback */}
        <View style={[styles.summaryCard, isDarkMode && styles.summaryCardDark]}>
          <View style={styles.summaryCardHeader}>
            <Text style={[styles.summaryLabel, isDarkMode && { color: '#A1A1AA' }]}>Total feedback</Text>
            <View
              style={[
                styles.headerPillBadge,
                {
                  backgroundColor: isDarkMode ? '#202124' : '#F4F4F5',
                  borderColor: isDarkMode ? '#303236' : '#E4E4E7',
                },
              ]}
            >
              <Text style={[styles.headerPillText, { color: isDarkMode ? '#A1A1AA' : '#52525B' }]}>
                {stats.totalRatings} ratings · {stats.reportsCount} reports
              </Text>
            </View>
          </View>
          <View style={styles.summaryValueBlock}>
            <Text style={[styles.summaryValue, styles.tabularNums, isDarkMode && styles.textLight]}>
              {stats.total}
            </Text>
            <Text style={[styles.summarySubText, isDarkMode && { color: '#71717A' }]}>
              All customer ratings & reports
            </Text>
          </View>
          <View style={[styles.summaryTrack, isDarkMode && { backgroundColor: '#292B2F' }]}>
            <View
              style={[
                styles.summaryTrackFill,
                { width: stats.total > 0 ? '78%' : '18%', backgroundColor: isDarkMode ? '#FF5A00' : '#EA580C' },
              ]}
            />
          </View>
        </View>

        {/* Card 2: Average Rating */}
        <View style={[styles.summaryCard, isDarkMode && styles.summaryCardDark]}>
          <View style={styles.summaryCardHeader}>
            <Text style={[styles.summaryLabel, isDarkMode && { color: '#A1A1AA' }]}>Average rating</Text>
            <View
              style={[
                styles.headerPillBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                  borderColor: isDarkMode ? 'rgba(0, 201, 141, 0.28)' : '#A7F3D0',
                },
              ]}
            >
              <Text style={[styles.headerPillText, { color: isDarkMode ? '#00C98D' : '#047857' }]}>
                {stats.ratingCount > 0 ? `${stats.ratingCount} reviews` : 'No reviews'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryValueBlock}>
            <View style={styles.ratingValRow}>
              <Text style={[styles.summaryValue, styles.tabularNums, isDarkMode && styles.textLight]}>
                {stats.averageRating > 0 ? Number(stats.averageRating).toFixed(1) : '0.0'}
              </Text>
              <BootstrapIcon
                name="star-fill"
                size={16}
                color={isDarkMode ? '#F5B942' : '#F59E0B'}
              />
            </View>
            <Text style={[styles.summarySubText, isDarkMode && { color: '#71717A' }]}>
              Out of 5.0 satisfaction score
            </Text>
          </View>
          <View style={[styles.summaryTrack, isDarkMode && { backgroundColor: '#292B2F' }]}>
            <View
              style={[
                styles.summaryTrackFill,
                {
                  width: `${Math.min(100, Math.max(12, Math.round(((Number(stats.averageRating) || 0) / 5) * 100)))}%`,
                  backgroundColor: isDarkMode ? '#F5B942' : '#F59E0B',
                },
              ]}
            />
          </View>
        </View>

        {/* Card 3: Action Required */}
        <View style={[styles.summaryCard, isDarkMode && styles.summaryCardDark]}>
          <View style={styles.summaryCardHeader}>
            <Text style={[styles.summaryLabel, isDarkMode && { color: '#A1A1AA' }]}>Action required</Text>
            <View
              style={[
                styles.headerPillBadge,
                stats.actionRequiredCount > 0
                  ? {
                      backgroundColor: isDarkMode ? 'rgba(245, 185, 66, 0.14)' : '#FEF3C7',
                      borderColor: isDarkMode ? 'rgba(245, 185, 66, 0.28)' : '#FDE68A',
                    }
                  : {
                      backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                      borderColor: isDarkMode ? 'rgba(0, 201, 141, 0.28)' : '#A7F3D0',
                    },
              ]}
            >
              <Text
                style={[
                  styles.headerPillText,
                  {
                    color:
                      stats.actionRequiredCount > 0
                        ? isDarkMode
                          ? '#F5B942'
                          : '#B45309'
                        : isDarkMode
                          ? '#00C98D'
                          : '#047857',
                  },
                ]}
              >
                {stats.actionRequiredCount > 0
                  ? `${stats.newCount} new · ${stats.underReviewCount} review`
                  : 'All resolved'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryValueBlock}>
            <Text
              style={[
                styles.summaryValue,
                styles.tabularNums,
                {
                  color:
                    stats.actionRequiredCount > 0
                      ? isDarkMode
                        ? '#F04444'
                        : '#DC2626'
                      : isDarkMode
                        ? '#F5F5F5'
                        : '#18181B',
                },
              ]}
            >
              {stats.actionRequiredCount}
            </Text>
            <Text style={[styles.summarySubText, isDarkMode && { color: '#71717A' }]}>
              {stats.actionRequiredCount > 0 ? 'Pending triage & follow-up' : 'Queue cleared'}
            </Text>
          </View>
          <View style={[styles.summaryTrack, isDarkMode && { backgroundColor: '#292B2F' }]}>
            <View
              style={[
                styles.summaryTrackFill,
                {
                  width: stats.actionRequiredCount > 0 ? '68%' : '16%',
                  backgroundColor: stats.actionRequiredCount > 0 ? (isDarkMode ? '#F04444' : '#DC2626') : '#00C98D',
                },
              ]}
            />
          </View>
        </View>

        {/* Card 4: Resolved */}
        <View style={[styles.summaryCard, isDarkMode && styles.summaryCardDark]}>
          <View style={styles.summaryCardHeader}>
            <Text style={[styles.summaryLabel, isDarkMode && { color: '#A1A1AA' }]}>Resolved</Text>
            <View
              style={[
                styles.headerPillBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 201, 141, 0.14)' : '#ECFDF5',
                  borderColor: isDarkMode ? 'rgba(0, 201, 141, 0.28)' : '#A7F3D0',
                },
              ]}
            >
              <Text style={[styles.headerPillText, { color: isDarkMode ? '#00C98D' : '#047857' }]}>
                {stats.total > 0 ? `${stats.resolvedRate}% rate` : '100% rate'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryValueBlock}>
            <Text style={[styles.summaryValue, styles.tabularNums, isDarkMode && styles.textLight]}>
              {stats.resolvedCount}
            </Text>
            <Text style={[styles.summarySubText, isDarkMode && { color: '#71717A' }]}>
              Closed & responded cases
            </Text>
          </View>
          <View style={[styles.summaryTrack, isDarkMode && { backgroundColor: '#292B2F' }]}>
            <View
              style={[
                styles.summaryTrackFill,
                {
                  width: `${Math.min(100, Math.max(14, Number(stats.resolvedRate) || 0))}%`,
                  backgroundColor: isDarkMode ? '#00C98D' : '#10B981',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          4. REVIEW QUEUE SECTION & CONTROLS
      ────────────────────────────────────────────────────────────── */}
      <View style={[styles.reviewQueueCard, isDarkMode && styles.reviewQueueCardDark]}>
        {/* Section Header */}
        <View style={styles.queueHeaderRow}>
          <View>
            <Text style={[styles.queueTitle, isDarkMode && styles.textLight]}>Review Queue</Text>
            <Text style={[styles.queueSubtitle, isDarkMode && { color: '#A1A1AA' }]}>
              Monitor, triage, and respond to incoming customer reviews and incident reports.
            </Text>
          </View>

          {/* Updated just now indicator */}
          <View
            style={[
              styles.updatedBadge,
              isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' },
            ]}
          >
            <View style={[styles.liveDot, isDarkMode && { backgroundColor: '#00C98D' }]} />
            <Text style={[styles.updatedBadgeText, isDarkMode && { color: '#A1A1AA' }]}>
              Updated just now
            </Text>
          </View>
        </View>

        {/* Toolbar: Search, Segmented Filters, More Filters */}
        <View style={styles.queueToolbar}>
          {/* Search Field */}
          <View style={[styles.searchBox, isDarkMode && styles.searchBoxDark]}>
            <BootstrapIcon name="search" size={14} color={isDarkMode ? '#71717A' : '#64748B'} />
            <TextInput
              style={[styles.searchInput, isDarkMode && { color: '#F2F2F3' }]}
              placeholder="Search customer, message, or order ID"
              placeholderTextColor={isDarkMode ? '#71717A' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? '#71717A' : '#94A3B8'} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Segmented Filters: All, Ratings, Reports */}
          <View style={[styles.segmentedGroup, isDarkMode && styles.segmentedGroupDark]}>
            {[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'rating_review', label: 'Ratings', count: stats.totalRatings },
              { id: 'customer_report', label: 'Reports', count: stats.reportsCount },
            ].map((seg) => {
              const active = filterType === seg.id;
              return (
                <TouchableOpacity
                  key={seg.id}
                  style={[
                    styles.segmentedBtn,
                    active && (isDarkMode ? styles.segmentedBtnActiveDark : styles.segmentedBtnActive),
                  ]}
                  onPress={() => setFilterType(seg.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentedBtnText,
                      isDarkMode && { color: '#A1A1AA' },
                      active && (isDarkMode ? { color: '#F5F5F5', fontWeight: '700' } : styles.segmentedBtnTextActive),
                    ]}
                  >
                    {seg.label}
                  </Text>
                  <View
                    style={[
                      styles.segmentedCountBadge,
                      isDarkMode && { backgroundColor: '#191A1D' },
                      active &&
                        (isDarkMode
                          ? { backgroundColor: '#3A241B', borderWidth: 1, borderColor: '#8A3D19' }
                          : styles.segmentedCountBadgeActive),
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedCountText,
                        styles.tabularNums,
                        isDarkMode && { color: '#A1A1AA' },
                        active && (isDarkMode ? { color: '#FF5A00' } : styles.segmentedCountTextActive),
                      ]}
                    >
                      {seg.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* More Filters Toggle */}
          <TouchableOpacity
            style={[
              styles.moreFiltersBtn,
              isDarkMode && styles.moreFiltersBtnDark,
              showMoreFilters &&
                (isDarkMode
                  ? { borderColor: '#8A3D19', backgroundColor: '#3A241B' }
                  : styles.moreFiltersBtnActive),
            ]}
            onPress={() => setShowMoreFilters(!showMoreFilters)}
            activeOpacity={0.8}
          >
            <BootstrapIcon
              name="sliders"
              size={13}
              color={showMoreFilters ? '#FF5A00' : isDarkMode ? '#A1A1AA' : '#475569'}
            />
            <Text
              style={[
                styles.moreFiltersBtnText,
                isDarkMode && { color: '#F2F2F3' },
                showMoreFilters && { color: '#FF5A00' },
              ]}
            >
              More filters
            </Text>
            <BootstrapIcon
              name={showMoreFilters ? 'chevron-up' : 'chevron-down'}
              size={11}
              color={showMoreFilters ? '#FF5A00' : isDarkMode ? '#71717A' : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>

        {/* Collapsible Extended Filters */}
        {showMoreFilters && (
          <View style={[styles.extendedFiltersPanel, isDarkMode && styles.extendedFiltersPanelDark]}>
            <View style={styles.extFilterGroup}>
              <Text style={[styles.extFilterLabel, isDarkMode && { color: '#A1A1AA' }]}>STATUS:</Text>
              <View style={styles.extPillRow}>
                {['all', 'New', 'Under Review', 'Resolved', 'Dismissed'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.extPill,
                      isDarkMode && styles.extPillDark,
                      statusFilter === st && styles.extPillActive,
                    ]}
                    onPress={() => setStatusFilter(st)}
                  >
                    <Text
                      style={[
                        styles.extPillText,
                        isDarkMode && { color: '#A1A1AA' },
                        statusFilter === st && styles.extPillTextActive,
                      ]}
                    >
                      {st === 'all' ? 'All Statuses' : st === 'Under Review' ? 'In Review' : st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.extFilterGroup}>
              <Text style={[styles.extFilterLabel, isDarkMode && { color: '#A1A1AA' }]}>SORT BY:</Text>
              <View style={styles.extPillRow}>
                {[
                  { id: 'newest', label: 'Newest' },
                  { id: 'oldest', label: 'Oldest' },
                  { id: 'rating_high', label: 'Highest Rating' },
                  { id: 'rating_low', label: 'Lowest Rating' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.extPill,
                      isDarkMode && styles.extPillDark,
                      sortBy === s.id && styles.extPillActive,
                    ]}
                    onPress={() => setSortBy(s.id)}
                  >
                    <Text
                      style={[
                        styles.extPillText,
                        isDarkMode && { color: '#A1A1AA' },
                        sortBy === s.id && styles.extPillTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {isFiltered && (
                  <TouchableOpacity style={styles.resetBtn} onPress={handleClearFilters}>
                    <BootstrapIcon name="arrow-counterclockwise" size={11} color={isDarkMode ? '#F04444' : '#DC2626'} />
                    <Text style={[styles.resetBtnText, isDarkMode && { color: '#F04444' }]}>Reset filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────
            5. CUSTOMER FEEDBACK TABLE & MOBILE STACKED CARDS
        ────────────────────────────────────────────────────────────── */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#FF5A00" />
            <Text style={[styles.loadingText, isDarkMode && { color: '#A1A1AA' }]}>
              Loading customer ratings and reports...
            </Text>
          </View>
        ) : submissions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <BootstrapIcon name="inbox" size={36} color={isDarkMode ? '#52525B' : '#CBD5E1'} />
            <Text style={[styles.emptyTitle, isDarkMode && styles.textLight]}>
              {isFiltered ? 'No matching submissions found' : 'No customer feedback yet'}
            </Text>
            <Text style={[styles.emptySubtitle, isDarkMode && { color: '#A1A1AA' }]}>
              {isFiltered
                ? 'Try adjusting your search query or filters.'
                : 'When customers rate orders or submit problem reports, they will appear here in real time.'}
            </Text>
            {isFiltered && (
              <TouchableOpacity
                style={[
                  styles.emptyActionBtn,
                  isDarkMode && { backgroundColor: '#202124', borderWidth: 1, borderColor: '#303236' },
                ]}
                onPress={handleClearFilters}
              >
                <Text style={[styles.emptyActionBtnText, isDarkMode && { color: '#F2F2F3' }]}>
                  Clear all filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isCompact ? (
          /* ── MOBILE STACKED CARDS VIEW ── */
          <View style={styles.stackedCardsContainer}>
            {submissions.map((item) => {
              const avatarStyle = getAvatarColor(item.customerName, isDarkMode);
              const statusStyle = getStatusBadge(item.status);
              const isRating = item.submissionType === 'rating_review';
              const isUrgent = Boolean(item.isUrgent);
              const catObj = REPORT_CATEGORIES[item.category?.toUpperCase()] || {
                label: item.category || 'General',
              };

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.stackedCard,
                    isDarkMode && styles.stackedCardDark,
                    isUrgent &&
                      (isDarkMode
                        ? { borderLeftColor: '#F04444', backgroundColor: 'rgba(240, 68, 68, 0.06)' }
                        : styles.urgentCardHighlight),
                  ]}
                  onPress={() => handleOpenItem(item)}
                  activeOpacity={0.88}
                >
                  {/* Top Row: Customer & Status */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.customerMeta}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: avatarStyle.text }]}>
                          {item.customerInitials || (item.customerName || 'R').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.customerName, isDarkMode && styles.textLight]}>
                            {item.customerName}
                          </Text>
                          {item.isVerified && (
                            <View
                              style={[
                                styles.verifiedBadge,
                                isDarkMode && { backgroundColor: 'rgba(0, 201, 141, 0.14)' },
                              ]}
                            >
                              <BootstrapIcon
                                name="check-circle-fill"
                                size={11}
                                color={isDarkMode ? '#00C98D' : '#059669'}
                              />
                              <Text style={[styles.verifiedBadgeText, isDarkMode && { color: '#00C98D' }]}>
                                Verified
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.submissionDate, isDarkMode && { color: '#71717A' }]}>
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                      <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  {/* Type & Urgency Alert Bar */}
                  <View style={styles.cardTypeRow}>
                    {isRating ? (
                      <View
                        style={[
                          styles.ratingScorePill,
                          isDarkMode && {
                            backgroundColor: 'rgba(245, 185, 66, 0.14)',
                            borderColor: 'rgba(245, 185, 66, 0.28)',
                          },
                        ]}
                      >
                        <BootstrapIcon name="star-fill" size={12} color={isDarkMode ? '#F5B942' : '#D97706'} />
                        <Text
                          style={[
                            styles.ratingScoreText,
                            styles.tabularNums,
                            isDarkMode && { color: '#F5B942' },
                          ]}
                        >
                          {Number(item.rating || 5.0).toFixed(1)} Rating
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.reportBadge,
                          isDarkMode && { backgroundColor: '#3A241B', borderColor: '#8A3D19' },
                          isUrgent &&
                            (isDarkMode
                              ? { backgroundColor: 'rgba(240, 68, 68, 0.15)', borderColor: 'rgba(240, 68, 68, 0.32)' }
                              : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }),
                        ]}
                      >
                        <BootstrapIcon
                          name={isUrgent ? 'shield-exclamation' : 'flag-fill'}
                          size={11}
                          color={isUrgent ? (isDarkMode ? '#F04444' : '#DC2626') : '#FF5A00'}
                        />
                        <Text
                          style={[
                            styles.reportBadgeText,
                            isDarkMode && { color: '#FF5A00' },
                            isUrgent && { color: isDarkMode ? '#F04444' : '#DC2626' },
                          ]}
                        >
                          {isUrgent ? 'Urgent Safety Report' : 'Customer Report'}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.categoryChip,
                        isDarkMode && { backgroundColor: '#292B2F', borderWidth: 1, borderColor: '#303236' },
                      ]}
                    >
                      <Text style={[styles.categoryChipText, isDarkMode && { color: '#A1A1AA' }]}>
                        {catObj.label}
                      </Text>
                    </View>
                  </View>

                  {/* Message Preview */}
                  <Text style={[styles.cardMessagePreview, isDarkMode && { color: '#F2F2F3' }]} numberOfLines={2}>
                    {item.message}
                  </Text>

                  {/* Bottom Footer: Reference & Action */}
                  <View style={[styles.cardBottomRow, isDarkMode && { borderTopColor: '#292B2F' }]}>
                    <View
                      style={[
                        styles.referenceChip,
                        isDarkMode && { backgroundColor: '#292B2F', borderColor: '#303236' },
                      ]}
                    >
                      <BootstrapIcon name="hash" size={12} color={isDarkMode ? '#71717A' : '#64748B'} />
                      <Text style={[styles.referenceChipText, isDarkMode && { color: '#A1A1AA' }]}>
                        {item.transactionId || item.transactionRef || 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.viewActionLink}>
                      <Text style={styles.viewActionLinkText}>Review</Text>
                      <BootstrapIcon name="arrow-right" size={12} color="#FF5A00" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* ── DESKTOP TABLE VIEW ── */
          <View style={[styles.tableWrapper, isDarkMode && { borderColor: '#303236' }]}>
            {/* Table Header */}
            <View style={[styles.tableHeaderRow, isDarkMode && styles.tableHeaderRowDark]}>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 2.2 }]}>CUSTOMER</Text>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 1.4 }]}>TYPE</Text>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 3.8 }]}>MESSAGE & REFERENCE</Text>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 1.3 }]}>DATE</Text>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 1.3 }]}>STATUS</Text>
              <Text style={[styles.thCell, isDarkMode && { color: '#A1A1AA' }, { flex: 1.0, textAlign: 'right' }]}>ACTION</Text>
            </View>

            {/* Table Body Rows */}
            {submissions.map((item, idx) => {
              const avatarStyle = getAvatarColor(item.customerName, isDarkMode);
              const statusStyle = getStatusBadge(item.status);
              const isRating = item.submissionType === 'rating_review';
              const isUrgent = Boolean(item.isUrgent);
              const catObj = REPORT_CATEGORIES[item.category?.toUpperCase()] || {
                label: item.category || 'General',
              };

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.tableRow,
                    !isDarkMode && idx % 2 === 1 && styles.tableRowAlt,
                    isDarkMode && styles.tableRowDark,
                    isDarkMode && idx % 2 === 1 && { backgroundColor: '#1E1F23' },
                    isUrgent &&
                      (isDarkMode
                        ? {
                            backgroundColor: 'rgba(240, 68, 68, 0.06)',
                            borderLeftWidth: 3,
                            borderLeftColor: '#F04444',
                          }
                        : styles.tableRowUrgent),
                  ]}
                  onPress={() => handleOpenItem(item)}
                  activeOpacity={0.8}
                >
                  {/* Column 1: Customer */}
                  <View
                    style={[
                      styles.tdCell,
                      { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: avatarStyle.text }]}>
                        {item.customerInitials || (item.customerName || 'R').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.rowCustomerName, isDarkMode && { color: '#F2F2F3' }]}
                        numberOfLines={1}
                      >
                        {item.customerName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {item.isVerified ? (
                          <View style={styles.verifiedRow}>
                            <BootstrapIcon
                              name="patch-check-fill"
                              size={11}
                              color={isDarkMode ? '#00C98D' : '#059669'}
                            />
                            <Text style={[styles.verifiedRowText, isDarkMode && { color: '#00C98D' }]}>
                              Verified
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.unverifiedRowText, isDarkMode && { color: '#71717A' }]}>
                            Customer
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Column 2: Type */}
                  <View style={[styles.tdCell, { flex: 1.4 }]}>
                    {isRating ? (
                      <View
                        style={[
                          styles.ratingScorePill,
                          isDarkMode && {
                            backgroundColor: 'rgba(245, 185, 66, 0.14)',
                            borderColor: 'rgba(245, 185, 66, 0.28)',
                          },
                        ]}
                      >
                        <BootstrapIcon name="star-fill" size={11} color={isDarkMode ? '#F5B942' : '#D97706'} />
                        <Text
                          style={[
                            styles.ratingScoreText,
                            styles.tabularNums,
                            isDarkMode && { color: '#F5B942' },
                          ]}
                        >
                          {Number(item.rating || 5.0).toFixed(1)} Rating
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.reportBadge,
                          isDarkMode && { backgroundColor: '#3A241B', borderColor: '#8A3D19' },
                          isUrgent &&
                            (isDarkMode
                              ? { backgroundColor: 'rgba(240, 68, 68, 0.15)', borderColor: 'rgba(240, 68, 68, 0.32)' }
                              : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }),
                        ]}
                      >
                        <BootstrapIcon
                          name={isUrgent ? 'shield-exclamation' : 'flag-fill'}
                          size={10}
                          color={isUrgent ? (isDarkMode ? '#F04444' : '#DC2626') : '#FF5A00'}
                        />
                        <Text
                          style={[
                            styles.reportBadgeText,
                            isDarkMode && { color: '#FF5A00' },
                            isUrgent && { color: isDarkMode ? '#F04444' : '#DC2626' },
                          ]}
                        >
                          {isUrgent ? 'Urgent Report' : 'Report'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Column 3: Message & Reference */}
                  <View style={[styles.tdCell, { flex: 3.8 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View
                        style={[
                          styles.categoryChip,
                          isDarkMode && { backgroundColor: '#202124', borderWidth: 1, borderColor: '#303236' },
                        ]}
                      >
                        <Text style={[styles.categoryChipText, isDarkMode && { color: '#A1A1AA' }]}>
                          {catObj.label}
                        </Text>
                      </View>
                      {item.transactionId && (
                        <View
                          style={[
                            styles.referenceChip,
                            isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' },
                          ]}
                        >
                          <Text style={[styles.referenceChipText, isDarkMode && { color: '#A1A1AA' }]}>
                            {item.transactionId}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.tableMessagePreview, isDarkMode && { color: '#A1A1AA' }]}
                      numberOfLines={2}
                    >
                      {item.message}
                    </Text>
                  </View>

                  {/* Column 4: Date */}
                  <View style={[styles.tdCell, { flex: 1.3 }]}>
                    <Text style={[styles.rowDateText, isDarkMode && { color: '#A1A1AA' }]}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>

                  {/* Column 5: Status */}
                  <View style={[styles.tdCell, { flex: 1.3 }]}>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                      <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  {/* Column 6: Action */}
                  <View style={[styles.tdCell, { flex: 1.0, alignItems: 'flex-end' }]}>
                    <View
                      style={[
                        styles.rowActionButton,
                        isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' },
                      ]}
                    >
                      <Text style={[styles.rowActionButtonText, isDarkMode && { color: '#F2F2F3' }]}>
                        View
                      </Text>
                      <BootstrapIcon name="chevron-right" size={11} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ─────────────────────────────────────────────────────────────
          6. SELECTED-ITEM DETAIL DRAWER (SLIDE-OUT ON DESKTOP / SHEET)
      ────────────────────────────────────────────────────────────── */}
      {selectedItem && (
        <View style={styles.drawerBackdrop}>
          {/* Backdrop Dismiss Click Area */}
          <TouchableOpacity
            style={styles.drawerBackdropDismiss}
            onPress={handleCloseDrawer}
            activeOpacity={1}
          />

          {/* Drawer Body Container */}
          <View style={[styles.drawerContent, isDarkMode && styles.drawerContentDark]}>
            {/* Drawer Header */}
            <View
              style={[
                styles.drawerHeader,
                isDarkMode && { backgroundColor: '#191A1D', borderBottomColor: '#303236' },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.drawerTitle, isDarkMode && styles.textLight]}>Feedback Details</Text>
                  <View
                    style={[
                      styles.drawerRefPill,
                      isDarkMode && { backgroundColor: '#202124', borderWidth: 1, borderColor: '#303236' },
                    ]}
                  >
                    <Text style={[styles.drawerRefPillText, isDarkMode && { color: '#A1A1AA' }]}>
                      {selectedItem.transactionId || selectedItem.id}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.drawerSubtitle, isDarkMode && { color: '#A1A1AA' }]}>
                  Submitted {formatDate(selectedItem.createdAt)} ·{' '}
                  {selectedItem.submissionType === 'rating_review' ? 'Customer Review' : 'Incident Report'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.drawerCloseBtn,
                  isDarkMode && { backgroundColor: '#202124', borderWidth: 1, borderColor: '#303236' },
                ]}
                onPress={handleCloseDrawer}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Detail Body */}
            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollInner}>
              {/* Urgency Alert Notice (if urgent report) */}
              {selectedItem.isUrgent && (
                <View
                  style={[
                    styles.drawerUrgentBox,
                    isDarkMode && {
                      backgroundColor: 'rgba(240, 68, 68, 0.12)',
                      borderColor: 'rgba(240, 68, 68, 0.30)',
                    },
                  ]}
                >
                  <View style={styles.drawerUrgentHeader}>
                    <BootstrapIcon
                      name="shield-fill-exclamation"
                      size={17}
                      color={isDarkMode ? '#F04444' : '#DC2626'}
                    />
                    <Text style={[styles.drawerUrgentTitle, isDarkMode && { color: '#F04444' }]}>
                      {selectedItem.urgencyTitle || 'HIGH-PRIORITY REPORT · ATTENTION REQUIRED'}
                    </Text>
                  </View>
                  <Text style={[styles.drawerUrgentDesc, isDarkMode && { color: '#FCA5A5' }]}>
                    {selectedItem.urgencyReason ||
                      'This customer report was flagged for immediate attention. Please review the details below and coordinate response or resolution.'}
                  </Text>
                </View>
              )}

              {/* Section 1: Customer Information */}
              <View style={[styles.drawerSectionCard, isDarkMode && styles.drawerSectionCardDark]}>
                <Text style={[styles.drawerSectionHeading, isDarkMode && { color: '#A1A1AA' }]}>
                  CUSTOMER INFORMATION
                </Text>
                <View style={styles.drawerCustomerRow}>
                  {(() => {
                    const avatarStyle = getAvatarColor(selectedItem.customerName, isDarkMode);
                    return (
                      <View
                        style={[
                          styles.avatarLarge,
                          { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border },
                        ]}
                      >
                        <Text style={[styles.avatarLargeText, { color: avatarStyle.text }]}>
                          {selectedItem.customerInitials ||
                            (selectedItem.customerName || 'R').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.drawerCustomerName, isDarkMode && styles.textLight]}>
                        {selectedItem.customerName}
                      </Text>
                      {selectedItem.isVerified && (
                        <View
                          style={[
                            styles.verifiedBadge,
                            isDarkMode && { backgroundColor: 'rgba(0, 201, 141, 0.14)' },
                          ]}
                        >
                          <BootstrapIcon
                            name="check-circle-fill"
                            size={11}
                            color={isDarkMode ? '#00C98D' : '#059669'}
                          />
                          <Text style={[styles.verifiedBadgeText, isDarkMode && { color: '#00C98D' }]}>
                            Verified Rider
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.drawerCustomerEmail, isDarkMode && { color: '#A1A1AA' }]}>
                      {selectedItem.customerEmail || 'Verified phone account'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Section 2: Full Message & Rating */}
              <View style={[styles.drawerSectionCard, isDarkMode && styles.drawerSectionCardDark]}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={[styles.drawerSectionHeading, isDarkMode && { color: '#A1A1AA' }]}>
                    CUSTOMER FEEDBACK
                  </Text>
                  {selectedItem.submissionType === 'rating_review' ? (
                    <View
                      style={[
                        styles.drawerRatingBadge,
                        isDarkMode && {
                          backgroundColor: 'rgba(245, 185, 66, 0.14)',
                          borderColor: 'rgba(245, 185, 66, 0.28)',
                        },
                      ]}
                    >
                      <BootstrapIcon name="star-fill" size={13} color={isDarkMode ? '#F5B942' : '#D97706'} />
                      <Text
                        style={[
                          styles.drawerRatingScore,
                          styles.tabularNums,
                          isDarkMode && { color: '#F5B942' },
                        ]}
                      >
                        {Number(selectedItem.rating || 5.0).toFixed(1)} / 5.0
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.categoryChip,
                        isDarkMode && { backgroundColor: '#292B2F', borderWidth: 1, borderColor: '#303236' },
                      ]}
                    >
                      <Text style={[styles.categoryChipText, isDarkMode && { color: '#A1A1AA' }]}>
                        {REPORT_CATEGORIES[selectedItem.category?.toUpperCase()]?.label ||
                          selectedItem.category}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Readable Customer Message */}
                <View style={[styles.drawerMessageBox, isDarkMode && styles.drawerMessageBoxDark]}>
                  <Text style={[styles.drawerMessageText, isDarkMode && { color: '#F2F2F3' }]}>
                    "{selectedItem.message}"
                  </Text>
                </View>

                {/* Related Transaction Information */}
                {(selectedItem.transactionId || selectedItem.transactionRef) && (
                  <View style={[styles.drawerTxBox, isDarkMode && { borderTopColor: '#292B2F' }]}>
                    <Text style={[styles.drawerTxLabel, isDarkMode && { color: '#71717A' }]}>
                      RELATED TRANSACTION
                    </Text>
                    <View style={styles.drawerTxRow}>
                      <BootstrapIcon name="receipt" size={14} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
                      <Text style={[styles.drawerTxValue, isDarkMode && { color: '#F2F2F3' }]}>
                        {selectedItem.transactionRef || selectedItem.transactionId}
                      </Text>
                      {selectedItem.transactionStatus && (
                        <View
                          style={[
                            styles.txStatusPill,
                            isDarkMode && { backgroundColor: 'rgba(0, 201, 141, 0.14)' },
                          ]}
                        >
                          <Text style={[styles.txStatusPillText, isDarkMode && { color: '#00C98D' }]}>
                            {selectedItem.transactionStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Section 3: Activity Timeline */}
              <View style={[styles.drawerSectionCard, isDarkMode && styles.drawerSectionCardDark]}>
                <Text style={[styles.drawerSectionHeading, isDarkMode && { color: '#A1A1AA' }]}>
                  ACTIVITY TIMELINE
                </Text>
                <View style={styles.timelineList}>
                  {selectedItem.timeline && selectedItem.timeline.length > 0 ? (
                    selectedItem.timeline.map((step, sIdx) => (
                      <View key={sIdx} style={styles.timelineItem}>
                        <View style={styles.timelineLineWrap}>
                          <View style={styles.timelineDot} />
                          {sIdx < selectedItem.timeline.length - 1 && (
                            <View
                              style={[
                                styles.timelineConnector,
                                isDarkMode && { backgroundColor: '#303236' },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={styles.timelineStepRow}>
                            <Text style={[styles.timelineStepTitle, isDarkMode && styles.textLight]}>
                              {step.step}
                            </Text>
                            <Text style={[styles.timelineStepTime, isDarkMode && { color: '#71717A' }]}>
                              {step.time}
                            </Text>
                          </View>
                          <Text style={[styles.timelineStepNote, isDarkMode && { color: '#A1A1AA' }]}>
                            {step.note}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineLineWrap}>
                        <View style={styles.timelineDot} />
                      </View>
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineStepRow}>
                          <Text style={[styles.timelineStepTitle, isDarkMode && styles.textLight]}>
                            Feedback Logged
                          </Text>
                          <Text style={[styles.timelineStepTime, isDarkMode && { color: '#71717A' }]}>
                            {formatDate(selectedItem.createdAt)}
                          </Text>
                        </View>
                        <Text style={[styles.timelineStepNote, isDarkMode && { color: '#A1A1AA' }]}>
                          Captured from customer session.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Section 4: Admin Review Workflow & Notes */}
              <View style={[styles.drawerSectionCard, isDarkMode && styles.drawerSectionCardDark]}>
                <Text style={[styles.drawerSectionHeading, isDarkMode && { color: '#A1A1AA' }]}>
                  ADMIN REVIEW & RESOLUTION
                </Text>

                {/* Status Switcher Buttons */}
                <Text style={[styles.fieldLabel, isDarkMode && { color: '#F2F2F3' }]}>Review Status</Text>
                <View style={styles.statusButtonsRow}>
                  {[
                    { id: REPORT_STATUSES.NEW, label: 'New' },
                    { id: REPORT_STATUSES.UNDER_REVIEW, label: 'In Review' },
                    { id: REPORT_STATUSES.RESOLVED, label: 'Resolved' },
                    { id: REPORT_STATUSES.DISMISSED, label: 'Dismissed' },
                  ].map((btn) => {
                    const isSel = drawerStatus === btn.id;
                    const bStyle = getStatusBadge(btn.id);
                    return (
                      <TouchableOpacity
                        key={btn.id}
                        style={[
                          styles.statusOptionBtn,
                          isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' },
                          isSel && { backgroundColor: bStyle.bg, borderColor: bStyle.border },
                        ]}
                        onPress={() => setDrawerStatus(btn.id)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: isSel ? bStyle.dot : isDarkMode ? '#52525B' : '#CBD5E1' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusOptionBtnText,
                            isDarkMode && { color: '#A1A1AA' },
                            isSel && { color: bStyle.text, fontWeight: '700' },
                          ]}
                        >
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Internal Admin Notes */}
                <Text style={[styles.fieldLabel, isDarkMode && { color: '#F2F2F3' }, { marginTop: 14 }]}>
                  Internal Admin Notes
                </Text>
                <TextInput
                  style={[styles.drawerNotesInput, isDarkMode && styles.drawerNotesInputDark]}
                  placeholder="Record investigation findings, customer contact outcomes, or resolution steps..."
                  placeholderTextColor={isDarkMode ? '#71717A' : '#94A3B8'}
                  value={drawerNotes}
                  onChangeText={setDrawerNotes}
                  multiline
                  numberOfLines={4}
                />

                {/* Primary & Secondary Actions */}
                <View style={styles.drawerActionsRow}>
                  {selectedItem.status === REPORT_STATUSES.NEW ? (
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => handleSaveDrawerStatus(REPORT_STATUSES.UNDER_REVIEW)}
                      disabled={isSavingDrawer}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="play-fill" size={15} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>
                        {isSavingDrawer ? 'Saving...' : 'Start review'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => handleSaveDrawerStatus(drawerStatus)}
                      disabled={isSavingDrawer}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="check2" size={15} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>
                        {isSavingDrawer
                          ? 'Saving...'
                          : drawerStatus === REPORT_STATUSES.RESOLVED
                            ? 'Save & Resolve'
                            : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.drawerCancelBtn,
                      isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' },
                    ]}
                    onPress={handleCloseDrawer}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.drawerCancelBtnText, isDarkMode && { color: '#F2F2F3' }]}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLESHEET
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
    minHeight: '100%',
  },
  containerDark: {
    backgroundColor: '#18181B',
  },
  textLight: {
    color: '#F5F5F5',
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },

  // ── Header Row ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    minWidth: 280,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  supportingText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    cursor: 'pointer',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  exportBtnDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5A00',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    cursor: 'pointer',
    shadowColor: '#FF5A00',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Priority Notification Banner ──
  priorityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  priorityBannerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 280,
  },
  priorityWarningIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityTextWrap: {
    flex: 1,
  },
  priorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  priorityHeadline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  urgentSafetyChip: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  urgentSafetyChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  priorityDescription: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  priorityActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    cursor: 'pointer',
  },
  priorityActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Summary Cards Grid ──
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  summaryCardDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },
  headerPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValueBlock: {
    marginVertical: 12,
  },
  summaryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#18181B',
    letterSpacing: -0.6,
  },
  ratingValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summarySubRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summarySubText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 3,
  },
  summaryTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F4F4F5',
    overflow: 'hidden',
    marginTop: 4,
  },
  summaryTrackFill: {
    height: '100%',
    borderRadius: 2,
  },
  positiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  positiveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  urgentBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  resolvedBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resolvedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },

  // ── Review Queue Card ──
  reviewQueueCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewQueueCardDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  queueSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  updatedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // ── Toolbar & Segmented Group ──
  queueToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  searchBoxDark: {
    backgroundColor: '#202124',
    borderColor: '#3A3B40',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    outlineStyle: 'none',
  },
  segmentedGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  segmentedGroupDark: {
    backgroundColor: '#202124',
    borderWidth: 1,
    borderColor: '#303236',
  },
  segmentedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    cursor: 'pointer',
  },
  segmentedBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentedBtnActiveDark: {
    backgroundColor: '#292B2F',
    borderWidth: 1,
    borderColor: '#3A3B40',
  },
  segmentedBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  segmentedCountBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  segmentedCountBadgeActive: {
    backgroundColor: '#F1F5F9',
  },
  segmentedCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  segmentedCountTextActive: {
    color: '#0F172A',
  },
  moreFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    cursor: 'pointer',
  },
  moreFiltersBtnDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  moreFiltersBtnActive: {
    borderColor: '#FF5A00',
    backgroundColor: '#FFF7ED',
  },
  moreFiltersBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Extended Filters Dropdown Panel
  extendedFiltersPanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  extendedFiltersPanelDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  extFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  extFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    minWidth: 70,
  },
  extPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  extPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    cursor: 'pointer',
  },
  extPillDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  extPillActive: {
    backgroundColor: '#FF5A00',
    borderColor: '#FF5A00',
  },
  extPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  extPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    cursor: 'pointer',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },

  // ── Desktop Table ──
  tableWrapper: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tableHeaderRowDark: {
    backgroundColor: '#202124',
    borderBottomColor: '#303236',
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  tableRowAlt: {
    backgroundColor: '#FAFCFF',
  },
  tableRowUrgent: {
    backgroundColor: '#FFFDFD',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  tableRowDark: {
    backgroundColor: '#191A1D',
    borderBottomColor: '#292B2F',
  },
  tdCell: {
    paddingRight: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowCustomerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedRowText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#059669',
  },
  unverifiedRowText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  ratingScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  ratingScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  reportBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C',
  },
  categoryChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  referenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  referenceChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tableMessagePreview: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  rowDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowActionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // ── Mobile Stacked Cards ──
  stackedCardsContainer: {
    gap: 12,
  },
  stackedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    cursor: 'pointer',
  },
  stackedCardDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  urgentCardHighlight: {
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    backgroundColor: '#FFFDFD',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  submissionDate: {
    fontSize: 11,
    color: '#64748B',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 5,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  cardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardMessagePreview: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  viewActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewActionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
  },

  // ── States ──
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },

  // ─────────────────────────────────────────────────────────────
  // 6. SELECTED-ITEM DETAIL DRAWER STYLES
  // ─────────────────────────────────────────────────────────────
  drawerBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 9999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerBackdropDismiss: {
    flex: 1,
    cursor: 'pointer',
  },
  drawerContent: {
    width: '100%',
    maxWidth: 520,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: 0 },
    display: 'flex',
    flexDirection: 'column',
  },
  drawerContentDark: {
    backgroundColor: '#18181B',
    borderLeftColor: '#303236',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  drawerRefPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  drawerRefPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  drawerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollInner: {
    padding: 20,
    gap: 16,
  },
  drawerUrgentBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  drawerUrgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerUrgentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  drawerUrgentDesc: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 17,
  },
  drawerSectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  drawerSectionCardDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  drawerSectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  drawerCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  drawerCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  drawerCustomerEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  drawerRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  drawerRatingScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  drawerMessageBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  drawerMessageBoxDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  drawerMessageText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  drawerTxBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 4,
  },
  drawerTxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  drawerTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  drawerTxValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  txStatusPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  txStatusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
  },

  // ── Timeline ──
  timelineList: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineLineWrap: {
    alignItems: 'center',
    width: 14,
    paddingTop: 3,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA580C',
  },
  timelineConnector: {
    width: 2,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineStepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  timelineStepTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  timelineStepNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // ── Admin Actions in Drawer ──
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    cursor: 'pointer',
  },
  statusOptionBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  drawerNotesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  },
  drawerNotesInputDark: {
    backgroundColor: '#202124',
    borderColor: '#3A3B40',
    color: '#F2F2F3',
  },
  drawerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF5A00',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    cursor: 'pointer',
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  drawerCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  drawerCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
