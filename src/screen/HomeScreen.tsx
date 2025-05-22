// screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bienvenue sur l’écran d’accueil !</Text>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f2e7',
  },
  text: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});
