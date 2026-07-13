import * as React from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { parseAmountFromTranscript } from '@expenses/shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

/** Parsed voice values used to prefill the review form (nothing saved yet). */
export interface VoiceCapture {
  amount: string;
  comment: string;
}

interface VoiceButtonProps {
  /**
   * Called with the parsed values so the caller can open the add form prefilled
   * for review. Nothing is written until the owner saves that form.
   */
  onCapture: (capture: VoiceCapture) => void;
  /** Auto-start listening on mount (PWA "Log by voice" shortcut, 8.3). */
  autoStart?: boolean;
}

/**
 * Mic button. Tap → speak → the utterance is parsed ("first number wins") and the
 * add/edit form opens prefilled for review (design.md B1). Nothing is saved on
 * transcription; the owner reviews, edits, and commits from the form. Hidden
 * entirely where speech recognition is unsupported.
 */
export function VoiceButton({ onCapture, autoStart }: VoiceButtonProps) {
  const { supported, listening, start } = useSpeechRecognition();
  const { toast } = useToast();

  const handleTranscript = React.useCallback(
    (transcript: string) => {
      const { amount, comment, needsReview } = parseAmountFromTranscript(transcript);
      // Never invent an amount: leave it blank for the owner to fill in the form.
      onCapture({ amount: needsReview ? '' : String(amount), comment });
    },
    [onCapture],
  );

  const beginListening = React.useCallback(() => {
    start(handleTranscript, (err) => {
      if (err !== 'no-speech' && err !== 'aborted') {
        toast({ variant: 'destructive', title: 'Voice capture error', description: err });
      }
    });
  }, [start, handleTranscript, toast]);

  // PWA "Log by voice" shortcut opens straight into listening.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (autoStart && supported && !started.current) {
      started.current = true;
      beginListening();
    }
  }, [autoStart, supported, beginListening]);

  if (!supported) return null;

  return (
    <Button
      size="lg"
      className="h-14 w-14 rounded-full p-0 shadow-lg"
      aria-label="Log spending by voice"
      disabled={listening}
      onClick={beginListening}
    >
      {listening ? <Loader2 className="animate-spin" /> : <Mic />}
    </Button>
  );
}
