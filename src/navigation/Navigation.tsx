// Navigation.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screen/LoginScreen';
import HomeScreen from '../screen/HomeScreen';
import SignupScreen from '../screen/SignupScreen';
import ShoppingListScreen from '../screen/ShoppingListScreen';
import MealPlanningScreen from '../screen/MealPlanningScreen';
import FridgeScreen from '../screen/FridgeScreen';
import BudgetScreen from '../screen/BudgetScreen';
import SplashScreen from '../screen/SplashScreen';
import ProfileScreen from '../screen/ProfileScreen';
import OnboardingScreen from '../screen/OnboardingScreen';
import FamilySetup from '../screen/FamilySetup';
import RecipeListScreen from '../screen/RecipeListScreen';
import CuisineAI from '../screen/CuisineAI';
import NearbyMarketsScreen from '../screen/NearbyMarketsScreen';


export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Home: undefined;
  Signup: undefined;
  ShoppingList: undefined;
  MealPlanning: undefined;
  Fridge: undefined;
  Statistics: undefined;
  Onboarding: undefined;
  ProfileUser: undefined;
  FamilySetup: undefined;
  RecipeList: undefined;
  CuisineAI: undefined;
  NearbyMarkets: undefined; // Ajoute cette ligne
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
        <Stack.Screen name="MealPlanning" component={MealPlanningScreen} />
        <Stack.Screen name="Fridge" component={FridgeScreen} />
        <Stack.Screen name="Statistics" component={BudgetScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="ProfileUser" component={ProfileScreen} />
        <Stack.Screen name="FamilySetup" component={FamilySetup} />
        <Stack.Screen name="RecipeList" component={RecipeListScreen} />
        <Stack.Screen name="CuisineAI" component={CuisineAI} />
        <Stack.Screen name="NearbyMarkets" component={NearbyMarketsScreen} options={{ title: 'Marchés à proximité' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
