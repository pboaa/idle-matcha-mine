// アプリのバージョン表示用。ビルド時に vite.config の define で package.json の version が埋め込まれる。
// バージョンは固定（package.json を上げた時だけ変わる）。
declare const __APP_VERSION__: string;

/** package.json の version（例: 0.12.0）。 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
