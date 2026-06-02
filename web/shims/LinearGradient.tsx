import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

type Point = {
  x?: number;
  y?: number;
};

type LinearGradientProps = ViewProps & {
  colors: string[];
  locations?: number[];
  start?: Point;
  end?: Point;
  useAngle?: boolean;
  angle?: number;
  angleCenter?: Point;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

function toCssAngle(start?: Point, end?: Point, useAngle?: boolean, angle?: number) {
  if (useAngle && typeof angle === 'number') {
    return `${angle}deg`;
  }

  const startX = start?.x ?? 0.5;
  const startY = start?.y ?? 0;
  const endX = end?.x ?? 0.5;
  const endY = end?.y ?? 1;
  const radians = Math.atan2(endY - startY, endX - startX);
  return `${90 - (radians * 180) / Math.PI}deg`;
}

function buildGradient(colors: string[], locations?: number[], start?: Point, end?: Point, useAngle?: boolean, angle?: number) {
  if (!colors.length) {
    return undefined;
  }

  const angleValue = toCssAngle(start, end, useAngle, angle);
  const stops = colors.map((color, index) => {
    const location = locations?.[index];
    return typeof location === 'number' ? `${color} ${Math.round(location * 100)}%` : color;
  });

  return `linear-gradient(${angleValue}, ${stops.join(', ')})`;
}

export function LinearGradient({
  colors,
  locations,
  start,
  end,
  useAngle,
  angle,
  style,
  children,
  ...rest
}: LinearGradientProps) {
  const gradient = buildGradient(colors, locations, start, end, useAngle, angle);
  const backgroundColor = colors[0] ?? 'transparent';

  return (
    <View {...rest} style={style}>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor,
            backgroundImage: gradient,
            pointerEvents: 'none',
          } as ViewStyle,
        ]}
      />
      {children}
    </View>
  );
}

export default LinearGradient;
