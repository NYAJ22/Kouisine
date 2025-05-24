import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

// Types
interface TodayMeals {
  lunch: string;
  dinner: string;
}

interface ExpiringItem {
  name: string;
  days: number;
}

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

type QuickActionType = 'shopping' | 'planning' | 'stock' | 'stats' | 'profile';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [todayMeals, _setTodayMeals] = useState<TodayMeals>({
    lunch: 'Pasta Bolognaise',
    dinner: 'Salade César',
  });
  const [shoppingListCount, _setShoppingListCount] = useState<number>(12);
  const [expiringItems, _setExpiringItems] = useState<ExpiringItem[]>([
    { name: 'Lait', days: 1 },
    { name: 'Yaourts', days: 2 },
    { name: 'Bananes', days: 0 },
  ]);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0));
  const slideAnim = React.useRef(new Animated.Value(50));

  useEffect(() => {
    // Formatage de la date actuelle
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setCurrentDate(today.toLocaleDateString('fr-FR', options));

    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim.current, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim.current, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      default:
        Alert.alert('Navigation', `Aller vers ${action}`);
    }
  };

  const getExpirationColor = (days: number): string => {
    if (days === 0) {
      return '#FF6B6B';
    }
    if (days <= 2) {
      return '#FFB347';
    }
    return '#4ECDC4';
  };

  const getExpirationText = (days: number): string => {
    if (days === 0) {
      return 'Expiré';
    }
    if (days === 1) {
      return 'Expire demain';
    }
    return `Expire dans ${days} jours`;
  };

  const handleProfilePress = (): void => {
    navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A5D4A" />
      {/* Header avec gradient */}
      <View style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>🍽️</Text>
            </View>
            <View>
              <Text style={styles.appName}>KOUISINE</Text>
              <Text style={styles.appSubtitle}>Votre assistant culinaire</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim.current,
              transform: [{ translateY: slideAnim.current }],
            },
          ]}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.dateText}>{currentDate}</Text>
            <Text style={styles.welcomeText}>Bonjour ! Que cuisinez-vous aujourd'hui ?</Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatNumber}>{shoppingListCount}</Text>
                <Text style={styles.heroStatLabel}>Articles à acheter</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatNumber}>{expiringItems.length}</Text>
                <Text style={styles.heroStatLabel}>À surveiller</Text>
              </View>
            </View>
          </View>

          {/* Repas du jour - Design carte amélioré */}
          <View style={styles.todayMealsSection}>
            <Text style={styles.sectionTitle}>Vos repas d'aujourd'hui</Text>
            <View style={styles.mealsContainer}>
              <View style={styles.mealCard}>
                <View style={styles.mealCardHeader}>
                  <Text style={styles.mealEmoji}>☀️</Text>
                  <Text style={styles.mealType}>Déjeuner</Text>
                </View>
                <Text style={styles.mealName}>{todayMeals.lunch}</Text>
                <View style={styles.mealCardFooter}>
                  <TouchableOpacity style={styles.mealActionButton}>
                    <Text style={styles.mealActionText}>Voir recette</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.mealCard}>
                <View style={styles.mealCardHeader}>
                  <Text style={styles.mealEmoji}>🌙</Text>
                  <Text style={styles.mealType}>Dîner</Text>
                </View>
                <Text style={styles.mealName}>{todayMeals.dinner}</Text>
                <View style={styles.mealCardFooter}>
                  <TouchableOpacity style={styles.mealActionButton}>
                    <Text style={styles.mealActionText}>Voir recette</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Alertes d'expiration - Design moderne */}
          {expiringItems.length > 0 && (
            <View style={styles.alertsContainer}>
              <View style={styles.alertsHeader}>
                <Text style={styles.sectionTitle}>⚠️ Produits à surveiller</Text>
                <TouchableOpacity style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>Tout voir</Text>
                </TouchableOpacity>
              </View>
              {expiringItems.slice(0, 3).map((item: ExpiringItem, index: number) => (
                <View key={index} style={styles.alertItem}>
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
                    <Text style={styles.alertItemName}>{item.name}</Text>
                    <Text style={[
                      styles.alertItemExpiry,
                      { color: getExpirationColor(item.days) },
                    ]}>
                      {getExpirationText(item.days)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.alertAction}>
                    <Text style={styles.alertActionText}>→</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Actions rapides - Grid améliorée */}
          <View style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={[styles.quickActionCard, styles.shoppingCard]}
                onPress={() => handleQuickAction('shopping')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, styles.shoppingIcon]}>
                  <Text style={styles.quickActionEmoji}>📝</Text>
                </View>
                <Text style={styles.quickActionTitle}>Ma liste</Text>
                <Text style={styles.quickActionSubtitle}>de courses</Text>
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
            </View>
          </View>

          {/* Section inspiration */}
          <View style={styles.inspirationSection}>
            <Text style={styles.sectionTitle}>💡 Inspiration du jour</Text>
            <View style={styles.inspirationCard}>
              <Text style={styles.inspirationText}>
                "Cuisiner avec amour transforme les ingrédients les plus simples en moments précieux."
              </Text>
              <TouchableOpacity style={styles.inspirationButton}>
                <Text style={styles.inspirationButtonText}>Découvrir une recette</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#1A5D4A',
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoText: {
    fontSize: 22,
  },
  appName: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileIcon: {
    fontSize: 20,
    color: 'white',
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
    borderRadius: 20,
    padding: 24,
    marginTop: -12,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A5D4A',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A5D4A',
  },
  heroStatLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E9ECEF',
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  todayMealsSection: {
    marginBottom: 24,
  },
  mealsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  mealType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    lineHeight: 22,
  },
  mealCardFooter: {
    alignItems: 'flex-start',
  },
  mealActionButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mealActionText: {
    fontSize: 12,
    color: '#1A5D4A',
    fontWeight: '600',
  },
  alertsContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 12,
    color: '#1A5D4A',
    fontWeight: '600',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  alertIconContainer: {
    marginRight: 16,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  alertInfo: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  alertItemExpiry: {
    fontSize: 13,
    fontWeight: '500',
  },
  alertAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertActionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 52) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  shoppingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  planningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  stockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#45B7D1',
  },
  statsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#96CEB4',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  shoppingIcon: {
    backgroundColor: '#FF6B6B20',
  },
  planningIcon: {
    backgroundColor: '#4ECDC420',
  },
  stockIcon: {
    backgroundColor: '#45B7D120',
  },
  statsIcon: {
    backgroundColor: '#96CEB420',
  },
  quickActionEmoji: {
    fontSize: 26,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  inspirationSection: {
    marginBottom: 32,
  },
  inspirationCard: {
    backgroundColor: '#1A5D4A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  inspirationText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 20,
  },
  inspirationButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inspirationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
