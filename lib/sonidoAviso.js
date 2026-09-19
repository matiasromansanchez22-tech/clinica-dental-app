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
