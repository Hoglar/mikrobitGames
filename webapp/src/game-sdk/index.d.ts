export type Score = Readonly<Record<string, number>>;
export type Unsubscribe = () => void;
export interface InputState {
  readonly connection: 'connected' | 'connecting' | 'disconnected';
  readonly inputAvailable: boolean;
  readonly board: 'microbit-v2' | null;
  readonly buttons: {readonly aPressed: boolean; readonly bPressed: boolean};
  readonly tilt: {readonly x: number; readonly y: number};
  readonly accelerometer: null | {readonly xMg: number; readonly yMg: number; readonly zMg: number; readonly strengthMg: number; readonly gesture: 'shake' | null};
  readonly temperatureC: number | null;
  readonly lightLevel: number | null;
  readonly microphone: null | {readonly soundLevel: number; readonly soundEvent: 'quiet' | 'loud'};
  readonly touch: {readonly logoPressed: boolean | null};
}
export interface Viewport {width: number; height: number; pixelRatio: number}
export interface GameController {
  update(seconds: number): void;
  render(context: CanvasRenderingContext2D, viewport: Viewport): void;
  onPause?(reason: string): void;
  onResume?(): void;
  onResize?(viewport: Viewport): void;
  dispose?(): void | Promise<void>;
}
export interface GameRecord {rank?: number; name?: string; score: Score; formattedScore?: string; recordedAt?: string; isCurrentPlayer?: boolean}
export interface LeaderboardPage {scope: 'local' | 'online'; boardKey: string; items: GameRecord[]; page: number; pageSize: number; total: number}
export interface SaveState {state: 'idle' | 'awaiting-name' | 'saving' | 'saved' | 'skipped' | 'unconfirmed' | 'conflict'; outcome?: string; currentRecord?: unknown; error?: {message: string}}
export type Setting = {id: string; label: string; type: 'toggle'; defaultValue: boolean} | {id: string; label: string; type: 'range'; defaultValue: number; min: number; max: number; step: number};
export interface GameContext {
  readonly canvas: HTMLCanvasElement;
  readonly round: {
    readonly id: string; readonly modeId: string; readonly rulesVersion: number;
    readonly config: Readonly<Record<string, unknown>>; readonly seed: string;
    readonly storage: 'local' | 'online' | 'none'; readonly phase: string; readonly elapsedMs: number;
    requestPause(): void; onPhase(callback: (phase: string) => void): Unsubscribe;
  };
  readonly input: {
    getState(): InputState;
    subscribe(callback: (state: InputState) => void): Unsubscribe;
    onPress(callback: (event: {input: 'a' | 'b' | 'logo'; count: number}) => void): Unsubscribe;
    onGesture(callback: (gesture: 'shake') => void): Unsubscribe;
  };
  readonly device: {
    readonly capabilities: Readonly<Record<string, unknown>> | null;
    readonly display: {showText(text: string): Promise<void>; showImage(pixels: number[]): Promise<void>; clear(): Promise<void>};
    readonly speaker: {
      playTone(tone: {frequencyHz: number; durationMs: number; volume?: number}): Promise<void>;
      playMelody(melody: {notes: {frequencyHz: number; durationMs: number}[]; volume?: number}): Promise<void>;
      playBuiltInSound(name: string): Promise<void>; stop(): Promise<void>;
    };
  };
  readonly scores: {
    finish(result: {status: 'completed' | 'incomplete'; score: Score | null; resultText?: string}): Promise<{attemptId: string; status: string; eligible: boolean; score: Score | null}>;
    getLeaderboard(options?: {scope?: 'local' | 'online'; page?: number; pageSize?: number}): Promise<LeaderboardPage>;
    getPersonalBest(): Promise<GameRecord | null>;
    format(score: Score): string; compare(a: Score, b: Score): -1 | 0 | 1;
    decode(value: number): Score;
    subscribe(callback: (state: SaveState) => void): Unsubscribe;
  };
  readonly assets: {url(path: string): Promise<string>; readText(path: string): Promise<string>; readJson(path: string): Promise<unknown>};
  readonly ui: {
    setStatus(text: string): void; setHelp(text: string): void; requestFullscreen(): Promise<void>;
    addSetting(setting: Setting, onChange: (value: number | boolean) => void): Unsubscribe;
    addPauseAction(action: {id: string; label: string; confirmText?: string; resumeAfter?: boolean}, handler: () => void | Promise<void>): Unsubscribe;
  };
  readonly audio: {
    /** Shared toolbar preference. Browser audio applies volume; device volume is scaled by the host. */
    getSettings(): Readonly<{enabled: boolean; volume: number}>;
    subscribe(callback: (settings: Readonly<{enabled: boolean; volume: number}>) => void): Unsubscribe;
    onUnlock(callback: () => void): Unsubscribe;
    unlock(): Promise<void>; registerCleanup(callback: () => void): Unsubscribe;
  };
  readonly random: {next(): number};
}
export function defineGame(factory: (context: GameContext) => GameController | Promise<GameController>, options?: {stepHz?: 30 | 60 | 120}): {factory: typeof factory; stepHz: number};
/** Migration utility; new games should implement GameController directly. */
export function adaptEngine(context: GameContext, create: (options: any) => any, options?: Record<string, any>): GameController;
