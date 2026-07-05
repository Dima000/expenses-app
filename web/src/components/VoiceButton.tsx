import * as React from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { parseAmountFromTranscript, UNCATEGORIZED, type Spending } from '@expenses/shared';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { createSpending, deleteSpending } from '@/lib/spendings';
import { todayString } from '@/lib/date';

interface VoiceButtonProps {
  ownerUid: string;
  /** Open the edit form for a just-saved entry (toast "Edit" action). */
  onEditRequest: (spending: Spending) => void;
  /** Auto-start listening on mount (PWA "Log by voice" shortcut, 8.3). */
  autoStart?: boolean;
}

/**
 * Mic button. Tap → speak → the utterance is parsed ("first number wins"),
 * saved fire-and-forget as `uncategorized`, and a correctable toast appears
 * with Undo and Edit (design.md D6). Hidden entirely where unsupported.
 */
export function VoiceButton({ ownerUid, onEditRequest, autoStart }: VoiceButtonProps) {
  const { supported, listening, start } = useSpeechRecognition();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const handleTranscript = React.useCallback(
    async (transcript: string) => {
      const { amount, comment, needsReview } = parseAmountFromTranscript(transcript);
      const date = todayString();
      // Never invent an amount: flag unparseable entries for review (spec 9.4).
      const input = {
        // Unparseable → store 0 and flag; the amber "?" + toast surface the fix.
        amount: needsReview ? 0 : (amount as number),
        date,
        comment,
        category: UNCATEGORIZED as typeof UNCATEGORIZED,
        needsReview,
      };
      setSaving(true);
      try {
        const id = await createSpending(input, ownerUid, 'voice');
        const saved: Spending = {
          id,
          ...input,
          ownerUid,
          source: 'voice',
          createdAtMs: null,
        };
        toast({
          title: needsReview
            ? "Couldn't catch the amount — saved for review"
            : `Logged ${input.amount} · uncategorized`,
          description: comment || undefined,
          action: (
            <div className="flex gap-2">
              <ToastAction altText="Undo" onClick={() => deleteSpending(id)}>
                Undo
              </ToastAction>
              <ToastAction altText="Edit" onClick={() => onEditRequest(saved)}>
                Edit
              </ToastAction>
            </div>
          ),
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Failed to log spending',
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [ownerUid, onEditRequest, toast],
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

  const busy = listening || saving;
  return (
    <Button
      size="lg"
      className="h-14 w-14 rounded-full p-0 shadow-lg"
      aria-label="Log spending by voice"
      disabled={busy}
      onClick={beginListening}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Mic />}
    </Button>
  );
}
