/**
 * Rate, pitch and volume sliders plus the speed presets. Values are committed
 * to the engine on release, not on every tick, so a drag does not restart the
 * current sentence dozens of times; the numeric readout still follows the
 * finger live through local preview state.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Btn } from './ui';
import type { Theme } from '../theme';

type SliderKey = 'rate' | 'pitch' | 'volume';

interface SliderSpec {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

export function DeliveryControls(props: {
  rate: number;
  pitch: number;
  volume: number;
  onCommit: (key: SliderKey, value: number) => void;
  onPreset: (rate: number) => void;
  onReset: () => void;
  theme: Theme;
  labels: {
    rate: string;
    pitch: string;
    volume: string;
    slow: string;
    normal: string;
    brisk: string;
    reset: string;
  };
}) {
  const { theme, labels } = props;
  const [preview, setPreview] = useState<{ key: SliderKey; value: number } | null>(null);

  const sliders: SliderSpec[] = [
    { key: 'rate', label: labels.rate, min: 0.5, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}x` },
    { key: 'pitch', label: labels.pitch, min: 0.5, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
    { key: 'volume', label: labels.volume, min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  ];

  return (
    <View style={styles.wrap}>
      {sliders.map((spec) => {
        const value = props[spec.key];
        const shown = preview && preview.key === spec.key ? preview.value : value;
        return (
          <View key={spec.key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.inkSoft }]}>{spec.label}</Text>
              <Text style={[styles.value, { color: theme.inkFaint }]}>{spec.format(shown)}</Text>
            </View>
            <Slider
              accessibilityLabel={spec.label}
              minimumValue={spec.min}
              maximumValue={spec.max}
              step={spec.step}
              value={value}
              onValueChange={(v) => setPreview({ key: spec.key, value: v })}
              onSlidingComplete={(v) => {
                setPreview(null);
                props.onCommit(spec.key, v);
              }}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.line}
              thumbTintColor={theme.accent}
              style={styles.slider}
            />
          </View>
        );
      })}

      <View style={styles.presets}>
        <Btn small theme={theme} label={labels.slow} onPress={() => props.onPreset(0.8)} />
        <Btn small theme={theme} label={labels.normal} onPress={() => props.onPreset(1)} />
        <Btn small theme={theme} label={labels.brisk} onPress={() => props.onPreset(1.35)} />
        <Btn small theme={theme} label={labels.reset} onPress={props.onReset} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { gap: 2 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 14, fontWeight: '600' },
  value: { fontSize: 13, fontVariant: ['tabular-nums'] },
  slider: { width: '100%', height: 36 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
