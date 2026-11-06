import { StatusBar } from 'expo-status-bar';
import GameScreen from './src/ui/GameScreen.js';

export default function App() {
  return (
    <>
      <GameScreen />
      <StatusBar style="light" hidden />
    </>
  );
}
