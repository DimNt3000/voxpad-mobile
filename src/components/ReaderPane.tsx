/**
 * Renders the text as tappable sentences and keeps the highlight in sync.
 *
 * The text is grouped into paragraphs (chunks never cross a hard line break,
 * the segmenter guarantees that), each paragraph is one flowing <Text> of
 * sentence spans, and every paragraph View reports its y offset so the list
 * can auto scroll to the active sentence. Only the active sentence re-renders
 * on a word boundary, everything else is memoised by reference.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Chunk } from '../core/segmenter';
import type { Theme } from '../theme';

export interface WordRange {
  index: number;
  charIndex: number;
  charLength: number;
}

interface Paragraph {
  key: string;
  chunks: Array<{ chunk: Chunk; index: number }>;
}

function toParagraphs(text: string, chunks: Chunk[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: Paragraph | null = null;
  let lastEnd = 0;

  chunks.forEach((chunk, index) => {
    const gap = text.slice(lastEnd, chunk.start);
    if (current === null || gap.includes('\n')) {
      current = { key: `p${paragraphs.length}`, chunks: [] };
      paragraphs.push(current);
    }
    current.chunks.push({ chunk, index });
    lastEnd = chunk.end;
  });
  return paragraphs;
}

export function ReaderPane(props: {
  text: string;
  chunks: Chunk[];
  activeIndex: number;
  word: WordRange | null;
  onSentencePress: (index: number) => void;
  theme: Theme;
  emptyMessage: string;
  hint: string;
}) {
  const { text, chunks, activeIndex, word, onSentencePress, theme } = props;

  const paragraphs = useMemo(() => toParagraphs(text, chunks), [text, chunks]);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Map<string, number>>(new Map());

  /** Paragraph containing the active sentence, for auto scroll. */
  const activeParagraph = useMemo(() => {
    if (activeIndex < 0) return null;
    return paragraphs.find((p) => p.chunks.some((c) => c.index === activeIndex)) ?? null;
  }, [paragraphs, activeIndex]);

  useEffect(() => {
    if (!activeParagraph) return;
    const y = offsets.current.get(activeParagraph.key);
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }, [activeParagraph]);

  if (!chunks.length) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: theme.inkFaint, fontSize: 15, lineHeight: 22 }}>{props.emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
      {paragraphs.map((paragraph) => (
        <View
          key={paragraph.key}
          onLayout={(e) => offsets.current.set(paragraph.key, e.nativeEvent.layout.y)}
          style={styles.paragraph}
        >
          <Text style={[styles.body, { color: theme.ink }]}>
            {paragraph.chunks.map(({ chunk, index }, i) => (
              <React.Fragment key={index}>
                {i > 0 ? ' ' : null}
                <Sentence
                  chunk={chunk}
                  state={index === activeIndex ? 'active' : activeIndex >= 0 && index < activeIndex ? 'done' : 'idle'}
                  word={word && word.index === index ? word : null}
                  onPress={() => onSentencePress(index)}
                  theme={theme}
                />
              </React.Fragment>
            ))}
          </Text>
        </View>
      ))}
      <Text style={[styles.hint, { color: theme.inkFaint }]}>{props.hint}</Text>
    </ScrollView>
  );
}

const Sentence = React.memo(function Sentence(props: {
  chunk: Chunk;
  state: 'idle' | 'active' | 'done';
  word: WordRange | null;
  onPress: () => void;
  theme: Theme;
}) {
  const { chunk, state, word, onPress, theme } = props;
  const base = {
    backgroundColor: state === 'active' ? theme.hlSentence : 'transparent',
    color: state === 'done' ? theme.inkFaint : theme.ink,
  };

  if (state !== 'active' || !word) {
    return (
      <Text suppressHighlighting onPress={onPress} style={base}>
        {chunk.text}
      </Text>
    );
  }

  const start = Math.max(0, Math.min(word.charIndex, chunk.text.length));
  const end = Math.min(chunk.text.length, start + word.charLength);
  return (
    <Text suppressHighlighting onPress={onPress} style={base}>
      {chunk.text.slice(0, start)}
      <Text style={{ backgroundColor: theme.hlWord, color: theme.hlWordInk }}>
        {chunk.text.slice(start, end)}
      </Text>
      {chunk.text.slice(end)}
    </Text>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  paragraph: { marginBottom: 14 },
  body: { fontSize: 19, lineHeight: 32 },
  empty: { padding: 16 },
  hint: { fontSize: 13, marginTop: 10, lineHeight: 19 },
});
