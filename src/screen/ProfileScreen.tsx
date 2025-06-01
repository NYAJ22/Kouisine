// screen/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
  Platform, // Pour les styles spécifiques à la plateforme
  StatusBar, // Pour contrôler la barre de statut
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient'; // NÉCESSITE L'INSTALLATION: npm install react-native-linear-gradient

const { width } = Dimensions.get('window');

// Interface pour un membre de la famille
interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age?: number;
  avatar?: string;
}

interface UserData {
  uid: string;
  email: string;
  name?: string;
  avatar?: string;
  phone?: string;
  address?: string;
}

type RootStackParamList = {
  Login: undefined;
};

const ProfileScreen = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    relation: '',
    age: '',
  });

  const navigation = useNavigation<import('@react-navigation/native').NavigationProp<RootStackParamList>>();

  const relations = ['Père', 'Mère', 'Époux/se', 'Frère', 'Sœur', 'Fils', 'Fille', 'Grand-père', 'Grand-mère', 'Oncle', 'Tante', 'Cousin/e', 'Autre'];

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const userUnsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(doc => {
        const userData = doc.data();
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          name: userData?.name || userData?.userName || userData?.displayName || 'Utilisateur',
          avatar: userData?.avatar || userData?.photoURL,
          phone: userData?.phone,
          address: userData?.address,
        });
        setLoading(false);
      }, error => {
        console.error("Erreur lors de la récupération des données utilisateur:", error);
        Alert.alert('Erreur', 'Impossible de charger les données de profil.');
        setLoading(false);
      });

    const familyMembersUnsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .collection('familyMembers')
      .orderBy('name', 'asc')
      .onSnapshot(snapshot => {
        const members: FamilyMember[] = [];
        snapshot.forEach(doc => {
          members.push({
            id: doc.id,
            ...doc.data() as Omit<FamilyMember, 'id'>,
          });
        });
        setFamilyMembers(members);
      }, error => {
        console.error("Erreur lors de la récupération des membres de la famille:", error);
        Alert.alert('Erreur', 'Impossible de charger les membres de la famille.');
      });

    return () => {
      userUnsubscribe();
      familyMembersUnsubscribe();
    };
  }, [navigation]);

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth().signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (e) {
              console.error("Erreur lors de la déconnexion:", e);
              Alert.alert('Erreur', "Impossible de se déconnecter.");
            }
          },
        },
      ]
    );
  };

  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberForm({ name: '', relation: '', age: '' });
    setModalVisible(true);
  };

  const openEditMemberModal = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      relation: member.relation,
      age: member.age?.toString() || '',
    });
    setModalVisible(true);
  };

  const handleSaveMember = async () => {
    if (!memberForm.name.trim() || !memberForm.relation.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom et la relation.');
      return;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) return;

    try {
      const memberData = {
        name: memberForm.name.trim(),
        relation: memberForm.relation,
        age: memberForm.age ? parseInt(memberForm.age) : undefined,
      };

      if (editingMember) {
        await firestore()
          .collection('users')
          .doc(uid)
          .collection('familyMembers')
          .doc(editingMember.id)
          .update(memberData);
      } else {
        await firestore()
          .collection('users')
          .doc(uid)
          .collection('familyMembers')
          .add(memberData);
      }

      setModalVisible(false);
      setMemberForm({ name: '', relation: '', age: '' });
      Alert.alert('Succès', 'Membre enregistré avec succès !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le membre.');
    }
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    Alert.alert(
      'Supprimer le membre',
      `Êtes-vous sûr de vouloir supprimer ${member.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const uid = auth().currentUser?.uid;
            if (!uid) return;
            try {
              await firestore()
                .collection('users')
                .doc(uid)
                .collection('familyMembers')
                .doc(member.id)
                .delete();
              Alert.alert('Supprimé', 'Membre supprimé avec succès.');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le membre.');
            }
          },
        },
      ]
    );
  };

  // --- Rendu d'un élément de membre de la famille (amélioré) ---
  const renderFamilyMemberItem = ({ item }: { item: FamilyMember }) => (
    <View style={styles.familyMemberCard}>
      <View style={styles.memberLeft}>
        <View style={styles.avatarWrapper}>
          <Image
            source={
              item.avatar
                ? { uri: item.avatar }
                : require('../assets/avatar-default.png')
            }
            style={styles.familyMemberAvatar}
          />
          <View style={styles.relationBadge}>
            <Text style={styles.relationBadgeText}>
              {item.relation ? item.relation.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberRelation}>
            {item.relation}{item.age ? ` • ${item.age} ans` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.memberActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditMemberModal(item)}
        >
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMember(item)}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header avec gradient de couleur */}
        <LinearGradient
          colors={['#4A90E2', '#357ABD']} // Un gradient bleu élégant
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.profileImageContainer}>
              <Image
                source={
                  user?.avatar
                    ? { uri: user.avatar }
                    : require('../assets/avatar-default.png')
                }
                style={styles.profileImage}
              />
              {/* Indicateur de statut (peut être utilisé pour 'en ligne' ou autre) */}
              <View style={styles.statusIndicator} />
            </View>
            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.phone && (
              <Text style={styles.userInfo}>📞 {user.phone}</Text>
            )}
            {user?.address && (
              <Text style={styles.userInfo}>📍 {user.address}</Text>
            )}
            <TouchableOpacity style={styles.editProfileButton}>
              <Text style={styles.editProfileButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Section Informations personnelles (optionnel si vous voulez la rajouter) */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations Personnelles</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom :</Text>
            <Text style={styles.infoValue}>{user?.name || 'Non défini'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email :</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          {user?.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Téléphone :</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          )}
          {user?.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse :</Text>
              <Text style={styles.infoValue}>{user.address}</Text>
            </View>
          )}
        </View> */}

        {/* Section Membres de la famille */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Ma Famille</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddMemberModal}>
              <Text style={styles.addButtonText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>

          {familyMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👥</Text>
              <Text style={styles.emptyStateTitle}>Aucun membre ajouté</Text>
              <Text style={styles.emptyStateSubtitle}>
                Commencez par ajouter les membres de votre famille ici.
              </Text>
            </View>
          ) : (
            <FlatList
              data={familyMembers}
              keyExtractor={(item) => item.id}
              renderItem={renderFamilyMemberItem}
              scrollEnabled={false} // Désactiver le défilement de FlatList car il est dans un ScrollView parent
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />} // Espacement entre les cartes
            />
          )}
        </View>

        {/* Bouton de déconnexion */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />{/* Espace pour le bas du scroll */}
      </ScrollView>

      {/* Modal pour ajouter/modifier un membre */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMember ? '✏️ Modifier le membre' : '➕ Ajouter un membre'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.textInput}
                  value={memberForm.name}
                  onChangeText={(text) => setMemberForm({ ...memberForm, name: text })}
                  placeholder="Entrez le nom complet"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Relation *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.relationContainer}>
                    {relations.map((relation) => (
                      <TouchableOpacity
                        key={relation}
                        style={[
                          styles.relationChip,
                          memberForm.relation === relation && styles.relationChipSelected,
                        ]}
                        onPress={() => setMemberForm({ ...memberForm, relation })}
                      >
                        <Text
                          style={[
                            styles.relationChipText,
                            memberForm.relation === relation && styles.relationChipTextSelected,
                          ]}
                        >
                          {relation}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Âge (optionnel)</Text>
                <TextInput
                  style={styles.textInput}
                  value={memberForm.age}
                  onChangeText={(text) => setMemberForm({ ...memberForm, age: text })}
                  placeholder="Entrez l'âge"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveMember}>
                <Text style={styles.saveButtonText}>
                  {editingMember ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa', // Fond général légèrement gris
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
  },
  // --- Header Section ---
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20, // Ajustement pour la barre de statut iOS
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    // Les styles de shadow sont définis par LinearGradient maintenant
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff', // Bordure blanche autour de l'avatar
    backgroundColor: '#e0e0e0', // Fallback si l'image n'est pas chargée
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50', // Vert vif pour le statut (en ligne)
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 2,
    fontWeight: '500',
  },
  editProfileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Bouton transparent sur le gradient
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  editProfileButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // --- Section Générique pour les cartes ---
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Ombre plus prononcée pour la profondeur
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50', // Gris foncé pour les titres
  },
  addButton: {
    backgroundColor: '#4A90E2', // Couleur principale
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // --- Family Member Card ---
  familyMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fcfcfc', // Fond très clair pour les cartes de membres
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 5, // Bordure gauche plus épaisse
    borderLeftColor: '#A8DADC', // Couleur pastel pour la bordure (peut être dynamique selon la relation)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  familyMemberAvatar: {
    width: 55, // Taille légèrement augmentée
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#e0e0e0',
  },
  relationBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24, // Badge légèrement plus grand
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2', // Couleur principale
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  relationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700', // Plus gras
    color: '#2c3e50',
    marginBottom: 4,
  },
  memberRelation: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Espacement entre les icônes
  },
  editButton: {
    padding: 8,
    borderRadius: 20, // Rond
    backgroundColor: '#EBF5FB', // Fond léger pour les actions
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FDEDEC', // Fond rouge très léger pour supprimer
  },
  actionIcon: {
    fontSize: 18,
    color: '#34495e', // Couleur neutre pour les icônes d'action
  },
  // --- Empty State ---
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateIcon: {
    fontSize: 60, // Grande icône
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // --- Logout Button ---
  logoutButton: {
    backgroundColor: '#e74c3c', // Rouge pour déconnexion
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Fond plus sombre pour la modal
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 25, // Rayon plus grand
    width: width - 40,
    maxHeight: '85%', // Un peu plus grand
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, // Ligne très fine
    borderBottomColor: '#e0e0e0', // Gris clair
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    width: 36, // Taille légèrement plus grande
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5', // Fond léger pour le bouton fermer
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  formContainer: {
    padding: 25, // Padding plus grand
  },
  inputGroup: {
    marginBottom: 25, // Plus d'espace entre les groupes d'input
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700', // Plus gras
    color: '#2c3e50',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dcdcdc', // Bordure plus subtile
    borderRadius: 15, // Rayon plus grand
    paddingHorizontal: 18,
    paddingVertical: 14, // Padding vertical plus grand
    fontSize: 16,
    backgroundColor: '#fdfdfd', // Fond presque blanc
    color: '#34495e',
  },
  relationContainer: {
    flexDirection: 'row',
    paddingVertical: 4, // Un peu d'espace si les chips sont trop serrés
  },
  relationChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25, // Bien rond
    backgroundColor: '#f0f2f5', // Gris clair
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 10, // Espacement entre les chips
  },
  relationChipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  relationChipText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  relationChipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Espacement équitable
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 15, // Espace entre les boutons
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: '#eef2f5', // Gris très clair
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: '#4A90E2', // Couleur principale
    alignItems: 'center',
    shadowColor: '#4A90E2', // Ombre sur le bouton sauvegarder
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
