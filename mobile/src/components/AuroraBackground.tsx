import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { Theme } from "../theme";

export function AuroraBackground({
  theme,
  reduceMotion = false
}: {
  theme: Theme;
  reduceMotion?: boolean;
}) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      phase.setValue(0.45);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 9000, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, reduceMotion]);

  const driftA = phase.interpolate({ inputRange: [0, 1], outputRange: [-24, 38] });
  const driftB = phase.interpolate({ inputRange: [0, 1], outputRange: [28, -32] });
  const scaleA = phase.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} />
      <Animated.View
        style={[
          styles.orb,
          styles.orbA,
          {
            backgroundColor: theme.primary,
            opacity: theme.bg === "#000000" ? 0.12 : 0.1,
            transform: [{ translateX: driftA }, { scale: scaleA }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbB,
          {
            backgroundColor: theme.cyan,
            opacity: theme.bg === "#000000" ? 0.08 : 0.065,
            transform: [{ translateX: driftB }]
          }
        ]}
      />
      <View style={[styles.topFade, { backgroundColor: theme.primary + "08" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180
  },
  orbA: { top: -185, left: -115 },
  orbB: { top: 110, right: -225 },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 150 }
});
