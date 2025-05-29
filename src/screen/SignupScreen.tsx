import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateInputs = (): boolean => {
    if (!email.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une adresse e-mail.');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un mot de passe.');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return false;
    }

    return true;
  };

  const handleSignup = async (): Promise<void> => {
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('Début de l\'inscription...');

      // Créer le compte utilisateur
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      console.log('Utilisateur créé:', user.uid);

      // Créer le document utilisateur dans Firestore
      await firestore().collection('users').doc(user.uid).set({
        email: user.email,
        hasCompletedOnboarding: false,
        familyMembers: [],
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log('Navigation vers Onboarding...');
      // Navigation directe vers Onboarding sans Alert
      navigation.replace('Onboarding');

    } catch (error: any) {
      console.error('Erreur lors de l\'inscription:', error);

      let errorMessage = 'Une erreur est survenue lors de l\'inscription.';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cette adresse e-mail est déjà utilisée.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Adresse e-mail invalide.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Le mot de passe est trop faible.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BIENVENUE</Text>
      <Text style={styles.subtitle}>Rejoignez nous dès aujourd'hui !</Text>

      <TextInput
        placeholder="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />
      <TextInput
        placeholder="Mot de passe"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        style={styles.input}
        editable={!isLoading}
      />
      <TextInput
        placeholder="Confirmer le mot de passe"
        value={confirmPassword}
        secureTextEntry
        onChangeText={setConfirmPassword}
        style={styles.input}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.signupButton, isLoading && styles.disabledButton]}
        onPress={handleSignup}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>S'inscrire</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => navigation.navigate('Login')}
        disabled={isLoading}>
        <Text style={styles.buttonText}>Connexion</Text>
      </TouchableOpacity>

      <Text style={styles.socialText}>Connectez-vous via</Text>
      <View style={styles.socialIcons}>
        <Image source={require('../assets/google.png')} style={styles.icon} />
        <Image source={require('../assets/facebook.png')} style={styles.icon} />
        <Image source={require('../assets/instagram.png')} style={styles.icon} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f8f2e7',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#A98F60',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  signupButton: {
    backgroundColor: '#A98F60',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A98F60',
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#000',
  },
  socialText: {
    marginTop: 30,
    textAlign: 'center',
  },
  socialIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  icon: {
    width: 30,
    height: 30,
  },
});

export default SignupScreen;
