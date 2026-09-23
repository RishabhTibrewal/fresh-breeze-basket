import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { CheckCircle2, Clock, PackageCheck, Truck, Home } from 'lucide-react-native';

const TRACKING_STEPS = [
  {
    title: 'Order Placed & Confirmed',
    time: 'Today, 02:15 PM',
    done: true,
    active: false,
    icon: CheckCircle2,
  },
  {
    title: 'Packed at Warehouse',
    time: 'Today, 03:00 PM',
    done: true,
    active: false,
    icon: PackageCheck,
  },
  {
    title: 'Handed to Shiprocket Express Courier',
    time: 'Estimated Today, 06:00 PM',
    done: false,
    active: true,
    icon: Truck,
  },
  {
    title: 'Delivered to your Doorstep',
    time: 'Estimated 2 Business Days',
    done: false,
    active: false,
    icon: Home,
  },
];

export const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId = 'ORD-893212' } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Order Tracking</Text>
        <Text style={styles.orderId}>{orderId}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.etaContainer}>
            <Clock color={COLORS.accent} size={24} />
            <View style={styles.etaTextContainer}>
              <Text style={styles.etaLabel}>ESTIMATED NATIONWIDE DELIVERY</Text>
              <Text style={styles.etaValue}>2-3 Business Days</Text>
            </View>
          </View>
          <Text style={styles.courierTag}>Partnered with Shiprocket Express Shipping</Text>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shipment Status</Text>

          <View style={styles.timeline}>
            {TRACKING_STEPS.map((step, index) => {
              const IconComp = step.icon;
              return (
                <View key={index} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        step.done && styles.iconCircleDone,
                        step.active && styles.iconCircleActive,
                      ]}
                    >
                      <IconComp
                        color={
                          step.done ? '#FFF' : step.active ? COLORS.accent : COLORS.textDarkSecondary
                        }
                        size={18}
                      />
                    </View>

                    {index < TRACKING_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.line,
                          step.done && styles.lineDone,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.stepRight}>
                    <Text
                      style={[
                        styles.stepTitle,
                        step.active && styles.stepTitleActive,
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text style={styles.stepTime}>{step.time}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.homeButtonText}>Back to Shopping</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
  },
  headerTitle: {
    color: COLORS.textDarkPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  orderId: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.bgCardDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  cardTitle: {
    color: COLORS.textDarkPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaTextContainer: {
    marginLeft: SPACING.md,
  },
  etaLabel: {
    color: COLORS.textDarkSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  etaValue: {
    color: COLORS.textDarkPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  courierTag: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
  },
  timeline: {
    marginTop: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  iconCircleDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: COLORS.accent,
  },
  line: {
    width: 2,
    height: 30,
    backgroundColor: COLORS.borderDark,
    marginTop: 4,
  },
  lineDone: {
    backgroundColor: COLORS.primary,
  },
  stepRight: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    color: COLORS.textDarkSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  stepTitleActive: {
    color: COLORS.textDarkPrimary,
    fontWeight: '800',
  },
  stepTime: {
    color: COLORS.textDarkSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  homeButton: {
    backgroundColor: COLORS.bgCardDark,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    marginTop: SPACING.sm,
  },
  homeButtonText: {
    color: COLORS.textDarkPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
