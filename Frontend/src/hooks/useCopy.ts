/**
 * Copy interaction.
 *
 * DESIGN.md §28 — subtle haptic on successful copy. DESIGN.md §17 — long
 * identifiers always get a copy action. Both the clipboard write and the
 * feedback are centralised so every copy affordance behaves identically.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { toast } from '@/stores/toast';

export type CopyState = 'idle' | 'copied' | 'failed';

export function useCopy(resetAfterMs = 1800) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (value: string, label?: string) => {
      try {
        await Clipboard.setStringAsync(value);
        setState('copied');
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        if (label) toast.success(`${label} copied`);
      } catch {
        // Never surface the raw clipboard failure; show an actionable message.
        setState('failed');
        toast.error('Could not copy to the clipboard');
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), resetAfterMs);
    },
    [resetAfterMs],
  );

  return { state, copy };
}