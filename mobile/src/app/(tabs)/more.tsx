// More (prototype tab 3): the monthly report, backup and Settings.

import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero } from '@/components/home/Hero';
import { KeyboardSpace } from '@/components/keyboard';
import { useTabPage } from '@/components/tabPage';
import { BackupFold } from '@/components/more/BackupFold';
import { ReportFold } from '@/components/more/ReportFold';
import { SettingsFold } from '@/components/more/SettingsFold';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { useTheme } from '@/theme';

export default function More() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { ref, anchor, top, onContentSizeChange } = useTabPage(3);
  // bottom padding: the tab bar sits over the content (prototype main padding-bottom 130px)
  return (
    <Animated.ScrollView
      ref={ref}
      onContentSizeChange={onContentSizeChange}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* the top of the content, for the guided tour's measurements */}
      <View ref={anchor} collapsable={false} />
      <TabEntrance index={3}>
        <Hero />
        <Sections>
          <ReportFold />
          <BackupFold />
          <SettingsFold />
        </Sections>
      </TabEntrance>
      <KeyboardSpace />
    </Animated.ScrollView>
  );
}
