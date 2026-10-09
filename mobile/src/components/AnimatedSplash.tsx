import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 150 }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 1050);
    return () => clearTimeout(timer);
  }, [onDone, opacity, scale]);

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <View style={styles.glow} />
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <LottieView
          autoPlay
          loop={false}
          style={styles.lottie}
          source={require("../../assets/logo-reveal.json")}
        />
        <Text style={styles.brand}>UID <Text style={styles.blue}>2.O</Text></Text>
        <Text style={styles.sub}>CYBER MINIMAL</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#168cff",
    opacity: 0.08
  },
  lottie: { width: 154, height: 154 },
  brand: { color: "#f4fbff", fontSize: 27, fontWeight: "900", letterSpacing: -0.8, marginTop: -10 },
  blue: { color: "#39a7ff" },
  sub: { color: "#526681", fontSize: 9, fontWeight: "800", letterSpacing: 3, marginTop: 7 }
});
