import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TotalCardProps {
  total: number;
  count: number;
}

/** Month-total card. Recomputes whenever the passed spendings change. */
export function TotalCard({ total, count }: TotalCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Month total</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{total.toLocaleString()}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {count} {count === 1 ? 'spending' : 'spendings'}
      </CardContent>
    </Card>
  );
}
