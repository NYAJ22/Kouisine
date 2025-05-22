import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/Navigation'; // adapte le chemin selon ta structure

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigation = useNavigation<NavigationProp>();

  const handleLogin = () => {
    auth()
      .signInWithEmailAndPassword(email, password)
      .then(() => {
        Alert.alert('Connexion réussie !');
        // navigation.navigate('Home');
      })
      .catch(error => {
        Alert.alert('Erreur', error.message);
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BIENVENUE</Text>
      <Text style={styles.subtitle}>Ravi de vous revoir</Text>

      <TextInput
        style={styles.input}
        placeholder="Adresse e-mail"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginText}>Se connecter</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={styles.forgot}>J'ai oublié mon mot de passe</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.registerText}>Inscription</Text>
      </TouchableOpacity>

      <Text style={styles.connectText}>Connectez-vous via</Text>
      <View style={styles.socialIcons}>
        <Image source={require('../assets/google.png')} style={styles.icon} />
        <Image source={require('../assets/facebook.png')} style={styles.icon} />
        <Image source={require('../assets/instagram.png')} style={styles.icon} />
      </View>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  loginButton: {
    backgroundColor: '#b4a26a',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  loginText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  forgot: {
    textAlign: 'center',
    color: '#888',
    marginBottom: 20,
  },
  registerButton: {
    borderWidth: 1,
    borderColor: '#b4a26a',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  registerText: {
    color: '#b4a26a',
    fontWeight: 'bold',
  },
  connectText: {
    textAlign: 'center',
    color: '#888',
    marginBottom: 10,
  },
  socialIcons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  icon: {
    width: 30,
    height: 30,
  },
});
