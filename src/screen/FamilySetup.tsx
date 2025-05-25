import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';
//import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FamilySetup'>;
};

type FamilyMember = {
  id: string;
  name: string;
  age: string;
  emoji: string;
};

const MEMBER_EMOJIS = ['👨', '👩', '👦', '👧', '🧓', '👶', '👴', '👵', '🧒', '👱'];

const FamilySetup: React.FC<Props> = ({ navigation }) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, headerSlideAnim, slideAnim]);

  const getRandomEmoji = (): string => {
    return MEMBER_EMOJIS[Math.floor(Math.random() * MEMBER_EMOJIS.length)];
  };

  const addMember = (): void => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un prénom');
      return;
    }
    if (!age.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un âge');
      return;
    }
    if (isNaN(Number(age)) || Number(age) < 0 || Number(age) > 120) {
      Alert.alert('Erreur', 'Veuillez entrer un âge valide (0-120)');
      return;
    }

    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: name.trim(),
      age: age.trim(),
      emoji: getRandomEmoji(),
    };

    setMembers([...members, newMember]);
    setName('');
    setAge('');

    // Animation pour le nouveau membre
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const removeMember = (id: string): void => {
    Alert.alert(
      'Supprimer le membre',
      'Êtes-vous sûr de vouloir supprimer ce membre de la famille ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setMembers(members.filter(member => member.id !== id));
          },
        },
      ]
    );
  };

  const handleContinue = async (): Promise<void> => {
    if (members.length === 0) {
      Alert.alert('Information', 'Ajoutez au moins un membre de la famille pour continuer');
      return;
    }

    setIsLoading(true);
    const uid = auth().currentUser?.uid;

    if (!uid) {
      setIsLoading(false);
      Alert.alert('Erreur', 'Problème d\'authentification');
      return;
    }

    try {
      /*await firestore().collection('users').doc(uid).update({
        family: members,
      });*/

      // Simulation du traitement
      setTimeout(() => {
        setIsLoading(false);
        navigation.replace('Home');
      }, 1500);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Erreur', 'Impossible de sauvegarder les informations familiales');
    }
  };

  const renderMemberItem = ({ item, index }: { item: FamilyMember; index: number }) => (
    <Animated.View
      style={[
        styles.memberCard,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10 * index],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatarContainer}>
          <Text style={styles.memberEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberAge}>{item.age} ans</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeMember(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.removeIcon}>🗑️</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A5D4A" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: headerSlideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.title}>Qui mange avec vous ?</Text>
            <Text style={styles.subtitle}>
              Ajoutez les membres de votre famille pour personnaliser vos menus
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Étape 2 sur 3</Text>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </Animated.View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Formulaire d'ajout */}
          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Ajouter un membre</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Prénom</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'name' && styles.inputWrapperFocused,
                ]}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    placeholder="Ex: Marie, Paul..."
                    placeholderTextColor="#A0A0A0"
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Âge</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'age' && styles.inputWrapperFocused,
                ]}>
                  <Text style={styles.inputIcon}>🎂</Text>
                  <TextInput
                    placeholder="Ex: 25, 8..."
                    placeholderTextColor="#A0A0A0"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={age}
                    onChangeText={setAge}
                    onFocus={() => setFocusedField('age')}
                    onBlur={() => setFocusedField(null)}
                    maxLength={3}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={addMember}
                activeOpacity={0.8}
              >
                <Text style={styles.addButtonIcon}>➕</Text>
                <Text style={styles.addButtonText}>Ajouter à la famille</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Liste des membres */}
          {members.length > 0 && (
            <Animated.View
              style={[
                styles.familyListContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.familyListTitle}>
                Ma famille ({members.length} membre{members.length > 1 ? 's' : ''})
              </Text>
              <FlatList
                data={members}
                keyExtractor={item => item.id}
                renderItem={renderMemberItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </Animated.View>
          )}

          {/* Message d'encouragement si pas de membres */}
          {members.length === 0 && (
            <Animated.View
              style={[
                styles.emptyStateContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.emptyStateEmoji}>🏠</Text>
              <Text style={styles.emptyStateTitle}>Votre famille vous attend !</Text>
              <Text style={styles.emptyStateText}>
                Commencez par ajouter le premier membre de votre famille
              </Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bouton Continuer */}
        <Animated.View
          style={[
            styles.footerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.continueButton,
              members.length === 0 && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={members.length === 0 || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Configuration...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.continueButtonText}>Continuer</Text>
                <Text style={styles.continueButtonIcon}>→</Text>
              </>
            )}
          </TouchableOpacity>

          {members.length === 0 && (
            <Text style={styles.continueHint}>
              Ajoutez au moins un membre pour continuer
            </Text>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2e7',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  progressFill: {
    width: '66%',
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperFocused: {
    borderColor: '#1A5D4A',
    backgroundColor: '#F8F9FA',
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 16,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#1A5D4A',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#1A5D4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  familyListContainer: {
    marginBottom: 24,
  },
  familyListTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatarContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#F8F9FA',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberEmoji: {
    fontSize: 24,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  memberAge: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 18,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  continueButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  continueButtonDisabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A5D4A',
    marginRight: 8,
  },
  continueButtonIcon: {
    fontSize: 20,
    color: '#1A5D4A',
  },
  continueHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A5D4A',
  },
});

export default FamilySetup;
