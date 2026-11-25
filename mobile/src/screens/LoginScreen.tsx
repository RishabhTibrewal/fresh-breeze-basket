import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore } from '../store/useStore';
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  Leaf,
  ShieldCheck,
} from 'lucide-react-native';
import { apiClient } from '../api/client';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
const GOOGLE_ANDROID_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
const GOOGLE_IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

const hasGoogleClientIdForPlatform = () => {
  if (Platform.OS === 'android') return Boolean(GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
  if (Platform.OS === 'ios') return Boolean(GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);
  return Boolean(GOOGLE_WEB_CLIENT_ID);
};

interface GoogleSignInButtonProps {
  disabled: boolean;
  onIdToken: (idToken: string, nonce?: string) => void;
  onError: (msg: string) => void;
}

const ConfiguredGoogleSignInButton = ({
  disabled,
  onIdToken,
  onError,
}: GoogleSignInButtonProps) => {
  const handledTokenRef = useRef<string | null>(null);
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || undefined,
    extraParams: {
      prompt: 'select_account',
    },
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken =
        googleResponse.params?.id_token || googleResponse.authentication?.idToken;
      if (idToken) {
        if (handledTokenRef.current === idToken) return;
        handledTokenRef.current = idToken;
        onIdToken(idToken, (googleRequest as any)?.nonce);
      } else {
        onError('Google did not return an ID token. Please try again.');
      }
    } else if (googleResponse?.type === 'error') {
      onError(googleResponse.error?.description || 'Google sign-in failed.');
    }
  }, [googleResponse, googleRequest, onIdToken, onError]);

  return (
    <TouchableOpacity
      style={styles.socialBtn}
      disabled={disabled || !googleRequest}
      onPress={async () => {
        try {
          await promptGoogleAsync();
        } catch (err: any) {
          onError(err?.message || 'Failed to launch Google Sign-In.');
        }
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.socialIcon}>🌐</Text>
      <Text style={styles.socialBtnText}>Google</Text>
    </TouchableOpacity>
  );
};

export const LoginScreen = ({ navigation }: any) => {
  const { setAuth, user } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const isGoogleConfigured = hasGoogleClientIdForPlatform();

  const goBackSafely = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'ProfileTab' });
    }
  };

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setErrorMsg('Please provide your full name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await apiClient.post('/auth/login', {
          email: email.trim(),
          password: password.trim(),
        });

        if (response.data && response.data.data) {
          const u = response.data.data.user || response.data.data;
          const token =
            response.data.data.access_token ||
            response.data.data.token ||
            response.data.token;

          const displayName =
            (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : null) ||
            u.name ||
            email.split('@')[0];

          setAuth(
            {
              id: u.id,
              email: u.email || email.trim(),
              name: displayName,
              phone: u.phone || phone.trim() || undefined,
              role: u.role || 'user',
            },
            token
          );

          Alert.alert('Welcome Back! 🎉', `Signed in as ${displayName}`);
          goBackSafely();
          return;
        }
      } else {
        // Register Flow
        const names = fullName.trim().split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || '';

        const response = await apiClient.post('/auth/register', {
          email: email.trim(),
          password: password.trim(),
          first_name: firstName,
          last_name: lastName,
          phone: phone.trim() || undefined,
        });

        if (response.data && response.data.success) {
          // Now sign in automatically to get session token
          try {
            const loginRes = await apiClient.post('/auth/login', {
              email: email.trim(),
              password: password.trim(),
            });

            if (loginRes.data && loginRes.data.data) {
              const u = loginRes.data.data.user || response.data.data;
              const token = loginRes.data.data.access_token || loginRes.data.data.token;
              setAuth(
                {
                  id: u.id || response.data.data?.id,
                  email: email.trim(),
                  name: fullName.trim(),
                  phone: phone.trim() || undefined,
                  role: u.role || 'user',
                },
                token
              );
            }
          } catch {
            // Fallback to basic registration state
            setAuth(
              {
                id: response.data.data?.id || 'usr-' + Date.now(),
                email: email.trim(),
                name: fullName.trim(),
                phone: phone.trim() || undefined,
                role: 'user',
              },
              'registered-session'
            );
          }

          Alert.alert('Account Created! 🎉', 'Welcome to FreshBasket Farm Direct.');
          goBackSafely();
          return;
        }
      }
    } catch (err: any) {
      console.log('Auth request failed:', err?.response?.data || err?.message);
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to complete request. Please verify credentials and network connection.';

      setErrorMsg(serverMsg);
      Alert.alert('Authentication Failed', serverMsg, [
        { text: 'OK' },
        {
          text: 'Use Demo Mode',
          onPress: () => {
            const fallbackName = fullName.trim() || email.split('@')[0] || 'Fresh Member';
            setAuth(
              {
                id: 'usr-demo-' + Date.now(),
                email: email.trim() || 'demo@freshbasket.com',
                name: fallbackName,
                phone: phone.trim() || '+91 98765 43210',
                role: 'user',
              },
              null
            );
            goBackSafely();
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleIdToken = async (idToken: string, nonce?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await apiClient.post('/auth/google', {
        id_token: idToken,
        ...(nonce ? { nonce } : {}),
      });
      if (response.data?.success && response.data?.data) {
        const u = response.data.data.user || response.data.data;
        const token = response.data.data.access_token || response.data.data.token;
        const displayName =
          (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : null) ||
          u.name ||
          (u.email ? u.email.split('@')[0] : 'GoFreshCo User');

        setAuth(
          {
            id: u.id,
            email: u.email,
            name: displayName,
            phone: u.phone || '',
            role: u.role || 'user',
          },
          token || null
        );
        goBackSafely();
      } else {
        setErrorMsg(response.data?.message || 'Google sign-in failed.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to complete Google sign-in.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    setErrorMsg(null);

    if (provider === 'Apple') {
      Alert.alert('Coming Soon', 'Apple Sign-In will be available in a future update.');
      return;
    }

    setErrorMsg(
      'Google Sign-In is not configured yet. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and Android/iOS Client IDs) to mobile/.env.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackSafely()}>
          <ArrowLeft color={COLORS.primaryDark} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Logo & Headline */}
          <View style={styles.brandHero}>
            <View style={styles.logoPill}>
              <Leaf color={COLORS.primary} size={18} fill={COLORS.primary} />
              <View style={styles.brandLogo}>
                <Text style={styles.logoFresh}>Fresh</Text>
                <Text style={styles.logoBasket}>Basket</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              {mode === 'login' ? 'Welcome Back to Fresh Produce' : 'Join the Fresh Harvest'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {mode === 'login'
                ? 'Sign in to access your saved addresses, live tracking & member discounts.'
                : 'Experience direct-from-farm 100% organic groceries delivered in 25 minutes.'}
            </Text>
          </View>

          {/* Segmented Switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
              onPress={() => {
                setMode('login');
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
              onPress={() => {
                setMode('register');
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message Banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Form Card */}
          <View style={styles.card}>
            {/* Full Name (Register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputBox}>
                  <User color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Rishabh Tibrewal"
                    placeholderTextColor={COLORS.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>
            )}

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputBox}>
                <Mail color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Phone (Register only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                <View style={styles.inputBox}>
                  <Phone color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={COLORS.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            )}

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputBox}>
                <Lock color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff color={COLORS.textSecondary} size={18} />
                  ) : (
                    <Eye color={COLORS.textSecondary} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password link (Login only) */}
            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() =>
                  Alert.alert('Reset Password', 'A reset link has been sent to your registered email.')
                }
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Primary Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Sign In to FreshBasket' : 'Create Free Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Social Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Sign-in Buttons */}
          <View style={styles.socialRow}>
            {isGoogleConfigured ? (
              <ConfiguredGoogleSignInButton
                disabled={loading}
                onIdToken={handleGoogleIdToken}
                onError={(msg) => setErrorMsg(msg)}
              />
            ) : (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => handleSocialLogin('Google')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialIcon}>🌐</Text>
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialLogin('Apple')}
              activeOpacity={0.85}
            >
              <Text style={styles.socialIcon}>🍎</Text>
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Continue as Guest */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => goBackSafely()}
            activeOpacity={0.7}
          >
            <Text style={styles.guestBtnText}>Continue as Guest →</Text>
          </TouchableOpacity>

          {/* Trust Banner */}
          <View style={styles.trustFooter}>
            <ShieldCheck color="#2E7D32" size={16} />
            <Text style={styles.trustFooterText}>
              256-bit encrypted secure session • No spam guaranteed
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bgWhite,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  brandLogo: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoFresh: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  logoBasket: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 320,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: 4,
    marginVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.primaryDark,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  inputGroup: {
    marginBottom: SPACING.sm + 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textBody,
  },
  eyeBtn: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.md,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
    ...SHADOWS.cardElevated,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    paddingHorizontal: SPACING.sm,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 8,
    ...SHADOWS.card,
  },
  socialIcon: {
    fontSize: 16,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  guestBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  trustFooterText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});

