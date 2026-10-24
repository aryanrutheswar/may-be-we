import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/authContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, logout, setIsPasswordRecovery } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Set a new password — May Be We';
    }

    let isMounted = true;

    async function verifyRecoverySession() {
      try {
        setCheckingSession(true);

        // Check for error parameters in URL on Web (e.g. expired link)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlString = window.location.href;
          let parsedError = null;

          try {
            const parsed = new URL(urlString.replace('#', '?'));
            parsedError =
              parsed.searchParams.get('error_description') ||
              parsed.searchParams.get('error');
          } catch {
            const errorMatch =
              urlString.match(/[?&#]error_description=([^&#]+)/) ||
              urlString.match(/[?&#]error=([^&#]+)/);
            if (errorMatch) parsedError = decodeURIComponent(errorMatch[1]);
          }

          if (parsedError) {
            if (isMounted) {
              setUrlError(
                parsedError.includes('expired')
                  ? 'This password reset link has expired. Please request a new one.'
                  : parsedError
              );
              setCheckingSession(false);
            }
            return;
          }

          // Check if there is a PKCE code or access_token in the URL to exchange
          const searchParams = new URLSearchParams(window.location.search);
          const hash = window.location.hash || '';
          const code = searchParams.get('code');

          if (code && isSupabaseConfigured) {
            try {
              const { data: exData, error: exErr } =
                await supabase.auth.exchangeCodeForSession(code);
              if (!exErr && exData?.session) {
                if (isMounted) {
                  setHasValidSession(true);
                  setIsPasswordRecovery(true);
                  setCheckingSession(false);
                }
                return;
              }
            } catch (exchangeCatchErr) {
              console.warn('PKCE code exchange error:', exchangeCatchErr);
            }
          } else if (hash.includes('access_token') && isSupabaseConfigured) {
            try {
              const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              if (accessToken && refreshToken) {
                const { data: sData, error: sErr } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (!sErr && sData?.session) {
                  if (isMounted) {
                    setHasValidSession(true);
                    setIsPasswordRecovery(true);
                    setCheckingSession(false);
                  }
                  return;
                }
              }
            } catch (hashCatchErr) {
              console.warn('Hash session parse error:', hashCatchErr);
            }
          }
        }

        // Verify active Supabase session
        if (isSupabaseConfigured) {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          if (isMounted) {
            if (currentSession?.user) {
              setHasValidSession(true);
              setIsPasswordRecovery(true);
            } else {
              setHasValidSession(false);
            }
            setCheckingSession(false);
          }
        } else {
          // Demo fallback: permit reset for interface testing
          if (isMounted) {
            setHasValidSession(true);
            setCheckingSession(false);
          }
        }
      } catch (err) {
        console.warn('Error verifying recovery session:', err);
        if (isMounted) {
          setHasValidSession(false);
          setCheckingSession(false);
        }
      }
    }

    verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdatePassword = async () => {
    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword) {
      setErrorMessage('Please enter your new password.');
      return;
    }

    if (trimmedPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setErrorMessage('Both passwords must match.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({
          password: trimmedPassword,
        });

        if (error) {
          setErrorMessage(error.message || 'Failed to update password. Please try again.');
          return;
        }

        setIsSuccess(true);
      } else {
        // Demo mode fallback
        setIsSuccess(true);
      }
    } catch (err) {
      console.warn('Update user password error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToLogin = async () => {
    try {
      if (logout) {
        await logout();
      }
    } catch {}
    setIsPasswordRecovery(false);
    router.replace('/(auth)/login');
  };

  const handleRequestNewLink = () => {
    router.replace('/(auth)/forgot-password');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 20, 48),
            paddingBottom: Math.max(insets.bottom + 24, 40),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Logo / Title Header */}
        <Text style={styles.brandTitle}>May Be We</Text>

        {/* Card Container */}
        <View style={styles.card}>
          {checkingSession ? (
            /* Loading State */
            <View style={styles.stateWrapper}>
              <ActivityIndicator size="large" color="#2563EB" style={{ marginBottom: 16 }} />
              <Text style={styles.stateTitle}>Verifying reset link...</Text>
              <Text style={styles.stateSubtitle}>Please wait a moment.</Text>
            </View>
          ) : urlError ? (
            /* Expired / Invalid URL Error */
            <View style={styles.stateWrapper}>
              <Ionicons name="alert-circle-outline" size={44} color="#DC2626" style={{ marginBottom: 12 }} />
              <Text style={styles.stateTitle}>Link Expired</Text>
              <Text style={styles.stateSubtitle}>{urlError}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestNewLink}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Request a new reset email</Text>
              </TouchableOpacity>
            </View>
          ) : !hasValidSession && !session?.user ? (
            /* Session expired or direct access without token */
            <View style={styles.stateWrapper}>
              <Ionicons name="key-outline" size={44} color="#D97706" style={{ marginBottom: 12 }} />
              <Text style={styles.stateTitle}>Session Expired</Text>
              <Text style={styles.stateSubtitle}>
                This password reset link is invalid or has expired.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestNewLink}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Request a new reset email</Text>
              </TouchableOpacity>
            </View>
          ) : isSuccess ? (
            /* Password Reset Success Card */
            <View style={styles.stateWrapper}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" style={{ marginBottom: 12 }} />
              <Text style={styles.stateTitle}>Password Updated</Text>
              <Text style={styles.stateSubtitle}>
                Your password has been changed successfully. You can now log in with your new password.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNavigateToLogin}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Log in with new password</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form matching design */
            <>
              <Text style={styles.cardHeading}>Set a new password</Text>
              <Text style={styles.cardSubtitle}>
                Choose a password you have not used before. This link works once and expires soon.
              </Text>

              {/* New Password Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    style={styles.visibilityToggle}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm new password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type it again"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleUpdatePassword}
                  />
                  <TouchableOpacity
                    style={styles.visibilityToggle}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Both passwords must match.</Text>
              </View>

              {/* Inline Error Message */}
              {errorMessage ? (
                <View style={styles.errorAlert}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorAlertText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Update Password Button */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleUpdatePassword}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update password</Text>
                )}
              </TouchableOpacity>

              {/* Card Footer: Request new reset email */}
              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>Link expired? </Text>
                <TouchableOpacity onPress={handleRequestNewLink}>
                  <Text style={styles.footerLink}>Request a new reset email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Back to Login Link Below Card */}
        <TouchableOpacity
          onPress={handleNavigateToLogin}
          style={styles.backToLoginWrapper}
          accessibilityRole="button"
        >
          <Text style={styles.backToLoginLink}>Back to login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: -0.2,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 36,
    paddingVertical: 36,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  cardHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    color: '#4B5563',
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    height: 46,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  visibilityToggle: {
    padding: 6,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorAlertText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 13.5,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 13.5,
    color: '#2563EB',
    fontWeight: '500',
  },
  backToLoginWrapper: {
    marginTop: 22,
    paddingVertical: 6,
    alignItems: 'center',
  },
  backToLoginLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  stateWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    textAlign: 'center',
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
});
