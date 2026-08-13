/**
 * A modal voice list, grouped by language with the section headers coming from
 * the platform's own locale names. The trigger row shows the current pick.
 */

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import type { Voice } from 'expo-speech';
import { VoiceQuality } from 'expo-speech';
import { groupByLanguage } from '../speech/voices';
import type { Theme } from '../theme';

export function VoicePicker(props: {
  voices: Voice[];
  selected: Voice | null;
  onSelect: (voice: Voice) => void;
  theme: Theme;
  uiLang: string;
  labels: { heading: string; pick: string; none: string; enhanced: string; close: string; count: string };
}) {
  const { voices, selected, onSelect, theme, uiLang, labels } = props;
  const [open, setOpen] = useState(false);

  const sections = useMemo(
    () =>
      groupByLanguage(voices, uiLang).map((group) => ({
        title: `${group.label} (${group.voices.length})`,
        data: group.voices,
      })),
    [voices, uiLang]
  );

  if (!voices.length) {
    return <Text style={{ color: theme.inkFaint, fontSize: 14 }}>{labels.none}</Text>;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.pick}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: theme.lineStrong, backgroundColor: pressed ? theme.bgSunk : theme.surface },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.ink, fontSize: 15, fontWeight: '600' }}>
            {selected ? selected.name : labels.pick}
          </Text>
          {selected ? (
            <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 2 }}>
              {selected.language}
              {selected.quality === VoiceQuality.Enhanced ? `, ${labels.enhanced}` : ''}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: theme.inkFaint, fontSize: 12 }}>{labels.count}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
            <Text style={{ color: theme.ink, fontSize: 17, fontWeight: '700' }}>{labels.heading}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.close}
              onPress={() => setOpen(false)}
              style={styles.closeBtn}
            >
              <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '600' }}>{labels.close}</Text>
            </Pressable>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(voice) => voice.identifier}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <Text style={[styles.section, { color: theme.inkFaint, backgroundColor: theme.bg }]}>
                {section.title}
              </Text>
            )}
            renderItem={({ item }) => {
              const isSelected = selected?.identifier === item.identifier;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: isSelected ? theme.accentWash : pressed ? theme.bgSunk : theme.surface,
                      borderBottomColor: theme.line,
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: theme.ink, fontSize: 15 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: theme.inkFaint, fontSize: 12, marginTop: 1 }}>
                      {item.language}
                      {item.quality === VoiceQuality.Enhanced ? `, ${labels.enhanced}` : ''}
                    </Text>
                  </View>
                  {isSelected ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  sheet: { flex: 1 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
