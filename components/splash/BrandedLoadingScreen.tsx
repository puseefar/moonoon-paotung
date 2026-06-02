import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const splashLogo = require('../../assets/splash/logo-moonoon-paotung-splash.png');

const HORIZONTAL_PADDING = 24;
const VERTICAL_PADDING = 32;
const MAX_LOGO_SIZE = 380;
const MIN_LOGO_SIZE = 240;
const MAX_MESSAGE_WIDTH = 340;

type Props = {
  message?: string;
};

export function BrandedLoadingScreen({ message = 'กำลังเตรียมแอป...' }: Props) {
  const { width, height } = useWindowDimensions();

  const logoSize = Math.max(
    MIN_LOGO_SIZE,
    Math.min(width * 0.82, height * 0.42, MAX_LOGO_SIZE)
  );
  const messageWidth = Math.min(width - HORIZONTAL_PADDING * 2, MAX_MESSAGE_WIDTH);

  return (
    <View style={styles.root}>
      <Image
        source={splashLogo}
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
          },
        ]}
        resizeMode="contain"
      />

      <View style={[styles.messageCard, { width: messageWidth }]}>
        <ActivityIndicator size="small" color="#2362E1" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: VERTICAL_PADDING,
    gap: 28,
  },
  logo: {
    shadowColor: '#F287D0',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 10,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E7ECF4',
    shadowColor: '#2362E1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#2B3E73',
    textAlign: 'center',
    flexShrink: 1,
  },
});
