// screen/ProfileScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
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
  Platform,
  StatusBar,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import ImagePicker from 'react-native-image-crop-picker';

const { width } = Dimensions.get('window');

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

interface Recipe {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  [key: string]: any;
}

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
    avatar: '',
  });
  const [uploading, setUploading] = useState(false);
  const [selectedImageType, setSelectedImageType] = useState<'user' | 'member' | null>(null);
  const editingMemberRef = useRef<FamilyMember | null>(null);
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);

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
          avatar: userData?.avatar,
          phone: userData?.phone,
          address: userData?.address,
        });
        setLoading(false);
      }, error => {
        console.error('Erreur lors de la récupération des données utilisateur:', error);
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
        console.error('Erreur lors de la récupération des membres de la famille:', error);
        Alert.alert('Erreur', 'Impossible de charger les membres de la famille.');
      });

    let unsubscribeRecipes: (() => void) | undefined;

    if (currentUser) {
      unsubscribeRecipes = firestore()
        .collection('recipes')
        .where('createdBy', '==', currentUser.uid)
        .onSnapshot(snapshot => {
          const recipes: Recipe[] = [];
          snapshot.forEach(doc => {
            recipes.push({
              id: doc.id,
              ...doc.data(),
            } as Recipe);
          });
          setUserRecipes(recipes);
        });
    }

    return () => {
      userUnsubscribe();
      familyMembersUnsubscribe();
      if (unsubscribeRecipes) unsubscribeRecipes();
    };
  }, [navigation]);

  const handleImagePicker = async (type: 'user' | 'member') => {
    try {
      setSelectedImageType(type);
      const image = await ImagePicker.openPicker({
        width: 500,
        height: 500,
        cropping: true,
        cropperCircleOverlay: true,
        mediaType: 'photo',
        compressImageQuality: 0.8,
      });

      if (type === 'user') {
        await updateUserAvatar(image.path);
      } else {
        setMemberForm({ ...memberForm, avatar: image.path });
      }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code !== 'E_PICKER_CANCELLED') {
        console.error('Erreur lors de la sélection de l\'image:', error);
        Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
      }
    }
  };

  const updateUserAvatar = async (imagePath: string) => {
    if (!user?.uid) return;

    try {
      setUploading(true);
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64data = reader.result as string;

        await firestore()
          .collection('users')
          .doc(user.uid)
          .update({ avatar: base64data });

        setUploading(false);
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'avatar:', error);
      setUploading(false);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo de profil');
    }
  };

  const updateMemberAvatar = async (memberId: string, imagePath: string) => {
    if (!user?.uid) return;

    try {
      setUploading(true);
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64data = reader.result as string;

        await firestore()
          .collection('users')
          .doc(user.uid)
          .collection('familyMembers')
          .doc(memberId)
          .update({ avatar: base64data });

        setUploading(false);
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'avatar:', error);
      setUploading(false);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo du membre');
    }
  };

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
              console.error('Erreur lors de la déconnexion:', e);
              Alert.alert('Erreur', 'Impossible de se déconnecter.');
            }
          },
        },
      ]
    );
  };

  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberForm({ name: '', relation: '', age: '', avatar: '' });
    setModalVisible(true);
  };

  const openEditMemberModal = (member: FamilyMember) => {
    editingMemberRef.current = member;
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      relation: member.relation,
      age: member.age?.toString() || '',
      avatar: member.avatar || '',
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
      const memberData: {
        name: string;
        relation: string;
        age?: number;
        avatar?: string;
      } = {
        name: memberForm.name.trim(),
        relation: memberForm.relation,
        age: memberForm.age ? parseInt(memberForm.age) : undefined,
      };

      // Si c'est une modification et qu'il y a une nouvelle image
      if (editingMember && memberForm.avatar && memberForm.avatar !== editingMember.avatar) {
        await updateMemberAvatar(editingMember.id, memberForm.avatar);
      }

      // Si c'est une création et qu'il y a une image
      if (!editingMember && memberForm.avatar) {
        memberData.avatar = memberForm.avatar;
      }

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
      setMemberForm({ name: '', relation: '', age: '', avatar: '' });
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

  const renderFamilyMemberItem = ({ item }: { item: FamilyMember }) => (
    <View style={styles.familyMemberCard}>
      <View style={styles.memberLeft}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => {
            editingMemberRef.current = item;
            handleImagePicker('member');
          }}
        >
          <Image
            source={
              item.avatar
                ? { uri: item.avatar }
                : require('../assets/avatar-default.png')
            }
            style={styles.familyMemberAvatar}
          />
          <View style={styles.avatarEditBadge}>
            <Text style={{fontSize: 14, color: '#fff'}}>📷</Text>
          </View>
          <View style={styles.relationBadge}>
            <Text style={styles.relationBadgeText}>
              {item.relation ? item.relation.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </TouchableOpacity>
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
          <Text style={{fontSize: 18}}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMember(item)}
        >
          <Text style={{fontSize: 18}}>🗑️</Text>
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
          colors={['#4A90E2', '#357ABD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.profileImageContainer}
              onPress={() => handleImagePicker('user')}
              disabled={uploading}
            >
              {uploading && selectedImageType === 'user' ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <Image
                  source={
                    user?.avatar
                      ? { uri: user.avatar }
                      : require('../assets/avatar-default.png')
                  }
                  style={styles.profileImage}
                />
              )}
              <View style={styles.avatarEditBadge}>
                <Text style={{fontSize: 16, color: '#fff'}}>📷</Text>
              </View>
              <View style={styles.statusIndicator} />
            </TouchableOpacity>
            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.phone && (
              <Text style={styles.userInfo}>
                <Text style={{fontSize: 14}}>📞</Text> {user.phone}
              </Text>
            )}
            {user?.address && (
              <Text style={styles.userInfo}>
                <Text style={{fontSize: 14}}>📍</Text> {user.address}
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* Section Membres de la famille */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={{fontSize: 22}}>👨‍👩‍👧‍👦</Text> Ma Famille
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddMemberModal}
            >
              <Text style={{fontSize: 20, color: '#fff'}}>➕</Text>
              <Text style={styles.addButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {familyMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{fontSize: 60}}>👨‍👩‍👧‍👦</Text>
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
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          )}
        </View>

        {/* Section Recettes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={{fontSize: 22}}>🍳</Text> Mes recettes
          </Text>
          {userRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{fontSize: 40}}>🍽️</Text>
              <Text style={styles.emptyStateTitle}>Aucune recette créée</Text>
              <Text style={styles.emptyStateSubtitle}>
                Vous n'avez pas encore ajouté de recette.
              </Text>
            </View>
          ) : (
            <FlatList
              data={userRecipes}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: '#f8f8f8',
                  borderRadius: 12,
                  padding: 10,
                }}>
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : require('../assets/recipe-default.png')}
                    style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                    <Text numberOfLines={1} style={{ color: '#888', fontSize: 13 }}>{item.description}</Text>
                  </View>
                </View>
              )}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Bouton de déconnexion */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={{fontSize: 20, color: '#fff'}}>🚪</Text>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
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
                {editingMember ? 'Modifier le membre' : 'Ajouter un membre'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{fontSize: 24, color: '#7f8c8d'}}>✖️</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.avatarPickerContainer}>
                <TouchableOpacity
                  onPress={() => handleImagePicker('member')}
                  disabled={uploading && selectedImageType === 'member'}
                >
                  {uploading && selectedImageType === 'member' ? (
                    <View style={styles.avatarLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <Image
                      source={
                        memberForm.avatar
                          ? { uri: memberForm.avatar }
                          : require('../assets/avatar-default.png')
                      }
                      style={styles.modalAvatar}
                    />
                  )}
                  <View style={styles.avatarEditBadge}>
                    <Text style={{fontSize: 14, color: '#fff'}}>📷</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.avatarPickerText}>
                  {memberForm.avatar ? 'Changer la photo' : 'Ajouter une photo'}
                </Text>
              </View>

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
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relationContainer}
                >
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
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveMember}
                disabled={!memberForm.name || !memberForm.relation}
              >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    borderColor: '#fff',
    backgroundColor: '#e0e0e0',
  },
  avatarLoading: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
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
    color: '#2c3e50',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 6,
  },
  familyMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fcfcfc',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#A8DADC',
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
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#e0e0e0',
  },
  relationBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
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
    fontWeight: '700',
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
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#EBF5FB',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FDEDEC',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
    marginTop: 10,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 25,
    width: width - 40,
    maxHeight: '85%',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 25,
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
    marginBottom: 10,
  },
  avatarPickerText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 15,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fdfdfd',
    color: '#34495e',
  },
  relationContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingRight: 20,
  },
  relationChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#f0f2f5',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 10,
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
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: '#eef2f5',
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
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
export default ProfileScreen;

