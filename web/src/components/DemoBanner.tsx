import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Persistent demo banner. Deliberately the *only* control for leaving the demo
 * — the header's sign-out icon is hidden while demoing — so "leave the demo"
 * and "sign out of a real session" never look like the same action.
 *
 * Exit is a plain navigation to `/`, out of the demo subtree; demo mode then
 * ends because it is re-derived from the URL. Nothing persisted, nothing to
 * flush.
 */
export function DemoBanner() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <p className="text-sm">
          <span className="font-semibold">Demo mode</span>
          <span className="opacity-90"> — sample data, nothing is saved.</span>
        </p>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Exit demo mode"
          onClick={() => navigate('/')}
        >
          Exit demo
        </Button>
      </div>
    </div>
  );
}
