import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View
} from "react-native";
import type { Theme } from "../theme";

export function BottomSheet({
  visible,
  onClose,
  theme,
  children,
  maxHeight = "88%"
}: {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  children: React.ReactNode;
  maxHeight?: any;
}) {
  const y = useRef(new Animated.Value(500)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    y.setValue(500);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 210, mass: 0.9 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true })
    ]).start();
  }, [opacity, visible, y]);

  const close = () => {
    Animated.parallel([
      Animated.timing(y, { toValue: 480, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              maxHeight,
              transform: [{ translateY: y }]
            }
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.muted + "66" }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingBottom: 22,
    elevation: 32,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 }
  },
  handle: { width: 44, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 }
});
