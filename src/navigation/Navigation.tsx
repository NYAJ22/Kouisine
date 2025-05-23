// Navigation.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screen/LoginScreen'; // adapter le chemin selon ton projet
import HomeScreen from '../screen/HomeScreen'; // adapter le chemin selon ton projet
import SignupScreen from '../screen/SignupScreen';
import ShoppingListScreen from '../screen/ShoppingListScreen';
import MealPlanningScreen from '../screen/MealPlanningScreen';
import FridgeScreen from '../screen/FridgeScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Signup: undefined;
  ShoppingList: undefined;
  MealPlanning: undefined;
  Fridge: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
        <Stack.Screen name="MealPlanning" component={MealPlanningScreen} />
        <Stack.Screen name="Fridge" component={FridgeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
