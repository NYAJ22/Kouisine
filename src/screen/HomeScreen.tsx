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
  Platform,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import LinearGradient from 'react-native-linear-gradient'; // Make sure this is installed: npm install react-native-linear-gradient

// Types
interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

interface TodayMeals {
  breakfast: string;
  lunch: string;
  dinner: string;
  lunchRecipeId?: string;
  dinnerRecipeId?: string;
  breakfastRecipeId?: string;
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
  // Il y a des cas limites, mais pour un usage courant c'est suffisant.
  const firstJan = new Date(year, 0, 1);
  const daysOffset = (monday.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000);
  const firstJanDayOfWeek = (firstJan.getDay() === 0) ? 7 : firstJan.getDay(); // Lundi=1, Dimanche=7
  const weekNumber = Math.ceil((daysOffset + firstJanDayOfWeek - 1) / 7);

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// Noms des jours en français pour correspondre aux clés du planning
const dayNamesForPlanning = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];


const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [todayMeals, setTodayMeals] = useState<TodayMeals>({
    breakfast: 'Aucun repas planifié',
    lunch: 'Aucun repas planifié',
    dinner: 'Aucun repas planifié',
  });
  const [shoppingListCount, setShoppingListCount] = useState<number>(0);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [totalStockItems, setTotalStockItems] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMeals, setLoadingMeals] = useState<boolean>(true);

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

    // Animations d'entrée pour les éléments principaux
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

    // Listener pour recharger les données lorsque l'écran est à nouveau focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
        loadUserData();
    });

    loadUserData(); // Chargement initial des données

    return () => {
        unsubscribeFocus(); // Nettoyage du listener de focus
        // Les désabonnements des listeners Firestore sont gérés dans loadUserData
    };
  }, [navigation, fadeAnim, slideAnim]); // Ajout de fadeAnim et slideAnim dans les dépendances

  const loadUserData = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      console.log('User not logged in');
      setLoadingMeals(false);
      setRefreshing(false);
      // Réinitialiser tous les états si l'utilisateur n'est pas connecté
      setUserProfile(null);
      setTodayMeals({ breakfast: 'Aucun repas planifié', lunch: 'Aucun repas planifié', dinner: 'Aucun repas planifié' });
      setShoppingListCount(0);
      setExpiringItems([]);
      setTotalStockItems(0);
      // Retourne une fonction vide pour le nettoyage si pas d'utilisateur
      return () => {};
    }

    setRefreshing(true); // Indique le début du rafraîchissement global
    setLoadingMeals(true); // Indique le début du chargement des repas spécifiques

    const cleanupFunctions: (() => void)[] = []; // Pour stocker les fonctions de désabonnement

    try {
      // 1. Charger le profil utilisateur
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

      // 2. Listener pour la liste de courses
      const unsubscribeShopping = firestore()
        .collection('users')
        .doc(uid)
        .collection('shoppingList')
        .where('completed', '==', false) // Filtrer les articles non achetés
        .onSnapshot(snapshot => {
          setShoppingListCount(snapshot.size);
        }, error => console.error('Error fetching shopping list:', error));
      cleanupFunctions.push(unsubscribeShopping);

      // 3. Listener pour le frigo/stock et les articles expirants
      const unsubscribeFridge = firestore()
        .collection('users')
        .doc(uid)
        .collection('fridge')
        .onSnapshot(snapshot => {
          setTotalStockItems(snapshot.size);
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Normaliser la date actuelle au début du jour

          const expiring: ExpiringItem[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.expiryDate) {
              let expiryDate: Date;
              if (data.expiryDate.toDate) { // Firebase Timestamp
                expiryDate = data.expiryDate.toDate();
              } else if (typeof data.expiryDate === 'string') { // Chaîne de date (ex: "DD/MM/YYYY")
                const parts = data.expiryDate.split('/');
                if (parts.length === 3) {
                    // Les mois sont basés sur 0 dans Date (Janvier = 0)
                    expiryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                } else {
                    console.warn(`Invalid date string format: ${data.expiryDate} for item ${doc.id}`);
                    return;
                }
              } else {
                console.warn(`Unrecognized expiryDate format for item ${doc.id}:`, data.expiryDate);
                return;
              }
              // Assurez-vous que la date parsée est valide
              if (isNaN(expiryDate.getTime())) {
                console.warn(`Parsed expiryDate is invalid for item ${doc.id}:`, data.expiryDate);
                return;
              }

              expiryDate.setHours(0, 0, 0, 0); // Normaliser la date d'expiration au début du jour

              const timeDiff = expiryDate.getTime() - now.getTime();
              const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Arrondi au supérieur pour inclure le jour même

              if (days <= 3) { // 0 jour (aujourd'hui), 1 jour (demain), 2 jours, 3 jours
                expiring.push({
                  id: doc.id,
                  name: data.name || 'Produit',
                  days: Math.max(days, 0), // Assure que les jours ne sont pas négatifs si déjà expiré
                  quantity: data.quantity || 1,
                  category: data.category || 'Autre',
                });
              }
            }
          });
          expiring.sort((a, b) => a.days - b.days); // Trier par nombre de jours restants
          setExpiringItems(expiring);
        }, error => console.error('Error fetching fridge items:', error));
      cleanupFunctions.push(unsubscribeFridge);

      // 4. Listener pour les repas du jour depuis le planning hebdomadaire
      const currentWeekId = getCurrentWeekId(0); // Semaine actuelle
      const today = new Date();
      const todayDayName = dayNamesForPlanning[today.getDay()]; // Nom du jour actuel (ex: "Lundi")

      const mealPlanningRef = firestore()
        .collection('users')
        .doc(uid)
        .collection('mealPlanning')
        .doc(currentWeekId);

      const unsubscribeWeeklyMeals = mealPlanningRef.onSnapshot(docSnapshot => {
        setLoadingMeals(true); // Indiquer le chargement des repas
        if (docSnapshot.exists()) {
          const weeklyPlanningData = docSnapshot.data();
          const planningForWeek = weeklyPlanningData?.planning;

          if (planningForWeek && planningForWeek[todayDayName]) {
            const mealsForToday = planningForWeek[todayDayName];
            setTodayMeals({
              breakfast: mealsForToday.breakfast || 'Aucun repas planifié',
              lunch: mealsForToday.lunch || 'Aucun repas planifié',
              dinner: mealsForToday.dinner || 'Aucun repas planifié',
              breakfastRecipeId: mealsForToday.breakfastRecipeId,
              lunchRecipeId: mealsForToday.lunchRecipeId,
              dinnerRecipeId: mealsForToday.dinnerRecipeId,
            });
          } else {
            setTodayMeals({
              breakfast: 'Aucun repas planifié',
              lunch: 'Aucun repas planifié',
              dinner: 'Aucun repas planifié',
            });
          }
        } else {
          setTodayMeals({
            breakfast: 'Aucun repas planifié',
            lunch: 'Aucun repas planifié',
            dinner: 'Aucun repas planifié',
          });
        }
        setLoadingMeals(false); // Fin du chargement des repas
        setRefreshing(false); // Fin du rafraîchissement global
      }, error => {
        console.error('Error fetching weekly meal plan:', error);
        setTodayMeals({ breakfast: 'Aucun repas planifié', lunch: 'Aucun repas planifié', dinner: 'Aucun repas planifié' });
        setLoadingMeals(false);
        setRefreshing(false);
      });
      cleanupFunctions.push(unsubscribeWeeklyMeals);

      // Retourne une fonction de nettoyage qui désabonne tous les listeners Firestore
      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
      Alert.alert('Erreur', 'Impossible de charger les données utilisateur.');
      setLoadingMeals(false);
      setRefreshing(false);
      return () => {}; // Retourne une fonction vide pour le nettoyage
    }
  };

  const onRefresh = () => {
    // loadUserData gère déjà setRefreshing(true/false)
    loadUserData();
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
    if (days === 0) { return '#FF4757'; } // Rouge vif (expire aujourd'hui)
    if (days === 1) { return '#FF6B6B'; } // Rouge corail (expire demain)
    if (days === 2) { return '#FFB347'; } // Orange (expire dans 2 jours)
    return '#FFA726'; // Jaune-orange (expire dans 3 jours ou plus)
  };

  const getExpirationText = (days: number): string => {
    if (days === 0) { return "Expire aujourd'hui"; }
    if (days === 1) { return 'Expire demain'; }
    if (days >= 2) { return `Expire dans ${days} jours`; }
    return "Expiré"; // Pour les articles déjà expirés (jours < 0)
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
    else if (mealType === 'breakfast') recipeId = todayMeals.breakfastRecipeId;

    if (recipeId) {
      navigation.navigate('RecipeDetail', { recipeId });
    } else {
      navigation.navigate('MealPlanning'); // Redirige vers le planning si pas de recette spécifique
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
    // Fallback si le parent n'est pas un Drawer ou si openDrawer n'existe pas
    if (typeof (navigation as any).openDrawer === 'function') {
        (navigation as any).openDrawer();
    } else {
        console.warn('navigation.openDrawer is not a function. Is a Drawer Navigator configured?');
        Alert.alert('Erreur de navigation', 'Impossible d\'ouvrir le menu latéral. Veuillez vérifier la configuration du Drawer Navigator.');
    }
  };

  const renderQuickStats = () => (
    <View style={styles.quickStatsContainer}>
      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#FFC10720' }]}>
          <Text style={styles.quickStatEmoji}>🛒</Text>
        </View>
        <Text style={styles.quickStatNumber}>{shoppingListCount}</Text>
        <Text style={styles.quickStatLabel}>À acheter</Text>
      </View>

      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#42A5F520' }]}>
          <Text style={styles.quickStatEmoji}>🥫</Text>
        </View>
        <Text style={styles.quickStatNumber}>{totalStockItems}</Text>
        <Text style={styles.quickStatLabel}>En stock</Text>
      </View>

      <View style={styles.quickStatItem}>
        <View style={[styles.quickStatIcon, { backgroundColor: '#FF704320' }]}>
          <Text style={styles.quickStatEmoji}>⚠️</Text>
        </View>
        <Text style={styles.quickStatNumber}>{expiringItems.length}</Text>
        <Text style={styles.quickStatLabel}>À surveiller</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF7043" />

      <LinearGradient
        colors={['#FF8A65', '#FF7043']}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF7043']} tintColor={'#FF7043'}/>
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

            <View style={styles.mealsContainer}>
              {/* Petit-déjeuner */}
              <TouchableOpacity
                style={styles.mealCard}
                onPress={() => handleMealPress('breakfast')}
                activeOpacity={0.7}
              >
                <View style={styles.mealCardHeader}>
                  <View style={styles.mealTimeContainer}>
                    <Text style={styles.mealEmoji}>☕</Text>
                    <Text style={styles.mealType}>Petit-déjeuner</Text>
                  </View>
                  <Text style={styles.mealTime}>08:00</Text>
                </View>
                <Text style={styles.mealName} numberOfLines={2}>
                  {loadingMeals ? 'Chargement...' : todayMeals.breakfast}
                </Text>
                <View style={styles.mealCardFooter}>
                  <Text style={styles.mealActionText}>
                    {todayMeals.breakfastRecipeId ? 'Voir recette' : (todayMeals.breakfast !== 'Aucun repas planifié' && todayMeals.breakfast !== '' ? 'Modifier' : 'Planifier')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Déjeuner */}
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
                  {loadingMeals ? 'Chargement...' : todayMeals.lunch}
                </Text>
                <View style={styles.mealCardFooter}>
                  <Text style={styles.mealActionText}>
                    {todayMeals.lunchRecipeId ? 'Voir recette' : (todayMeals.lunch !== 'Aucun repas planifié' && todayMeals.lunch !== '' ? 'Modifier' : 'Planifier')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.mealsContainer}>
              {/* Dîner - placé seul dans une nouvelle ligne pour un meilleur alignement visuel sur 2 colonnes */}
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
                  {loadingMeals ? 'Chargement...' : todayMeals.dinner}
                </Text>
                <View style={styles.mealCardFooter}>
                  <Text style={styles.mealActionText}>
                    {todayMeals.dinnerRecipeId ? 'Voir recette' : (todayMeals.dinner !== 'Aucun repas planifié' && todayMeals.dinner !== '' ? 'Modifier' : 'Planifier')}
                  </Text>
                </View>
              </TouchableOpacity>
              {/* Ajout d'une vue vide pour maintenir l'alignement sur deux colonnes pour le dîner */}
              <View style={styles.mealCardPlaceholder} />
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

              {expiringItems.slice(0, 4).map((item: ExpiringItem, index: number) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.alertItem, index === expiringItems.slice(0, 4).length - 1 && styles.alertItemLast]}
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
                style={styles.quickActionCard}
                onPress={() => handleQuickAction('shopping')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.shoppingIcon]}>
                  <Text style={styles.quickActionEmoji}>🛒</Text>
                </View>
                <Text style={styles.quickActionTitle}>Ma liste</Text>
                <Text style={styles.quickActionSubtitle}>de courses</Text>
                {shoppingListCount > 0 && (
                  <View style={[styles.quickActionBadge, { backgroundColor: '#FFC107' }]}> {/* Using secondary accent */}
                    <Text style={styles.quickActionBadgeText}>{shoppingListCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionCard}
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
                style={styles.quickActionCard}
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
                style={styles.quickActionCard}
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
                style={styles.quickActionCard}
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
                style={styles.quickActionCard}
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
              colors={['#42A5F5', '#1E88E5']} // Cool blue gradient for contrast
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

          {/* Boutons d'action au bas de l'écran (full width) */}
          <View style={styles.bottomActionsContainer}>
            <TouchableOpacity
              style={styles.aiAssistantButton}
              onPress={() => navigation.navigate('CuisineAI')}
            >
              <Text style={styles.aiAssistantButtonText}>🤖 Assistant IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.nearbyMarketButton}
                onPress={() => navigation.navigate('NearbyMarkets')}
            >
              <Text style={styles.nearbyMarketButtonText}>🗺️ Trouver un marché proche</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};
  export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFDFD', // Off-white, almost white
  },
  headerGradient: {
    paddingBottom: 24,
    borderBottomLeftRadius: 35, // More rounded
    borderBottomRightRadius: 35,
    elevation: 15, // More prominent shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 10 : 50, // Adjusted for safe area and spacing
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 58, // Larger logo
    height: 58,
    backgroundColor: 'rgba(255,255,255,0.25)', // Slightly more opaque
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)', // Stronger border
  },
  logoText: {
    fontSize: 28, // Larger emoji
  },
  appNameAndSubtitleContainer: {
    marginLeft: 16,
  },
  appName: {
    color: 'white',
    fontSize: 26, // Larger and bolder
    fontWeight: '900',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  appSubtitle: {
    color: 'rgba(255,255,255,0.95)', // Slightly lighter
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  profileButton: {
    width: 54, // Larger
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  profileIcon: {
    fontSize: 20, // Larger
    color: 'white',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10, // Added vertical padding
  },
  animatedContainer: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    marginTop: -25, // Pulls it up into the header gradient
    marginBottom: 24,
    elevation: 10, // More prominent shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    borderWidth: StyleSheet.hairlineWidth, // Subtle border
    borderColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 24, // Larger
    fontWeight: '800',
    color: '#FF7043', // Primary accent color
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  welcomeText: {
    fontSize: 18, // Larger and more prominent
    color: '#212121', // Darker text
    marginBottom: 24,
    lineHeight: 26,
    fontWeight: '600',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 18, // More padding
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE', // Lighter border
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8, // Added padding
  },
  quickStatIcon: {
    width: 52, // Larger icon background
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)', // Subtle border
  },
  quickStatEmoji: {
    fontSize: 22, // Larger emoji
  },
  quickStatNumber: {
    fontSize: 26, // Larger and bolder
    fontWeight: '900',
    color: '#212121', // Darker text
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#616161', // Mid-tone text
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 23, // Larger
    fontWeight: '800',
    color: '#212121',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18, // More spacing
  },
  sectionAction: {
    backgroundColor: '#EEEEEE', // Lighter background
    paddingHorizontal: 18, // More padding
    paddingVertical: 9,
    borderRadius: 20, // More rounded
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionActionText: {
    fontSize: 14,
    color: '#FF7043', // Primary accent
    fontWeight: '700',
  },
  todayMealsSection: {
    marginBottom: 28, // More spacing
  },
  mealsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16, // Consistent gap
    marginBottom: 16, // Space between rows of meal cards
  },
  mealCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 8, // More pronounced shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
  },
  // Placeholder pour maintenir l'alignement des colonnes si seulement 1 élément dans une ligne
  mealCardPlaceholder: {
    flex: 1,
    backgroundColor: 'transparent', // Rendre invisible
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15, // More spacing
  },
  mealTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealEmoji: {
    fontSize: 24, // Larger emoji
    marginRight: 10,
  },
  mealType: {
    fontSize: 16,
    color: '#616161', // Mid-tone text
    fontWeight: '700',
  },
  mealTime: {
    fontSize: 13,
    color: '#9E9E9E', // Lighter grey
    fontWeight: '600',
  },
  mealName: {
    fontSize: 17, // Slightly larger
    fontWeight: '700',
    color: '#212121',
    marginBottom: 18, // More spacing
    lineHeight: 24,
    minHeight: 48, // Ensure consistent height
  },
  mealCardFooter: {
    alignItems: 'flex-start',
  },
  mealActionText: {
    fontSize: 14,
    color: '#FF7043', // Primary accent
    fontWeight: '700',
  },
  alertsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28, // More spacing
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15, // More padding
    borderBottomWidth: StyleSheet.hairlineWidth, // Subtle separator
    borderBottomColor: '#EEEEEE',
  },
  alertItemLast: {
    borderBottomWidth: 0, // No border for the last item
  },
  alertIconContainer: {
    marginRight: 15,
  },
  alertIcon: {
    width: 40, // Larger icon
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDot: {
    width: 10, // Dot size
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 5, // Position the dot
    right: 5,
    borderWidth: 1.5,
    borderColor: 'white', // White border around the dot
  },
  alertInfo: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  alertItemExpiry: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertItemCategory: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  alertAction: {
    paddingLeft: 15,
  },
  alertActionText: {
    fontSize: 20,
    color: '#9E9E9E', // Grey arrow
  },
  quickActionsContainer: {
    marginBottom: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15, // Gap between cards
  },
  quickActionCard: {
    width: (width - 40 - 15) / 2, // Calculate width for two columns with padding and gap
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
    marginBottom: 15, // Space between rows
  },
  quickActionIcon: {
    width: 60, // Larger icon background
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionEmoji: {
    fontSize: 28, // Larger emoji
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#212121',
    marginBottom: 2,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 18,
  },
  quickActionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFC107', // Gold for general badges
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quickActionBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Specific colors for quick action icons (backgrounds)
  shoppingIcon: { backgroundColor: '#FFC10720' }, // Gold light
  planningIcon: { backgroundColor: '#42A5F520' }, // Blue light
  stockIcon: { backgroundColor: '#FF704320' }, // Orange light
  recipesIcon: { backgroundColor: '#8BC34A20' }, // Green light
  statsIcon: { backgroundColor: '#7B1FA220' }, // Purple light
  profileIconContainer: { backgroundColor: '#607D8B20' }, // Grey blue light

  inspirationSection: {
    marginBottom: 30,
  },
  inspirationCard: {
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  inspirationIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  inspirationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  inspirationText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
  },
  inspirationButton: {
    backgroundColor: 'rgba(255,255,255,0.25)', // White translucent
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  inspirationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  bottomActionsContainer: {
    marginBottom: 30,
    gap: 15, // Space between buttons
  },
  aiAssistantButton: {
    backgroundColor: '#2196F3', // Bright blue
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  aiAssistantButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  nearbyMarketButton: {
    backgroundColor: '#4CAF50', // Green for map/location
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  nearbyMarketButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
