import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(true);

  const startAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.delay(800), // Pause pour laisser voir l'animation
    ]).start(() => setIsLoading(false));
  }, [fadeAnim]);

  const navigateToLogin = useCallback(() => {
    navigation.replace('Login'); // ou 'Home'
  }, [navigation]);

  useEffect(() => {
    startAnimation();
    const timeout = setTimeout(navigateToLogin, 2500); // 2.5s total
    return () => clearTimeout(timeout);
  }, [startAnimation, navigateToLogin]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        🍲 KOUISINE
      </Animated.Text>
      {isLoading && (
        <ActivityIndicator size="large" color="#2d7d5e" style={styles.loader} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2d7d5e',
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;
