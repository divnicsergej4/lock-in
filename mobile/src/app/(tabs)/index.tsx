import { Card, Screen, T } from '@/components/ui';
import { fmt } from '@/logic/format';
import { freeBalance } from '@/logic/money';
import { streakInfo, TIERS, tierIndex } from '@/logic/streak';
import { useStore } from '@/store/StoreProvider';
import { useTheme } from '@/theme';

// Skeleton: the real Home screen gets ported from the prototype in step 4.
export default function Home() {
  const { state } = useStore();
  const { c } = useTheme();
  const now = Date.now();
  const free = freeBalance(state);
  const streak = streakInfo(state, now).n;

  return (
    <Screen>
      <T variant="title">Home</T>
      <Card>
        <T variant="small">Available</T>
        <T variant="big" style={free < 0 ? { color: c.minus } : undefined}>
          {fmt(free)} {state.cur}
        </T>
      </Card>
      <Card>
        <T variant="h2">
          🔥 {streak} {streak === 1 ? 'day' : 'days'}
        </T>
        <T variant="small">{TIERS[tierIndex(streak)].name}</T>
      </Card>
    </Screen>
  );
}
