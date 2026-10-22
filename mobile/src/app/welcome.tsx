// Intro for a new user: the character screen → three skippable slides → setup.
// (In the prototype the paywall and the guided tour come after setup; they are not built yet.)

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { IntroScreen } from '@/components/onboarding/IntroScreen';
import { SetupScreen } from '@/components/onboarding/SetupScreen';
import { Slides } from '@/components/onboarding/Slides';
import { Toast, useToast } from '@/components/onboarding/Toast';
import { completeSetup, type SetupInput } from '@/logic/setup';
import { useStore } from '@/store/StoreProvider';

export default function Welcome() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { state, update } = useStore();
  const toast = useToast();

  const start = (input: SetupInput) => {
    const r = completeSetup(state, input, Date.now());
    if (!r.ok) return toast.show(r.error);
    update(() => r.state);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f8f5' }}>
      <StatusBar style="dark" />
      {step === 1 && <IntroScreen onStart={() => setStep(2)} />}
      {step === 2 && <Slides onDone={() => setStep(3)} />}
      {step === 3 && <SetupScreen onStart={start} />}
      <Toast text={toast.text} />
    </View>
  );
}
