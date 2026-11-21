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
import { ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';

const PRIVACY_URL = 'https://www.gofreshco.com/privacy-policy';

export const PrivacyPolicyScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.primaryDark} size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>gofreshco • com.gofreshco.app</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <ShieldCheck color={COLORS.primaryDark} size={20} />
            <Text style={styles.bannerTitle}>Last Updated: November 21, 2026</Text>
          </View>
          <Text style={styles.bannerText}>
            This Privacy Policy explains how GoFreshCo collects, uses, and protects your data when you use the
            gofreshco mobile app and website.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.bold}>Account & Contact Info:</Text> Name, email address, phone number, and login
            credentials.{'\n'}
            • <Text style={styles.bold}>Delivery Addresses:</Text> Street, city, state, and postal/PIN code for order
            delivery.{'\n'}
            • <Text style={styles.bold}>Location (Optional):</Text> Approximate/precise location only if you grant
            permission, used to detect delivery addresses and check delivery availability.{'\n'}
            • <Text style={styles.bold}>Orders & Payments:</Text> Order history and transaction details. Payments are
            processed securely via Stripe; we do not store full card numbers or CVV.{'\n'}
            • <Text style={styles.bold}>Notifications & Diagnostics:</Text> Push notification tokens for order updates
            and basic crash/error logs.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
          <Text style={styles.bodyText}>
            We use your information to create and manage your account, process and deliver orders, handle secure
            payments and refunds, send order status notifications, and provide customer support.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Data Sharing & Third Parties</Text>
          <Text style={styles.bodyText}>
            We do not sell your personal information. Data is shared only with essential service providers: Stripe
            (payments), Supabase (secure authentication & database), Expo/FCM (push notifications), and delivery
            personnel (name, address, phone needed for delivery).
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.bodyText}>
            All network traffic is encrypted in transit using HTTPS/TLS, and payments are handled through PCI-DSS
            compliant Stripe infrastructure.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5. Data Retention & Account Deletion</Text>
          <Text style={styles.bodyText}>
            We retain account data while your account is active and transaction records as required for tax/legal
            compliance. To request permanent account and data deletion, email{' '}
            <Text style={styles.bold}>support@gofreshco.com</Text> with the subject &ldquo;Account Deletion
            Request&rdquo; from your registered email. Requests are processed within 30 days.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>6. Children&apos;s Privacy & Contact</Text>
          <Text style={styles.bodyText}>
            This app is not directed to children under 13 and we do not knowingly collect data from children. For
            privacy questions, contact <Text style={styles.bold}>support@gofreshco.com</Text>.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.webLinkBtn}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          <Text style={styles.webLinkBtnText}>Open Full Policy on Web</Text>
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

