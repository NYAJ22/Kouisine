import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  Platform, // Ajout de l'import Platform
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import LinearGradient from 'react-native-linear-gradient';

// Types
interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

// Mise à jour de l'interface TodayMeals pour inclure le petit-déjeuner
interface TodayMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
  lunchRecipeId?: string;
  dinnerRecipeId?: string;
  breakfastRecipeId?: string; // Au cas où vous stockeriez des ID de recette pour le petit-déjeuner
}

interface ExpiringItem {
  id: string;
  name: string;
  days: number;
  quantity: number;
  category: string;
}

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

type QuickActionType = 'shopping' | 'planning' | 'stock' | 'stats' | 'profile' | 'recipes';

const { width } = Dimensions.get('window');

// Fonction pour obtenir l'ID de la semaine actuelle (identique à MealPlanningScreen)
function getCurrentWeekId(offset: number = 0): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Dimanche) - 6 (Samedi)
  // Ajuster pour que Lundi soit le premier jour de la semaine
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + (offset * 7));
  monday.setHours(0, 0, 0, 0); // Normaliser au début du jour

  const year = monday.getFullYear();
  // Calcul du numéro de semaine ISO 8601 (simplifié)
  const firstJan = new Date(year, 0, 1);
  const daysOffset = (monday.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000);
  const firstJanDayOfWeek = (firstJan.getDay() === 0) ? 7 : firstJan.getDay(); // Lundi=1, Dimanche=7
  const weekNumber = Math.ceil((daysOffset + firstJanDayOfWeek -1) / 7);

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// Noms des jours en français pour correspondre aux clés du planning
const dayNamesForPlanning = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];


const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // Mise à jour de l'état initial de todayMeals
  const [todayMeals, setTodayMeals] = useState<TodayMeals>({
    breakfast: 'Aucun repas planifié',
    lunch: 'Aucun repas planifié',
    dinner: 'Aucun repas planifié',
  });
  const [shoppingListCount, setShoppingListCount] = useState<number>(0);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [totalStockItems, setTotalStockItems] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMeals, setLoadingMeals] = useState<boolean>(true); // État de chargement spécifique aux repas

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setCurrentDate(today.toLocaleDateString('fr-FR', options));

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    const unsubscribeFocus = navigation.addListener('focus', () => {
        loadUserData(); // Recharger les données lorsque l'écran revient au premier plan
    });
    
    loadUserData(); // Chargement initial

    return () => {
        unsubscribeFocus();
        // Les désabonnements des listeners Firestore sont gérés dans loadUserData
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]); // Ajout de navigation aux dépendances pour le listener de focus

  const loadUserData = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      console.log('User not logged in');
      setLoadingMeals(false);
      // Réinitialiser les états si l'utilisateur n'est pas connecté
      setUserProfile(null);
      setTodayMeals({ breakfast: 'Aucun repas planifié', lunch: 'Aucun repas planifié', dinner: 'Aucun repas planifié' });
      setShoppingListCount(0);
      setExpiringItems([]);
      setTotalStockItems(0);
      return () => {};
    }

    setRefreshing(true); // Indique le début du chargement/rafraîchissement
    setLoadingMeals(true);

    const cleanupFunctions: (() => void)[] = [];

    try {
      // Charger le profil utilisateur
      const userDocRef = firestore().collection('users').doc(uid);
      const userDocSnapshot = await userDocRef.get();
      if (userDocSnapshot.exists()) {
        const userData = userDocSnapshot.data();
        setUserProfile({
          name: userData?.name || userData?.userName || userData?.displayName || 'Utilisateur',
          email: userData?.email || auth().currentUser?.email || '',
          avatar: userData?.avatar,
        });
      } else {
        setUserProfile(null);
      }

      // Listener pour la liste de courses
      const unsubscribeShopping = firestore()
        .collection('users')
        .doc(uid)
        .collection('shoppingList')
        .where('purchased', '==', false)
        .onSnapshot(snapshot => {
          setShoppingListCount(snapshot.size);
        }, error => console.error("Error fetching shopping list:", error));
      cleanupFunctions.push(unsubscribeShopping);

      // Listener pour le frigo/stock
      const unsubscribeFridge = firestore()
        .collection('users')
        .doc(uid)
        .collection('fridge')
        .onSnapshot(snapshot => {
          setTotalStockItems(snapshot.size);
          const now = new Date();
          const expiring: ExpiringItem[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.expiryDate) {
              let expiryDate: Date;
              if (data.expiryDate.toDate) {
                expiryDate = data.expiryDate.toDate();
              } else if (typeof data.expiryDate === 'string') {
                const parts = data.expiryDate.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    expiryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else {
                    console.warn(`Invalid date string format: ${data.expiryDate} for item ${doc.id}`);
                    return;
                }
              } else {
                console.warn(`Unrecognized expiryDate format for item ${doc.id}:`, data.expiryDate);
                return;
              }
              if (isNaN(expiryDate.getTime())) {
                console.warn(`Parsed expiryDate is invalid for item ${doc.id}:`, data.expiryDate);
                return;
              }
              const days = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (days <= 3) {
                expiring.push({
                  id: doc.id,
                  name: data.name || 'Produit',
                  days: Math.max(days, 0),
                  quantity: data.quantity || 1,
                  category: data.category || 'Autre',
                });
              }
            }
          });
          expiring.sort((a, b) => a.days - b.days);
          setExpiringItems(expiring);
        }, error => console.error("Error fetching fridge items:", error));
      cleanupFunctions.push(unsubscribeFridge);

      // ***** NOUVELLE LOGIQUE POUR CHARGER LES REPAS DU JOUR DEPUIS LE PLANNING HEBDOMADAIRE *****
      const currentWeekId = getCurrentWeekId(0); // Semaine actuelle
      const today = new Date();
      const todayDayName = dayNamesForPlanning[today.getDay()]; // Nom du jour actuel (ex: "Lundi")

      const mealPlanningRef = firestore()
        .collection('users')
        .doc(uid)
        .collection('mealPlanning') // Collection utilisée par MealPlanningScreen
        .doc(currentWeekId);

      const unsubscribeWeeklyMeals = mealPlanningRef.onSnapshot(docSnapshot => {
        setLoadingMeals(true); // Indiquer le chargement des repas
        if (docSnapshot.exists()) {
          const weeklyPlanningData = docSnapshot.data();
          const planningForWeek = weeklyPlanningData?.planning; // L'objet { Lundi: {...}, Mardi: {...} }

          if (planningForWeek && planningForWeek[todayDayName]) {
            const mealsForToday = planningForWeek[todayDayName]; // { breakfast: "...", lunch: "...", dinner: "..." }
            setTodayMeals({
              breakfast: mealsForToday.breakfast || 'Aucun repas planifié',
              lunch: mealsForToday.lunch || 'Aucun repas planifié',
              dinner: mealsForToday.dinner || 'Aucun repas planifié',
              // Les RecipeId ne sont pas dans cette structure de données, donc ils seront undefined
              breakfastRecipeId: undefined,
              lunchRecipeId: undefined,
              dinnerRecipeId: undefined,
            });
          } else {
            // Pas de planning pour ce jour spécifique
            setTodayMeals({
              breakfast: 'Aucun repas planifié',
              lunch: 'Aucun repas planifié',
              dinner: 'Aucun repas planifié',
            });
          }
        } else {
          // Pas de document de planning pour cette semaine
          setTodayMeals({
            breakfast: 'Aucun repas planifié',
            lunch: 'Aucun repas planifié',
            dinner: 'Aucun repas planifié',
          });
        }
        setLoadingMeals(false); // Fin du chargement des repas
        setRefreshing(false); // Fin du rafraîchissement global
      }, error => {
        console.error("Error fetching weekly meal plan:", error);
        setTodayMeals({ breakfast: 'Aucun repas planifié', lunch: 'Aucun repas planifié', dinner: 'Aucun repas planifié' });
        setLoadingMeals(false);
        setRefreshing(false);
      });
      cleanupFunctions.push(unsubscribeWeeklyMeals);
      // ***** FIN DE LA NOUVELLE LOGIQUE *****

      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
      Alert.alert('Erreur', 'Impossible de charger les données utilisateur.');
      setLoadingMeals(false);
      setRefreshing(false);
      return () => {};
    }
  };


  const onRefresh = () => {
    loadUserData(); // loadUserData gère déjà setRefreshing(true/false)
  };

  const handleQuickAction = (action: QuickActionType): void => {
    switch (action) {
      case 'shopping':
        navigation.navigate('ShoppingList');
        break;
      case 'planning':
        navigation.navigate('MealPlanning');
        break;
      case 'stock':
        navigation.navigate('Fridge');
        break;
      case 'stats':
        navigation.navigate('Statistics');
        break;
      case 'profile':
        navigation.navigate('ProfileUser');
        break;
      case 'recipes':
        navigation.navigate('RecipeList');
        break;
      default:
        Alert.alert('Navigation', `Aller vers ${action}`);
    }
  };

  const getExpirationColor = (days: number): string => {
    if (days === 0) { return '#FF4757'; }
    if (days === 1) { return '#FF6B6B'; }
    if (days === 2) { return '#FFB347'; }
    return '#FFA726';
  };

  const getExpirationText = (days: number): string => {
    if (days === 0) { return "Expire aujourd'hui"; }
    if (days === 1) { return 'Expire demain'; }
    return `Expire dans ${days} jours`;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) { return 'Bonjour'; }
    if (hour < 18) { return 'Bon après-midi'; }
    return 'Bonsoir';
  };

  const handleProfilePress = (): void => {
    navigation.navigate('ProfileUser');
  };

  const handleMealPress = (mealType: 'lunch' | 'dinner' | 'breakfast') => {
    let recipeId: string | undefined;
    if (mealType === 'lunch') recipeId = todayMeals.lunchRecipeId;
    else if (mealType === 'dinner') recipeId = todayMeals.dinnerRecipeId;
    else if (mealType === 'breakfast') recipeId = todayMeals.breakfastRecipeId; // Au cas où

    if (recipeId) {
      navigation.navigate('RecipeDetail', { recipeId });
    } else {
      navigation.navigate('MealPlanning');
    }
  };

  const handleToggleDrawer = () => {
    if (navigation.getParent) {
        const parentNav = navigation.getParent();
        if (parentNav && typeof (parentNav as any).openDrawer === 'function') {
            (parentNav as any).openDrawer();
            return;
        }
    }
    if (typeof (navigation as any).openDrawer === 'function') {
        (navigation as any).openDrawer();
    } else {
        console.warn('navigation.openDrawer is not a function. Is a Drawer Navigator configured?');
        Alert.alert('Erreur de navigation', 'Impossible d\'ouvrir le menu latéral.');
    }
  };


  const renderQuickStats = () => (
    <View style={styles.quickStatsContainer}>
      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#FF6B6B20' }]}>
          <Text style={styles.quickStatEmoji}>🛒</Text>
        </View>
        <Text style={styles.quickStatNumber}>{shoppingListCount}</Text>
        <Text style={styles.quickStatLabel}>À acheter</Text>
      </View>

      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#4ECDC420' }]}>
          <Text style={styles.quickStatEmoji}>🥫</Text>
        </View>
        <Text style={styles.quickStatNumber}>{totalStockItems}</Text>
        <Text style={styles.quickStatLabel}>En stock</Text>
      </View>

      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#FFB34720' }]}>
          <Text style={styles.quickStatEmoji}>⚠️</Text>
        </View>
        <Text style={styles.quickStatNumber}>{expiringItems.length}</Text>
        <Text style={styles.quickStatLabel}>À surveiller</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ebc665" />

      <LinearGradient
        colors={['#e4af29', '#ebc665', '#ffd700']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.headerLeftContent}>
            <TouchableOpacity onPress={handleToggleDrawer} activeOpacity={0.7}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>🍽️</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.appNameAndSubtitleContainer}>
              <Text style={styles.appName}>KOUISINE</Text>
              <Text style={styles.appSubtitle}>Votre assistant culinaire</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
            <Text style={styles.profileIcon}>
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : '👤'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1A5D4A"]} tintColor={"#1A5D4A"}/>
        }
      >
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.heroSection}>
            <Text style={styles.dateText}>{currentDate}</Text>
            <Text style={styles.welcomeText}>
              {getGreeting()}{userProfile?.name ? `, ${userProfile.name}` : ''} !
              {'\n'}Que cuisinez-vous aujourd'hui ?
            </Text>
            {renderQuickStats()}
          </View>

          {/* Section des repas du jour */}
          {/* Vous pouvez ajouter un indicateur de chargement ici si loadingMeals est true */}
          <View style={styles.todayMealsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🍽️ Vos repas d'aujourd'hui</Text>
              <TouchableOpacity
                style={styles.sectionAction}
                onPress={() => handleQuickAction('planning')}
              >
                <Text style={styles.sectionActionText}>Planifier</Text>
              </TouchableOpacity>
            </View>

            {/* Affichage du petit-déjeuner (si vous ajoutez une carte pour cela) */}
            {/*
            <TouchableOpacity
                style={styles.mealCard} // Adaptez ou créez un style pour le petit-déjeuner
                onPress={() => handleMealPress('breakfast')}
                activeOpacity={0.7}
            >
                <View style={styles.mealCardHeader}>
                    <View style={styles.mealTimeContainer}>
                        <Text style={styles.mealEmoji}>🥐</Text> // Icône pour petit-déjeuner
                        <Text style={styles.mealType}>Petit-déjeuner</Text>
                    </View>
                    <Text style={styles.mealTime}>08:00</Text> // Heure indicative
                </View>
                <Text style={styles.mealName} numberOfLines={2}>
                    {loadingMeals ? "Chargement..." : todayMeals.breakfast}
                </Text>
                <View style={styles.mealCardFooter}>
                    <Text style={styles.mealActionText}>
                        {todayMeals.breakfastRecipeId ? 'Voir recette' : (todayMeals.breakfast !== 'Aucun repas planifié' && todayMeals.breakfast !== '' ? 'Modifier' : 'Planifier')}
                    </Text>
                </View>
            </TouchableOpacity>
            */}

            <View style={styles.mealsContainer}>
              <TouchableOpacity
                style={styles.mealCard}
                onPress={() => handleMealPress('lunch')}
                activeOpacity={0.7}
              >
                <View style={styles.mealCardHeader}>
                  <View style={styles.mealTimeContainer}>
                    <Text style={styles.mealEmoji}>☀️</Text>
                    <Text style={styles.mealType}>Déjeuner</Text>
                  </View>
                  <Text style={styles.mealTime}>12:00</Text>
                </View>
                <Text style={styles.mealName} numberOfLines={2}>
                  {loadingMeals ? "Chargement..." : todayMeals.lunch}
                </Text>
                <View style={styles.mealCardFooter}>
                  <Text style={styles.mealActionText}>
                    {todayMeals.lunchRecipeId ? 'Voir recette' : (todayMeals.lunch !== 'Aucun repas planifié' && todayMeals.lunch !== '' ? 'Modifier' : 'Planifier')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mealCard}
                onPress={() => handleMealPress('dinner')}
                activeOpacity={0.7}
              >
                <View style={styles.mealCardHeader}>
                  <View style={styles.mealTimeContainer}>
                    <Text style={styles.mealEmoji}>🌙</Text>
                    <Text style={styles.mealType}>Dîner</Text>
                  </View>
                  <Text style={styles.mealTime}>19:00</Text>
                </View>
                <Text style={styles.mealName} numberOfLines={2}>
                  {loadingMeals ? "Chargement..." : todayMeals.dinner}
                </Text>
                <View style={styles.mealCardFooter}>
                  <Text style={styles.mealActionText}>
                    {todayMeals.dinnerRecipeId ? 'Voir recette' : (todayMeals.dinner !== 'Aucun repas planifié' && todayMeals.dinner !== '' ? 'Modifier' : 'Planifier')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {expiringItems.length > 0 && (
            <View style={styles.alertsContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>⚠️ Produits à surveiller</Text>
                <TouchableOpacity
                  style={styles.sectionAction}
                  onPress={() => handleQuickAction('stock')}
                >
                  <Text style={styles.sectionActionText}>Tout voir</Text>
                </TouchableOpacity>
              </View>

              {expiringItems.slice(0, 4).map((item: ExpiringItem) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.alertItem}
                  onPress={() => handleQuickAction('stock')}
                  activeOpacity={0.7}
                >
                  <View style={styles.alertIconContainer}>
                    <View style={[
                      styles.alertIcon,
                      { backgroundColor: getExpirationColor(item.days) + '20' },
                    ]}>
                      <View style={[
                        styles.alertDot,
                        { backgroundColor: getExpirationColor(item.days) },
                      ]} />
                    </View>
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertItemName}>
                      {item.name} {item.quantity > 1 && `(x${item.quantity})`}
                    </Text>
                    <Text style={[
                      styles.alertItemExpiry,
                      { color: getExpirationColor(item.days) },
                    ]}>
                      {getExpirationText(item.days)}
                    </Text>
                    <Text style={styles.alertItemCategory}>{item.category}</Text>
                  </View>
                  <View style={styles.alertAction}>
                    <Text style={styles.alertActionText}>→</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitle}>🚀 Actions rapides</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={[styles.quickActionCard, styles.shoppingCard]}
                onPress={() => handleQuickAction('shopping')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.shoppingIcon]}>
                  <Text style={styles.quickActionEmoji}>🛒</Text>
                </View>
                <Text style={styles.quickActionTitle}>Ma liste</Text>
                <Text style={styles.quickActionSubtitle}>de courses</Text>
                {shoppingListCount > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{shoppingListCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionCard, styles.planningCard]}
                onPress={() => handleQuickAction('planning')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.planningIcon]}>
                  <Text style={styles.quickActionEmoji}>📅</Text>
                </View>
                <Text style={styles.quickActionTitle}>Planning</Text>
                <Text style={styles.quickActionSubtitle}>des repas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionCard, styles.stockCard]}
                onPress={() => handleQuickAction('stock')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.stockIcon]}>
                  <Text style={styles.quickActionEmoji}>🥫</Text>
                </View>
                <Text style={styles.quickActionTitle}>Mon stock</Text>
                <Text style={styles.quickActionSubtitle}>& frigo</Text>
                {expiringItems.length > 0 && (
                  <View style={[styles.quickActionBadge, { backgroundColor: '#FF4757' }]}>
                    <Text style={styles.quickActionBadgeText}>{expiringItems.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionCard, styles.recipesCard]}
                onPress={() => handleQuickAction('recipes')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.recipesIcon]}>
                  <Text style={styles.quickActionEmoji}>📖</Text>
                </View>
                <Text style={styles.quickActionTitle}>Recettes</Text>
                <Text style={styles.quickActionSubtitle}>& idées</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionCard, styles.statsCard]}
                onPress={() => handleQuickAction('stats')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.statsIcon]}>
                  <Text style={styles.quickActionEmoji}>📊</Text>
                </View>
                <Text style={styles.quickActionTitle}>Statistiques</Text>
                <Text style={styles.quickActionSubtitle}>& budget</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionCard, styles.profileCard]}
                onPress={() => handleQuickAction('profile')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.profileIconContainer]}>
                  <Text style={styles.quickActionEmoji}>👤</Text>
                </View>
                <Text style={styles.quickActionTitle}>Profil</Text>
                <Text style={styles.quickActionSubtitle}>& paramètres</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inspirationSection}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.inspirationCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.inspirationIcon}>💡</Text>
              <Text style={styles.inspirationTitle}>Inspiration du jour</Text>
              <Text style={styles.inspirationText}>
                "Cuisiner avec amour transforme les ingrédients les plus simples en moments précieux."
              </Text>
              <TouchableOpacity
                style={styles.inspirationButton}
                onPress={() => handleQuickAction('recipes')}
              >
                <Text style={styles.inspirationButtonText}>Découvrir une recette</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 16 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoText: {
    fontSize: 24,
  },
  appNameAndSubtitleContainer: {
    marginLeft: 16,
  },
  appName: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  appSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  profileButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileIcon: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  animatedContainer: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    marginTop: -16,
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A5D4A',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  welcomeText: {
    fontSize: 17,
    color: '#555',
    marginBottom: 24,
    lineHeight: 25,
    fontWeight: '500',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStatEmoji: {
    fontSize: 20,
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A5D4A',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionAction: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionActionText: {
    fontSize: 13,
    color: '#1A5D4A',
    fontWeight: '700',
  },
  todayMealsSection: {
    marginBottom: 24,
  },
  mealsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  mealCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  mealType: {
    fontSize: 15,
    color: '#666',
    fontWeight: '700',
  },
  mealTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    lineHeight: 22,
    minHeight: 44,
  },
  mealCardFooter: {
    alignItems: 'flex-start',
  },
  mealActionText: {
    fontSize: 13,
    color: '#1A5D4A',
    fontWeight: '700',
  },
  alertsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  alertIconContainer: {
    marginRight: 16,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  alertInfo: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  alertItemExpiry: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertItemCategory: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  alertAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertActionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '700',
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  quickActionCard: {
    width: (width - 40 - 16) / 2,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    position: 'relative',
    minHeight: 120,
  },
  shoppingCard: { borderLeftWidth: 5, borderLeftColor: '#FF6B6B' },
  planningCard: { borderLeftWidth: 5, borderLeftColor: '#4ECDC4' },
  stockCard: { borderLeftWidth: 5, borderLeftColor: '#45B7D1' },
  statsCard: { borderLeftWidth: 5, borderLeftColor: '#96CEB4' },
  recipesCard: { borderLeftWidth: 5, borderLeftColor: '#A8E6CF' },
  profileCard: { borderLeftWidth: 5, borderLeftColor: '#FFD93D' },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  shoppingIcon: { backgroundColor: '#FF6B6B20' },
  planningIcon: { backgroundColor: '#4ECDC420' },
  stockIcon: { backgroundColor: '#45B7D120' },
  statsIcon: { backgroundColor: '#96CEB420' },
  recipesIcon: { backgroundColor: '#A8E6CF20' },
  profileIconContainer: { backgroundColor: '#FFD93D20' },
  quickActionEmoji: { fontSize: 28 },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  quickActionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  quickActionBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  inspirationSection: {
    marginBottom: 32,
  },
  inspirationCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  inspirationIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  inspirationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    marginBottom: 16,
  },
  inspirationText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  inspirationButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  inspirationButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default HomeScreen;
