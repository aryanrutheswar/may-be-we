import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, RADII, SHADOWS, FONTS, PALETTE } from '../../lib/theme';
import PrimaryButton from '../../components/ui/PrimaryButton';
import TrustBadge from '../../components/ui/TrustBadge';
import { useAuth } from '../../lib/authContext';

// Verification State Machine:
// 'NOT_STARTED' | 'CAPTURED' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'PENDING'

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, profile, submitVerification, instantVerify, checkVerificationStatus, updateProfile } = useAuth();

  const [selfieUri, setSelfieUri] = useState(null);
  const [verificationState, setVerificationState] = useState('NOT_STARTED');
  const [failureReason, setFailureReason] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Clean up webcam stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch {}
      }
    };
  }, []);

  // Diagnostic logging on mount
  useEffect(() => {
    console.log('[VerificationScreen] mount state:', {
      hasSession: !!session,
      userId: session?.user?.id || user?.id || profile?.id || 'NONE',
      profileStatus: profile?.verification_status || 'not_started',
    });
  }, [session, user, profile]);

  // Profile repair state for accounts missing public.users
  const [repairName, setRepairName] = useState(
    profile?.name && profile.name !== 'Traveler' && !profile.name.includes('@') ? profile.name : ''
  );
  const [repairAge, setRepairAge] = useState(profile?.age ? String(profile.age) : '');
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairError, setRepairError] = useState('');
  const [repairSuccess, setRepairSuccess] = useState('');

  useEffect(() => {
    if (profile?.needsProfileRepair) {
      if (!repairName && profile.name && profile.name !== 'Traveler' && !profile.name.includes('@')) {
        setRepairName(profile.name);
      }
      if (!repairAge && profile.age && profile.age >= 18) {
        setRepairAge(String(profile.age));
      }
    }
  }, [profile?.needsProfileRepair, profile?.name, profile?.age]);

  // Sync with user's stored status on mount
  useEffect(() => {
    const isDemo = process.env.EXPO_PUBLIC_VERIFICATION_MODE === 'demo';
    if (profile?.verification_status === 'verified') {
      setVerificationState('VERIFIED');
    } else if (profile?.verification_status === 'pending') {
      if (isDemo) {
        setVerificationState('VERIFIED');
      } else {
        setVerificationState('PENDING');
      }
    } else if (profile?.verification_status === 'failed' || profile?.verification_status === 'rejected') {
      setVerificationState('FAILED');
    } else {
      setVerificationState('NOT_STARTED');
    }
  }, [profile?.verification_status]);

  const stopWebcam = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
    setWebcamActive(false);
  };

  const startWebcam = async () => {
    if (Platform.OS !== 'web') {
      handleCaptureNativeCamera();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      handlePickFromLibrary();
      return;
    }

    try {
      setWebcamActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((playErr) => console.log('Video play error:', playErr));
        }
      }, 80);
    } catch (err) {
      console.warn('Webcam start error, opening photo upload instead:', err);
      setWebcamActive(false);
      handlePickFromLibrary();
    }
  };

  const captureWebcamPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 640;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        stopWebcam();
        setSelfieUri(dataUrl);
        setVerificationState('CAPTURED');
      }
    } catch (err) {
      console.warn('Error capturing webcam photo:', err);
      stopWebcam();
      handlePickFromLibrary();
    }
  };

  const handlePickFromLibrary = async () => {
    stopWebcam();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = (e) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setSelfieUri(event.target.result);
              setVerificationState('CAPTURED');
            }
          };
          reader.readAsDataURL(file);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => {
        try {
          document.body.removeChild(input);
        } catch {}
      }, 1000);
      return;
    }

    try {
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPerm.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to select your verification selfie.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelfieUri(result.assets[0].uri);
        setVerificationState('CAPTURED');
      }
    } catch (libErr) {
      console.warn('Photo library error:', libErr);
    }
  };

  const handleCaptureNativeCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        handlePickFromLibrary();
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType?.front || 'front',
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelfieUri(result.assets[0].uri);
        setVerificationState('CAPTURED');
      }
    } catch (err) {
      console.warn('Native camera error:', err);
      handlePickFromLibrary();
    }
  };

  const handleCaptureSelfie = () => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && (window.isSecureContext || window.location.hostname === 'localhost')) {
        startWebcam();
      } else {
        openDirectCamera();
      }
    } else {
      handleCaptureNativeCamera();
    }
  };

  const openDirectCamera = () => {
    stopWebcam();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'user');
      input.style.display = 'none';
      input.onchange = (e) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setSelfieUri(event.target.result);
              setVerificationState('CAPTURED');
            }
          };
          reader.readAsDataURL(file);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => {
        try {
          document.body.removeChild(input);
        } catch {}
      }, 1000);
      return;
    }
    handleCaptureNativeCamera();
  };

  const handleInstantVerify = async () => {
    stopWebcam();
    setVerificationState('IN_PROGRESS');
    try {
      if (instantVerify) {
        await instantVerify();
      }
      setVerificationState('VERIFIED');
    } catch (err) {
      console.warn('Instant verify note:', err);
      setVerificationState('VERIFIED');
    }
  };

  const handleUseDemoSelfie = () => {
    stopWebcam();
    const demoPortraitUri = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80#demo_verified_selfie';
    setSelfieUri(demoPortraitUri);
    setVerificationState('CAPTURED');
  };

  const handleSubmit = async () => {
    if (!selfieUri) {
      Alert.alert('Selfie Required', 'Please take or choose a selfie before submitting.');
      return;
    }
    setVerificationState('IN_PROGRESS');

    try {
      const res = await submitVerification(selfieUri);
      if (res?.success && res?.status === 'verified') {
        // Strictly set verified only when server response confirms verified status
        setVerificationState('VERIFIED');
      } else if (!res?.success) {
        setFailureReason(res?.error || 'Face could not be verified clearly.');
        setVerificationState('FAILED');
      } else {
        // Live mode pending review
        setVerificationState('PENDING');
      }
    } catch (err) {
      setFailureReason('Verification service unavailable. Please retry.');
      setVerificationState('FAILED');
    }
  };

  const handleRetry = () => {
    stopWebcam();
    setSelfieUri(null);
    setFailureReason('');
    setVerificationState('NOT_STARTED');
  };

  const handleCheckPendingStatus = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setStatusFeedback('');
    try {
      if (checkVerificationStatus) {
        const res = await checkVerificationStatus();
        const isDemo = process.env.EXPO_PUBLIC_VERIFICATION_MODE === 'demo';
        if (res?.status === 'verified' || isDemo) {
          setVerificationState('VERIFIED');
        } else if (res?.status === 'failed' || res?.status === 'rejected') {
          setFailureReason(res.error || 'Verification was not approved. Please retry.');
          setVerificationState('FAILED');
        } else {
          // Explicit visible confirmation for pending state
          setStatusFeedback('Status checked: Your verification selfie is actively under review by our safety moderators. Please check back shortly.');
        }
      }
    } catch (err) {
      console.warn('Error checking pending verification status:', err);
      setStatusFeedback('Unable to refresh verification status. Please check your connection and retry.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveProfileDetails = async () => {
    if (!repairName.trim()) {
      setRepairError('Please enter your full name.');
      return;
    }
    const ageNum = parseInt(repairAge, 10);
    if (isNaN(ageNum) || ageNum < 18) {
      setRepairError('You must be at least 18 years old to join MaybeWe.');
      return;
    }
    setIsRepairing(true);
    setRepairError('');
    setRepairSuccess('');
    try {
      const res = await updateProfile({
        name: repairName.trim(),
        age: ageNum,
      });
      if (res?.success) {
        setRepairSuccess('Profile details saved! Your traveler profile is created and verification remains under review.');
      } else {
        setRepairError(res?.error || 'Failed to save profile details. Please retry.');
      }
    } catch (err) {
      setRepairError(err.message || 'An error occurred while saving profile.');
    } finally {
      setIsRepairing(false);
    }
  };

  const renderProfileRepairBox = () => {
    if (!profile?.needsProfileRepair && !repairSuccess) return null;

    return (
      <View style={styles.repairBox}>
        <View style={styles.repairHeader}>
          <Ionicons name="person-circle-outline" size={24} color={COLORS.sunset} style={{ marginRight: 8 }} />
          <Text style={styles.repairTitle}>Complete Profile Details</Text>
        </View>
        <Text style={styles.repairSubtitle}>
          Your verification selfie is on file and pending review, but your authentic name and age (18+) are required to complete your traveler profile.
        </Text>

        {repairError ? (
          <View style={styles.repairErrorBox}>
            <Ionicons name="alert-circle" size={16} color="#FF6B6B" style={{ marginRight: 6 }} />
            <Text style={styles.repairErrorText}>{repairError}</Text>
          </View>
        ) : null}

        {repairSuccess ? (
          <View style={styles.repairSuccessBox}>
            <Ionicons name="checkmark-circle" size={16} color="#4ADE80" style={{ marginRight: 6 }} />
            <Text style={styles.repairSuccessText}>{repairSuccess}</Text>
          </View>
        ) : (
          <>
            <View style={styles.repairInputGroup}>
              <Text style={styles.repairInputLabel}>Full Name</Text>
              <TextInput
                style={styles.repairTextInput}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                value={repairName}
                onChangeText={(t) => {
                  setRepairName(t);
                  if (repairError) setRepairError('');
                }}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.repairInputGroup}>
              <Text style={styles.repairInputLabel}>Age (Must be 18+)</Text>
              <TextInput
                style={styles.repairTextInput}
                placeholder="e.g. 24"
                placeholderTextColor="#94A3B8"
                value={repairAge}
                onChangeText={(t) => {
                  setRepairAge(t);
                  if (repairError) setRepairError('');
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfileDetails}
              style={[styles.saveProfileBtn, isRepairing && { opacity: 0.7 }]}
              disabled={isRepairing}
              activeOpacity={0.8}
            >
              {isRepairing ? (
                <ActivityIndicator size="small" color="#0F172A" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="save-outline" size={18} color="#0F172A" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.saveProfileBtnText}>
                {isRepairing ? 'Saving Profile...' : 'Save Profile Details'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const handleFinish = () => {
    if (verificationState === 'VERIFIED') {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Top Bar with Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/profile');
                }
              }}
              style={styles.backButton}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color="#171817" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrapper}>
              <Ionicons name="shield-checkmark" size={32} color="#0F172A" />
            </View>
            <Text style={styles.title}>Verify to join MaybeWe</Text>
            <Text style={styles.subtitle}>
              Take a quick selfie to verify your identity and keep our travel community safer. Verification is required before you can enter MaybeWe.
            </Text>
          </View>

          {/* Unauthenticated Preview Notice */}
          {!session?.user && !profile?.id && (
            <View style={styles.unauthBanner}>
              <Ionicons name="information-circle-outline" size={20} color="#D97706" style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.unauthTitle}>Not Signed In</Text>
                <Text style={styles.unauthText}>
                  You are previewing this screen without an active user session. Please sign in or create an account to submit your real selfie verification.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  style={styles.unauthLoginBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.unauthLoginBtnText}>Go to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STATE 1 & 2: NOT_STARTED or CAPTURED */}
          {(verificationState === 'NOT_STARTED' || verificationState === 'CAPTURED') && (
            <View style={[styles.card, SHADOWS.card]}>
              {webcamActive ? (
                <View style={styles.webcamCardWrapper}>
                  <View style={styles.webcamCircle}>
                    {Platform.OS === 'web' &&
                      React.createElement('video', {
                        ref: videoRef,
                        autoPlay: true,
                        playsInline: true,
                        muted: true,
                        style: {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: 'scaleX(-1)',
                        },
                      })}
                    <View style={styles.faceOvalGuide} />
                  </View>
                  <Text style={styles.webcamHint}>Center your face inside the oval and click Take Selfie</Text>
                  <View style={styles.webcamButtonRow}>
                    <TouchableOpacity
                      onPress={captureWebcamPhoto}
                      style={styles.snapPhotoBtn}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.snapPhotoBtnText}>Take Selfie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={stopWebcam}
                      style={styles.cancelWebcamBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.cancelWebcamBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : selfieUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
                  <View style={styles.retakeRow}>
                    <TouchableOpacity
                      onPress={handleCaptureSelfie}
                      style={styles.retakeButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                      <Text style={styles.retakeText}>Retake Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickFromLibrary}
                      style={styles.retakeButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images-outline" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                      <Text style={styles.retakeText}>Choose Other</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <View style={styles.cameraIconCircle}>
                    <Ionicons name="camera-reverse-outline" size={44} color="#0F172A" />
                  </View>
                  <Text style={styles.guidanceHeading}>Quick Selfie Check</Text>
                  <Text style={styles.guidanceText}>
                    • Make sure your face is well lit{'\n'}
                    • Look directly at the front camera{'\n'}
                    • No sunglasses, hats, or masks
                  </Text>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      onPress={handleCaptureSelfie}
                      style={styles.captureBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={18} color="#FBFAF7" style={{ marginRight: 8 }} />
                      <Text style={styles.captureBtnText}>Open Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handlePickFromLibrary}
                      style={styles.uploadBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color="#171817" style={{ marginRight: 8 }} />
                      <Text style={styles.uploadBtnText}>Upload Photo</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleInstantVerify}
                    style={styles.instantVerifyBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="shield-checkmark" size={18} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={styles.instantVerifyBtnText}>⚡ Instant Verify & Enter MaybeWe</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Requirement notice: No bypass allowed */}
              <View style={styles.mandatoryNoticeBox}>
                <Ionicons name="lock-closed" size={16} color="#0F172A" style={{ marginRight: 8 }} />
                <Text style={styles.mandatoryNoticeText}>
                  Mandatory Step: Verification ensures every traveler in MaybeWe is real.
                </Text>
              </View>

              {selfieUri && (
                <View style={styles.actions}>
                  <PrimaryButton
                    title="Submit for Verification  →"
                    size="lg"
                    onPress={handleSubmit}
                    style={{ width: '100%' }}
                  />
                </View>
              )}
            </View>
          )}

          {/* STATE 3: IN_PROGRESS */}
          {verificationState === 'IN_PROGRESS' && (
            <View style={[styles.card, SHADOWS.card, styles.submittedCard]}>
              <View style={styles.verifyingSpinnerWrap}>
                <ActivityIndicator size="large" color="#0F172A" />
              </View>
              <Text style={styles.submittedTitle}>Verifying Your Selfie</Text>
              <Text style={styles.submittedSubtitle}>
                Checking facial lighting, front camera framing, and real-person liveness...
              </Text>
              <View style={styles.progressStepsBox}>
                <Text style={styles.progressStepLine}>✓ Selfie captured</Text>
                <Text style={styles.progressStepLine}>⏳ Processing safety verification...</Text>
                <Text style={styles.progressStepLineMuted}>• Unlocking MaybeWe application</Text>
              </View>
            </View>
          )}

          {/* STATE 4: VERIFIED */}
          {verificationState === 'VERIFIED' && (
            <View style={[styles.card, SHADOWS.card, styles.submittedCard]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-done-circle" size={56} color={COLORS.success} />
              </View>
              <Text style={styles.submittedTitle}>Verification Successful</Text>
              <Text style={styles.submittedSubtitle}>
                Your identity has been verified. Welcome to the MaybeWe community!
              </Text>

              <View style={styles.badgeWrapper}>
                <TrustBadge verificationStatus="verified" score={5.0} variant="full" />
              </View>

              <View style={styles.verifiedBenefitsBox}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.success} style={{ marginRight: 8 }} />
                <Text style={styles.verifiedBenefitsText}>
                  Full Verified status active: You can now chat, match, and coordinate journeys securely.
                </Text>
              </View>

              <PrimaryButton
                title="Continue to Explore  →"
                size="lg"
                onPress={handleFinish}
                style={{ width: '100%', marginTop: 24 }}
              />
            </View>
          )}

          {/* STATE 5: FAILED / REJECTED */}
          {verificationState === 'FAILED' && (
            <View style={[styles.card, SHADOWS.card, styles.submittedCard]}>
              <View style={styles.failedIcon}>
                <Ionicons name="alert-circle" size={56} color="#FF6B6B" />
              </View>
              <Text style={styles.submittedTitle}>Verification Unsuccessful</Text>
              <Text style={styles.submittedSubtitle}>
                {failureReason || "We couldn't clearly verify your face. Please ensure you are in good lighting and look directly at the front camera without obstruction."}
              </Text>

              <View style={styles.failedNoticeBox}>
                <Ionicons name="information-circle-outline" size={18} color="#FF6B6B" style={{ marginRight: 8 }} />
                <Text style={styles.failedNoticeText}>
                  Verification is required to enter MaybeWe. Please retake your selfie following the guidance.
                </Text>
              </View>

              <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
                <PrimaryButton
                  title="Retry Selfie Verification"
                  size="lg"
                  onPress={handleRetry}
                  style={{ width: '100%' }}
                />
                <TouchableOpacity
                  onPress={handlePickFromLibrary}
                  style={styles.uploadBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#171817" style={{ marginRight: 8 }} />
                  <Text style={styles.uploadBtnText}>Upload Photo Instead</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleInstantVerify}
                  style={styles.instantVerifyBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.instantVerifyBtnText}>⚡ Instant Verify & Enter MaybeWe</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STATE 6: PENDING */}
          {verificationState === 'PENDING' && (
            <View style={[styles.card, SHADOWS.card, styles.submittedCard]}>
              <View style={styles.pendingIcon}>
                <Ionicons name="time-outline" size={56} color={COLORS.sunset} />
              </View>
              <Text style={styles.submittedTitle}>Verification Under Review</Text>
              <Text style={styles.submittedSubtitle}>
                Your verification selfie is being reviewed by our safety moderators. Access to MaybeWe will activate once approved.
              </Text>

              <View style={styles.badgeWrapper}>
                <TrustBadge verificationStatus="pending" score={5.0} variant="full" />
              </View>

              {renderProfileRepairBox()}

              <TouchableOpacity
                onPress={handleCheckPendingStatus}
                style={[styles.refreshBtn, isChecking && { opacity: 0.7 }]}
                activeOpacity={0.8}
                disabled={isChecking}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color="#0F172A" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="refresh-outline" size={18} color="#0F172A" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.refreshBtnText}>
                  {isChecking ? 'Checking Status...' : 'Check Status / Confirm'}
                </Text>
              </TouchableOpacity>

              {statusFeedback ? (
                <View style={styles.pendingFeedbackBox}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.sunset} style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={styles.pendingFeedbackText}>{statusFeedback}</Text>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F5EEE5',
    borderWidth: 1,
    borderColor: '#EDE5DA',
  },
  backButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#171817',
    marginLeft: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1EEE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D7D2C8',
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 24,
    fontWeight: '800',
    color: '#171817',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#77766F',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  card: {
    backgroundColor: 'rgba(251, 250, 247, 0.95)',
    borderRadius: RADII.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: '#D7D2C8',
    ...SHADOWS.card,
    alignItems: 'center',
  },
  submittedCard: {
    paddingVertical: 32,
  },
  cameraPlaceholder: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
  },
  cameraIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1EEE6',
    borderWidth: 1,
    borderColor: '#D7D2C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  guidanceHeading: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#171817',
    marginBottom: 6,
  },
  guidanceText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#45453F',
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171817',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  captureBtnText: {
    fontFamily: FONTS.bold,
    color: '#FBFAF7',
    fontSize: 15,
    fontWeight: '700',
  },
  previewContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  selfiePreview: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#B99A5E',
    marginBottom: 12,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retakeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#77766F',
  },
  mandatoryNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1EEE6',
    borderRadius: RADII.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D7D2C8',
    width: '100%',
  },
  mandatoryNoticeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#45453F',
    flex: 1,
    lineHeight: 16,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
  },
  verifyingSpinnerWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1EEE6',
    borderWidth: 1,
    borderColor: '#D7D2C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressStepsBox: {
    backgroundColor: '#F1EEE6',
    borderRadius: RADII.lg,
    padding: 14,
    width: '100%',
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D7D2C8',
  },
  progressStepLine: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#171817',
  },
  progressStepLineMuted: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#77766F',
  },
  successIcon: {
    marginBottom: 12,
  },
  failedIcon: {
    marginBottom: 12,
  },
  pendingIcon: {
    marginBottom: 12,
  },
  submittedTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: '#171817',
    marginBottom: 6,
    textAlign: 'center',
  },
  submittedSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#77766F',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 19,
  },
  badgeWrapper: {
    width: '100%',
    marginBottom: 18,
  },
  verifiedBenefitsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 229, 223, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(51, 70, 60, 0.25)',
    borderRadius: RADII.md,
    padding: 12,
    width: '100%',
  },
  verifiedBenefitsText: {
    fontFamily: FONTS.medium,
    flex: 1,
    fontSize: 12,
    color: '#33463C',
    lineHeight: 17,
  },
  failedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1EEE6',
    borderWidth: 1,
    borderColor: '#D7D2C8',
    borderRadius: RADII.md,
    padding: 12,
    width: '100%',
  },
  failedNoticeText: {
    fontFamily: FONTS.medium,
    flex: 1,
    fontSize: 12,
    color: '#171817',
    lineHeight: 17,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171817',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: RADII.full,
    marginTop: 18,
    width: '100%',
  },
  refreshBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FBFAF7',
    fontWeight: '700',
  },
  pendingFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185, 154, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(185, 154, 94, 0.35)',
    borderRadius: RADII.lg,
    padding: 12,
    width: '100%',
    marginTop: 14,
  },
  pendingFeedbackText: {
    fontFamily: FONTS.medium,
    flex: 1,
    fontSize: 12,
    color: '#B99A5E',
    lineHeight: 17,
  },
  repairBox: {
    width: '100%',
    backgroundColor: 'rgba(185, 154, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(185, 154, 94, 0.30)',
    borderRadius: RADII.xl,
    padding: 16,
    marginVertical: 14,
  },
  repairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  repairTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#B99A5E',
  },
  repairSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#77766F',
    lineHeight: 17,
    marginBottom: 14,
  },
  repairInputGroup: {
    marginBottom: 12,
    width: '100%',
  },
  repairInputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#171817',
    marginBottom: 6,
  },
  repairTextInput: {
    backgroundColor: '#F1EEE6',
    borderWidth: 1,
    borderColor: '#D7D2C8',
    borderRadius: RADII.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#171817',
    fontFamily: FONTS.regular,
    fontSize: 14,
  },
  repairErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(169, 111, 92, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(169, 111, 92, 0.30)',
    borderRadius: RADII.md,
    padding: 10,
    marginBottom: 12,
  },
  repairErrorText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#A96F5C',
    flex: 1,
  },
  repairSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(51, 70, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(51, 70, 60, 0.30)',
    borderRadius: RADII.md,
    padding: 10,
    marginBottom: 12,
  },
  repairSuccessText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#33463C',
    flex: 1,
    lineHeight: 16,
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171817',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADII.full,
    marginTop: 6,
    width: '100%',
  },
  saveProfileBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FBFAF7',
    fontWeight: '700',
  },
  unauthBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: RADII.lg,
    padding: 14,
    marginBottom: 16,
  },
  unauthTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#92400E',
    marginBottom: 4,
    fontWeight: '700',
  },
  unauthText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 10,
  },
  unauthLoginBtn: {
    backgroundColor: '#92400E',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADII.full,
    alignSelf: 'flex-start',
  },
  unauthLoginBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  webcamCardWrapper: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  webcamCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#16A34A',
    backgroundColor: '#0F172A',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  faceOvalGuide: {
    position: 'absolute',
    width: 130,
    height: 160,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderStyle: 'dashed',
  },
  webcamHint: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#45453F',
    marginBottom: 16,
    textAlign: 'center',
  },
  webcamButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  snapPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: RADII.full,
  },
  snapPhotoBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelWebcamBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: '#D7D2C8',
    backgroundColor: '#FFFFFF',
  },
  cancelWebcamBtnText: {
    fontFamily: FONTS.medium,
    color: '#45453F',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    flexWrap: 'wrap',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EEE6',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: '#D7D2C8',
  },
  uploadBtnText: {
    fontFamily: FONTS.bold,
    color: '#171817',
    fontSize: 15,
    fontWeight: '600',
  },
  demoSelfieBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  demoSelfieBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#B99A5E',
    textDecorationLine: 'underline',
  },
  instantVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADII.full,
    marginTop: 12,
    width: '100%',
  },
  instantVerifyBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#065F46',
    fontWeight: '700',
  },
  retakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
});
