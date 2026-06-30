// アプリのバージョン表示用（セーブ形式の VERSION とは別物）。ビルド時に vite.config の define で埋め込まれる。
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

/** package.json の version（例: 0.13.0）。 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
/** ビルド日時（UTC・例: 2026-06-30 12:34）。どのデプロイが反映されているか一目で分かる。 */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
