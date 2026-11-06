// Podešavanja kvaliteta grafike. Igra sama spusti kvalitet ako telefon ne stiže 60 slika u sekundi.
export const QUALITY_LEVELS = [
  { name: 'nisko', shadows: false, shadowMap: 512, particles: 0.5, dust: false, ambient: false },
  { name: 'srednje', shadows: true, shadowMap: 1024, particles: 0.75, dust: true, ambient: false },
  { name: 'visoko', shadows: true, shadowMap: 1024, particles: 1, dust: true, ambient: true },
];

// Prati koliko traje jedna slika i javlja kad treba smanjiti kvalitet.
export class FrameMonitor {
  constructor() {
    this.samples = [];
    this.cooldown = 3; // sekunde pre prvog merenja (dok se sve učita)
  }

  // vraća true ako je igra spora i treba spustiti kvalitet
  push(dt) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return false;
    }
    this.samples.push(dt);
    if (this.samples.length < 120) return false;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (avg > 1 / 42) {
      this.cooldown = 3;
      return true;
    }
    return false;
  }
}
