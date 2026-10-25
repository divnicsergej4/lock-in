// "Monthly report" (prototype section[data-fold=rep]): spent this month vs last, the biggest category,
// what's left of the income, and the verdict.

import { StyleSheet, Text, View } from 'react-native';

import { InlineIcon } from '@/components/CategoryIcon';
import { Fold, Small } from '@/components/home/Section';
import { categoryColor } from '@/logic/categories';
import { monthReport, REPORT_EMPTY } from '@/logic/report';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

export function ReportFold() {
  const { state } = useStore();
  const { c, name } = useTheme();
  const r = monthReport(state, Date.now());
  const [before, after] = r ? [r.top.slice(0, 'Most goes to '.length), r.top.slice('Most goes to '.length)] : ['', ''];
  return (
    <Fold id="rep" title="Monthly report" tourId="rep">
      {r ? (
        <View style={[st.tip, { backgroundColor: name === 'light' ? '#f3f6f4' : c.tipBg, borderColor: c.line }]}>
          <Text style={[st.t, { color: c.ink }]}>
            {r.spent + '\n' + before}
            {/* .ei: 1.15em icon, vertical-align -.22em; kept short so it doesn't make the line taller */}
            <View style={{ width: 16.92, height: 12 }}>
              <View style={{ position: 'absolute', left: 0, bottom: -14.72 * 0.22 }}>
                <InlineIcon cat={r.topCat} color={categoryColor(state, r.topCat)} size={16.92} mix={c.iconMix} />
              </View>
            </View>
            {' ' + after}
            {r.left ? '\n' + r.left : ''}
            {'\n' + r.verdict}
          </Text>
        </View>
      ) : (
        <Small style={{ marginTop: 0.8, marginBottom: 12.8 }}>{REPORT_EMPTY}</Small>
      )}
    </Fold>
  );
}

const st = StyleSheet.create({
  tip: { padding: 12, borderWidth: 1, borderRadius: 14 },
  t: { fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
