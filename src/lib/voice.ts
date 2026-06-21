/**
 * Lectura por voz con la Web Speech API del navegador (SPECS_V3.5 §7), para
 * preparar la salida sin mirar la pantalla. Offline (voz del sistema). Degrada
 * si el navegador no la soporta.
 */

export function isSpeechSupported(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Lee el texto en voz alta (cancela lo anterior). */
export function speak(text: string, lang = 'es-ES'): void {
	if (!isSpeechSupported()) return;
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = lang;
	window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
	if (isSpeechSupported()) window.speechSynthesis.cancel();
}
