import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
} from 'react-native';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';

const TERMS_URL = 'https://www.gofreshco.com/terms-of-service';

export const TermsOfServiceScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.primaryDark} size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <Text style={styles.headerSubtitle}>gofreshco • com.gofreshco.app</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <FileText color={COLORS.primaryDark} size={20} />
            <Text style={styles.bannerTitle}>Last Updated: November 21, 2026</Text>
          </View>
          <Text style={styles.bannerText}>
            By using the gofreshco mobile app or www.gofreshco.com, you agree to these Terms of Service.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Accounts &amp; Eligibility</Text>
          <Text style={styles.bodyText}>
            You must provide accurate account details and keep your login credentials secure. You are responsible for
            all orders and activity under your account.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Products, Pricing &amp; Orders</Text>
          <Text style={styles.bodyText}>
            All products and prices are subject to availability. Payments are processed securely through Stripe (or
            Cash on Delivery where available). If an item is unavailable after ordering, we will notify you and refund
            any amount paid for that item.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Delivery &amp; Returns</Text>
          <Text style={styles.bodyText}>
            Delivery times are estimates and may vary due to traffic or weather. For damaged, missing, or quality
            issues, report within 24 hours of delivery for a replacement or refund.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. Acceptable Use &amp; IP</Text>
          <Text style={styles.bodyText}>
            You agree not to misuse the app, attempt unauthorized access, or engage in fraudulent orders. All app
            branding, content, and software belong to GoFreshCo.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5. Privacy &amp; Liability</Text>
          <Text style={styles.bodyText}>
            Your data is handled under our Privacy Policy. To the extent permitted by law, GoFreshCo&apos;s liability
            for any order claim is limited to the amount paid for that order.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>6. Contact</Text>
          <Text style={styles.bodyText}>
            Questions about these terms? Email us at <Text style={styles.bold}>support@gofreshco.com</Text> or visit{' '}
            <Text style={styles.bold}>www.gofreshco.com/contact</Text>.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.webLinkBtn}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          <Text style={styles.webLinkBtnText}>Open Full Terms on Web</Text>
          <ExternalLink color="#FFF" size={16} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  backBtn: {
    padding: 6,
    marginRight: SPACING.sm,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    gap: SPACING.sm + 2,
  },
  bannerCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  bannerText: {
    fontSize: 13,
    color: COLORS.textBody,
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    color: COLORS.textBody,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  webLinkBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.xs,
  },
  webLinkBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

