/**
 * Small shared pieces: buttons and the transport glyphs. The glyphs are drawn
 * with plain Views (border triangles and bars) so the app needs no icon
 * library and no SVG dependency.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Theme } from '../theme';

const TAP = 44;

export function Btn(props: {
  label: string;
  onPress: () => void;
  theme: Theme;
  accent?: boolean;
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { label, onPress, theme, accent, small, disabled } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          minHeight: small ? 36 : TAP,
          borderColor: accent ? theme.accent : theme.lineStrong,
          backgroundColor: pressed ? theme.bgSunk : theme.surface,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: accent ? theme.accent : theme.ink,
          fontSize: small ? 13 : 15,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function RoundBtn(props: {
  glyph: 'play' | 'pause' | 'stop' | 'prev' | 'next';
  onPress: () => void;
  theme: Theme;
  primary?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { glyph, onPress, theme, primary, disabled } = props;
  const size = primary ? 64 : TAP;
  const ink = primary ? theme.accentInk : theme.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: primary ? theme.accent : theme.lineStrong,
          backgroundColor: primary ? theme.accent : pressed ? theme.bgSunk : theme.surface,
          opacity: disabled ? 0.4 : 1,
          transform: pressed && !disabled ? [{ scale: 0.96 }] : [],
        },
      ]}
    >
      <Glyph kind={glyph} color={ink} scale={primary ? 1.25 : 1} />
    </Pressable>
  );
}

/** Transport glyphs from bordered Views: triangle, bars, square. */
export function Glyph({ kind, color, scale = 1 }: { kind: string; color: string; scale?: number }) {
  const s = (n: number) => Math.round(n * scale);

  const triangle = (pointLeft: boolean): ViewStyle => ({
    width: 0,
    height: 0,
    borderTopWidth: s(7),
    borderBottomWidth: s(7),
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    ...(pointLeft
      ? { borderRightWidth: s(11), borderRightColor: color }
      : { borderLeftWidth: s(11), borderLeftColor: color }),
  });

  const bar: ViewStyle = {
    width: s(4),
    height: s(15),
    borderRadius: s(2),
    backgroundColor: color,
  };

  switch (kind) {
    case 'play':
      return <View style={[triangle(false), { marginLeft: s(3) }]} />;
    case 'pause':
      return (
        <View style={{ flexDirection: 'row', gap: s(4) }}>
          <View style={bar} />
          <View style={bar} />
        </View>
      );
    case 'stop':
      return <View style={{ width: s(14), height: s(14), borderRadius: s(3), backgroundColor: color }} />;
    case 'prev':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2) }}>
          <View style={[bar, { height: s(14) }]} />
          <View style={triangle(true)} />
        </View>
      );
    case 'next':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2) }}>
          <View style={triangle(false)} />
          <View style={[bar, { height: s(14) }]} />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  round: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
