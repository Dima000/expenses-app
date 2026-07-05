import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';

/** Signed-out gate: shown when unauthenticated, with no spending data. */
export function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Expenses</CardTitle>
          <CardDescription>Sign in to view and log your spending.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onSignIn}>
            <LogIn className="mr-2" /> Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
