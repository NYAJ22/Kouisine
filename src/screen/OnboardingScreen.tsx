import React from 'react';
import {
  SafeAreaView,
  Image,
  StyleSheet,
  FlatList,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageSourcePropType,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';
//import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#f8f2e7',
  black: '#000',
} as const;

interface SlideItem {
  id: string;
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
}

interface SlideProps {
  item: SlideItem;
}

interface OnboardingScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

interface FooterProps {
  currentSlideIndex: number;
  skip: () => void;
  goToNextSlide: () => void;
  finishOnboarding: () => void;
}

const slides: SlideItem[] = [
  {
    id: '1',
    image: require('../assets/image1.png'),
    title: 'Bienvenue sur KOUISINE',
    subtitle: 'Gérez vos repas et vos courses facilement avec toute la famille.',
  },
  {
    id: '2',
    image: require('../assets/image2.png'),
    title: 'Planifiez vos menus',
    subtitle: 'Créez des menus adaptés selon les membres de votre foyer.',
  },
  {
    id: '3',
    image: require('../assets/image3.png'),
    title: 'Évitez le gaspillage',
    subtitle: 'Suivez votre stock, vos courses et votre budget efficacement.',
  },
];

const Slide: React.FC<SlideProps> = ({ item }) => {
  return (
    <View style={{ alignItems: 'center' }}>
      <Image
        source={item?.image}
        style={{ height: '75%', width, resizeMode: 'contain' }}
      />
      <View>
        <Text style={styles.title}>{item?.title}</Text>
        <Text style={styles.subtitle}>{item?.subtitle}</Text>
      </View>
    </View>
  );
};

const Footer: React.FC<FooterProps> = ({ currentSlideIndex, skip, goToNextSlide, finishOnboarding }) => {
  return (
    <View
      style={{
        height: height * 0.25,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
      }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 20,
        }}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[styles.indicator, currentSlideIndex === index && {
              backgroundColor: COLORS.black,
              width: 25,
            }]}
          />
        ))}
      </View>

      <View style={{ marginBottom: 20 }}>
        {currentSlideIndex === slides.length - 1 ? (
          <View style={{ height: 50 }}>
            <TouchableOpacity
              style={styles.btn}
              onPress={finishOnboarding}>
              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                COMMENCER
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btn, {
                borderColor: COLORS.black,
                borderWidth: 1,
                backgroundColor: 'transparent',
              }]}
              onPress={skip}>
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: COLORS.black }}>
                PASSER
              </Text>
            </TouchableOpacity>
            <View style={{ width: 15 }} />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goToNextSlide}
              style={styles.btn}>
              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                SUIVANT
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = React.useState<number>(0);
  const ref = React.useRef<FlatList<SlideItem>>(null);

  const updateCurrentSlideIndex = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentSlideIndex(currentIndex);
  };

  const goToNextSlide = (): void => {
    const nextSlideIndex = currentSlideIndex + 1;
    if (nextSlideIndex !== slides.length) {
      const offset = nextSlideIndex * width;
      ref?.current?.scrollToOffset({ offset });
      setCurrentSlideIndex(nextSlideIndex);
    }
  };

  const skip = (): void => {
    const lastSlideIndex = slides.length - 1;
    const offset = lastSlideIndex * width;
    ref?.current?.scrollToOffset({ offset });
    setCurrentSlideIndex(lastSlideIndex);
  };

  const finishOnboarding = async (): Promise<void> => {
    const uid = auth().currentUser?.uid;
    if (uid) {
      /*await firestore().collection('users').doc(uid).update({
        hasCompletedOnboarding: true,
      });*/
      navigation.replace('FamilySetup');
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.primary }}>
      <StatusBar backgroundColor={COLORS.primary} />
      <FlatList<SlideItem>
        ref={ref}
        onMomentumScrollEnd={updateCurrentSlideIndex}
        contentContainerStyle={{ height: height * 0.75 }}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={slides}
        pagingEnabled
        renderItem={({ item }) => <Slide item={item} />}
      />
      <Footer
        currentSlideIndex={currentSlideIndex}
        skip={skip}
        goToNextSlide={goToNextSlide}
        finishOnboarding={finishOnboarding}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    color: COLORS.black,
    fontSize: 13,
    marginTop: 10,
    maxWidth: '70%',
    textAlign: 'center',
    lineHeight: 23,
  },
  title: {
    color: COLORS.black,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  image: {
    height: '100%',
    width: '100%',
    resizeMode: 'contain',
  },
  indicator: {
    height: 2.5,
    width: 10,
    backgroundColor: 'grey',
    marginHorizontal: 3,
    borderRadius: 2,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OnboardingScreen;
