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

type QuickActionType = 'shopping' | 'planning' | 'stock' | 'stats';

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
      default:
        Alert.alert('Navigation', `Aller vers ${action}`);
    }
  };

  const getExpirationColor = (days: number): string => {
    if (days === 0) {
      return '#e74c3c'; // Rouge - Expiré
    }
    if (days <= 2) {
      return '#f39c12'; // Orange - Bientôt expiré
    }
    return '#27ae60'; // Vert - OK
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
      <StatusBar barStyle="light-content" backgroundColor="#2d7d5e" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🍽️</Text>
          </View>
          <Text style={styles.appName}>KOUISINE</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date du jour */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{currentDate}</Text>
          <Text style={styles.welcomeText}>Bonjour ! Que cuisinez-vous aujourd'hui ?</Text>
        </View>

        {/* Résumé du jour */}
        <View style={styles.todaySummary}>
          <Text style={styles.sectionTitle}>Aujourd'hui</Text>
          {/* Repas prévus */}
          <View style={styles.mealsContainer}>
            <View style={styles.mealCard}>
              <Text style={styles.mealType}>🌅 Déjeuner</Text>
              <Text style={styles.mealName}>{todayMeals.lunch}</Text>
            </View>
            <View style={styles.mealCard}>
              <Text style={styles.mealType}>🌙 Dîner</Text>
              <Text style={styles.mealName}>{todayMeals.dinner}</Text>
            </View>
          </View>

          {/* Infos rapides */}
          <View style={styles.quickInfoContainer}>
            <View style={styles.quickInfoCard}>
              <Text style={styles.quickInfoNumber}>{shoppingListCount}</Text>
              <Text style={styles.quickInfoLabel}>Articles sur ma liste</Text>
            </View>
            <View style={styles.quickInfoCard}>
              <Text style={styles.quickInfoNumber}>{expiringItems.length}</Text>
              <Text style={styles.quickInfoLabel}>Produits à surveiller</Text>
            </View>
          </View>
        </View>

        {/* Alertes d'expiration */}
        {expiringItems.length > 0 && (
          <View style={styles.alertsContainer}>
            <Text style={styles.sectionTitle}>⚠️ À surveiller</Text>
            {expiringItems.slice(0, 3).map((item: ExpiringItem, index: number) => (
              <View key={index} style={styles.alertItem}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertItemName}>{item.name}</Text>
                  <Text style={[
                    styles.alertItemExpiry,
                    { color: getExpirationColor(item.days) },
                  ]}>
                    {getExpirationText(item.days)}
                  </Text>
                </View>
                <View style={[
                  styles.alertIndicator,
                  { backgroundColor: getExpirationColor(item.days) },
                ]} />
              </View>
            ))}
          </View>
        )}

        {/* Actions rapides */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('shopping')}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>📝</Text>
              </View>
              <Text style={styles.quickActionTitle}>Ma liste</Text>
              <Text style={styles.quickActionSubtitle}>de courses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('planning')}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>🍽️</Text>
              </View>
              <Text style={styles.quickActionTitle}>Planning</Text>
              <Text style={styles.quickActionSubtitle}>des repas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('stock')}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>🥫</Text>
              </View>
              <Text style={styles.quickActionTitle}>Mon stock</Text>
              <Text style={styles.quickActionSubtitle}>& frigo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('stats')}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>📊</Text>
              </View>
              <Text style={styles.quickActionTitle}>Statistiques</Text>
              <Text style={styles.quickActionSubtitle}>& budget</Text>
            </TouchableOpacity>

          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
  },
  header: {
    backgroundColor: '#2d7d5e',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
  },
  appName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 18,
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dateContainer: {
    marginTop: 20,
    marginBottom: 25,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d7d5e',
    marginBottom: 5,
    textTransform: 'capitalize',
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  todaySummary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  mealsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  mealCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 5,
  },
  mealType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quickInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickInfoCard: {
    alignItems: 'center',
  },
  quickInfoNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d7d5e',
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  alertsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  alertInfo: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  alertItemExpiry: {
    fontSize: 12,
    marginTop: 2,
  },
  alertIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  quickActionsContainer: {
    marginBottom: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#f4d03f',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d7d5e',
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default HomeScreen;
