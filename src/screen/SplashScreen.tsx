import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, StatusBar, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const logoFadeAnim = useRef(new Animated.Value(0)).current; // Pour le fade in du logo
  const logoScaleAnim = useRef(new Animated.Value(0.7)).current; // Pour le zoom doux du logo
  const textFadeAnim = useRef(new Animated.Value(0)).current; // Pour le fade in du texte
  const poweredByFadeAnim = useRef(new Animated.Value(0)).current; // Pour le fade in de "Powered by"
  const [isLoading, setIsLoading] = useState(true);

  const startAnimation = useCallback(() => {
    // Animation du logo (fade + scale)
    Animated.parallel([
      Animated.timing(logoFadeAnim, {
        toValue: 1,
        duration: 1000, // Apparition rapide du logo
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 7, // Léger rebond
        tension: 100, // Vitesse du rebond
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Une fois le logo apparu, faire apparaître le texte
      Animated.sequence([
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 800, // Apparition du titre et slogan
          delay: 200, // Petit délai après le logo
          useNativeDriver: true,
        }),
        Animated.timing(poweredByFadeAnim, {
          toValue: 1,
          duration: 500, // Apparition de "Powered by"
          delay: 300, // Délai après le slogan
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsLoading(false); // Arrête l'indicateur de chargement après toutes les animations
      });
    });
  }, [logoFadeAnim, logoScaleAnim, textFadeAnim, poweredByFadeAnim]);

  const navigateToNextScreen = useCallback(() => {
    navigation.replace('Login'); // Ou 'Home', 'AuthStack', etc. selon votre logique d'authentification
  }, [navigation]);

  useEffect(() => {
    // S'assurer que la barre de statut est adaptée au fond blanc
    StatusBar.setBarStyle('dark-content'); // Icônes sombres sur fond clair
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#f8f2e7'); // Couleur de fond de votre splash screen
    }

    startAnimation(); // Démarre les animations

    // Temps total du splash screen (doit être > durée des animations combinées)
    const totalSplashTime = 1000 + 200 + 800 + 300 + 500 + 500; // Durée de toutes les animations + un petit délai final (500ms)
    const timeout = setTimeout(navigateToNextScreen, totalSplashTime);

    return () => {
      clearTimeout(timeout);
    };
  }, [startAnimation, navigateToNextScreen]);

  return (
    <View style={styles.container}>
      {/* Votre logo existant */}
      <Animated.Image
        source={require('../assets/Logo.png')} // ASSUREZ-VOUS QUE CE CHEMIN EST CORRECT POUR VOTRE LOGO
        style={[
          styles.logo,
          {
            opacity: logoFadeAnim,
            transform: [{ scale: logoScaleAnim }],
          },
        ]}
        resizeMode="contain"
      />

      <Animated.Text style={[styles.title, { opacity: textFadeAnim }]}>
        KOUISINE
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: textFadeAnim }]}>
        Faites votre cuisine comme un chef
      </Animated.Text>

      <Animated.Text style={[styles.poweredBy, { opacity: poweredByFadeAnim }]}>
        Powered by <Text style={styles.geminiText}>GeminiAI</Text>
      </Animated.Text>

      {/* L'indicateur de chargement peut rester, mais il sera peu visible si les animations sont rapides */}
      {isLoading && (
        <ActivityIndicator size="large" color="#2d7d5e" style={styles.loader} />
      )}
    </View>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7', // Le fond blanc cassé de votre image
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180, // Agrandir un peu le logo pour plus d'impact
    height: 180,
    marginBottom: 20, // Plus d'espace entre le logo et le titre

  },
  title: {
    fontSize: 48, // Taille comme sur votre image, ou légèrement plus grande
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8, // Espace entre le titre et le slogan
  },
  subtitle: {
    fontSize: 20, // Taille légèrement plus grande pour le slogan
    color: '#555', // Gris foncé pour le slogan
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 28,
  },
  poweredBy: {
    position: 'absolute', // Positionne ce texte en bas de l'écran
    bottom: 50,
    fontSize: 14,
    color: '#888', // Gris plus clair pour ce texte
  },
  geminiText: {
    fontWeight: 'bold',
    color: '#000000', // Mettre en évidence GeminiAI avec votre couleur principale
  },
  loader: {
    position: 'absolute', // Positionne l'indicateur de chargement
    bottom: 100,
  },
});

export default SplashScreen;
