import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation'; // adapte ce chemin selon ton projet

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const handleSignup = () => {
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    auth()
      .createUserWithEmailAndPassword(email, password)
      .then(() => {
        Alert.alert('Succès', 'Compte créé avec succès !');
        navigation.navigate('Login');
      })
      .catch(error => {
        Alert.alert('Erreur', error.message);
      });
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
      />
      <TextInput
        placeholder="Mot de passe"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        style={styles.input}
      />
      <TextInput
        placeholder="Confirmer le mot de passe"
        value={confirmPassword}
        secureTextEntry
        onChangeText={setConfirmPassword}
        style={styles.input}
      />

      <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
        <Text style={styles.buttonText}>S'inscrire</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => navigation.navigate('Login')}>
        <Text style={styles.buttonText}>Connexion</Text>
      </TouchableOpacity>

      <Text style={styles.socialText}>Connectez-vous via</Text>
      <View style={styles.socialIcons}>
        <Text>Google</Text>
        <Text>Facebook</Text>
        <Text>Instagram</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
  },
  signupButton: {
    backgroundColor: '#A98F60',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
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
});

export default SignupScreen;
