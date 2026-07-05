import * as React from 'react';

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser exposes the Web Speech API (design.md D3). */
export const isSpeechRecognitionSupported = (): boolean => getRecognitionCtor() !== null;

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  /** Start a single-shot recognition; resolves the callback with the transcript. */
  start(onResult: (transcript: string) => void, onError?: (err: string) => void): void;
  stop(): void;
}

/**
 * Single-shot speech recognition. When unsupported, `supported` is false and
 * callers hide/disable the mic; the manual add form remains the fallback.
 */
export function useSpeechRecognition(): UseSpeechRecognition {
  const supported = React.useMemo(isSpeechRecognitionSupported, []);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = React.useCallback(
    (onResult: (transcript: string) => void, onError?: (err: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        onError?.('unsupported');
        return;
      }
      const recognition = new Ctor();
      recognitionRef.current = recognition;
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (e) => {
        const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
          .join(' ')
          .trim();
        onResult(transcript);
      };
      recognition.onerror = (e) => {
        setListening(false);
        onError?.(e.error);
      };
      recognition.onend = () => setListening(false);

      setListening(true);
      recognition.start();
    },
    [],
  );

  React.useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
