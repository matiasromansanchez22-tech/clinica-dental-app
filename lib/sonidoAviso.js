// Un "ding-dong" cortito generado con el navegador (sin archivo de audio
// que mantener) para llamar la atención cuando aparece un aviso grande en
// pantalla. Si el navegador bloquea el audio por no haber interacción
// previa del usuario, se ignora en silencio — el aviso visual igual se ve.
export function reproducirSonidoAviso() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    const contexto = new Contexto();
    const notas = [880, 1108];
    notas.forEach((frecuencia, i) => {
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = frecuencia;
      const inicio = contexto.currentTime + i * 0.16;
      ganancia.gain.setValueAtTime(0, inicio);
      ganancia.gain.linearRampToValueAtTime(0.25, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.001, inicio + 0.3);
      oscilador.connect(ganancia);
      ganancia.connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.32);
    });
    setTimeout(() => contexto.close().catch(() => {}), 800);
  } catch {
    // silencioso a propósito
  }
}

// Un arpegio cortito y alegre (Do-Mi-Sol-Do agudo) para festejar cuando
// se cierra una venta. Mismo criterio que reproducirSonidoAviso: si el
// navegador bloquea el audio, no rompe nada, solo no suena.
export function reproducirSonidoCelebracion() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    const contexto = new Contexto();
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((frecuencia, i) => {
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.type = "triangle";
      oscilador.frequency.value = frecuencia;
      const inicio = contexto.currentTime + i * 0.1;
      ganancia.gain.setValueAtTime(0, inicio);
      ganancia.gain.linearRampToValueAtTime(0.22, inicio + 0.015);
      ganancia.gain.exponentialRampToValueAtTime(0.001, inicio + 0.45);
      oscilador.connect(ganancia);
      ganancia.connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.46);
    });
    setTimeout(() => contexto.close().catch(() => {}), 1200);
  } catch {
    // silencioso a propósito
  }
}
