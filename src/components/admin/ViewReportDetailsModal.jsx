import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import { REPORT_CATEGORIES, REPORT_STATUSES } from '../../services/feedback/ratingsReportsService.js';

export default function ViewReportDetailsModal({
  visible = false,
  submission = null,
  onClose = () => {},
  onSaveStatus = async () => {},
  isDarkMode = false,
  currentAdminName = 'Admin',
}) {
  const [prevSubmissionId, setPrevSubmissionId] = useState(() => submission?.id || null);
  const [selectedStatus, setSelectedStatus] = useState(() => submission?.status || 'New');
  const [adminNotes, setAdminNotes] = useState(() => submission?.adminNotes || '');
  const [dismissedReason, setDismissedReason] = useState(() => submission?.dismissedReason || '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Sync state when submission changes
  const currentSubmissionId = submission?.id || null;
  if (currentSubmissionId && currentSubmissionId !== prevSubmissionId) {
    setPrevSubmissionId(currentSubmissionId);
    setSelectedStatus(submission?.status || 'New');
    setAdminNotes(submission?.adminNotes || '');
    setDismissedReason(submission?.dismissedReason || '');
    setFeedbackMsg('');
  }

  if (!visible || !submission) return null;

  const isReport = submission.submissionType === 'customer_report';
  const categoryInfo = REPORT_CATEGORIES[submission.category?.toUpperCase()] || {
    label: submission.category || 'Feedback',
    color: '#64748B',
    icon: 'chat-square-text',
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setFeedbackMsg('');

    try {
      await onSaveStatus(submission.id, {
        status: selectedStatus,
        adminNotes: adminNotes.trim(),
        dismissedReason: selectedStatus === REPORT_STATUSES.DISMISSED ? dismissedReason.trim() : null,
        adminName: currentAdminName,
      });
      setFeedbackMsg('Status and admin review notes updated successfully.');
      setTimeout(() => {
        setFeedbackMsg('');
      }, 3500);
    } catch (e) {
      setFeedbackMsg('Failed to update: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = submission.createdAt
    ? new Date(submission.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Unknown Date';

  const lastReviewedFormatted = submission.reviewedAt
    ? new Date(submission.reviewedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const statusColors = {
    New: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    'Under Review': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
    Resolved: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
    Dismissed: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* ─── MODAL HEADER ─── */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrap, { backgroundColor: isReport ? '#FEE2E2' : '#FEF3C7' }]}>
                <BootstrapIcon
                  name={isReport ? 'exclamation-triangle-fill' : 'star-fill'}
                  size={16}
                  color={isReport ? '#DC2626' : '#D97706'}
                />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.modalTitle, isDarkMode && styles.textLight]}>
                    {isReport ? 'Customer Report Details' : 'Customer Rating & Review'}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: isReport ? '#FEF2F2' : '#FFFBEB',
                        borderColor: isReport ? '#FECACA' : '#FDE68A',
                      },
                    ]}
                  >
                    <Text style={[styles.typeBadgeText, { color: isReport ? '#DC2626' : '#B45309' }]}>
                      {isReport ? 'REPORT / COMPLAINT' : 'RATING & REVIEW'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalSub}>Submission ID: {submission.id}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* ─── BODY SCROLLVIEW ─── */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Success/Error Banner */}
            {feedbackMsg ? (
              <View
                style={[
                  styles.feedbackBanner,
                  feedbackMsg.startsWith('Failed') ? styles.bannerError : styles.bannerSuccess,
                ]}
              >
                <BootstrapIcon
                  name={feedbackMsg.startsWith('Failed') ? 'exclamation-circle-fill' : 'check-circle-fill'}
                  size={14}
                  color={feedbackMsg.startsWith('Failed') ? '#DC2626' : '#15803D'}
                />
                <Text
                  style={[
                    styles.feedbackBannerText,
                    feedbackMsg.startsWith('Failed') ? styles.textError : styles.textSuccess,
                  ]}
                >
                  {feedbackMsg}
                </Text>
              </View>
            ) : null}

            {/* ── SECTION 1: CUSTOMER INFORMATION ── */}
            <View style={[styles.sectionCard, isDarkMode && styles.sectionCardDark]}>
              <View style={styles.sectionHeaderRow}>
                <BootstrapIcon name="person-badge" size={14} color="#EA580C" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
                  Customer Information
                </Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>CUSTOMER NAME</Text>
                  <Text style={[styles.fieldValue, isDarkMode && styles.textLight]}>
                    {submission.customerName || 'Anonymous Rider'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>CUSTOMER EMAIL</Text>
                  <Text style={[styles.fieldValue, isDarkMode && styles.textLight]}>
                    {submission.customerEmail || 'Not Provided (Verified Rider)'}
                  </Text>
                </View>

                <View style={styles.infoColFull}>
                  <Text style={styles.fieldLabel}>DATE SUBMITTED</Text>
                  <Text style={[styles.fieldValue, isDarkMode && styles.textLight, styles.tabularNums]}>
                    {formattedDate}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── SECTION 2: RATING AND FEEDBACK ── */}
            <View style={[styles.sectionCard, isDarkMode && styles.sectionCardDark]}>
              <View style={styles.sectionHeaderRow}>
                <BootstrapIcon name="chat-square-quote" size={14} color="#EA580C" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
                  Rating and Customer Feedback
                </Text>
              </View>

              <View style={styles.ratingCategoryRow}>
                {/* Star rating if provided */}
                <View style={styles.ratingBox}>
                  <Text style={styles.fieldLabel}>RATING</Text>
                  {submission.rating != null ? (
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <BootstrapIcon
                          key={star}
                          name={star <= Math.round(submission.rating) ? 'star-fill' : 'star'}
                          size={15}
                          color={star <= Math.round(submission.rating) ? '#D97706' : '#D1D5DB'}
                        />
                      ))}
                      <Text style={[styles.ratingScore, styles.tabularNums]}>
                        {Number(submission.rating).toFixed(1)} / 5.0
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noRatingText}>No star rating submitted (Report)</Text>
                  )}
                </View>

                {/* Category Badge */}
                <View style={styles.categoryBox}>
                  <Text style={styles.fieldLabel}>REPORT CATEGORY</Text>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: categoryInfo.color + '18', borderColor: categoryInfo.color + '40' },
                    ]}
                  >
                    <BootstrapIcon name={categoryInfo.icon} size={12} color={categoryInfo.color} />
                    <Text style={[styles.categoryBadgeText, { color: categoryInfo.color }]}>
                      {categoryInfo.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Full Customer Written Message */}
              <View style={styles.messageBoxWrap}>
                <Text style={styles.fieldLabel}>FULL CUSTOMER MESSAGE</Text>
                <View style={[styles.messageBox, isDarkMode && styles.messageBoxDark]}>
                  <Text style={[styles.messageText, isDarkMode && styles.textLight]}>
                    {submission.message || 'No written message provided.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── SECTION 3: RELATED TRANSACTION ── */}
            <View style={[styles.sectionCard, isDarkMode && styles.sectionCardDark]}>
              <View style={styles.sectionHeaderRow}>
                <BootstrapIcon name="link-45deg" size={15} color="#EA580C" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
                  Related Transaction & Context
                </Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>TRANSACTION TYPE</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { textTransform: 'capitalize' },
                      isDarkMode && styles.textLight,
                    ]}
                  >
                    {submission.transactionType || 'General System Feedback'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>REFERENCE ID</Text>
                  <Text
                    style={[styles.fieldValue, styles.tabularNums, { color: '#EA580C', fontWeight: '600' }]}
                  >
                    {submission.transactionId || 'None'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>ITEM / SERVICE REFERENCE</Text>
                  <Text style={[styles.fieldValue, isDarkMode && styles.textLight]}>
                    {submission.transactionRef || 'General Platform Experience'}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>TRANSACTION STATUS</Text>
                  <Text style={[styles.fieldValue, isDarkMode && styles.textLight]}>
                    {submission.transactionStatus || 'Completed'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── SECTION 4: ADMIN REVIEW WORKFLOW ── */}
            <View
              style={[
                styles.sectionCard,
                styles.adminWorkflowCard,
                isDarkMode && styles.adminWorkflowCardDark,
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <BootstrapIcon name="shield-check" size={14} color="#EA580C" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textLight]}>
                  Admin Review & Investigation Workflow
                </Text>
                <View
                  style={[
                    styles.currentStatusPill,
                    {
                      backgroundColor: (statusColors[submission.status] || statusColors.New).bg,
                      borderColor: (statusColors[submission.status] || statusColors.New).border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.currentStatusPillText,
                      { color: (statusColors[submission.status] || statusColors.New).text },
                    ]}
                  >
                    Current: {submission.status || 'New'}
                  </Text>
                </View>
              </View>

              {/* Status Selector Buttons */}
              <Text style={styles.fieldLabel}>UPDATE REVIEW STATUS</Text>
              <View style={styles.statusButtonsRow}>
                {[
                  { key: REPORT_STATUSES.NEW, label: '1. New', icon: 'asterisk' },
                  { key: REPORT_STATUSES.UNDER_REVIEW, label: '2. Under Review', icon: 'search' },
                  { key: REPORT_STATUSES.RESOLVED, label: '3. Resolved', icon: 'check-circle' },
                  { key: REPORT_STATUSES.DISMISSED, label: '4. Dismissed', icon: 'x-circle' },
                ].map((s) => {
                  const isSelected = selectedStatus === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.statusBtn,
                        isSelected && styles.statusBtnSelected,
                        isSelected && { borderColor: '#EA580C', backgroundColor: '#EA580C10' },
                      ]}
                      onPress={() => setSelectedStatus(s.key)}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name={s.icon} size={12} color={isSelected ? '#EA580C' : '#64748B'} />
                      <Text
                        style={[styles.statusBtnText, isSelected && { color: '#EA580C', fontWeight: '600' }]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Dismissed Reason (if Dismissed is selected) */}
              {selectedStatus === REPORT_STATUSES.DISMISSED && (
                <View style={styles.dismissedBoxWrap}>
                  <Text style={[styles.fieldLabel, { color: '#DC2626' }]}>
                    REASON FOR DISMISSAL (REQUIRED FOR AUDIT TRAIL)
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.dismissedInput, isDarkMode && styles.textInputDark]}
                    placeholder="e.g. Inconclusive report, duplicate submission, or resolved verbally with customer..."
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    value={dismissedReason}
                    onChangeText={setDismissedReason}
                  />
                </View>
              )}

              {/* Internal Admin Notes */}
              <View style={styles.notesWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>INTERNAL ADMIN NOTES (STAFF ONLY)</Text>
                  <Text style={styles.fieldSub}>Not visible to customers</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.notesInput, isDarkMode && styles.textInputDark]}
                  placeholder="Record investigation findings, customer contact outcomes, or replacement parts dispatched..."
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  multiline={true}
                  numberOfLines={4}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                />
              </View>

              {/* Audit Trail Row */}
              {submission.reviewedBy && (
                <View style={styles.auditRow}>
                  <BootstrapIcon name="clock-history" size={12} color="#64748B" />
                  <Text style={styles.auditText}>
                    Last reviewed by <Text style={{ fontWeight: '600' }}>{submission.reviewedBy}</Text>
                    {lastReviewedFormatted ? ` on ${lastReviewedFormatted}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* ─── FOOTER CONTROLS ─── */}
          <View style={[styles.footer, isDarkMode && styles.footerDark]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BootstrapIcon name="check2" size={15} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Review Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#1E293B',
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontFamily: 'Inter',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    padding: 20,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  sectionCardDark: {
    backgroundColor: '#0F172A40',
    borderColor: '#334155',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F080',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoCol: {
    width: '47%',
  },
  infoColFull: {
    width: '100%',
  },
  fieldLabel: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldSub: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
  ratingCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 12,
  },
  ratingBox: {
    minWidth: 160,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScore: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
    marginLeft: 6,
  },
  noRatingText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  categoryBox: {
    minWidth: 180,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBoxWrap: {
    marginTop: 4,
  },
  messageBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    minHeight: 80,
  },
  messageBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  messageText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  adminWorkflowCard: {
    borderColor: '#EA580C40',
    backgroundColor: '#FFF7ED40',
  },
  adminWorkflowCardDark: {
    borderColor: '#EA580C40',
    backgroundColor: '#1E293B',
  },
  currentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  currentStatusPillText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '600',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  statusBtnSelected: {
    borderWidth: 1.5,
  },
  statusBtnText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  dismissedBoxWrap: {
    marginBottom: 14,
  },
  dismissedInput: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  notesWrap: {
    marginBottom: 12,
  },
  textInput: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
  },
  textInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  notesInput: {
    minHeight: 85,
    textAlignVertical: 'top',
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  auditText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#64748B',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  bannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  feedbackBannerText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
  },
  textSuccess: {
    color: '#15803D',
  },
  textError: {
    color: '#DC2626',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  footerDark: {
    backgroundColor: '#1E293B',
    borderTopColor: '#334155',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#EA580C',
  },
  saveBtnText: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textLight: {
    color: '#F8FAFC',
  },
});
